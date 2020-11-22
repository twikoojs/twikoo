<template></template>

<script>
import { call } from '../../js/utils'

export default {
  data () {
    return {
      counter: {}
    }
  },
  methods: {
    async getCounter () {
      const result = await call(this.$tcb, 'COUNTER_GET', {
        url: window.location.pathname,
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
