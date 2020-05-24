import Vue from 'vue'
import App from './App.vue'

const render = (data, options) => {
  Vue.prototype.$tcb = data
  return new Vue({
    render: h => h(App, {
      props: {
        options
      }
    })
  }).$mount('#twikoo')
}

export {
  render
}
