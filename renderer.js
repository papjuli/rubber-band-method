import { parseGrf, solveEquilibrium, placeNailedNodes, randomizeFreeNodes, setupGraphForTiling, rubberBandStepNodes } from "./graph.js";

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);


class GraphRenderer {
  constructor(container, settings) {
    this.settings = settings;
    this.graph = null;
    this.squareTiling = null;
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
    let width = this.svg.node.clientWidth;
    let height = this.svg.node.clientHeight;
    console.log(width, height);
    let scale = Math.min(width, height) / 2 * 0.9;
    this.outerGroup.transform({
      scale: [scale, -scale],
      translateX: width / 2,
      translateY: height / 2
    });
    this.lastTimeoutId = null;
    this.mode = "attract";
    this.editMode = null; // "editing", "edges", "manual-move", "rubber-band-move" or null
    this.showGraph = true;
    this.morphStage = 0;
    this.grabbedNodeId = null;

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
          this.render();          
        }
      }
    );
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
    this.graphGroup.clear();
    this.tilingGroup.clear();
    this.morphGroup.clear();
  }

  refreshInfo() {
    document.getElementById('num-vertices').innerHTML = this.graph.nodeCount();
    document.getElementById('num-edges').innerHTML = this.graph.edgeCount();  
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
    this.graph.addNode({x: this.ex2x(ex), y: this.ey2y(ey)});
    this.refreshInfo();
    this.render();
  }

  onMouseDown(ev, node) {
    console.log("node mousedown, edit mode: ", this.editMode);
    this.grabbedNodeId = node.id;
    if (this.editMode === "edges") {
      this.svg.node.addEventListener("mousemove", this.boundOnMouseMove);
      document.addEventListener("mouseup", this.onMouseUp.bind(this), { once: true });
    }
  }

  onMouseUpOnNode(ev, node, circle) {
    console.log("node mouseup");
    this.svg.node.removeEventListener("mousemove", this.boundOnMouseMove);
    if (this.grabbedNodeId) {
      circle.node.classList.remove("grabbing");
      if (this.editMode === "edges") {
        if (this.grabbedNodeId != null && this.grabbedNodeId != node.id) {
          this.graph.addEdge({ from: this.grabbedNodeId, to: node.id, weight: 1 });
          this.refreshInfo();
          this.render();
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
      this.addNode(ex, ey);
      this.render();
      this.hideSvgContextMenu();
    };
    this.svgContextMenu.style.left = x + 'px';
    this.svgContextMenu.style.top = y + 'px';
    this.svgContextMenu.style.display = 'block';
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
      this.graph.deleteNode(node);
      this.refreshInfo();
      this.render();
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
      this.render();
    };
    
    // Color Dropdown
    let colorDropdown = this.nodeContextMenu.querySelector('#node-color-dropdown');
    colorDropdown.value = node.color;
    colorDropdown.onchange = (ev) => {
      node.color = colorDropdown.value;
      this.refreshInfo();
      this.render();
    };

    this.nodeContextMenu.style.left = x + 'px';
    this.nodeContextMenu.style.top = y + 'px';
    this.nodeContextMenu.style.display = 'block';
  }

  hideNodeContextMenu() {
    this.nodeContextMenu.style.display = 'none';
  }

  getEdgeContextMenu() {
    return document.getElementById('edge-context-menu');
  }

  showEdgeContextMenu(x, y, edge) {
    if (this.editMode === null) return;
    let deleteButton = this.edgeContextMenu.querySelector('#delete-edge-button');
    deleteButton.onclick = (ev) => {
      ev.stopPropagation();
      this.graph.deleteEdge(edge);
      this.refreshInfo();
      this.render();
      this.hideEdgeContextMenu();
    };
    let strengthSlider = this.edgeContextMenu.querySelector('#edge-strength-slider');
    let valueSpan = this.edgeContextMenu.querySelector('#edge-strength-value');
    strengthSlider.value = edge.weight || 1;
    valueSpan.textContent = strengthSlider.value;
    strengthSlider.oninput = (ev) => {
      valueSpan.textContent = strengthSlider.value;
      edge.weight = parseFloat(strengthSlider.value);
      this.render();
      ev.stopPropagation();
    };
    this.edgeContextMenu.style.left = x + 'px';
    this.edgeContextMenu.style.top = y + 'px';
    this.edgeContextMenu.style.display = 'block';
  }

  hideEdgeContextMenu() {
    this.edgeContextMenu.style.display = 'none';
  }

  renderNode(node) {
    let defaultColor = this.settings.nodes.color;
    if (node.color && this.settings.colors.has(node.color)) {
      var color = this.settings.colors.get(node.color);
    } else {
      var color = defaultColor;
    }
    let strokeColor = (node.color === "White" || node.color === "Yellow" || node.color === "Light Grey") ? defaultColor : color;
    let size = node.size || this.settings.nodes.size;
    let circle = this.graphGroup.circle(size)
      .move(node.x - size / 2, node.y - size / 2)
      .fill(color).stroke({ width: this.settings.nodes.strokeWidth, color: strokeColor });

    let nail_circle = null;
    if (node.nailed) {
      let nailRadius = size * 0.4;
      nail_circle = this.graphGroup.circle(nailRadius)
        .move(node.x - nailRadius / 2, node.y - nailRadius / 2)
        .fill(this.settings.nodes.nailColor);
    }

    circle.node.addEventListener('mousedown', (e) => this.onMouseDown(e, node));
    circle.node.addEventListener('mouseup', (e) => this.onMouseUpOnNode(e, node, circle));
    circle.node.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showNodeContextMenu(e.clientX, e.clientY, node);
    });
    if (node.nailed) {
      nail_circle.node.addEventListener('mousedown', (e) => this.onMouseDown(e, node));
      nail_circle.node.addEventListener('mouseup', (e) => this.onMouseUpOnNode(e, node, nail_circle));
      nail_circle.node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showNodeContextMenu(e.clientX, e.clientY, node);
      });
    }

    if (this.editMode === "manual-move" || this.editMode === "rubber-band-move") {
      if (this.grabbedNodeId == node.id) {
          circle.node.classList.add("grabbing");
        if (node.nailed) {
          nail_circle.node.classList.add("grabbing");
        }
      } else {
        circle.node.classList.add("grab");
        if (node.nailed) {
          nail_circle.node.classList.add("grab");
        }
      }
    }
    else if (this.editMode === "edges") {
      circle.node.style.cursor = "pointer";
      if (node.nailed) {
          nail_circle.node.style.cursor = "pointer";
        }
    }
  }

  render() {
    this.clearAll();
    this.renderSquareTiling();
    if (this.showGraph) {
      this.renderGraph();
    }
  }

  renderGraph() {
    this.graph.forEachEdge((edge) => {
      let color = edge.color || this.settings.edges.color;
      let defaultWidth = this.settings.edges.width;
      let width = edge.weight * defaultWidth;
      let s = this.graph.getNode(edge.from);
      let t = this.graph.getNode(edge.to);
      this.graphGroup.line(s.x, s.y, t.x, t.y).stroke({ width, color });
      // transparent line for interaction
      let interactionLine = this.graphGroup.line(s.x, s.y, t.x, t.y)
        .stroke({ width: 6 * defaultWidth, color: '#000', opacity: 0 });
      interactionLine.on('contextmenu', (e) => {
        e.preventDefault();
        this.showEdgeContextMenu(e.clientX, e.clientY, edge);
      });
    });
    this.graph.forEachNode((node) => this.renderNode(node));
  }

  rubberBandStep() {
    console.log('step')
    let { maxChange, maxCoord } = rubberBandStepNodes(this.graph, this.settings.rate, this.mode);
    this.render();

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
        this.renderGraph();
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
      this.render();
      this.renderTilingSegments();
    } else if (this.morphStage == 1) {
      this.morphStage = 0;
      this.morphSegments();
    }
  }
}


function loadGraph(url, renderer, callback, topicName="") {
  console.log("loadGraph");
  renderer.clearAll();
  renderer.setGraph(null);
  renderer.setSquareTiling(null);
  parseGrf(url, (graph) => {
    if (topicName == "SquareTiling") {
      setupGraphForTiling(graph);
    }
    else {
      placeNailedNodes(graph);
    }

    randomizeFreeNodes(graph);
    renderer.setGraph(graph);
    renderer.render();

    if (callback)
      callback(graph);
  })
}


export { GraphRenderer, loadGraph, randomizeFreeNodes };
