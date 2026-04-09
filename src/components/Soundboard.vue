<template>
  <div id="container">
    <h3>Soundboard</h3>

    <label
      class="dropzone"
      :class="{ active: isDragOverFile }"
      @dragover.prevent="isDragOverFile = true"
      @dragleave.prevent="isDragOverFile = false"
      @drop.prevent="onFileDrop"
    >
      <input
        type="file"
        accept="audio/*"
        multiple
        hidden
        @change="onFileSelect"
      />
      <span>Drop audio files here or click to upload</span>
    </label>

    <p v-if="loadError" class="err">Could not load saved clips: {{ loadError }}</p>
    <p v-if="uploadError" class="err">{{ uploadError }}</p>
    <i v-if="showBundled" class="hint">
      No saved clips yet &mdash; showing bundled samples. Upload any clip to replace them.
    </i>

    <div class="soundboard">
      <template v-if="!showBundled">
        <div
          v-for="(clip, i) in userClips"
          :key="clip.id"
          class="tile"
          :class="{ 'drag-over': dragOverIndex === i }"
          draggable="true"
          @dragstart="onTileDragStart(i, $event)"
          @dragover.prevent="dragOverIndex = i"
          @dragleave="dragOverIndex === i && (dragOverIndex = null)"
          @drop.prevent.stop="onTileDrop(i)"
          @dragend="onTileDragEnd"
        >
          <button
            v-if="editingId !== clip.id"
            class="clip"
            @click.prevent="playSound(clip.url)"
            @dblclick.prevent="startRename(clip)"
          >
            {{ clip.name }}
          </button>
          <input
            v-else
            v-model="draftName"
            class="rename"
            :ref="(el) => registerRenameInput(clip.id, el)"
            @keydown.enter.prevent="commitRename(clip)"
            @keydown.esc.prevent="cancelRename"
            @blur="commitRename(clip)"
          />
          <button
            class="del"
            title="Delete clip"
            aria-label="Delete clip"
            @click.stop.prevent="deleteClip(clip)"
          >
            &times;
          </button>
        </div>
      </template>
      <template v-else>
        <button
          v-for="s in bundledClips"
          :key="s.pathShort"
          class="clip"
          @click.prevent="playSound(s.pathLong)"
        >
          {{ s.pathShort.replace(/\.\//, '').replace(/\.mp3$/, '').replace(/_/g, ' ') }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as clipsDb from '../storage/clipsDb'

// Bundled fallback clips — discovered at build time by Vite.
const modules = import.meta.glob('../assets/sounds/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
})
const bundledClips = ref(
  Object.entries(modules).map(([path, url]) => ({
    pathLong: url,
    pathShort: path.replace(/^.*\/assets\/sounds\//, './'),
  }))
)

const userClips = ref([])
const isDragOverFile = ref(false)
const dragSrcIndex = ref(null)
const dragOverIndex = ref(null)
const editingId = ref(null)
const draftName = ref('')
const loadError = ref(null)
const uploadError = ref(null)

// Plain (non-reactive) map of clip.id -> <input> element for rename focus.
const renameInputs = {}
function registerRenameInput(id, el) {
  if (el) renameInputs[id] = el
  else delete renameInputs[id]
}

const showBundled = computed(() => userClips.value.length === 0)

onMounted(async () => {
  try {
    const rows = await clipsDb.getAllClips()
    userClips.value = rows.map((r) => ({
      ...r,
      url: URL.createObjectURL(r.blob),
    }))
  } catch (err) {
    loadError.value = err?.message ?? String(err)
    console.error('Failed to load clips from IndexedDB:', err)
  }
})

onBeforeUnmount(() => {
  userClips.value.forEach((c) => {
    if (c.url) URL.revokeObjectURL(c.url)
  })
})

function playSound(src) {
  if (!src) return
  new Audio(src).play().catch((err) => console.warn('Playback failed:', err))
}

function defaultNameFromFile(file) {
  return file.name.replace(/\.[^/.]+$/, '')
}

async function addFiles(fileList) {
  uploadError.value = null
  const files = Array.from(fileList ?? [])
  for (const file of files) {
    if (!file.type || !file.type.startsWith('audio/')) {
      console.warn('Skipping non-audio file:', file.name, file.type)
      continue
    }
    try {
      const record = await clipsDb.addClip({
        name: defaultNameFromFile(file),
        blob: file,
        mimeType: file.type,
      })
      userClips.value.push({
        ...record,
        url: URL.createObjectURL(record.blob),
      })
    } catch (err) {
      if (err?.name === 'QuotaExceededError') {
        uploadError.value = 'Storage full — delete some clips and try again.'
        break
      }
      console.error('addClip failed:', err)
      uploadError.value = `Could not save "${file.name}": ${err?.message ?? err}`
    }
  }
}

function onFileSelect(e) {
  addFiles(e.target.files)
  e.target.value = '' // allow re-selecting the same file
}

function onFileDrop(e) {
  isDragOverFile.value = false
  if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return
  addFiles(e.dataTransfer.files)
}

async function deleteClip(clip) {
  if (clip.url) URL.revokeObjectURL(clip.url)
  try {
    await clipsDb.deleteClip(clip.id)
  } catch (err) {
    console.error('deleteClip failed:', err)
  }
  userClips.value = userClips.value.filter((c) => c.id !== clip.id)
}

async function startRename(clip) {
  editingId.value = clip.id
  draftName.value = clip.name
  await nextTick()
  const el = renameInputs[clip.id]
  if (el) {
    el.focus()
    el.select()
  }
}

function cancelRename() {
  editingId.value = null
  draftName.value = ''
}

async function commitRename(clip) {
  // Guard against blur firing after Esc has already cleared editingId.
  if (editingId.value !== clip.id) return
  const trimmed = draftName.value.trim()
  if (!trimmed || trimmed === clip.name) {
    cancelRename()
    return
  }
  try {
    await clipsDb.updateClip(clip.id, { name: trimmed })
    clip.name = trimmed
  } catch (err) {
    console.error('updateClip failed:', err)
  }
  editingId.value = null
  draftName.value = ''
}

function onTileDragStart(i, e) {
  dragSrcIndex.value = i
  e.dataTransfer.effectAllowed = 'move'
  // Firefox requires dataTransfer.setData or the drag never initiates.
  e.dataTransfer.setData('text/plain', String(i))
}

function onTileDrop(i) {
  performReorder(dragSrcIndex.value, i)
}

function onTileDragEnd() {
  dragSrcIndex.value = null
  dragOverIndex.value = null
}

async function performReorder(from, to) {
  if (from == null || from === to) return
  const copy = userClips.value.slice()
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  userClips.value = copy
  try {
    await clipsDb.reorderClips(copy.map((c) => c.id))
    copy.forEach((c, idx) => {
      c.order = idx
    })
  } catch (err) {
    console.error('reorderClips failed:', err)
  }
}
</script>

<style scoped>
#container {
  max-width: 40em;
  margin: auto;
}
.dropzone {
  display: block;
  max-width: 30em;
  margin: 1em auto;
  padding: 1.5em 1em;
  border: 2px dashed #32C4F5;
  border-radius: 0.5em;
  color: #32C4F5;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  background: rgba(226, 247, 254, 0.4);
  transition: background 0.2s, border-color 0.2s;
}
.dropzone:hover,
.dropzone.active {
  background: rgb(226, 247, 254);
  border-color: rgb(76, 204, 246);
}
.err {
  color: #c0392b;
  max-width: 30em;
  margin: 0.5em auto;
}
.hint {
  display: block;
  margin: 0.5em auto 0;
  color: #666;
}
.soundboard {
  display: flex;
  align-items: center;
  align-content: flex-start;
  justify-content: center;
  flex-wrap: wrap;
}
button.clip {
  margin: 1em;
  padding: 0 0.5em;
  width: 7em;
  height: 5em;
  flex: none;
  text-transform: uppercase;
  background-color: rgb(226, 247, 254);
  border: none;
  color: #32C4F5;
  outline: none !important;
  font-weight: bold;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
}
button.clip:hover {
  color: white;
  background-color: rgb(76, 204, 246);
  transition: 0.3s;
}
.tile {
  position: relative;
  margin: 1em;
  width: 7em;
  height: 5em;
}
.tile button.clip {
  margin: 0;
  width: 100%;
  height: 100%;
}
.tile.drag-over button.clip {
  outline: 2px dashed #32C4F5;
  outline-offset: 2px;
}
.tile .del {
  position: absolute;
  top: -0.5em;
  right: -0.5em;
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  border: none;
  background: #c0392b;
  color: white;
  font-size: 0.9em;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
.tile:hover .del,
.tile .del:focus {
  opacity: 1;
}
.tile .rename {
  width: 100%;
  height: 100%;
  padding: 0 0.5em;
  box-sizing: border-box;
  border: 2px solid #32C4F5;
  background: white;
  color: #32C4F5;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
  font-family: inherit;
  outline: none;
}
</style>
