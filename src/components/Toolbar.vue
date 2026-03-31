<template>
  <div class="toolbar">
    <div class="section-label">Tools</div>
    <button
      v-for="t in tools" :key="t.id"
      :class="{ active: state.tool === t.id }"
      @click="state.tool = t.id"
      :title="t.label"
    >{{ t.icon }} {{ t.label }}</button>

    <div class="section-label">Brush</div>
    <div class="brush-selector">
      <button
        v-for="(shape, key) in brushShapes" :key="key"
        :class="{ active: state.brush === key }"
        @click="state.brush = key"
        :title="shape.label"
        class="brush-btn"
      >
        <canvas
          :ref="el => drawBrushPreview(el, shape.offsets)"
          width="15"
          height="15"
          class="brush-preview"
        />
      </button>
      <button
        :class="{ active: state.brush === 'eyes' }"
        @click="state.brush = 'eyes'"
        title="Eyes"
        class="brush-btn"
      >&#x1F441;</button>
    </div>
    <div v-if="state.brush === 'eyes' && state.eyeStamps.length" class="eye-selector">
      <button
        v-for="(stamp, i) in state.eyeStamps" :key="'eye'+i"
        :class="{ active: state.selectedEye === i }"
        @click="state.selectedEye = i"
        class="eye-btn"
      >
        <canvas
          :ref="el => drawEyePreview(el, stamp)"
          width="16"
          height="16"
          class="eye-preview"
        />
      </button>
    </div>

    <div class="section-label">Toggles</div>
    <button :class="{ active: state.mirrorMode }" @click="state.mirrorMode = !state.mirrorMode" title="Mirror Mode">
      &#x2194; Mirror
    </button>
    <button :class="{ active: state.pixelRadar }" @click="state.pixelRadar = !state.pixelRadar" title="Pixel Radar">
      &#x25CE; Radar
    </button>
    <button :class="{ active: state.soloMode }" @click="state.soloMode = !state.soloMode" title="Solo current layer">
      &#x25D0; Solo
    </button>
    <button :class="{ active: state.insidePaint }" @click="state.insidePaint = !state.insidePaint" title="Only paint over non-transparent pixels">
      &#x25A3; Inside
    </button>

  </div>
</template>

<script setup>
import { nextTick } from 'vue'
import { state, brushShapes } from '../store.js'


function drawBrushPreview(el, offsets) {
  if (!el) return
  nextTick(() => {
    const ctx = el.getContext('2d')
    ctx.clearRect(0, 0, 15, 15)
    const cx = 7, cy = 7
    ctx.fillStyle = '#aaa'
    for (const [dx, dy] of offsets) {
      ctx.fillRect(cx + dx * 3, cy + dy * 3, 3, 3)
    }
  })
}

function drawEyePreview(el, stamp) {
  if (!el || !stamp) return
  nextTick(() => {
    const ctx = el.getContext('2d')
    ctx.clearRect(0, 0, 16, 16)
    const cx = 8, cy = 8
    for (const { dx, dy, color } of stamp.pixels) {
      ctx.fillStyle = color
      ctx.fillRect(cx + dx * 2, cy + dy * 2, 2, 2)
    }
  })
}

const tools = [
  { id: 'pen', label: 'Pen', icon: "\u270E" },
{ id: 'delete_row', label: 'Del Row', icon: "\u2190" },
  { id: 'shadow', label: 'Shadow', icon: "\u25D3" },
  { id: 'light', label: 'Light', icon: "\u2600" },
  { id: 'shadow_pattern', label: 'Pattern', icon: "\u2591" },
  { id: 'antialias', label: 'AA', icon: "\u25E8" },
]
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  width: 120px;
  flex-shrink: 0;
}
.section-label {
  font-size: 10px;
  text-transform: uppercase;
  color: #666;
  margin-top: 8px;
  letter-spacing: 1px;
}
button {
  background: #222;
  color: #ccc;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  transition: background 0.15s;
}
button:hover {
  background: #2a2a2a;
}
button.active {
  background: #335;
  border-color: #55a;
  color: #fff;
}
.brush-selector {
  display: flex;
  gap: 3px;
}
.brush-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  min-width: 0;
}
.brush-preview {
  display: block;
  image-rendering: pixelated;
}
.eye-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.eye-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  min-width: 0;
  width: 24px;
  height: 24px;
}
.eye-preview {
  display: block;
  image-rendering: pixelated;
}
</style>
