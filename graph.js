
class Graph {
  constructor() {
    this.nodesById = new Map();
    this.edgesAt = new Map();
  }

  addNode(node) {
    if (!node.id) throw "Node must have an id";
    this.nodesById.set(node.id, node);
    this.edgesAt.set(node.id, []);
  }

  addEdge(edge) {
    this.edgesAt.get(edge.from).push(edge);
    this.edgesAt.get(edge.to).push(edge);
  }

  nodeCount() {
    return this.nodesById.size;
  }

  edgeCount() {
    let count = 0;
    this.edgesAt.forEach((edges) => count += edges.length);
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
    return this.edgesAt.get(nodeId).length;
  }
}


class GraphRenderer {
  constructor(container, settings) {
    this.svg = SVG().addTo(container).size("100%", "100%");
    this.group = this.svg.group();
    let width = this.svg.node.clientWidth;
    let height = this.svg.node.clientHeight;
    console.log(width, height);
    let scale = Math.min(width, height) / 2 * 0.9;
    this.group.transform({
      scale: [scale, -scale],
      translateX: width / 2,
      translateY: height / 2
    });
    this.settings = settings;
    this.lastTimeoutId = null;
    this.mode = "attract";
  }

  setGraph(graph) {
    this.graph = graph;
  }

  clear() {
    clearTimeout(this.lastTimeoutId);
    this.group.clear();
  }

  render() {
    this.clear();
    this.graph.forEachEdge((edge) => {
      let color = edge.color || this.settings.edges.color;
      let width = edge.width || this.settings.edges.width;
      let s = this.graph.getNode(edge.from);
      let t = this.graph.getNode(edge.to);
      this.group.line(s.x, s.y, t.x, t.y).stroke({ width, color });
    });
    this.graph.forEachNode((node) => {
      let color = this.settings.nodes.color;
      if (node.color) {
        color = this.settings.colors.get(node.color);
      }
      let size = node.size || this.settings.nodes.size;
      this.group.circle(size).move(node.x - size / 2, node.y - size / 2).fill(color);
      if (node.nailed) {
        let nailRadius = size * 0.4;
        this.group.circle(nailRadius)
          .move(node.x - nailRadius / 2, node.y - nailRadius / 2)
          .fill(this.settings.nodes.nailColor);
      }
    });
  }
}


function loadGraph(url, renderer, callback) {
  console.log("loadGraph")
  parseGrf(url, (graph) => {
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
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      var lines = xhr.responseText.split('\n')
        .filter(line => !line.startsWith('#'));
      var nodeCount = parseInt(lines[0]);
      var i, j, nodeData, isEdge, color;
      for (i = 0; i < nodeCount; i++) {
        graph.addNode({id: 'n' + i})
      }
      for (i = 0; i < nodeCount; i++) {
        nodeData = lines[i + 1].split(',');
        for (j = i + 1; j < nodeCount; j++) {
          isEdge = nodeData[j];
          if (isEdge == 1) {
            graph.addEdge({from: 'n' + i, to: 'n' + j, weight: 1});
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
    else {
      console.error("Failed to load graph");
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
      node.x = Math.random() * 2 - 1
      node.y = Math.random() * 2 - 1
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
    node.force = {x: 0, y: 0}
  })
  graph.forEachNode((node) => {
    if (!node.nailed && graph.degree(node.id) > 0) {
      force = {x: 0, y: 0}
      graph.forEachEdgeAt(node.id, (edge) => {
        let otherId = edge.from == node.id ? edge.to : edge.from
        let otherNode = graph.getNode(otherId)
        force.x += (otherNode.prevX - node.prevX) * edge.weight
        force.y += (otherNode.prevY - node.prevY) * edge.weight
      })
      dx = renderer.settings.rate * force.x
      dy = renderer.settings.rate * force.y
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


export { loadGraph, GraphRenderer, randomizeFreeNodes, rubberBandStep };
