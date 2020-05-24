import Vue from 'vue'
import App from './App.vue'

const render = (data) => {
  Vue.prototype.$tcb = data
  return new Vue({
    render: h => h(App)
  }).$mount('#twii')
}

export {
  render
}
