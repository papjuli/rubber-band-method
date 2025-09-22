import { loadGraph, GraphRenderer } from './renderer.js'
import { createSquareTiling, randomizeFreeNodes } from "./graph.js";


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
    size: 0.04,
    strokeWidth: 0.008,
    color: "#2c43a5ff",
    nailColor: "lightgrey"
  },
  edges: {
    color: "#2c43a5ff",
    width: 0.006
  },
  rate: 0.04,
  delay: 0.04,
  threshold: 0.00001,
  colors: new Map([
    ["Red", "#ed0707ff"],
    ["Dark blue", "#2c43a5ff"],
    ["Light blue", "#3795f9ff"],
    ["Green", "#09c681ff"],
    ["Yellow", "#eeee00"],
    ["Orange", "#ee8800"],
    ["Purple", "#aa00ee"],
    ["Black", "#000000"],
    ["Grey", "#888888"],
    ["White", "#ffffff"],
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
document.getElementById('run-button').onclick = () => renderer.rubberBandStep();


function hideSecondMenuRow() {
  document.querySelectorAll('.graph-menu-row-2').forEach(row => {
    row.setAttribute("hidden", "true");
  });
}

function loadTopic(topicName, button) {
  currentTopic = topicName;
  if (topicName == "SquareTiling") {
    hideSecondMenuRow();
    document.getElementById("square-tiling-controls").removeAttribute("hidden");
  } else {
    document.getElementById("square-tiling-controls").setAttribute("hidden", "true");
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

const editButton = document.getElementById('edit-graph-button');
const editButtonIcon = document.getElementById('edit-graph-icon');
const editButtonsContainer = document.getElementById('edit-buttons-container');
const editModeButtons = new Map([
  ['edges', document.getElementById('add-edge-button')],
  ['manual-move', document.getElementById('manual-move-button')],
  ['rubber-band-move', document.getElementById('rubber-band-move-button')],
]);

function deactivateEditModeButtons() {
  editModeButtons.forEach((btn) => {
    btn.classList.remove('active-button');
  });
}

document.getElementById('edit-graph-button').onclick = () => {
  if (editButtonsContainer.hasAttribute("hidden")) {
    hideSecondMenuRow()
    editButtonsContainer.removeAttribute("hidden");
    editButtonIcon.setAttribute("src", "assets/lock-unlock-line.svg");
    editButton.classList.add('active-button');
    renderer.editMode = "editing";
  }
  else {
    editButtonsContainer.setAttribute("hidden", "true");
    if (currentTopic === "SquareTiling") {
      document.getElementById("square-tiling-controls").removeAttribute("hidden");
    }
    editButtonIcon.setAttribute("src", "assets/lock-line.svg");
    editButton.classList.remove('active-button');
    deactivateEditModeButtons();
    renderer.editMode = null;
  }
  renderer.render();
}

editModeButtons.forEach((btn, mode) => {
  btn.onclick = () => {
    let was_active = btn.classList.contains('active-button');
    deactivateEditModeButtons();
    if (!was_active) {
      btn.classList.add('active-button');
    }
    renderer.editMode = was_active ? "editing" : mode;
    renderer.render();
  };
});

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
