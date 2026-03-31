<template>
  <div class="canvas-sizer" :style="{ width: canvasSize * state.zoom + 'px', height: canvasSize * state.zoom + 'px' }">
    <canvas
      ref="canvasEl"
      data-editor="main"
      :width="canvasSize"
      :height="canvasSize"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @contextmenu.prevent="onRightClick"
      @wheel.prevent="onWheel"
      :style="{ cursor: cursorStyle, transform: `scale(${state.zoom})`, transformOrigin: '0 0' }"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { state, GRID, getPixel, setPixel, getCompositePixel, deleteRow, restoreRow, saveSnapshot, undo, brushShapes } from '../store.js'
import { darkenColor, brightenColor, plotLine, findPixelIssues, computeAAColor } from '../utils.js'

const PIXEL = 8
const canvasSize = GRID * PIXEL
const canvasEl = ref(null)

let ctx = null
let painting = false
let lastX = -1, lastY = -1
let animFrame = null
let hoverX = -1, hoverY = -1
let layerFlashTime = 0
let strokeOrigin = null // snapshot of original colors for shadow/light strokes

const cursorStyle = ref('crosshair')

watch(() => state.currentLayerIndex, () => {
  layerFlashTime = performance.now()
})

function toGrid(e) {
  const rect = canvasEl.value.getBoundingClientRect()
  const scale = canvasSize / rect.width
  const x = Math.floor((e.clientX - rect.left) * scale / PIXEL)
  const y = Math.floor((e.clientY - rect.top) * scale / PIXEL)
  return [Math.max(0, Math.min(GRID - 1, x)), Math.max(0, Math.min(GRID - 1, y))]
}

function canPaint(li, x, y) {
  if (!state.insidePaint) return true
  return getPixel(li, x, y) !== null
}

function applyToolAt(li, tool, px, py) {
  if (tool === 'pen') {
    if (canPaint(li, px, py)) setPixel(li, px, py, state.currentColor)
  } else if (tool === 'shadow') {
    const key = py * GRID + px
    const original = strokeOrigin ? (strokeOrigin[key] || null) : getPixel(li, px, py)
    if (original) setPixel(li, px, py, darkenColor(original))
  } else if (tool === 'light') {
    const key = py * GRID + px
    const original = strokeOrigin ? (strokeOrigin[key] || null) : getPixel(li, px, py)
    if (original) setPixel(li, px, py, brightenColor(original))
  } else if (tool === 'shadow_pattern') {
    if ((px + py) % 2 === 0 && canPaint(li, px, py)) setPixel(li, px, py, state.currentColor)
  } else if (tool === 'antialias') {
    // Gather distinct neighbor colors (cardinal only)
    const neighborColors = []
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = px + dx, ny = py + dy
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue
      const key = ny * GRID + nx
      const c = strokeOrigin ? strokeOrigin[key] : getPixel(li, nx, ny)
      if (c && !neighborColors.includes(c)) neighborColors.push(c)
    }
    if (neighborColors.length < 2) return
    const aa = computeAAColor(neighborColors)
    if (aa) setPixel(li, px, py, aa)
  }
}

function stampEye(x, y) {
  const li = state.currentLayerIndex
  const stamp = state.eyeStamps[state.selectedEye]
  if (!stamp) return
  for (const { dx, dy, color } of stamp.pixels) {
    const px = x + dx, py = y + dy
    if (px < 0 || px >= GRID || py < 0 || py >= GRID) continue
    setPixel(li, px, py, color)
    if (state.mirrorMode) {
      const mx = GRID - 1 - px
      if (mx >= 0 && mx < GRID) setPixel(li, mx, py, color)
    }
  }
}

function applyTool(x, y) {
  const li = state.currentLayerIndex
  const tool = state.tool

  if (tool === 'delete_row') {
    deleteRow(y)
    painting = false
    return
  }

  if (state.brush === 'eyes') {
    stampEye(x, y)
    painting = false
    return
  }

  const offsets = brushShapes[state.brush].offsets
  for (const [dx, dy] of offsets) {
    const px = x + dx, py = y + dy
    if (px < 0 || px >= GRID || py < 0 || py >= GRID) continue
    applyToolAt(li, tool, px, py)
    if (state.mirrorMode) {
      const mx = GRID - 1 - px
      if (mx < 0 || mx >= GRID) continue
      applyToolAt(li, tool, mx, py)
    }
  }
}

function onMouseDown(e) {
  if (e.button === 2 || state.moviePlaying) return
  saveSnapshot()
  const tool = state.tool
  if (tool === 'shadow' || tool === 'light' || tool === 'antialias') {
    strokeOrigin = [...state.layers[state.currentLayerIndex].data]
  }
  painting = true
  const [x, y] = toGrid(e)
  lastX = x; lastY = y
  applyTool(x, y)
}

function onMouseMove(e) {
  const [x, y] = toGrid(e)
  hoverX = x; hoverY = y
  if (!painting) return
  if (x === lastX && y === lastY) return
  plotLine(lastX, lastY, x, y, applyTool)
  lastX = x; lastY = y
}

function onMouseUp() {
  painting = false
  lastX = -1; lastY = -1
  strokeOrigin = null
}

function onWheel(e) {
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  state.zoom = Math.min(5, Math.max(0.2, state.zoom + delta))
}

function onRightClick(e) {
  const tool = state.tool
  if (tool === 'pen') {
    const [x, y] = toGrid(e)
    const color = getCompositePixel(x, y)
    state.currentColor = color || null
  } else if (tool === 'delete_row') {
    restoreRow()
  } else {
    state.tool = 'pen'
  }
}

function render(time) {
  if (!ctx) { animFrame = requestAnimationFrame(render); return }

  ctx.clearRect(0, 0, canvasSize, canvasSize)

  // Background
  const bg = state.background
  if (bg === 'diamonds') {
    const t = (Math.sin(time / 12000 * Math.PI * 2) + 1) / 2
    const dark = 40, light = 55
    const a = dark + (light - dark) * t
    const b = dark + (light - dark) * (1 - t)
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const dx = x % 4, dy = y % 4
        const inDiamond = Math.abs(dx - 1.5) + Math.abs(dy - 1.5) <= 2
        const cellOdd = (Math.floor(x / 4) + Math.floor(y / 4)) % 2
        const checker = inDiamond ? cellOdd : 1 - cellOdd
        const v = checker ? a : b
        ctx.fillStyle = `rgb(${v},${v},${v})`
        ctx.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL)
      }
    }
  } else if (bg === 'purple') {
    for (let y = 0; y < GRID; y++) {
      const t = y / GRID
      const r = Math.round(30 + t * 15)
      const g = Math.round(20 + t * 10)
      const b = Math.round(45 + t * 20)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(0, y * PIXEL, canvasSize, PIXEL)
    }
  } else if (bg === 'sky') {
    for (let y = 0; y < GRID; y++) {
      const t = y / GRID
      const r = Math.round(40 + t * 60)
      const g = Math.round(80 + t * 80)
      const b = Math.round(160 - t * 40)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(0, y * PIXEL, canvasSize, PIXEL)
    }
  } else if (bg === 'night') {
    for (let y = 0; y < GRID; y++) {
      const t = y / GRID
      const r = Math.round(8 + t * 12)
      const g = Math.round(8 + t * 15)
      const b = Math.round(25 + t * 20)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(0, y * PIXEL, canvasSize, PIXEL)
    }
  }

  // Draw layers bottom to top
  for (let i = 0; i < state.layers.length; i++) {
    const layer = state.layers[i]
    if (!layer.visible) continue

    let alpha = 1
    if (state.soloMode && i !== state.currentLayerIndex) alpha = 0.15

    ctx.globalAlpha = alpha
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const c = layer.data[y * GRID + x]
        if (c) {
          ctx.fillStyle = c
          ctx.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL)
        }
      }
    }
    ctx.globalAlpha = 1
  }

  // Layer selection flash
  if (layerFlashTime > 0) {
    const elapsed = time - layerFlashTime
    const duration = 400
    if (elapsed < duration) {
      const flashAlpha = 0.35 * (1 - elapsed / duration)
      const currentLayer = state.layers[state.currentLayerIndex]
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (currentLayer.data[y * GRID + x]) {
            ctx.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL)
          }
        }
      }
    } else {
      layerFlashTime = 0
    }
  }

  // Pixel radar overlay
  if (state.pixelRadar) {
    const currentLayer = state.layers[state.currentLayerIndex]
    const { doubles } = findPixelIssues(currentLayer.data, GRID, state.currentColor)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.45)'
    for (const idx of doubles) {
      ctx.fillRect((idx % GRID) * PIXEL, Math.floor(idx / GRID) * PIXEL, PIXEL, PIXEL)
    }
  }

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath()
    ctx.moveTo(i * PIXEL, 0); ctx.lineTo(i * PIXEL, canvasSize)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * PIXEL); ctx.lineTo(canvasSize, i * PIXEL)
    ctx.stroke()
  }

  // Mirror line
  if (state.mirrorMode) {
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.3)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(canvasSize / 2, 0)
    ctx.lineTo(canvasSize / 2, canvasSize)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Hover cursor showing brush shape or eye preview
  if (hoverX >= 0 && hoverY >= 0) {
    if (state.brush === 'eyes' && state.eyeStamps[state.selectedEye]) {
      const stamp = state.eyeStamps[state.selectedEye]
      ctx.globalAlpha = 0.6
      for (const { dx, dy, color } of stamp.pixels) {
        const px = hoverX + dx, py = hoverY + dy
        if (px < 0 || px >= GRID || py < 0 || py >= GRID) continue
        ctx.fillStyle = color
        ctx.fillRect(px * PIXEL, py * PIXEL, PIXEL, PIXEL)
      }
      ctx.globalAlpha = 1
    } else {
      const offsets = brushShapes[state.brush].offsets
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 1
      for (const [dx, dy] of offsets) {
        const px = hoverX + dx, py = hoverY + dy
        if (px < 0 || px >= GRID || py < 0 || py >= GRID) continue
        ctx.fillRect(px * PIXEL, py * PIXEL, PIXEL, PIXEL)
        ctx.strokeRect(px * PIXEL + 0.5, py * PIXEL + 0.5, PIXEL - 1, PIXEL - 1)
      }
    }
  }

  animFrame = requestAnimationFrame(render)
}

function onKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    undo()
  }
}

onMounted(() => {
  ctx = canvasEl.value.getContext('2d')
  ctx.imageSmoothingEnabled = false
  animFrame = requestAnimationFrame(render)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.canvas-sizer {
  flex-shrink: 0;
  margin: auto;
}
canvas {
  display: block;
  image-rendering: pixelated;
}
</style>
