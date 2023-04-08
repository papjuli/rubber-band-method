import { loadGraph, GraphRenderer, randomizeFreeNodes, rubberBandStep } from './graph.js'

const topicTextElement = document.getElementById('topic-text')
const tabLinks = document.getElementsByClassName('tablink')

loadTopic('Intro', document.getElementById('IntroTab'))

const graphsForTopics = new Map([
  ["Intro", "./graphs/dodecahedron.grf"],
  ["Planarity", "./graphs/dodecahedron.grf"],
  ["Connectivity", "./graphs/twins.grf"],
  ["MaxCut", "./graphs/planar5.grf"],
  ["SquareTiling" , "./graphs/dodecahedron.grf"],
])


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

function setInfo(renderer, graphName) {
  document.getElementById('graph-name').innerHTML = graphName;
  document.getElementById('num-vertices').innerHTML = renderer.graph.nodeCount();
  document.getElementById('num-edges').innerHTML = renderer.graph.edgeCount();
}

loadGraph(
  "./graphs/dodecahedron.grf", 
  renderer, 
  (renderer) => setInfo(renderer, "dodecahedron")
);

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
    for (let i = 0; i < tabLinks.length; i++) {
      tabLinks[i].classList.remove("active");
    }
    button.classList.add("active");
  })
}


document.querySelectorAll("#topicTabs button").forEach(btn => {
  btn.onclick = () => {
    loadTopic(btn.dataset.topicName, btn);
    loadGraph(graphsForTopics.get(btn.dataset.topicName), renderer);
  }
})

document.querySelectorAll("#loadGraphDropdown button").forEach(btn => {
  btn.onclick = () => {
    loadGraph(`./graphs/${btn.dataset.name}.grf`, renderer, 
      (renderer) => setInfo(renderer, btn.innerHTML));
  }
})

document.querySelectorAll("#forceDropdown input").forEach(btn => {
  btn.onclick = () => {
    renderer.mode = btn.dataset.mode;
  }
})
