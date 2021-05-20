<template>
  <div class="tk-footer">
    Powered by <a href="https://twikoo.js.org" target="_blank">Twikoo</a>
    v{{ version }}
  </div>
</template>

<script>
import { version } from '../../../package.json'
import { call, getUrl } from '../../js/utils'

export default {
  data () {
    return {
      version,
      counter: {}
    }
  },
  methods: {
    async getCounter () {
      const url = getUrl(this.$twikoo.path)
      const result = await call(this.$tcb, 'COUNTER_GET', {
        url,
        href: window.location.href,
        title: document.title
      })
      this.counter = result.result
      if (this.counter.time || this.counter.time === 0) {
        const counterEl = document.getElementById('twikoo_visitors')
        if (counterEl) {
          counterEl.innerHTML = this.counter.time
        }
      }
    }
  },
  mounted () {
    this.getCounter()
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
