import { reactive } from 'vue'
import { darkenColor, rgbToHex } from './utils.js'
import paletteUrl from '/palette.png?url'
import eyesUrl from '/eyes.png?url'

export const GRID = 80
const undoStack = []

function cloneLayers() {
  return state.layers.map(l => ({
    name: l.name,
    visible: l.visible,
    data: [...l.data]
  }))
}

export function saveSnapshot() {
  undoStack.push({
    layers: cloneLayers(),
    currentLayerIndex: state.currentLayerIndex
  })
}

export function undo() {
  const snap = undoStack.pop()
  if (!snap) return
  state.layers.splice(0, state.layers.length, ...snap.layers)
  state.currentLayerIndex = snap.currentLayerIndex
  state.renderTick++
}

let movieTimer = null
let movieFinalState = null

function restoreState(snap) {
  state.layers.splice(0, state.layers.length, ...snap.layers.map(l => ({
    name: l.name, visible: l.visible, data: [...l.data]
  })))
  state.currentLayerIndex = snap.currentLayerIndex
  state.renderTick++
}

export function startMovie() {
  if (state.moviePlaying || undoStack.length === 0) return
  const frames = undoStack.map(s => s.layers)
  const finalLayers = cloneLayers()
  frames.push(finalLayers)
  movieFinalState = { layers: finalLayers, currentLayerIndex: state.currentLayerIndex }

  state.moviePlaying = true
  let i = 0

  function showFrame() {
    if (i >= frames.length) {
      state.moviePlaying = false
      movieFinalState = null
      movieTimer = null
      return
    }
    state.layers.splice(0, state.layers.length, ...frames[i].map(l => ({
      name: l.name, visible: l.visible, data: [...l.data]
    })))
    state.currentLayerIndex = Math.min(movieFinalState.currentLayerIndex, state.layers.length - 1)
    state.renderTick++
    i++
    movieTimer = setTimeout(showFrame, 180)
  }

  showFrame()
}

export function getPlaybackFrames() {
  if (undoStack.length === 0) return []
  const frames = undoStack.map(s => s.layers)
  frames.push(cloneLayers())
  return frames
}

export function stopMovie() {
  if (movieTimer) { clearTimeout(movieTimer); movieTimer = null }
  if (!state.moviePlaying) return
  if (movieFinalState) restoreState(movieFinalState)
  movieFinalState = null
  state.moviePlaying = false
}

function createLayer(name) {
  return {
    name,
    visible: true,
    data: new Array(GRID * GRID).fill(null)
  }
}

export const brushShapes = {
  pixel: { label: '1px', offsets: [[0, 0]] },
  cross: { label: '+', offsets: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
  square: { label: '2×2', offsets: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  ball: { label: '●', offsets: (() => {
    const o = []
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (dx * dx + dy * dy <= 5) o.push([dx, dy])
    return o
  })() },
}

export const state = reactive({
  tool: 'pen',
  brush: 'pixel',
  mirrorMode: true,
  pixelRadar: false,
  soloMode: false,
  insidePaint: false,
  currentColor: '#d9a066',
  currentLayerIndex: 0,
  layers: [createLayer('Layer 1')],
  palette: [],
  eyeStamps: [],
  selectedEye: 0,
  background: 'diamonds',
  zoom: 1,
  moviePlaying: false,
  renderTick: 0
})

export function getPixel(layerIndex, x, y) {
  if (x < 0 || x >= GRID || y < 0 || y >= GRID) return null
  return state.layers[layerIndex].data[y * GRID + x]
}

export function setPixel(layerIndex, x, y, color) {
  if (x < 0 || x >= GRID || y < 0 || y >= GRID) return
  state.layers[layerIndex].data[y * GRID + x] = color
  state.renderTick++
}

export function getCompositePixel(x, y) {
  for (let i = state.layers.length - 1; i >= 0; i--) {
    const layer = state.layers[i]
    if (!layer.visible) continue
    const c = layer.data[y * GRID + x]
    if (c) return c
  }
  return null
}

export function addLayer() {
  saveSnapshot()
  const name = `Layer ${state.layers.length + 1}`
  state.layers.push(createLayer(name))
  state.currentLayerIndex = state.layers.length - 1
}

export function removeLayer(index) {
  if (state.layers.length <= 1) return
  saveSnapshot()
  state.layers.splice(index, 1)
  if (state.currentLayerIndex >= state.layers.length) {
    state.currentLayerIndex = state.layers.length - 1
  }
  state.renderTick++
}

export function moveLayer(index, dir) {
  const newIndex = index + dir
  if (newIndex < 0 || newIndex >= state.layers.length) return
  saveSnapshot()
  const temp = state.layers[index]
  state.layers[index] = state.layers[newIndex]
  state.layers[newIndex] = temp
  if (state.currentLayerIndex === index) state.currentLayerIndex = newIndex
  else if (state.currentLayerIndex === newIndex) state.currentLayerIndex = index
  state.renderTick++
}

const deletedRows = []

export function deleteRow(y) {
  if (y < 0 || y >= GRID) return
  saveSnapshot()
  const layer = state.layers[state.currentLayerIndex]
  // Save the deleted row
  const saved = []
  for (let x = 0; x < GRID; x++) saved.push(layer.data[y * GRID + x])

  // Find content center to decide shift direction
  let sumY = 0, count = 0
  for (let row = 0; row < GRID; row++) {
    for (let x = 0; x < GRID; x++) {
      if (layer.data[row * GRID + x]) { sumY += row; count++ }
    }
  }
  const contentCenter = count > 0 ? sumY / count : GRID / 2
  const shiftDown = y < contentCenter // click above content → shift below up

  deletedRows.push({ y, layerIndex: state.currentLayerIndex, data: saved, shiftDown })

  if (shiftDown) {
    // Click above content: shift rows below up (pull content up)
    for (let row = y; row < GRID - 1; row++) {
      for (let x = 0; x < GRID; x++) {
        layer.data[row * GRID + x] = layer.data[(row + 1) * GRID + x]
      }
    }
    for (let x = 0; x < GRID; x++) {
      layer.data[(GRID - 1) * GRID + x] = null
    }
  } else {
    // Click below content: shift rows above down (pull content down)
    for (let row = y; row > 0; row--) {
      for (let x = 0; x < GRID; x++) {
        layer.data[row * GRID + x] = layer.data[(row - 1) * GRID + x]
      }
    }
    for (let x = 0; x < GRID; x++) {
      layer.data[x] = null
    }
  }
  state.renderTick++
}

export function restoreRow() {
  if (deletedRows.length === 0) return
  const entry = deletedRows.pop()
  saveSnapshot()
  const layer = state.layers[entry.layerIndex]
  const y = entry.y

  if (entry.shiftDown) {
    // Was shifted up → shift back down to make room
    for (let row = GRID - 1; row > y; row--) {
      for (let x = 0; x < GRID; x++) {
        layer.data[row * GRID + x] = layer.data[(row - 1) * GRID + x]
      }
    }
  } else {
    // Was shifted down → shift back up to make room
    for (let row = 0; row < y; row++) {
      for (let x = 0; x < GRID; x++) {
        layer.data[row * GRID + x] = layer.data[(row + 1) * GRID + x]
      }
    }
  }
  // Insert saved row at original position
  for (let x = 0; x < GRID; x++) {
    layer.data[y * GRID + x] = entry.data[x]
  }
  state.renderTick++
}

export function mergeDown(index) {
  if (index <= 0 || index >= state.layers.length) return
  saveSnapshot()
  const upper = state.layers[index]
  const lower = state.layers[index - 1]
  for (let i = 0; i < GRID * GRID; i++) {
    if (upper.data[i]) lower.data[i] = upper.data[i]
  }
  state.layers.splice(index, 1)
  if (state.currentLayerIndex >= index) {
    state.currentLayerIndex = Math.max(0, state.currentLayerIndex - 1)
  }
  state.renderTick++
}

export function generateOutline(layerOnly = false) {
  saveSnapshot()
  const existingIdx = state.layers.findIndex(l => l.name === 'Outline')
  if (existingIdx !== -1) {
    state.layers.splice(existingIdx, 1)
    if (state.currentLayerIndex >= state.layers.length) {
      state.currentLayerIndex = state.layers.length - 1
    }
  }

  const filled = new Array(GRID * GRID).fill(false)
  if (layerOnly) {
    const layer = state.layers[state.currentLayerIndex]
    for (let i = 0; i < GRID * GRID; i++) {
      if (layer.data[i]) filled[i] = true
    }
  } else {
    for (const layer of state.layers) {
      if (!layer.visible) continue
      for (let i = 0; i < GRID * GRID; i++) {
        if (layer.data[i]) filled[i] = true
      }
    }
  }

  const outline = createLayer('Outline')
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (filled[y * GRID + x]) continue
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID && filled[ny * GRID + nx]) {
          outline.data[y * GRID + x] = '#000000'
          break
        }
      }
    }
  }

  state.layers.push(outline)
  state.renderTick++
}

export function generateInnerOutline(layerOnly = false) {
  saveSnapshot()
  const existingIdx = state.layers.findIndex(l => l.name === 'Inner Outline')
  if (existingIdx !== -1) {
    state.layers.splice(existingIdx, 1)
    if (state.currentLayerIndex >= state.layers.length) {
      state.currentLayerIndex = state.layers.length - 1
    }
  }

  const filled = new Array(GRID * GRID).fill(null)
  if (layerOnly) {
    const layer = state.layers[state.currentLayerIndex]
    for (let i = 0; i < GRID * GRID; i++) {
      if (layer.data[i]) filled[i] = layer.data[i]
    }
  } else {
    for (const layer of state.layers) {
      if (!layer.visible) continue
      for (let i = 0; i < GRID * GRID; i++) {
        if (layer.data[i] && !filled[i]) filled[i] = layer.data[i]
      }
    }
  }

  const innerOutline = createLayer('Inner Outline')
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const color = filled[y * GRID + x]
      if (!color) continue
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy
        const outside = nx < 0 || nx >= GRID || ny < 0 || ny >= GRID
        if (outside || !filled[ny * GRID + nx]) {
          innerOutline.data[y * GRID + x] = darkenColor(color, 25)
          break
        }
      }
    }
  }

  state.layers.push(innerOutline)
  state.renderTick++
}

export async function loadPalette() {
  const img = new Image()
  img.src = paletteUrl
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const cols = 4
  const rows = 6
  const cellW = img.width / cols
  const cellH = img.height / rows
  const colors = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.floor(c * cellW + cellW / 2)
      const y = Math.floor(r * cellH + cellH / 2)
      const pixel = ctx.getImageData(x, y, 1, 1).data
      if (pixel[3] < 128) continue
      const hex = '#' + [pixel[0], pixel[1], pixel[2]]
        .map(v => v.toString(16).padStart(2, '0')).join('')
      if (!colors.includes(hex)) colors.push(hex)
    }
  }

  state.palette = colors
}

export async function loadEyeStamps() {
  const img = new Image()
  img.src = eyesUrl
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const imgData = ctx.getImageData(0, 0, img.width, img.height)

  // Collect non-transparent pixels
  const pixels = []
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4
      const r = imgData.data[i], g = imgData.data[i + 1], b = imgData.data[i + 2], a = imgData.data[i + 3]
      if (a > 10) {
        pixels.push({ x, y, color: rgbToHex(r, g, b) })
      }
    }
  }

  if (pixels.length === 0) return

  // Group by x-proximity (gap > 3 columns = new eye)
  pixels.sort((a, b) => a.x - b.x || a.y - b.y)
  const groups = []
  let current = [pixels[0]]
  for (let i = 1; i < pixels.length; i++) {
    const maxX = Math.max(...current.map(p => p.x))
    if (pixels[i].x - maxX > 3) {
      groups.push(current)
      current = [pixels[i]]
    } else {
      current.push(pixels[i])
    }
  }
  if (current.length) groups.push(current)

  // Convert each group to stamp: offsets + colors relative to center
  state.eyeStamps = groups.map(g => {
    const xs = g.map(p => p.x)
    const ys = g.map(p => p.y)
    const cx = Math.floor((Math.min(...xs) + Math.max(...xs)) / 2)
    const cy = Math.floor((Math.min(...ys) + Math.max(...ys)) / 2)
    return {
      pixels: g.map(p => ({ dx: p.x - cx, dy: p.y - cy, color: p.color })),
      width: Math.max(...xs) - Math.min(...xs) + 1,
      height: Math.max(...ys) - Math.min(...ys) + 1
    }
  })
}

const SESSION_KEY = 'paintmode_session'

export function saveSession() {
  const data = {
    tool: state.tool,
    brush: state.brush,
    mirrorMode: state.mirrorMode,
    pixelRadar: state.pixelRadar,
    soloMode: state.soloMode,
    insidePaint: state.insidePaint,
    currentColor: state.currentColor,
    currentLayerIndex: state.currentLayerIndex,
    selectedEye: state.selectedEye,
    background: state.background,
    zoom: state.zoom,
    layers: state.layers.map(l => ({
      name: l.name,
      visible: l.visible,
      data: [...l.data]
    }))
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

export function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return false
  try {
    const data = JSON.parse(raw)
    state.tool = data.tool || 'pen'
    state.brush = data.brush || 'pixel'
    state.mirrorMode = data.mirrorMode ?? true
    state.pixelRadar = data.pixelRadar ?? false
    state.soloMode = data.soloMode ?? false
    state.insidePaint = data.insidePaint ?? false
    state.currentColor = data.currentColor ?? '#d9a066'
    state.selectedEye = data.selectedEye ?? 0
    state.background = data.background || 'diamonds'
    state.zoom = data.zoom ?? 1
    if (data.layers && data.layers.length > 0) {
      state.layers.splice(0, state.layers.length, ...data.layers.map(l => ({
        name: l.name,
        visible: l.visible,
        data: [...l.data]
      })))
      state.currentLayerIndex = Math.min(data.currentLayerIndex || 0, state.layers.length - 1)
    }
    state.renderTick++
    return true
  } catch (e) {
    return false
  }
}
