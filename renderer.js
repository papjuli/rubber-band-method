import { parseGrf, solveEquilibrium, placeNailedNodes, randomizeFreeNodes, setupGraphForTiling, rubberBandStepNodes } from "./graph.js";

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);


class GraphRenderer {
  constructor(container, settings) {
    this.svg = SVG().addTo(container).size("100%", "100%");
    this.outerGroup = this.svg.group();
    this.innerGroup = this.outerGroup.group();
    this.tilingGroup = this.innerGroup.group();
    this.morphGroup = this.innerGroup.group();
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
    this.settings = settings;
    this.lastTimeoutId = null;
    this.mode = "attract";
    this.editMode = null; // "nodes", "edges", "editing" or null
    this.showGraph = true;
    this.morphStage = 0;
    this.mouseDownPos = null;
    this.grabbedNodeId = null;

    // Context menu setup
    this.contextMenu = this.createNodeContextMenu();
    container.appendChild(this.contextMenu);
    // SVG context menu setup
    this.svgContextMenu = this.createSvgContextMenu();
    container.appendChild(this.svgContextMenu);
    // Edge context menu setup
    this.edgeContextMenu = this.createEdgeContextMenu();
    container.appendChild(this.edgeContextMenu);
    document.addEventListener('click', () => {
      console.log("document click");
      this.hideNodeContextMenu();
      this.hideSvgContextMenu();
      this.hideEdgeContextMenu();
    });
  
    this.svg.node.addEventListener("click", (e) => {
      console.log("svg.node click");
      if (this.editMode === "nodes") {
        this.addNode(e.offsetX, e.offsetY);
        this.render();
      }
    });

    this.svg.node.addEventListener("contextmenu", (e) => {
      // Only show if not on a node (let node context menu take precedence)
      if (e.target === this.svg.node) {
        e.preventDefault();
        this.showSvgContextMenu(e.clientX, e.clientY, e.offsetX, e.offsetY);
      }
    });

    this.svg.node.addEventListener("mousemove",
      (e) => {
        if (this.grabbedNodeId != null && 
            (this.editMode === "manual-move" || this.editMode === "rubber-band-move")) {
          let node = this.graph.getNode(this.grabbedNodeId);
          //if ((this.x2ex(node.x) == e.offsetX) && (this.y2ey(node.y) == e.offsetY)) { console.log("kihagy"); }
          node.x = this.ex2x(e.offsetX);
          node.y = this.ey2y(e.offsetY);
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

  onMouseDown(e, node) {
    console.log("node mousedown, edit mode: ", this.editMode);
    // Track mouse movement to distinguish click vs drag
    this.mouseDownPos = { x: e.clientX, y: e.clientY };
    if (this.editMode === "edges") {
      if (this.edgeNodeId1 != null && this.edgeNodeId1 != node.id) {
        this.graph.addEdge({ from: this.edgeNodeId1, to: node.id, weight: 1 });
        this.edgeNodeId1 = null;
        this.refreshInfo();
        this.render();
      }
      else {
        this.edgeNodeId1 = node.id;
      }
    }
    else if (this.editMode === "manual-move" || this.editMode === "rubber-band-move") {
      this.grabbedNodeId = node.id;
    }
  }

  onMouseUp(e, node, circle) {
    console.log("node mouseup");
    if (this.mouseDownPos) {
      const dx = Math.abs(e.clientX - this.mouseDownPos.x);
      const dy = Math.abs(e.clientY - this.mouseDownPos.y);
      // Only treat as click if mouse didn't move much
      if (dx < 3 && dy < 3) {
        if (this.editMode === "nodes") {
          this.graph.deleteNode(node);
          this.refreshInfo();
          this.render();
        }
      }
      this.mouseDownPos = null;
      this.grabbedNodeId = null;
      circle.node.classList.remove("grabbing");
      if (this.editMode === "rubber-band-move") {
        this.rubberBandStep();
      }
    }
  }
  
  createSvgContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    // Add Node button
    const addButton = document.createElement('button');
    addButton.textContent = 'Add Node';
    addButton.id = 'svg-add-node-button';
    menu.appendChild(addButton);
    return menu;
  }

  showSvgContextMenu(x, y, ex, ey) {
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
  
  createNodeContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'context-menu';

    // Delete Node
    const deleteButton = document.createElement('button');
    deleteButton.id = 'delete-node-button';
    deleteButton.textContent = 'Delete Node';
    menu.appendChild(deleteButton);

    // Toggle Nail
    const toggleNailButton = document.createElement('button');
    toggleNailButton.id = 'toggle-nailed-button';
    menu.appendChild(toggleNailButton);

    // Color Dropdown
    const colorLabel = document.createElement('span');
    colorLabel.textContent = 'Change color:';
    colorLabel.style.fontSize = "1.1em";
    colorLabel.style.margin = '4px';
    colorLabel.htmlFor = 'node-color-dropdown';
    menu.appendChild(document.createElement('br'));
    menu.appendChild(colorLabel);
    const colorDropdown = document.createElement('select');
    colorDropdown.id = 'node-color-dropdown';
    colorDropdown.style.padding = '4px';
    colorDropdown.style.margin = '4px';
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
    menu.appendChild(colorDropdown);
    // Prevent menu from closing when interacting with dropdown
    colorDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    return menu;
  }

  showNodeContextMenu(x, y, node) {
    let deleteNodeButton = this.contextMenu.querySelector('#delete-node-button');
    deleteNodeButton.onclick = (e) => {
      e.stopPropagation();
      this.graph.deleteNode(node);
      this.refreshInfo();
      this.render();
      this.hideNodeContextMenu();
    };

    let toggleNailButton = this.contextMenu.querySelector('#toggle-nailed-button');
    toggleNailButton.textContent = node.nailed ? 'Unnail Node' : 'Nail Node';
    toggleNailButton.onclick = (e) => {
      e.stopPropagation();
      node.nailed = !node.nailed;
      this.refreshInfo();
      this.render();
    };

    // Color Dropdown
    let colorDropdown = this.contextMenu.querySelector('#node-color-dropdown');
    colorDropdown.value = node.color;
    colorDropdown.onchange = (e) => {
      node.color = colorDropdown.value;
      this.refreshInfo();
      this.render();
    };

    this.contextMenu.style.left = x + 'px';
    this.contextMenu.style.top = y + 'px';
    this.contextMenu.style.display = 'block';
  }

  hideNodeContextMenu() {
    this.contextMenu.style.display = 'none';
  }

  createEdgeContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    // Delete Edge button
    const deleteButton = document.createElement('button');
    deleteButton.id = 'delete-edge-button';
    deleteButton.textContent = 'Delete Edge';
    menu.appendChild(deleteButton);
    // Strength slider
    menu.appendChild(document.createElement('br'));
    menu.innerHTML += 'Set strength: ';
    const strengthSlider = document.createElement('input');
    strengthSlider.type = 'range';
    strengthSlider.min = '0.25';
    strengthSlider.max = '6';
    strengthSlider.step = '0.25';
    strengthSlider.id = 'edge-strength-slider';
    menu.appendChild(strengthSlider);
    // Value display
    const valueSpan = document.createElement('span');
    valueSpan.id = 'edge-strength-value';
    valueSpan.style.marginLeft = '4px';
    menu.appendChild(valueSpan);
    return menu;
  }

  showEdgeContextMenu(x, y, edge) {
    let deleteButton = this.edgeContextMenu.querySelector('#delete-edge-button');
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      this.graph.deleteEdge(edge);
      this.refreshInfo();
      this.render();
      this.hideEdgeContextMenu();
    };
    let strengthSlider = this.edgeContextMenu.querySelector('#edge-strength-slider');
    let valueSpan = this.edgeContextMenu.querySelector('#edge-strength-value');
    strengthSlider.value = edge.weight || 1;
    valueSpan.textContent = strengthSlider.value;
    strengthSlider.oninput = (e) => {
      valueSpan.textContent = strengthSlider.value;
      edge.weight = parseFloat(strengthSlider.value);
      this.render();
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
    circle.node.addEventListener('mouseup', (e) => this.onMouseUp(e, node, circle));
    circle.node.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showNodeContextMenu(e.clientX, e.clientY, node);
    });
    if (node.nailed) {
      nail_circle.node.addEventListener('mousedown', (e) => this.onMouseDown(e, node));
      nail_circle.node.addEventListener('mouseup', (e) => this.onMouseUp(e, node, nail_circle));
      nail_circle.node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showNodeContextMenu(e.clientX, e.clientY, node);
      });
    }

    if (this.editMode === "manual-move" || this.editMode === "rubber-band-move") {
      circle.node.classList.add("grab");
      if (node.nailed) {
        nail_circle.node.classList.add("grab");
      }
    }
    if (this.grabbedNodeId == node.id && (this.editMode === "manual-move" || this.editMode === "rubber-band-move")) {
      circle.node.classList.add("grabbing");
      if (node.nailed) {
        nail_circle.node.classList.add("grabbing");
      }
    }
    if (this.editMode === "nodes") {
      circle.node.classList.add("delete-cursor");
      if (node.nailed) {
        nail_circle.node.classList.add("delete-cursor");
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
