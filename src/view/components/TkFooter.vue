<template>
  <div class="tk-footer">
    Powered by <a href="https://twikoo.js.org" target="_blank">Twikoo</a>
    v{{ version }}
  </div>
</template>

<script>
import { version } from '../../../package.json'

export default {
  data () {
    return {
      version
    }
  }
}
</script>

<style scoped>
.tk-footer {
  width: 100%;
  text-align: end;
  font-size: 0.75em;
  color: #999999;
  margin-top: 1em;
}
</style>
