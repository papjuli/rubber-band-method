const clamp = (val, min, max) => Math.min(Math.max(val, min), max)

class Graph {
  constructor() {
    this.nodesById = new Map();
    this.edgesAt = new Map();
  }

  addNode(node) {
    if (!node.id) throw "Node must have an id";
    this.nodesById.set(node.id, node);
    //this.edgesAt.set(node.id, []);
    this.edgesAt.set(node.id, new Set());
    return node;
  }

  deleteNode(node) {
    this.edgesAt.get(node.id).forEach((adjEdge) => {
      this.deleteEdge(adjEdge);
    })
    this.nodesById.delete(node.id);
  }

  addEdge(edge) {
    //this.edgesAt.get(edge.from).push(edge);
    //this.edgesAt.get(edge.to).push(edge);
    this.edgesAt.get(edge.from).add(edge);
    this.edgesAt.get(edge.to).add(edge);
  }

  deleteEdge(edge) {
    this.edgesAt.get(edge.from).delete(edge);
    this.edgesAt.get(edge.to).delete(edge);
  }

  nodeCount() {
    return this.nodesById.size;
  }

  edgeCount() {
    let count = 0;
    //this.edgesAt.forEach((edges) => count += edges.length);
    this.edgesAt.forEach((edges) => count += edges.size);
    return count / 2;
  }

  getNode(id) {
    return this.nodesById.get(id);
  }

  forEachNode(callback) {
    this.nodesById.forEach(callback);
  }

  forEachEdge(callback) {
    this.edgesAt.forEach((edges, nodeId) => {
      edges.forEach((edge) => {
        let otherId = edge.from == nodeId ? edge.to : edge.from;
        if (nodeId < otherId) {
          callback(edge);
        }
      });
    });
  }

  forEachEdgeAt(nodeId, callback) {
    this.edgesAt.get(nodeId).forEach(callback);
  }

  degree(nodeId) {
//    return this.edgesAt.get(nodeId).length;
    return this.edgesAt.get(nodeId).size;
  }
}


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
    this.editable = false;
    this.showGraph = true;
    this.morphStage = 0;

    //this.svg.node.addEventListener("click",
    //  (e) => { console.log(e.offsetX, e.offsetY) });
    
    this.svg.node.addEventListener("click", (e) => {
      if (this.editable && this.editnodes) {
        this.addNode(e.offsetX, e.offsetY);
        this.render();
      }
    }
    );
    
    this.svg.node.addEventListener("mouseup",
      (e) => {
        //console.log("svg.node mouseup");
        if (this.grabbednodeid) {
          let node = this.graph.getNode(this.grabbednodeid);
          node.x = this.ex2x(e.offsetX);
          node.y = this.ey2y(e.offsetY);
          node.grab = false;
          this.grabbednodeid = undefined;
          this.render();
        }
      }
    );

    this.svg.node.addEventListener("mousemove",
      (e) => {
        //console.log("svg.node mousemove");
        if (this.grabbednodeid) {
          let node = this.graph.getNode(this.grabbednodeid);
          //if ((this.x2ex(node.x) == e.offsetX) && (this.y2ey(node.y) == e.offsetY)) { console.log("kihagy"); }
          node.x = this.ex2x(e.offsetX);
          node.y = this.ey2y(e.offsetY);
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
    let n = this.graph.nodeCount;
    let node = this.graph.addNode({ id : n});
    node.x = this.ex2x(ex);
    node.y = this.ey2y(ey);
    this.refreshInfo();
    this.render();
  }

  renderNode(node) {
    let color = this.settings.nodes.color;
    if (node.color) {
      color = this.settings.colors.get(node.color);
    }
    let size = node.size || this.settings.nodes.size;
    const circle = this.group.circle(size);
    //console.log("ci: ", circle);
    circle.move(node.x - size / 2, node.y - size / 2)
      .fill(color)
      .on('click', () => {
        console.log("click");
        if (this.editable && this.editnodes) {
          this.graph.deleteNode(node);
          this.refreshInfo();
          this.render();
        }
      })
      .on('mousedown', (e) => {
        //console.log("down");
        if (this.editable && !this.editnodes) {
          this.grabbednodeid = node.id;
          node.grab = true;
          this.render();
        }  
      })
     ;  
     if (this.editable) {
      circle.node.classList.add("grab");
    } else {
      //circle.node.classList.remove("grab");
    }
    if (this.grabbednodeid == node.id) {
      circle.node.classList.add("grabbing");
    } else {
      //circle.node.classList.remove("grabbing");
    }
    if (this.editnodes) {
      circle.node.classList.add("delete-cursor");
    }
    if (node.nailed) {
      let nailRadius = size * 0.3;
      this.group.circle(nailRadius)
        .move(node.x - nailRadius / 2, node.y - nailRadius / 2)
        .fill(this.settings.nodes.nailColor);
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
      this.graphGroup.line(s.x, s.y, t.x, t.y).stroke({ width, color })
        .on('click', () => {
          //TODO masik gombra kotni!
          if (this.editable && this.editnodes) {
            this.graph.deleteEdge(edge);
            this.refreshInfo();
            this.render();
          }
        });
    });
    this.graph.forEachNode((node) => {
      let color = this.settings.nodes.color;
      if (node.color) {
        color = this.settings.colors.get(node.color);
      }
      let size = node.size || this.settings.nodes.size;
      const circle = this.graphGroup.circle(size);
      //console.log("ci: ", circle);
      circle.move(node.x - size / 2, node.y - size / 2)
        .fill(color)
        .on('click', () => {
          console.log("click");
          if (this.editable && this.editnodes) {
            this.graph.deleteNode(node);
            this.refreshInfo();
            this.render();
          }
        })
        .on('mousedown', (e) => {
          //console.log("down");
          if (this.editable && !this.editnodes) {
            this.grabbednodeid = node.id;
            node.grab = true;
            this.render();
          }  
        })
       ;
      if (this.editable) {
        circle.node.classList.add("grab");
      } else {
        //circle.node.classList.remove("grab");
      }
      if (this.grabbednodeid == node.id) {
        circle.node.classList.add("grabbing");
      } else {
        //circle.node.classList.remove("grabbing");
      }
      if (this.editnodes) {
        circle.node.classList.add("delete-cursor");
      }
      if (node.nailed) {
        let nailRadius = size * 0.4;
        this.graphGroup.circle(nailRadius)
          .move(node.x - nailRadius / 2, node.y - nailRadius / 2)
          .fill(this.settings.nodes.nailColor);
      }
    });
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
    if (topicName == "SquareTiling")
      setupGraphForTiling(graph, renderer);
    else
      setupGraph(graph, renderer);
    if (callback)
      callback(graph);
  })
}


function parseGrf(url, callback) {
  var xhr = new XMLHttpRequest()
  if (!xhr) throw 'XMLHttpRequest not supported, cannot load the file.'

  var graph = new Graph()
  xhr.open('GET', url, true)
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      var lines = xhr.responseText.split('\n')
        .filter(line => !line.startsWith('#'));
      var nodeCount = parseInt(lines[0]);
      var i, j, nodeData, isEdge, color;
      for (i = 0; i < nodeCount; i++) {
        graph.addNode({ id: 'n' + i })
      }
      for (i = 0; i < nodeCount; i++) {
        nodeData = lines[i + 1].split(',');
        for (j = i + 1; j < nodeCount; j++) {
          isEdge = nodeData[j];
          if (isEdge == 1) {
            graph.addEdge({ from: 'n' + i, to: 'n' + j, weight: 1 });
          }
        }
        color = nodeData[nodeCount].trim();
        if (color != "")
          graph.getNode('n' + i).color = color;
        for (j = nodeCount + 1; j < nodeData.length; j++) {
          if (nodeData[j] == "Nailed") {
            graph.getNode('n' + i).nailed = true;
          }
        }
      }
      if (callback)
        callback(graph);
    }
  };
  xhr.send();
}


function setupGraph(graph, renderer) {
  console.log("setupGraph")
  placeNailedNodes(graph);
  randomizeFreeNodes(graph);
  renderer.setGraph(graph);
  renderer.render();
}


function setupGraphForTiling(graph, renderer) {
  console.log("setupGraphForTiling")
  // choose two nodes (which should be on a face)
  let nailedNodes = [];
  graph.forEachNode((node) => {
    if (node.nailed) nailedNodes.push(node)
  })
  if (nailedNodes.length < 2) {
    console.log("Not enough nailed nodes");
    return;
  }
  let n1 = nailedNodes[0];
  n1.x = -1;
  n1.y = -0.8;
  let n2 = nailedNodes[Math.floor(nailedNodes.length / 2)];
  n2.x = 1;
  n2.y = -0.8;
  // "unnail" the others, but set them fixed in the y axis
  nailedNodes.forEach((node, index) => {
    if (node !== n1 && node !== n2) {
      node.nailed = false;
      node.y = index < nailedNodes.length / 2 ? -0.6 : -1;
      node.fixed_y = true;
    }
  });

  randomizeFreeNodes(graph);
  renderer.setGraph(graph);
  renderer.render();
}


function placeNailedNodes(graph) {
  let nailedNodes = [];
  graph.forEachNode((node) => {
    if (node.nailed) nailedNodes.push(node)
  })
  if (nailedNodes.length == 0) return;
  if (nailedNodes.length == 1) {
    nailedNodes[0].x = 0
    nailedNodes[0].y = 1
    return;
  }
  if (nailedNodes.length == 2) {
    nailedNodes[0].x = -1
    nailedNodes[0].y = 0
    nailedNodes[1].x = 1
    nailedNodes[1].y = 0
    return;
  }
  let alpha = 2 * Math.PI / nailedNodes.length
  // put nailed nodes around unit circle, in the order they are in the file
  for (let i = 0; i < nailedNodes.length; i++) {
    nailedNodes[i].x = Math.sin(i * alpha)
    nailedNodes[i].y = Math.cos(i * alpha)
  }
}


function randomizeFreeNodes(graph) {
  graph.forEachNode((node) => {
    if (!node.nailed) {
      if (!node.fixed_x) node.x = Math.random() * 2 - 1
      if (!node.fixed_y) node.y = Math.random() * 2 - 1
    }
  })
}


function rubberBandStep(renderer) {
  let graph = renderer.graph
  console.log('step')
  let force, dx, dy
  let maxChange = 0
  let maxCoord = 0
  graph.forEachNode((node) => {
    node.prevX = node.x
    node.prevY = node.y
    node.force = { x: 0, y: 0 }
  })
  graph.forEachNode((node) => {
    if (!node.nailed && graph.degree(node.id) > 0) {
      force = { x: 0, y: 0 }
      graph.forEachEdgeAt(node.id, (edge) => {
        let otherId = edge.from == node.id ? edge.to : edge.from
        let otherNode = graph.getNode(otherId)
        force.x += (otherNode.prevX - node.prevX) * edge.weight
        force.y += (otherNode.prevY - node.prevY) * edge.weight
      })
      dx = renderer.settings.rate * force.x
      dy = renderer.settings.rate * force.y
      if (node.fixed_x) dx = 0
      if (node.fixed_y) dy = 0
      if (renderer.mode == "attract") {
        node.x += dx
        node.y += dy
      } else {
        node.x -= dx
        node.y -= dy
      }
      if (renderer.mode == "repel-constrained") {
        let r = Math.sqrt(node.x * node.x + node.y * node.y)
        if (r > 1) {
          node.x /= r
          node.y /= r
        }
      }
      maxChange = Math.max(maxChange, Math.abs(node.x - node.prevX), Math.abs(node.y - node.prevY))
      maxCoord = Math.max(maxCoord, Math.abs(node.x), Math.abs(node.y))
    }
  })
  renderer.render()

  if (maxChange > renderer.settings.threshold && maxCoord < 10000) {
    renderer.lastTimeoutId = setTimeout(rubberBandStep, renderer.settings.delay, renderer)
  }
}


function createSquareTiling(graph) {
  console.log("Creating square tiling");
  // Assumes the graph is already set up for tiling 
  // and rubber banding is applied.
  // Sort the nodes by x coordinate.
  let nodes = [];
  graph.forEachNode((node) => {
    nodes.push(node);
    node.height = undefined;
  });
  nodes.sort((a, b) => a.x - b.x);
  // define heights for the nodes:
  // the height of the first node is 0

  let tiling = {squares: [], verticalSegments: new Map()};
  nodes[0].height = -1;
  tiling.verticalSegments.set(nodes[0].id, {y1: nodes[0].height, y2: 2 * nodes[0].y});
  nodes.forEach((node) => {
    let laterNeighbors = [];
    graph.forEachEdgeAt(node.id, (edge) => {
      let otherId = edge.from == node.id ? edge.to : edge.from;
      let otherNode = graph.getNode(otherId);
      if (otherNode.x > node.x) laterNeighbors.push(otherNode);
    });

    // sort later neighbors by slope of edge
    laterNeighbors.sort((a, b) => {
      let slopeA = (a.y - node.y) / (a.x - node.x);
      let slopeB = (b.y - node.y) / (b.x - node.x);
      return slopeA - slopeB;
    });
    let currHeight = node.height;
    laterNeighbors.forEach((neighbor) => {
      let edgeSize = neighbor.x - node.x;
      neighbor.height = (neighbor.height == undefined) ? currHeight : Math.min(neighbor.height, currHeight);

      let square = {
        size: edgeSize,
        x: node.x,
        y: currHeight,
        // random pastel color
        color: `hsl(${Math.random() * 360}, 100%, 85%)`,
        nodeId1: node.id,
        nodeId2: neighbor.id
      };
      tiling.squares.push(square);
      currHeight += edgeSize;
    });
    // move the node to the midpoint of the vertical segment 
    // corresponding to the node
    if (laterNeighbors.length > 0) {
      node.y = (node.height + currHeight) / 2;
      tiling.verticalSegments.set(node.id, {y1: node.height, y2: currHeight});
    } else {
      node.y = nodes[0].y;
      let seg0 = tiling.verticalSegments.get(nodes[0].id);
      tiling.verticalSegments.set(node.id, {y1: seg0.y1, y2: seg0.y2});
    }
  });
  return tiling;
}


export { loadGraph, GraphRenderer, randomizeFreeNodes, rubberBandStep, createSquareTiling };
