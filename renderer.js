import { parseGrf, solveEquilibrium, placeNailedNodes, randomizeFreeNodes, setupGraphForTiling, rubberBandStepNodes } from "./graph.js";

const clamp = (val, min, max) => Math.min(Math.max(val, min), max)


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

    this.svg.node.addEventListener("click", (e) => {
      console.log("svg.node click");
      if (this.editMode === "nodes") {
        this.addNode(e.offsetX, e.offsetY);
        this.render();
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

  resetScale() {
    this.innerGroup.transform({ scale: [1, 1] });
  }

  setGraph(graph) {
    this.graph = graph;
    this.resetScale();
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
      this.resetScale();
    }
    this.morphStage = 0;
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
      // this.render();
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
        rubberBandStep(this);
      }
    }
  }

  renderNode(node) {
    let color = this.settings.nodes.color;
    if (node.color) {
      color = this.settings.colors.get(node.color);
    }
    let size = node.size || this.settings.nodes.size;
    let circle = this.graphGroup.circle(size)
      .move(node.x - size / 2, node.y - size / 2)
      .fill(color);
    
    let nail_circle = null;
    if (node.nailed) {
      let nailRadius = size * 0.4;
      nail_circle = this.graphGroup.circle(nailRadius)
        .move(node.x - nailRadius / 2, node.y - nailRadius / 2)
        .fill(this.settings.nodes.nailColor);
    }

    circle.node.addEventListener('mousedown', (e) => this.onMouseDown(e, node));
    circle.node.addEventListener('mouseup', (e) => this.onMouseUp(e, node, circle));
    if (node.nailed) {
      nail_circle.node.addEventListener('mousedown', (e) => this.onMouseDown(e, node));
      nail_circle.node.addEventListener('mouseup', (e) => this.onMouseUp(e, node, nail_circle));
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
      let width = edge.width || this.settings.edges.width;
      let s = this.graph.getNode(edge.from);
      let t = this.graph.getNode(edge.to);
      this.graphGroup.line(s.x, s.y, t.x, t.y).stroke({ width, color });
      // transparent line for interaction
      this.graphGroup.line(s.x, s.y, t.x, t.y)
        .stroke({ width: 3 * width, color: '#000', opacity: 0 })
        .on('click', () => {
          //TODO masik gombra kotni!
          if (this.editMode === "edges") {
            this.graph.deleteEdge(edge);
            this.refreshInfo();
            this.render();
          }
        });
    });
    this.graph.forEachNode((node) => this.renderNode(node));
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


function rubberBandStep(renderer) {
  let graph = renderer.graph
  console.log('step')
  let { maxChange, maxCoord } = rubberBandStepNodes(graph, renderer.settings.rate, renderer.mode);
  renderer.render()

  if (maxChange > renderer.settings.threshold && maxCoord < 10000) {
    renderer.lastTimeoutId = setTimeout(rubberBandStep, renderer.settings.delay, renderer)
  }
}


export { loadGraph, GraphRenderer, randomizeFreeNodes, rubberBandStep };
