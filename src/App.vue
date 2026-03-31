<template>
  <div class="app">
    <header class="header">
      <span class="title">PaintMode</span>
      <div class="header-menu">
        <button class="header-menu-btn" @click="toggleMenu('save')">Save &#x25BE;</button>
        <div v-if="openMenu === 'save'" class="header-dropdown">
          <button @click="exportPng(1); openMenu = null">Save PNG</button>
          <button @click="exportPng(4); openMenu = null">Save x4 PNG</button>
          <button @click="saveSession(); openMenu = null">Save Session</button>
        </div>
      </div>
      <div class="header-menu">
        <button class="header-menu-btn" @click="toggleMenu('effects')">Effects &#x25BE;</button>
        <div v-if="openMenu === 'effects'" class="header-dropdown">
          <button @click="generateOutline(true); openMenu = null">Outline Layer</button>
          <button @click="generateOutline(false); openMenu = null">Outline All</button>
          <button @click="generateInnerOutline(true); openMenu = null">Inner Outline Layer</button>
          <button @click="generateInnerOutline(false); openMenu = null">Inner Outline All</button>
        </div>
      </div>
      <div class="header-menu">
        <button class="header-menu-btn" @click="toggleMenu('bg')">Background &#x25BE;</button>
        <div v-if="openMenu === 'bg'" class="header-dropdown">
          <button :class="{ active: state.background === 'diamonds' }" @click="state.background = 'diamonds'; openMenu = null">Dancing Diamonds</button>
          <button :class="{ active: state.background === 'purple' }" @click="state.background = 'purple'; openMenu = null">Purple</button>
          <button :class="{ active: state.background === 'sky' }" @click="state.background = 'sky'; openMenu = null">Blue Sky</button>
          <button :class="{ active: state.background === 'night' }" @click="state.background = 'night'; openMenu = null">Night Sky</button>
        </div>
      </div>
      <div class="header-menu">
        <button class="header-menu-btn" :class="{ active: state.moviePlaying }" @click="toggleMenu('playback')">Playback &#x25BE;</button>
        <div v-if="openMenu === 'playback'" class="header-dropdown">
          <button @click="state.moviePlaying ? stopMovie() : startMovie(); openMenu = null">
            {{ state.moviePlaying ? '\u25A0 Stop' : '\u25B6 Play' }}
          </button>
          <button @click="exportGif(); openMenu = null">Save GIF</button>
        </div>
      </div>
    </header>
    <div class="main">
      <Toolbar />
      <div class="canvas-wrap">
        <EditorCanvas />
      </div>
      <LayerPanel />
    </div>
    <PaletteBar />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import EditorCanvas from './components/EditorCanvas.vue'
import Toolbar from './components/Toolbar.vue'
import LayerPanel from './components/LayerPanel.vue'
import PaletteBar from './components/PaletteBar.vue'
import { state, GRID, loadPalette, loadEyeStamps, loadSession, saveSession, startMovie, stopMovie, getPlaybackFrames, generateOutline, generateInnerOutline } from './store.js'
import { encodeGif } from './gif.js'

const openMenu = ref(null)

function toggleMenu(name) {
  openMenu.value = openMenu.value === name ? null : name
}

function onClickOutside(e) {
  if (openMenu.value && !e.target.closest('.header-menu')) {
    openMenu.value = null
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  loadPalette()
  loadEyeStamps()
  loadSession()
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
})

function exportPng(scale) {
  const size = GRID * scale
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  // Transparent background (PNG alpha)
  ctx.clearRect(0, 0, size, size)

  // Composite layers bottom to top
  for (const layer of state.layers) {
    if (!layer.visible) continue
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const c = layer.data[y * GRID + x]
        if (c) {
          ctx.fillStyle = c
          ctx.fillRect(x * scale, y * scale, scale, scale)
        }
      }
    }
  }

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = scale === 1 ? 'paintmode.png' : `paintmode_x${scale}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function exportGif() {
  const playbackFrames = getPlaybackFrames()
  if (playbackFrames.length === 0) return

  const scale = 4
  const size = GRID * scale
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  const gifFrames = []
  for (const layers of playbackFrames) {
    ctx.clearRect(0, 0, size, size)
    for (const layer of layers) {
      if (!layer.visible) continue
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const c = layer.data[y * GRID + x]
          if (c) {
            ctx.fillStyle = c
            ctx.fillRect(x * scale, y * scale, scale, scale)
          }
        }
      }
    }
    gifFrames.push(ctx.getImageData(0, 0, size, size))
  }

  const gifData = encodeGif(gifFrames, size, size, 180)
  const blob = new Blob([gifData], { type: 'image/gif' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'paintmode.gif'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #111;
  color: #ddd;
}
.header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 12px;
  background: #0a0a0a;
  border-bottom: 1px solid #222;
}
.title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #7a8baa;
}
.header-menu {
  position: relative;
}
.header-menu-btn {
  background: #222;
  color: #ccc;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
}
.header-menu-btn:hover {
  background: #2a2a2a;
}
.header-menu-btn.active {
  background: #335;
  border-color: #55a;
  color: #fff;
}
.header-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 2px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  z-index: 100;
  min-width: 140px;
}
.header-dropdown button {
  background: none;
  color: #ccc;
  border: none;
  padding: 6px 12px;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  white-space: nowrap;
}
.header-dropdown button:hover {
  background: #335;
  color: #fff;
}
.header-dropdown button.active {
  color: #8af;
}
.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.canvas-wrap {
  flex: 1;
  padding: 12px;
  overflow: auto;
}
</style>
