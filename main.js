import { loadGraph, parseGrf } from './graph.js'

const topicTextElement = document.getElementById('topic-text')

loadTopic('Intro')

parseGrf("./graphs/dodecahedron.grf", loadGraph)


function loadTopic(topicName) {
  fetch(`./topics/${topicName}.html`)
  .then(response => response.text())
  .then((data) => {
    topicTextElement.innerHTML = data
  })
}

let loadTopicButtons = document.querySelectorAll("#loadTopicDropdown button")
loadTopicButtons.forEach(btn => {
  btn.onclick = () => {
    loadTopic(btn.dataset.topicName)
  }
})

let loadGraphButtons = document.querySelectorAll("#loadGraphDropdown button")
loadGraphButtons.forEach(btn => {
  btn.onclick = () => {
    parseGrf(`./graphs/${btn.dataset.name}.grf`, loadGraph)
  }
})
