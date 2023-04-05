import { loadGraph, parseGrf } from './graph.js'

const topicTextElement = document.getElementById('topic-text')
const tabLinks = document.getElementsByClassName('tablink')

loadTopic('Intro', document.getElementById('IntroTab'))

parseGrf("./graphs/dodecahedron.grf", loadGraph)


function loadTopic(topicName, button) {
  fetch(`./topics/${topicName}.html`)
  .then(response => response.text())
  .then((data) => {
    topicTextElement.innerHTML = data;
    for (let i = 0; i < tabLinks.length; i++) {
      tabLinks[i].className = tabLinks[i].className.replace(" active", "")
    }
    button.className += " active"
  })
}

let loadTopicButtons = document.querySelectorAll("#topicTabs button")
loadTopicButtons.forEach(btn => {
  btn.onclick = () => {
    loadTopic(btn.dataset.topicName, btn)
  }
})

let loadGraphButtons = document.querySelectorAll("#loadGraphDropdown button")
loadGraphButtons.forEach(btn => {
  btn.onclick = () => {
    parseGrf(`./graphs/${btn.dataset.name}.grf`, loadGraph)
  }
})
