<template></template>

<script>
export default {
  data () {
    return {
      counter: {}
    }
  },
  methods: {
    async getCounter () {
      const result = await this.$tcb.app.callFunction({
        name: 'counter-get',
        data: {
          url: window.location.pathname,
          title: document.title
        }
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
