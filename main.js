import { loadGraph, GraphRenderer, randomizeFreeNodes, rubberBandStep } from './graph.js'

const topicTextElement = document.getElementById('topic-text');
const tabLinks = document.getElementsByClassName('tablink');

loadTopic('Intro', document.getElementById('IntroTab'));

const graphsForTopics = new Map([
  ["Intro", "dodecahedron"],
  ["Planarity", "dodecahedron"],
  ["Connectivity", "twins"],
  ["MaxCut", "planar5"],
  ["SquareTiling", "dodecahedron"],
]);

const allGraphs = new Map([
  ["accident", "./graphs/accident.grf"],
  ["accident 2", "./graphs/accident2.grf"],
  ["connectivity proof", "./graphs/connectproof.grf"],
  ["cube", "./graphs/cube.grf"],
  ["dodecahedron", "./graphs/dodecahedron.grf"],
  ["dodeca+", "./graphs/dodecaplus.grf"],
  ["dodecasymm", "./graphs/dodecasymm.grf"],
  ["grid", "./graphs/grid.grf"],
  ["grid-", "./graphs/gridminus.grf"],
  ["icosahedron", "./graphs/icosahedron.grf"],
  ["max cut big", "./graphs/maxcutbig.grf"],
  ["max cut bigger", "./graphs/maxcutbigger.grf"],
  ["max cut intro", "./graphs/maxcutintro.grf"],
  ["MyGraph", "./graphs/MyGraph.grf"],
  ["non2con", "./graphs/non2con.grf"],
  ["octahedron", "./graphs/octahedron.grf"],
  ["onesep", "./graphs/onesep.grf"],
  ["Petersen", "./graphs/petersen.grf"],
  ["Petersen var", "./graphs/petersen-var.grf"],
  ["pipe", "./graphs/pipe.grf"],
  ["planar0", "./graphs/planar0.grf"],
  ["planar1", "./graphs/planar1.grf"],
  ["planar2", "./graphs/planar2.grf"],
  ["planar3", "./graphs/planar3.grf"],
  ["planar4", "./graphs/planar4.grf"],
  ["planar5", "./graphs/planar5.grf"],
  ["planar6", "./graphs/planar6.grf"],
  ["planar7", "./graphs/planar7.grf"],
  ["planarpf", "./graphs/planarpf.grf"],
  ["planarx", "./graphs/planarx.grf"],
  ["prism", "./graphs/prism.grf"],
  ["squares", "./graphs/squares.grf"],
  ["termvil", "./graphs/termvil.grf"],
  ["tetrahedron", "./graphs/tetrahedron.grf"],
  ["tree1", "./graphs/tree1.grf"],
  ["tree2", "./graphs/tree2.grf"],
  ["tree3", "./graphs/tree3.grf"],
  ["tree4", "./graphs/tree4.grf"],
  ["tree5", "./graphs/tree5.grf"],
  ["triangles", "./graphs/triangles.grf"],
  ["twins", "./graphs/twins.grf"],
  ["twosep", "./graphs/twosep.grf"],
  ["twosep1", "./graphs/twosep1.grf"],
]);

let settings = {
  nodes: {
    size: 0.04,
    color: "#445498",  // "#023E8A"
    nailColor: "lightgrey"
  },
  edges: {
    color: "#445498",  // "#023E8A",
    width: 0.006
  },
  rate: 0.04,
  delay: 0.02,
  threshold: 0.00001,
  colors: new Map([
    ["Red", "#ee0000"],
    ["Blue", "#0000ee"],
    ["Green", "#03e090"],
    ["Yellow", "#eeee00"],
    ["White", "#445498"]
  ])
}

let renderer = new GraphRenderer(document.getElementById('graph-container'), settings);

function loadGraphAndSetInfo(graphName, path=null) {
  if (!path) path = allGraphs.get(graphName);
  loadGraph(path, renderer, (graph) => {
    document.getElementById('graph-name').innerHTML = graphName;
    document.getElementById('num-vertices').innerHTML = graph.nodeCount();
    document.getElementById('num-edges').innerHTML = graph.edgeCount();
  });
}

loadGraphAndSetInfo("dodecahedron");

document.getElementById('randomize-button').onclick = () => {
  randomizeFreeNodes(renderer.graph);
  renderer.render();
};
document.getElementById('run-button').onclick = () => rubberBandStep(renderer);


function loadTopic(topicName, button) {
  fetch(`./topics/${topicName}.html`)
  .then(response => response.text())
  .then((data) => {
    topicTextElement.innerHTML = data;
    topicTextElement.scrollIntoView();
    for (let i = 0; i < tabLinks.length; i++) {
      tabLinks[i].classList.remove("active");
    }
    button.classList.add("active");
  })
}


document.querySelectorAll("#topicTabs button").forEach(btn => {
  btn.onclick = () => {
    loadTopic(btn.dataset.topicName, btn);
    let graphName = graphsForTopics.get(btn.dataset.topicName);
    loadGraphAndSetInfo(graphName);
  }
})

allGraphs.forEach((path, name) => {
  let btn = document.createElement("button");
  btn.innerHTML = name;
  btn.onclick = () => loadGraphAndSetInfo(name, path);
  document.getElementById("loadGraphDropdown").appendChild(btn);
})

document.querySelectorAll("#forceDropdown input").forEach(btn => {
  btn.onclick = () => {
    renderer.mode = btn.dataset.mode;
  }
})
