
const settings = {
  delay: 0.02,
  rate: 0.01,
  threshold: 0.00001,
  sigmaSettings: {
    defaultNodeColor: '#023E8A',
    defaultEdgeColor: '#023E8A'
  },
  sigmaContainer: document.getElementById("sigma-container"),
}

const sigma = new Sigma.Sigma(
  new graphology.Graph(),
  settings.sigmaContainer,
  settings.sigmaSettings
)

document.getElementById('run-button').onclick = rubberBandStep
document.getElementById('randomize-button').onclick = randomizeFreeNodes

let timeoutId = null;

function loadGraph(graph) {
  console.log("drawGraph")
  clearTimeout(timeoutId)
  sigma.graph = graph
  setUpGraph(graph)
}

function setUpGraph(graph) {
  graph.forEachNode((node, attributes) => {attributes.size = 6})
  graph.forEachEdge((e, attributes) => {attributes.weight = 2})
  placeNailedNodes(graph)
  randomizeFreeNodes(graph)
}

function logNodeAttributes(graph) {
  graph.forEachNode((node, attributes) => {
    console.log(node, attributes)
  })
}

function parseGrf(url, callback) {
  var xhr = new XMLHttpRequest()
  if (!xhr) throw 'XMLHttpRequest not supported, cannot load the file.'

  var graph = new graphology.Graph()
  xhr.open('GET', url, true)
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      var lines = xhr.responseText.split('\n')
        .filter(line => !line.startsWith('#'));
      var nodeCount = parseInt(lines[0]);
      var i, j, nodeData, isEdge;
      for (i = 0; i < nodeCount; i++) {
        graph.addNode('n' + i)
      }
      for (i = 0; i < nodeCount; i++) {
        nodeData = lines[i + 1].split(',');
        for (j = i + 1; j < nodeCount; j++) {
          isEdge = nodeData[j];
          if (isEdge == 1) {
            graph.addEdge('n' + i,'n' + j);
          }
        }
        for (j = nodeCount; j < nodeData.length; j++) {
          if (nodeData[j] != '' && nodeData[j] != '\r') {
            graph.setNodeAttribute('n' + i, nodeData[j], true)
          }
        }
      }
      if (callback)
        callback(graph);
    }
  };
  xhr.send();
}

function placeNailedNodes(graph) {
  let nailedNodes = [];
  graph.forEachNode((node, attributes) => {
    if (attributes.Nailed) nailedNodes.push(node)
  })
  // put nailed nodes around unit circle
  // we assume that they form a cycle with no other edges among them
  let alpha = 2 * Math.PI / nailedNodes.length
  let prevNode, nextNode
  let currentNode = nailedNodes[0]
  graph.setNodeAttribute(currentNode, "x", 0)
  graph.setNodeAttribute(currentNode, "y", 1)
  for (let i = 1; i < nailedNodes.length; i++) {
      nextNode = nailedNodes.find(n => {
          return graph.neighbors(currentNode).includes(n) && n != prevNode
      })
      prevNode = currentNode
      currentNode = nextNode
      graph.setNodeAttribute(currentNode, "x", Math.sin(i * alpha))
      graph.setNodeAttribute(currentNode, "y", Math.cos(i * alpha))
  }  
}

function randomizeFreeNodes() {
  // let seed = Math.random()
  // Math.seedrandom(seed)
  // console.log("random seed:", seed)
  sigma.graph.forEachNode((node, attributes) => {
    if (!attributes.Nailed) {
      attributes.x = Math.random() * 2 - 1
      attributes.y = Math.random() * 2 - 1
    }
  })
  sigma.refresh()
}

function rubberBandStep() {
  let graph = sigma.graph
  console.log('step')
  let force, dx, dy
  let maxChange = 0
  graph.forEachNode((node, attributes) => {
    attributes.prevX = attributes.x
    attributes.prevY = attributes.y
    attributes.force = {x: 0, y: 0}
  })
  graph.forEachNode((node, attributes) => {
    if (!attributes.Nailed && graph.degree(node) > 0) {
      force = {x: 0, y: 0}
      graph.forEachEdge(node, (e, edgeAttrs, source, target, sourceAttrs, targetAttrs) => {
        let otherAttrs = source == node ? targetAttrs : sourceAttrs
        force.x += (otherAttrs.x - attributes.x) * edgeAttrs.weight
        force.y += (otherAttrs.y - attributes.y) * edgeAttrs.weight
      })
      dx = settings.rate * force.x
      dy = settings.rate * force.y
      attributes.x += dx
      attributes.y += dy
      maxChange = Math.max(maxChange, Math.abs(dx), Math.abs(dy))
    }
  })
  sigma.refresh()

  if (maxChange > settings.threshold) {
    timeoutId = setTimeout(rubberBandStep, settings.delay)
  }
}

export { loadGraph, parseGrf }
