import { createApp } from 'vue'
import App from './App.vue'
import { state, GRID, undo, mergeDown, brushShapes } from './store.js'
import { findPixelIssues } from './utils.js'

window.__paintmode = { state, GRID, undo, mergeDown, brushShapes }
window.__paintmode_utils = { findPixelIssues }

createApp(App).mount('#app')
