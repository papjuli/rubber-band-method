
class Graph {
  constructor() {
    this.nodesById = new Map();
    this.edgesAt = new Map();
  }

  addNode(node) {
    if (!node.id) node.id = globalThis.crypto.randomUUID();
    this.nodesById.set(node.id, node);
    this.edgesAt.set(node.id, new Set());
    console.log("Added node", node.id);
    return node;
  }

  deleteNode(node) {
    this.edgesAt.get(node.id).forEach((adjEdge) => {
      this.deleteEdge(adjEdge);
    });
    this.nodesById.delete(node.id);
  }

  addEdge(edge) {
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
    return this.edgesAt.get(nodeId).size;
  }

  edgeCountBetween(nodeId, nodeSet) {
    if (nodeSet.has(nodeId)) return 0;
    let count = 0;
    this.forEachEdgeAt(nodeId, (edge) => {
      if (nodeSet.has(edge.from) || nodeSet.has(edge.to)) {
        count++;
      }
    });
    return count;
  }

  weightedDegree(nodeId) {
    let degree = 0;
    this.forEachEdgeAt(nodeId, (edge) => {
      degree += edge.weight;
    });
    return degree;
  }

  placeNailedNodes() {
    let nailedNodes = [];
    this.forEachNode((node) => {
      if (node.nailed) nailedNodes.push(node);
    });
    if (nailedNodes.length == 0) return;
    if (nailedNodes.length == 1) {
      nailedNodes[0].x = 0;
      nailedNodes[0].y = 1;
      return;
    }
    if (nailedNodes.length == 2) {
      nailedNodes[0].x = -1;
      nailedNodes[0].y = 0;
      nailedNodes[1].x = 1;
      nailedNodes[1].y = 0;
      return;
    }
    let alpha = 2 * Math.PI / nailedNodes.length
    // put nailed nodes around unit circle, in the order they are in the file
    for (let i = 0; i < nailedNodes.length; i++) {
      nailedNodes[i].x = Math.sin(i * alpha);
      nailedNodes[i].y = Math.cos(i * alpha);
    }
  }

  randomizeFreeNodes() {
    this.forEachNode((node) => {
      if (!node.nailed) {
        if (!node.fixed_x) node.x = Math.random() * 2 - 1;
        if (!node.fixed_y) node.y = Math.random() * 2 - 1;
      }
    });
  }

  rubberBandStepNodes(rate, forceMode) {
    let force, dx, dy;
    let maxChange = 0;
    let maxCoord = 0;
    this.forEachNode((node) => {
      node.prevX = node.x;
      node.prevY = node.y;
    })
    this.forEachNode((node) => {
      if (!node.nailed && this.degree(node.id) > 0) {
        force = { x: 0, y: 0 };
        this.forEachEdgeAt(node.id, (edge) => {
          let otherId = edge.from == node.id ? edge.to : edge.from;
          let otherNode = this.getNode(otherId);
          force.x += (otherNode.prevX - node.prevX) * edge.weight;
          force.y += (otherNode.prevY - node.prevY) * edge.weight;
        });
        dx = rate * force.x;
        dy = rate * force.y;
        if (node.fixed_x) dx = 0;
        if (node.fixed_y) dy = 0;
        if (forceMode == "attract") {
          node.x += dx;
          node.y += dy;
        } else {
          node.x -= dx;
          node.y -= dy;
        }
        if (forceMode == "repel-constrained") {
          let r = Math.sqrt(node.x * node.x + node.y * node.y);
          if (r > 1) {
            node.x /= r;
            node.y /= r;
          }
        }
        maxChange = Math.max(maxChange, Math.abs(node.x - node.prevX), Math.abs(node.y - node.prevY));
        maxCoord = Math.max(maxCoord, Math.abs(node.x), Math.abs(node.y));
      }
    })
    return { maxChange: maxChange, maxCoord: maxCoord };
  }

  solveEquilibrium(otherFixedNodeId = null) {
    let nodeIndex = new Map();
    let indexNode = [];
    let n = this.nodeCount();
    let matrix = math.zeros(n, n, 'sparse');
    let bX = [];
    let bY = [];
    let i = 0;
    this.forEachNode((node) => {
      nodeIndex.set(node.id, i);
      indexNode.push(node.id);
      i++;
    });

    for (let row = 0; row < n; row++) {
      let nodeId = indexNode[row];
      let node = this.getNode(nodeId);
      if (node.nailed || otherFixedNodeId === nodeId) {
        matrix.set([row, row], 1);
        bX.push(node.x);
        bY.push(node.y);
      } else {
        for (let edge of this.edgesAt.get(nodeId)) {
          let otherId = edge.from == nodeId ? edge.to : edge.from;
          let col = nodeIndex.get(otherId);
          matrix.set([row, col], matrix.get([row, col]) - 1 * edge.weight);
        }
        matrix.set([row, row], this.weightedDegree(nodeId));
        bX.push(0);
        bY.push(0);
      }
    }
    // Solve for x and y coordinates
    let xSolution = math.lusolve(matrix, bX);
    let ySolution = math.lusolve(matrix, bY);
    // Update node positions
    for (let i = 0; i < n; i++) {
      let nodeId = indexNode[i];
      // leave isolated node where it is (otherwise would go to 0,0)
      if (this.degree(nodeId) == 0) continue;
      let node = this.getNode(nodeId);
      node.x = xSolution.get([i, 0]);
      node.y = ySolution.get([i, 0]);
    }
  }

  setupGraphForTiling() {
    console.log("setupGraphForTiling")
    // choose two nodes (which should be on a face)
    let nailedNodes = [];
    this.forEachNode((node) => {
      if (node.nailed) nailedNodes.push(node);
    });
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
  }

  createSquareTiling() {
    console.log("Creating square tiling");
    // Assumes the graph is already set up for tiling 
    // and rubber banding is applied.
    // Sort the nodes by x coordinate.
    let nodes = [];
    this.forEachNode((node) => {
      nodes.push(node);
      node.height = undefined;
    });
    nodes.sort((a, b) => a.x - b.x);
    // define heights for the nodes, which will be the y-coordinate of the
    // square corresponding to the lowest edge going right from the node.
    let tiling = { squares: [], verticalSegments: new Map() };
    nodes[0].height = -1;
    tiling.verticalSegments.set(nodes[0].id, { y1: nodes[0].height, y2: 2 * nodes[0].y });
    nodes.forEach((node) => {
      let laterNeighbors = [];
      this.forEachEdgeAt(node.id, (edge) => {
        let otherId = edge.from == node.id ? edge.to : edge.from;
        let otherNode = this.getNode(otherId);
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
        tiling.verticalSegments.set(node.id, { y1: node.height, y2: currHeight });
      } else {
        node.y = nodes[0].y;
        let seg0 = tiling.verticalSegments.get(nodes[0].id);
        tiling.verticalSegments.set(node.id, { y1: seg0.y1, y2: seg0.y2 });
      }
    });
    return tiling;
  }

  currentCutSize(colorName) {
    let cutSize = 0;
    this.forEachEdge((edge) => {
      let node1 = this.getNode(edge.from);
      let node2 = this.getNode(edge.to);
      if (node1.color === colorName && node2.color !== colorName ||
          node1.color !== colorName && node2.color === colorName) {
        cutSize++;
      }
    });
    return cutSize;
  }

  preciseMaxCut() {
    // Brute force search for max cut, using branch-and-bound.
    // Returns an object with part1, part2 (sets of node ids) and cutSize.
    let nodes = [];
    this.forEachNode((node) => {
      nodes.push(node);
    });
    // sort decreasing by degree
    nodes.sort((a, b) => this.degree(b.id) - this.degree(a.id));
    let n = nodes.length;
    let bestCut = { part1: new Set(), part2: new Set(), cutSize: 0 };
    let currentCut = { part1: new Set(), part2: new Set(), cutSize: 0 };

    function backtrack(index) {
      if (index == n) {
        if (currentCut.cutSize > bestCut.cutSize) {
          bestCut.part1 = new Set(currentCut.part1);
          bestCut.part2 = new Set(currentCut.part2);
          bestCut.cutSize = currentCut.cutSize;
        }
        return;
      }
      let node = nodes[index];

      // bound: if current cut size + max possible remaining edges <= best cut size, prune
      if (currentCut.cutSize + (n - index) * this.degree(node.id) <= bestCut.cutSize) {
        return;
      }

      // branch 1: put node in part1
      currentCut.part1.add(node.id);
      let edgesBetween = this.edgeCountBetween(node.id, currentCut.part2);
      currentCut.cutSize += edgesBetween;
      backtrack.bind(this)(index + 1);
      currentCut.part1.delete(node.id);
      currentCut.cutSize -= edgesBetween;
      // branch 2: put node in part2
      currentCut.part2.add(node.id);
      edgesBetween = this.edgeCountBetween(node.id, currentCut.part1);
      currentCut.cutSize += edgesBetween;
      backtrack.bind(this)(index + 1);
      currentCut.part2.delete(node.id);
      currentCut.cutSize -= edgesBetween;
    }

    backtrack.bind(this)(0);
    console.log(bestCut);
    return bestCut;
  }
}


function parseGrf(url, callback) {
  var xhr = new XMLHttpRequest();
  if (!xhr) throw 'XMLHttpRequest not supported, cannot load the file.';

  var graph = new Graph();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      var lines = xhr.responseText.split('\n')
        .filter(line => !line.startsWith('#'));
      var nodeCount = parseInt(lines[0]);
      var i, j, nodeData, isEdge, color;
      for (i = 0; i < nodeCount; i++) {
        graph.addNode({ id: 'n' + i });
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


export { Graph, parseGrf };
