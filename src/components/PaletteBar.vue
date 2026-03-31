<template>
  <div class="color-picker-panel">
    <!-- SV Square -->
    <div class="sv-area">
      <canvas
        ref="svCanvas"
        :width="SV_SIZE"
        :height="SV_SIZE"
        class="sv-canvas"
        @mousedown="onSvDown"
        @mousemove="onSvMove"
        @mouseup="onSvUp"
        @mouseleave="onSvUp"
      />
      <div
        class="sv-cursor"
        :style="{ left: svCursorX + 'px', top: svCursorY + 'px' }"
      />
    </div>

    <!-- Hue Strip -->
    <div class="hue-area">
      <canvas
        ref="hueCanvas"
        :width="HUE_W"
        :height="SV_SIZE"
        class="hue-canvas"
        @mousedown="onHueDown"
        @mousemove="onHueMove"
        @mouseup="onHueUp"
        @mouseleave="onHueUp"
      />
      <div
        class="hue-cursor"
        :style="{ top: hueCursorY + 'px' }"
      />
    </div>

    <!-- Palette Swatches + Current -->
    <div class="palette-side">
      <div class="current-color">
        <div class="color-preview" :style="{ background: state.currentColor || 'transparent' }"></div>
        <span class="color-hex">{{ state.currentColor || 'none' }}</span>
      </div>
      <div class="palette-rows">
        <!-- Light variants -->
        <div class="palette-row">
          <div class="swatch-spacer"></div>
          <button
            v-for="(color, i) in lightColors"
            :key="'l'+i"
            class="swatch"
            :class="{ active: state.currentColor === color }"
            :style="{ background: color }"
            @click="selectPaletteColor(color)"
            :title="color"
          />
        </div>
        <!-- Base palette -->
        <div class="palette-row base-row">
          <button
            class="transparent-swatch"
            :class="{ active: state.currentColor === null }"
            @click="selectTransparent"
            title="Transparent"
          >
            <span class="checker"></span>
          </button>
          <button
            v-for="(color, i) in state.palette"
            :key="'b'+i"
            class="swatch"
            :class="{ active: state.currentColor === color }"
            :style="{ background: color }"
            @click="selectPaletteColor(color)"
            :title="color"
          />
        </div>
        <!-- Dark variants -->
        <div class="palette-row">
          <div class="swatch-spacer"></div>
          <button
            v-for="(color, i) in darkColors"
            :key="'d'+i"
            class="swatch"
            :class="{ active: state.currentColor === color }"
            :style="{ background: color }"
            @click="selectPaletteColor(color)"
            :title="color"
          />
        </div>
        <!-- Sad/muted variants -->
        <div class="palette-row">
          <div class="swatch-spacer"></div>
          <button
            v-for="(color, i) in sadColors"
            :key="'s'+i"
            class="swatch"
            :class="{ active: state.currentColor === color }"
            :style="{ background: color }"
            @click="selectPaletteColor(color)"
            :title="color"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { state } from '../store.js'
import { hexToHsv, hsvToHex, hsvToRgb, brightenColor, darkenColor, saddenColor } from '../utils.js'

const lightColors = computed(() => state.palette.map(c => brightenColor(c, 20)))
const darkColors = computed(() => state.palette.map(c => darkenColor(c, 20)))
const sadColors = computed(() => state.palette.map(c => saddenColor(c)))

const SV_SIZE = 150
const HUE_W = 18

const svCanvas = ref(null)
const hueCanvas = ref(null)

// Internal HSV state
const hue = ref(0)
const sat = ref(100)
const val = ref(100)

let draggingSv = false
let draggingHue = false

// Cursor positions
const svCursorX = computed(() => (sat.value / 100) * SV_SIZE)
const svCursorY = computed(() => (1 - val.value / 100) * SV_SIZE)
const hueCursorY = computed(() => (hue.value / 360) * SV_SIZE)

// Draw the SV gradient
function drawSv() {
  const ctx = svCanvas.value?.getContext('2d')
  if (!ctx) return
  const w = SV_SIZE, h = SV_SIZE
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (x / w) * 100
      const v = (1 - y / h) * 100
      const [r, g, b] = hsvToRgb(hue.value, s, v)
      const i = (y * w + x) * 4
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

// Draw the hue strip
function drawHue() {
  const ctx = hueCanvas.value?.getContext('2d')
  if (!ctx) return
  const w = HUE_W, h = SV_SIZE
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    const hu = (y / h) * 360
    const [r, g, b] = hsvToRgb(hu, 100, 100)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function applyHsv() {
  state.currentColor = hsvToHex(hue.value, sat.value, val.value)
}

function syncFromColor(hex) {
  if (!hex) return
  const [h, s, v] = hexToHsv(hex)
  // Only update hue if the color has saturation (avoid hue jumps on grays)
  if (s > 1) hue.value = h
  sat.value = s
  val.value = v
  drawSv()
}

// SV interaction
function svFromEvent(e) {
  const rect = svCanvas.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  sat.value = x * 100
  val.value = (1 - y) * 100
  applyHsv()
}
function onSvDown(e) { draggingSv = true; svFromEvent(e) }
function onSvMove(e) { if (draggingSv) svFromEvent(e) }
function onSvUp() { draggingSv = false }

// Hue interaction
function hueFromEvent(e) {
  const rect = hueCanvas.value.getBoundingClientRect()
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  hue.value = y * 360
  drawSv()
  applyHsv()
}
function onHueDown(e) { draggingHue = true; hueFromEvent(e) }
function onHueMove(e) { if (draggingHue) hueFromEvent(e) }
function onHueUp() { draggingHue = false }

function selectPaletteColor(color) {
  state.currentColor = color
  syncFromColor(color)
}

function selectTransparent() {
  state.currentColor = null
}

onMounted(() => {
  drawHue()
  syncFromColor(state.currentColor || '#000000')
})

// Sync picker when color changes externally (e.g. eyedropper right-click)
watch(() => state.currentColor, (c) => {
  if (c && !draggingSv && !draggingHue) syncFromColor(c)
})
</script>

<style scoped>
.color-picker-panel {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: #181818;
  border-top: 1px solid #222;
}

/* SV Square */
.sv-area {
  position: relative;
  flex-shrink: 0;
}
.sv-canvas {
  display: block;
  border: 1px solid #333;
  cursor: crosshair;
}
.sv-cursor {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 2px rgba(0,0,0,0.8);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* Hue Strip */
.hue-area {
  position: relative;
  flex-shrink: 0;
}
.hue-canvas {
  display: block;
  border: 1px solid #333;
  cursor: pointer;
}
.hue-cursor {
  position: absolute;
  left: -1px;
  right: -1px;
  height: 4px;
  border: 1px solid #fff;
  box-shadow: 0 0 2px rgba(0,0,0,0.8);
  transform: translateY(-50%);
  pointer-events: none;
}

/* Palette + Current */
.palette-side {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.current-color {
  display: flex;
  align-items: center;
  gap: 6px;
}
.color-preview {
  width: 24px;
  height: 24px;
  border: 2px solid #555;
  border-radius: 4px;
  flex-shrink: 0;
}
.color-hex {
  font-size: 11px;
  font-family: monospace;
  color: #888;
}
.palette-rows {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.base-row .swatch, .base-row .transparent-swatch {
  border-color: rgba(255,255,255,0.15);
}
.palette-row {
  display: flex;
  gap: 2px;
  flex-wrap: nowrap;
}
.swatch-spacer {
  width: 18px;
  flex-shrink: 0;
}
.swatch, .transparent-swatch {
  width: 18px;
  height: 18px;
  border: 2px solid transparent;
  border-radius: 2px;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.swatch:hover, .transparent-swatch:hover {
  border-color: #888;
}
.swatch.active, .transparent-swatch.active {
  border-color: #fff;
  box-shadow: 0 0 4px rgba(255,255,255,0.4);
}
.transparent-swatch {
  position: relative;
  overflow: hidden;
  background: #333;
}
.checker {
  display: block;
  width: 100%;
  height: 100%;
  background: repeating-conic-gradient(#666 0% 25%, #444 0% 50%) 50% / 10px 10px;
}
</style>
