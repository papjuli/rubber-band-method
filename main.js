import { loadGraph, parseGrf } from './graph.js'

const topicElement = document.getElementById('topic-text')
const nextButton = document.getElementById('next-btn')
const prevButton = document.getElementById('prev-btn')

let page = 0

loadTopic('Intro')
nextButton.onclick = nextPage
document.getElementById('prev-btn').onclick = prevPage

parseGrf("./graphs/dodecahedron.grf", loadGraph)

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

function loadTopic(topicName) {
  fetch(`./topics/${topicName}.html`)
  .then(response => response.text())
  .then((data) => {
    topicElement.innerHTML = data
    page = 0
    prevButton.disabled = true
    if (topicElement.children.length == 1) {
      nextButton.disabled = true
    } else {
      nextButton.disabled = false
    }
  })
}

function nextPage() {
  if (page == topicElement.children.length - 1) return
  topicElement.children[page].style.display = "none"
  if (page == 0) {
    prevButton.disabled = false
  }
  page++
  topicElement.children[page].style.display = "block"
  if (page == topicElement.children.length - 1) {
    nextButton.disabled = true
  }
}

function prevPage() {
  if (page == 0) return
  topicElement.children[page].style.display = "none"
  if (page == topicElement.children.length - 1) {
    nextButton.disabled = false
  }
  page--
  topicElement.children[page].style.display = "block"
  if (page == 0) {
    prevButton.disabled = true
  }
}

