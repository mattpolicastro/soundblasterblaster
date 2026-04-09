<template>
  <div id="app">
    <Header/>
    <Soundboard/>
    <Main/>
    <Footer/>
  </div>
</template>

<script setup>
import Header from './components/Header.vue'
import Main from './components/Main.vue'
import Soundboard from './components/Soundboard.vue'
import Footer from './components/Footer.vue'
</script>

<style>
div {
  margin-bottom: 6em;
}
#app {
  font-family: Open Sans, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  min-height: 100%;
  position: relative;
  padding-bottom: 36em;
  margin-bottom: 0;
  background: linear-gradient(0deg, #32C4F5  6em, #ffffff 36em);
}
</style>
