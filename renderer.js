import { parseGrf, solveEquilibrium, placeNailedNodes, randomizeFreeNodes, setupGraphForTiling, rubberBandStepNodes } from "./graph.js";

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

function positionContextMenu(menu, x, y) {
  let menuRect = menu.getBoundingClientRect();
  let left = x;
  let top = y;
  if (x + menuRect.width > window.innerWidth) {
    left = Math.max(0, x - menuRect.width);
  }
  if (y + menuRect.height > window.innerHeight) {
    top = Math.max(0, y - menuRect.height);
  }
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}


class GraphRenderer {
  graph = null;
  squareTiling = null;
  lastTimeoutId = null;
  mode = "attract";
  editMode = null; // "editing", "edges", "manual-move", "rubber-band-move" or null
  showGraph = true;
  morphStage = 0;
  grabbedNodeId = null;

  constructor(container, settings) {
    this.settings = settings;
    this.svg = SVG().addTo(container).size("100%", "100%");
    this.outerGroup = this.svg.group();
    this.innerGroup = this.outerGroup.group();
    this.tilingGroup = this.innerGroup.group();
    this.morphGroup = this.innerGroup.group();
    this.newEdgeLine = this.innerGroup.line(0, 0, 0, 0)
      .stroke({ width: this.settings.edges.width, 
                color: this.settings.edges.color, 
                opacity: 0 });
    this.graphGroup = this.innerGroup.group();
    this.edgesGroup = this.graphGroup.group();
    this.nodesGroup = this.graphGroup.group();
    let width = this.svg.node.clientWidth;
    let height = this.svg.node.clientHeight;
    console.log(width, height);
    let scale = Math.min(width, height) / 2 * 0.9;
    this.outerGroup.transform({
      scale: [scale, -scale],
      translateX: width / 2,
      translateY: height / 2
    });

    // Bind onMouseMove once for consistent add/removeEventListener
    this.boundOnMouseMove = this.onMouseMove.bind(this);

    // Context menu setup
    this.svgContextMenu = this.getSvgContextMenu();
    this.nodeContextMenu = this.getNodeContextMenu();
    this.edgeContextMenu = this.getEdgeContextMenu();
    document.addEventListener('click', () => {
      console.log("document click");
      this.hideNodeContextMenu();
      this.hideSvgContextMenu();
      this.hideEdgeContextMenu();
    });

    this.svg.node.addEventListener("contextmenu", (e) => {
      // Only show if not on a node (let node context menu take precedence)
      if (e.target === this.svg.node) {
        e.preventDefault();
        this.showSvgContextMenu(e.clientX, e.clientY, e.offsetX, e.offsetY);
      }
    });

    this.svg.node.addEventListener("mouseup", (e) => {
      this.grabbedNodeId = null;
    });

    this.svg.node.addEventListener("mousemove",
      (ev) => {
        if (this.grabbedNodeId != null && 
            (this.editMode === "manual-move" || this.editMode === "rubber-band-move")) {
          let node = this.graph.getNode(this.grabbedNodeId);
          //if ((this.x2ex(node.x) == e.offsetX) && (this.y2ey(node.y) == e.offsetY)) { console.log("kihagy"); }
          node.x = this.ex2x(ev.offsetX);
          node.y = this.ey2y(ev.offsetY);
          if (this.editMode === "rubber-band-move") {
            solveEquilibrium(this.graph, this.grabbedNodeId);
          }
          this.updatePositions();          
        }
      }
    );
  }

  reset() {
    this.clearAll();
    this.setGraph(null);
    this.setSquareTiling(null);
    this.lastTimeoutId = null;
    this.mode = "attract";
    this.editMode = null;
    this.showGraph = true;
    this.morphStage = 0;
    this.grabbedNodeId = null;
  }

  loadGraph(url, callback, topicName="") {
    console.log("loadGraph");
    this.clearAll();
    this.setGraph(null);
    this.setSquareTiling(null);
    parseGrf(url, (graph) => {
      if (topicName == "SquareTiling") {
        setupGraphForTiling(graph);
      }
      else {
        placeNailedNodes(graph);
      }
      randomizeFreeNodes(graph);
      this.setGraph(graph);
      this.createSvg();

      if (callback)
        callback(graph);
    })
  }

  resetInnerGroupScale() {
    this.innerGroup.transform({ scale: [1, 1] });
  }

  setGraph(graph) {
    this.graph = graph;
    this.resetInnerGroupScale();
  }

  clearAll() {
    clearTimeout(this.lastTimeoutId);
    this.edgesGroup.clear();
    this.nodesGroup.clear();
    this.tilingGroup.clear();
    this.morphGroup.clear();
  }

  refreshInfo() {
    document.getElementById('num-vertices').innerHTML = this.graph.nodeCount();
    document.getElementById('num-edges').innerHTML = this.graph.edgeCount();  
  }

  createSvg() {
    this.clearAll();
    this.renderSquareTiling();
    if (this.showGraph) {
      this.createGraphSvg();
    }
  }

  // TODO handle scaling in innerGroup
  ex2x(ex) {
    return ((ex - this.outerGroup.transform('translateX')) / -this.outerGroup.transform('scaleX'));
  }

  ey2y(ey) {
    return ((ey - this.outerGroup.transform('translateY')) / -this.outerGroup.transform('scaleY'));
  }

  x2ex(x) {
    return (-x * this.outerGroup.transform('scaleX') + this.outerGroup.transform('translateX'));
  }

  y2ey(y) {
    return (-y * this.outerGroup.transform('scaleY') + this.outerGroup.transform('translateY'));
  }

  addNode(ex, ey) {
    let newNode = this.graph.addNode({x: this.ex2x(ex), y: this.ey2y(ey)});
    this.refreshInfo();
    this.createNodeSvg(newNode);
    return newNode;
  }

  onMouseDown(ev, node) {
    console.log("node mousedown, edit mode: ", this.editMode);
    this.grabbedNodeId = node.id;
    if (this.editMode === "edges") {
      this.svg.node.addEventListener("mousemove", this.boundOnMouseMove);
      document.addEventListener("mouseup", this.onMouseUp.bind(this), { once: true });
    }
  }

  onMouseUpOnNode(ev, node) {
    console.log("node mouseup");
    this.svg.node.removeEventListener("mousemove", this.boundOnMouseMove);
    if (this.grabbedNodeId) {
      node.group.node.classList.remove("grabbing");
      if (this.editMode === "edges") {
        if (this.grabbedNodeId != null && this.grabbedNodeId != node.id) {
          let newEdge = { from: this.grabbedNodeId, to: node.id, weight: 1 };
          this.graph.addEdge(newEdge);
          this.refreshInfo();
          this.createEdgeSvg(newEdge);
        }
      }
      else if (this.editMode === "rubber-band-move") {
        this.rubberBandStep();
      }
      this.newEdgeLine.stroke({ opacity: 0 });
      this.grabbedNodeId = null;
    }
  }

  onMouseUp(ev) {
    console.log("mouseup");
    this.svg.node.removeEventListener("mousemove", this.boundOnMouseMove);
    if (this.grabbedNodeId) {
      if (this.editMode === "edges") {
        this.newEdgeLine.stroke({ opacity: 0 });
      }
      this.grabbedNodeId = null;
    }
  }

  onMouseMove(ev) {
    console.log("mousemove");
    if (this.grabbedNodeId != null && this.editMode === "edges") {
      let node = this.graph.getNode(this.grabbedNodeId);
      this.newEdgeLine.plot(node.x, node.y, this.ex2x(ev.offsetX), this.ey2y(ev.offsetY));
      this.newEdgeLine.stroke({ opacity: 1 });
    }
  }

  getSvgContextMenu() {
    return document.getElementById('svg-context-menu');
  }

  showSvgContextMenu(x, y, ex, ey) {
    if (this.editMode === null) return;
    let addButton = this.svgContextMenu.querySelector('#svg-add-node-button');
    addButton.onclick = (e) => {
      e.stopPropagation();
      let newNode = this.addNode(ex, ey);
      this.createNodeSvg(newNode);
      this.hideSvgContextMenu();
    };
    this.svgContextMenu.style.display = 'block';
    positionContextMenu(this.svgContextMenu, x, y);
  }

  hideSvgContextMenu() {
    this.svgContextMenu.style.display = 'none';
  }
  
  getNodeContextMenu() {
    const menu = document.getElementById('node-context-menu');
    const colorDropdown = document.getElementById('node-color-dropdown');
    // Add options from settings.colors
    if (this.settings.colors) {
      for (const [name, hex] of this.settings.colors.entries()) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        option.style.backgroundColor = hex;
        option.style.color = (name === "Black" || name === "Dark blue" || name === "Brown") ? "white" : "black";
        option.style.margin = '2px';
        colorDropdown.appendChild(option);
      }
    }
    // Prevent menu from closing when interacting with dropdown
    colorDropdown.addEventListener('click', (ev) => {
      ev.stopPropagation();
    });

    return menu;
  }

  showNodeContextMenu(x, y, node) {
    if (this.editMode === null) return;
    let deleteNodeButton = this.nodeContextMenu.querySelector('#delete-node-button');
    deleteNodeButton.onclick = (ev) => {
      ev.stopPropagation();
      node.group.remove();
      this.graph.forEachEdgeAt(node.id, (edge) => {
        edge.group.remove();
      });
      this.graph.deleteNode(node);
      this.refreshInfo();
      this.hideNodeContextMenu();
    };

    let toggleNailButton = this.nodeContextMenu.querySelector('#toggle-nailed-button');
    let textSpan = toggleNailButton.querySelector('span');
    textSpan.textContent = node.nailed ? 'Unnail Node' : 'Nail Node';
    let pinIcon = toggleNailButton.querySelector('.menu-icon');
    pinIcon.src = node.nailed ? 'assets/unpin-line.svg' : 'assets/pushpin-line.svg';
    toggleNailButton.onclick = (ev) => {
      ev.stopPropagation();
      if (node.nailed) {
        node.nailed = false;
        textSpan.textContent = 'Nail Node';
        pinIcon.src = 'assets/pushpin-line.svg';
      } else {
        node.nailed = true;
        textSpan.textContent = 'Unnail Node';
        pinIcon.src = 'assets/unpin-line.svg';
      }
      this.refreshInfo();
      this.createNodeSvg(node);
    };
    
    // Color Dropdown
    let colorDropdown = this.nodeContextMenu.querySelector('#node-color-dropdown');
    colorDropdown.value = node.color;
    colorDropdown.onchange = (ev) => {
      node.color = colorDropdown.value;
      this.refreshInfo();
      this.createNodeSvg(node);
    };

    this.nodeContextMenu.style.display = 'block';
    positionContextMenu(this.nodeContextMenu, x, y);
  }

  hideNodeContextMenu() {
    this.nodeContextMenu.style.display = 'none';
  }

  getEdgeContextMenu() {
    return document.getElementById('edge-context-menu');
  }

  showEdgeContextMenu(clientX, clientY, offsetX, offsetY, edge) {
    if (this.editMode === null) return;
    let deleteButton = this.edgeContextMenu.querySelector('#delete-edge-button');
    deleteButton.onclick = (ev) => {
      ev.stopPropagation();
      this.graph.deleteEdge(edge);
      this.refreshInfo();
      edge.group.remove();
      this.hideEdgeContextMenu();
    };
    let splitNodeButton = this.edgeContextMenu.querySelector('#split-node-button');
    splitNodeButton.onclick = (ev) => {
      ev.stopPropagation();
      let newNode = this.addNode(offsetX, offsetY);
      let newEdge = { from: edge.from, to: newNode.id, weight: edge.weight };
      this.graph.addEdge(newEdge);
      let newEdge2 = { from: newNode.id, to: edge.to, weight: edge.weight };
      this.graph.addEdge(newEdge2);
      edge.group.remove();
      this.graph.deleteEdge(edge);
      this.refreshInfo();
      this.createNodeSvg(newNode);
      this.createEdgeSvg(newEdge);
      this.createEdgeSvg(newEdge2);
      this.hideEdgeContextMenu();
    };
    let strengthSlider = this.edgeContextMenu.querySelector('#edge-strength-slider');
    let valueSpan = this.edgeContextMenu.querySelector('#edge-strength-value');
    strengthSlider.value = edge.weight || 1;
    valueSpan.textContent = strengthSlider.value;
    strengthSlider.oninput = (ev) => {
      valueSpan.textContent = strengthSlider.value;
      edge.weight = parseFloat(strengthSlider.value);
      this.createEdgeSvg(edge);
      ev.stopPropagation();
    };
    this.edgeContextMenu.style.display = 'block';
    positionContextMenu(this.edgeContextMenu, clientX, clientY);
  }

  hideEdgeContextMenu() {
    this.edgeContextMenu.style.display = 'none';
  }

  createGraphSvg() {
    this.graph.forEachEdge((edge) => this.createEdgeSvg(edge));
    this.graph.forEachNode((node) => this.createNodeSvg(node));
  }

  createNodeSvg(node) {
    if (node.group) {
      node.group.remove();
    }
    let defaultColor = this.settings.nodes.color;
    if (node.color && this.settings.colors.has(node.color)) {
      var color = this.settings.colors.get(node.color);
    } else {
      var color = defaultColor;
    }
    let strokeColor = (node.color === "White" || node.color === "Yellow" || node.color === "Light Grey") ? defaultColor : color;
    let size = node.size || this.settings.nodes.size;
    node.group = this.nodesGroup.group().transform({ translateX: node.x, translateY: node.y });
    node.group.circle(size)
      .move(-size / 2, -size / 2)
      .fill(color).stroke({ width: this.settings.nodes.strokeWidth, color: strokeColor });

    if (node.nailed) {
      let nailRadius = size * 0.4;
      node.group.circle(nailRadius)
        .move(-nailRadius / 2, -nailRadius / 2)
        .fill(this.settings.nodes.nailColor);
    }

    node.group.node.addEventListener('mousedown', (e) => this.onMouseDown(e, node));
    node.group.node.addEventListener('mouseup', (e) => this.onMouseUpOnNode(e, node));
    node.group.node.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showNodeContextMenu(e.clientX, e.clientY, node);
    });

    if (this.editMode === "manual-move" || this.editMode === "rubber-band-move") {
      if (this.grabbedNodeId == node.id) {
        node.group.node.classList.add("grabbing");
      } else {
        node.group.node.classList.add("grab");
      }
    }
    else if (this.editMode === "edges") {
      node.group.node.style.cursor = "pointer";
    }
  }

  createEdgeSvg(edge) {
    if (edge.group) {
      edge.group.remove();
    }
    let color = edge.color || this.settings.edges.color;
    let defaultWidth = this.settings.edges.width;
    let width = edge.weight * defaultWidth;
    let s = this.graph.getNode(edge.from);
    let t = this.graph.getNode(edge.to);
    edge.group = this.edgesGroup.group();
    edge.line = edge.group.line(s.x, s.y, t.x, t.y).stroke({ width, color });
    // transparent line for interaction
    edge.interactionLine = edge.group.line(s.x, s.y, t.x, t.y)
      .stroke({ width: 6 * defaultWidth, color: '#000', opacity: 0 });
    edge.interactionLine.on('contextmenu', (e) => {
      e.preventDefault();
      this.showEdgeContextMenu(e.clientX, e.clientY, e.offsetX, e.offsetY, edge);
    });
  }

  updatePositions() {
    this.graph.forEachNode((node) => {
      if (node.group) {
        node.group.transform({ translateX: node.x, translateY: node.y });
      }
    });
    this.graph.forEachEdge((edge) => {
      let s = this.graph.getNode(edge.from);
      let t = this.graph.getNode(edge.to);
      if (edge.line) {
        edge.line.plot(s.x, s.y, t.x, t.y);
        edge.interactionLine.plot(s.x, s.y, t.x, t.y);
      }
    });
  }

  rubberBandStep() {
    console.log('step')
    let { maxChange, maxCoord } = rubberBandStepNodes(this.graph, this.settings.rate, this.mode);
    this.updatePositions();

    if (maxChange > this.settings.threshold && maxCoord < 10000) {
      this.lastTimeoutId = setTimeout(this.rubberBandStep.bind(this), this.settings.delay);
    }
  }
  
  setSquareTiling(tiling) {
    this.squareTiling = tiling;
    if (tiling) {
      let maxY = Math.max(...this.squareTiling.squares.map(tile => tile.y + tile.size));
      if (maxY > 1) {
        let scale = 2 / (maxY + 1);
        console.log("Scale:", scale);
        this.innerGroup.transform({
          scale: [scale, scale]
        });
      }
    } else {
      this.resetInnerGroupScale();
    }
    this.morphStage = 0;
  }

  renderSquareTiling() {
    if (!this.squareTiling) return;
    this.squareTiling.squares.forEach((square) => {
      this.tilingGroup.rect(square.size, square.size)
        .stroke({ color: "#fff", width: 0.005 })
        .move(square.x, square.y)
        .fill(square.color);
    });
  }

  renderTilingSegments() {
    if (!this.squareTiling) return;
    // draw the vertical segments corresponding to the nodes
    this.squareTiling.verticalSegments.forEach((segment, nodeId) => {
      let x = this.graph.getNode(nodeId).x;
      this.morphGroup.line(x, segment.y1, x, segment.y2)
        .stroke({ width: 0.02, color: this.settings.nodes.color });
    });
    // draw the horizontal segments corresponding to the edges
    this.squareTiling.squares.forEach((square) => {
      let y = square.y + square.size / 2;
      this.morphGroup.line(square.x, y, square.x + square.size, y)
        .stroke({ width: this.settings.edges.width, 
                  color: this.settings.edges.color, 
                  linecap: 'round' });
    });
  }

  morphSegments(step=0) {
    if (!this.squareTiling) return;
    let totalSteps = this.settings.morphSteps;
    if (step == totalSteps) {
        this.morphGroup.clear();
        this.showGraph = true;
        this.createGraphSvg();
        return;
    }
    this.morphGroup.clear();
    let verticalSegments = new Map();
    this.squareTiling.verticalSegments.forEach((segment, nodeId) => {
        let shrinkedSegment = { ...segment };
        shrinkedSegment.y1 += step / totalSteps * (segment.y2 - segment.y1) * 0.5;
        shrinkedSegment.y2 -= step / totalSteps * (segment.y2 - segment.y1) * 0.5;
        verticalSegments.set(nodeId, shrinkedSegment);
    });
    // draw the shrinked vertical segments corresponding to the nodes
    verticalSegments.forEach((segment, nodeId) => {
        let x = this.graph.getNode(nodeId).x;
        this.morphGroup.line(x, segment.y1, x, segment.y2)
            .stroke({ width: 0.02, color: this.settings.nodes.color });
    });

    // draw the horizontal segments corresponding to the edges,
    // so that it moves with the shrinking vertical segment
    this.squareTiling.squares.forEach((square) => {
      let y = square.y + square.size / 2;
      let seg1 = verticalSegments.get(square.nodeId1);
      let seg2 = verticalSegments.get(square.nodeId2);
      let y1 = clamp(y, seg1.y1, seg1.y2);
      let y2 = clamp(y, seg2.y1, seg2.y2);
      this.morphGroup.line(square.x, y1, square.x + square.size, y2)
        .stroke({ width: this.settings.edges.width,
                   color: this.settings.edges.color,
                   linecap: 'round' });
    });

    setTimeout(() => {
        this.morphSegments(step+1);
    }, this.settings.delay);
  }

  morphTiling() {
    if (!this.squareTiling) return;
    if (this.morphStage == 0) {
      this.morphStage = 1;
      this.showGraph = false;
      this.createSvg();
      this.renderTilingSegments();
    } else if (this.morphStage == 1) {
      this.morphStage = 0;
      this.morphSegments();
    }
  }
}


export { GraphRenderer, randomizeFreeNodes };
