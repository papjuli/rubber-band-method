import { loadGraph, GraphRenderer, randomizeFreeNodes, rubberBandStep, createSquareTiling } from './graph.js'


const topicTextElement = document.getElementById('topic-text');
const tabLinks = document.getElementsByClassName('tablink');
const loadGraphDropdown = document.getElementById('loadGraphDropdown');
const forceDropdown = document.getElementById('forceDropdown');
let currentTopic = "Intro";

loadTopic(currentTopic, document.getElementById('IntroTab'));

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
  // ["MyGraph", "./graphs/MyGraph.grf"],
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
    size: 0.05,
    color: "#445498",
    nailColor: "lightgrey"
  },
  edges: {
    color: "#445498",
    width: 0.006
  },
  rate: 0.04,
  delay: 0.04,
  threshold: 0.00001,
  colors: new Map([
    ["Red", "#ee0000"],
    ["Blue", "#0000ee"],
    ["Green", "#03e090"],
    ["Yellow", "#eeee00"],
    ["White", "#445498"]
  ]),
  morphSteps: 200
}

const graphContainer = document.getElementById('graph-container');
let renderer = new GraphRenderer(graphContainer, settings);

function loadGraphAndSetInfo(
    graphName, topicName, path=allGraphs.get(graphName)) {
  console.log("Loading graph:", graphName, "for topic:", topicName);
  loadGraph(path, renderer, (graph) => {
    document.getElementById('graph-name').innerHTML = graphName;
    document.getElementById('num-vertices').innerHTML = graph.nodeCount();
    document.getElementById('num-edges').innerHTML = graph.edgeCount();
  }, topicName);
}

loadGraphAndSetInfo("dodecahedron", "Intro");

document.getElementById('randomize-button').onclick = () => {
  randomizeFreeNodes(renderer.graph);
  renderer.render();
};
document.getElementById('run-button').onclick = () => rubberBandStep(renderer);


function loadTopic(topicName, button) {
  currentTopic = topicName;
  if (topicName == "SquareTiling") {
    document.querySelector(".square-tiling-controls").style.display = "block";
  } else {
    document.querySelector(".square-tiling-controls").style.display = "none";
  }
  fetch(`./topics/${topicName}.html`)
  .then(response => response.text())
  .then((data) => {
    topicTextElement.innerHTML = data;
    topicTextElement.scrollIntoView();
    for (const tab of tabLinks) {
      tab.classList.remove("active");
    }
    button.classList.add("active");
  })
}


document.querySelectorAll("#topicTabs button").forEach(btn => {
  btn.onclick = () => {
    loadTopic(btn.dataset.topicName, btn);
    let graphName = graphsForTopics.get(btn.dataset.topicName);
    loadGraphAndSetInfo(graphName, btn.dataset.topicName);
  }
})


allGraphs.forEach((path, name) => {
  let btn = document.createElement("button");
  btn.innerHTML = name;
  btn.onclick = () => loadGraphAndSetInfo(name, currentTopic, path);
  loadGraphDropdown.appendChild(btn);
})


forceDropdown.querySelectorAll("input").forEach(btn => {
  btn.onclick = () => {
    renderer.mode = btn.dataset.mode;
  }
})

const editbuttonicon = document.getElementById('edit-graph-icon');
const edit_node_btn = document.getElementById('edit-nodes-button');

document.getElementById('edit-graph-button').onclick = () => {
  if (renderer.editable == true) { 
    renderer.editable = false;
    editbuttonicon.setAttribute("src", "assets/lock-line.svg"); 
    document.getElementById('edit-buttons-container').toggleAttribute("hidden");
    //change cursor for nodes:
    renderer.render();
  }
  else { renderer.editable = true; 
    editbuttonicon.setAttribute("src", "assets/lock-unlock-line.svg");    
    document.getElementById('edit-buttons-container').toggleAttribute("hidden");
    edit_node_btn.classList.remove('active-button');
    edit_node_btn.classList.add('standard-button');
    renderer.editnodes = false;
    graphContainer.classList.remove('add-cursor');
    renderer.render();
  }
}

edit_node_btn.onclick = () => {
  if (renderer.editnodes) {
    renderer.editnodes = false;
    edit_node_btn.classList.remove('active-button');
    edit_node_btn.classList.add('standard-button');
    graphContainer.classList.remove('add-cursor');
  } else {
    renderer.editnodes = true;
    edit_node_btn.classList.add('active-button');
    edit_node_btn.classList.remove('standard-button');
    graphContainer.classList.add('add-cursor');
  }   
  renderer.render();
}

document.getElementById('squares-button').onclick = () => {
  let tiling = createSquareTiling(renderer.graph);
  renderer.setSquareTiling(tiling);
  renderer.render();
};


document.getElementById('show-hide-button').onclick = () => {
    renderer.showGraph = !renderer.showGraph;
    renderer.render();
};


document.getElementById('morph-button').onclick = () => {
  renderer.morphTiling();
};
