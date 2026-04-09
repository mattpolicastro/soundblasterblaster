<template>
  <div id="container">
    <h3>Soundboard</h3>
    <i v-if="!sounds.length">Here are two sample sounds, but add some clips to <code>/assets/sounds</code> to get started.</i>
    <div v-if="sounds.length" class="soundboard">
      <button v-for="sound in sounds" :key="sound.pathShort" @click.prevent="playSound(sound.pathLong)">{{sound.pathShort.replace(/\.\//, '').replace(/\.mp3$/, '').replace(/_/g, ' ')}}</button>
    </div>
    <div v-else class="soundboard">
      <button @click.prevent="playSound('http://soundbible.com/mp3/Elevator Ding-SoundBible.com-685385892.mp3')">ding</button>
      <button @click.prevent="playSound('http://soundbible.com/mp3/Air Plane Ding-SoundBible.com-496729130.mp3')">dong</button>
    </div>
  </div>

</template>

<script setup>
import { ref } from 'vue'

// Vite equivalent of require.context('../assets/sounds', true, /\.mp3$/)
const modules = import.meta.glob('../assets/sounds/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
})

const sounds = ref(
  Object.entries(modules).map(([path, url]) => ({
    pathLong: url,
    pathShort: path.replace(/^.*\/assets\/sounds\//, './'),
  }))
)

function playSound(src) {
  if (src) new Audio(src).play().catch(() => {})
}
</script>

<style scoped>
#container {
  max-width: 40em;
  margin: auto;
}
button {
  margin: 1em;
  padding: auto;
  width: 7em;
  height: 5em;
  flex: none;
  text-transform: uppercase;
  background-color: rgb(226, 247, 254);
  border: none;
  color: #32C4F5;
  outline: none !important;
  font-weight: bold;
}
button:hover {
  color: white;
  background-color: rgb(76, 204, 246);
  transition: 0.3s;
}
.soundboard {
  display: flex;
  align-items: center;
  align-content: flex-start;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
