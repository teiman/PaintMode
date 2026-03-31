<template>
  <div class="layer-panel">
    <div class="section-label">Layers</div>
    <div class="layers-list">
      <div
        v-for="(layer, i) in reversedLayers"
        :key="i"
        class="layer-item"
        :class="{ active: actualIndex(i) === state.currentLayerIndex }"
        @click="state.currentLayerIndex = actualIndex(i)"
      >
        <button class="vis-btn" @click.stop="layer.visible = !layer.visible" :title="layer.visible ? 'Hide' : 'Show'">
          {{ layer.visible ? '\u25C9' : '\u25CB' }}
        </button>
        <input
          v-if="editingIndex === actualIndex(i)"
          class="layer-name-input"
          :value="layer.name"
          @blur="finishRename($event, actualIndex(i))"
          @keydown.enter="$event.target.blur()"
          @keydown.escape="editingIndex = -1"
          @click.stop
          ref="renameInputs"
        />
        <span v-else class="layer-name" @dblclick.stop="startRename(actualIndex(i))">{{ layer.name }}</span>
        <div class="layer-actions">
          <button @click.stop="moveUp(actualIndex(i))" title="Move up">&uarr;</button>
          <button @click.stop="moveDown(actualIndex(i))" title="Move down">&darr;</button>
          <button @click.stop="merge(actualIndex(i))" title="Merge down" :disabled="actualIndex(i) === 0">&#x21E9;</button>
          <button @click.stop="remove(actualIndex(i))" title="Delete">&times;</button>
        </div>
      </div>
    </div>
    <button class="add-btn" @click="addLayer()">+ Add Layer</button>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { state, addLayer, removeLayer, moveLayer, mergeDown } from '../store.js'

const reversedLayers = computed(() => [...state.layers].reverse())
const editingIndex = ref(-1)
const renameInputs = ref([])

function startRename(i) {
  editingIndex.value = i
  nextTick(() => {
    const input = renameInputs.value[0]
    if (input) { input.focus(); input.select() }
  })
}

function finishRename(e, i) {
  const val = e.target.value.trim()
  if (val) state.layers[i].name = val
  editingIndex.value = -1
}

function actualIndex(reversedI) {
  return state.layers.length - 1 - reversedI
}

function moveUp(i) { moveLayer(i, 1) }
function moveDown(i) { moveLayer(i, -1) }
function merge(i) { mergeDown(i) }
function remove(i) { removeLayer(i) }
</script>

<style scoped>
.layer-panel {
  width: 150px;
  flex-shrink: 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.section-label {
  font-size: 10px;
  text-transform: uppercase;
  color: #666;
  letter-spacing: 1px;
}
.layers-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  max-height: 300px;
}
.layer-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 4px;
  background: #1a1a1a;
  cursor: pointer;
  font-size: 12px;
}
.layer-item.active {
  background: #223;
  outline: 1px solid #55a;
}
.layer-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.layer-name-input {
  flex: 1;
  background: #111;
  color: #fff;
  border: 1px solid #55a;
  border-radius: 2px;
  font-size: 12px;
  padding: 1px 4px;
  outline: none;
  min-width: 0;
}
.layer-actions {
  display: flex;
  gap: 2px;
}
.layer-actions button, .vis-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
}
.layer-actions button:hover, .vis-btn:hover {
  color: #fff;
}
.add-btn {
  background: #222;
  color: #ccc;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 4px;
}
.add-btn:hover {
  background: #2a2a2a;
}
</style>
