import Vue from 'vue'
import App from './App.vue'
import { ElButton, ElInput, ElLoading } from 'element-plus'
import 'element-plus/theme-chalk/el-button.css'
import 'element-plus/theme-chalk/el-input.css'
import 'element-plus/theme-chalk/el-loading.css'
import '../lib/owo.css'

Vue.use(ElButton)
Vue.use(ElInput)
Vue.use(ElLoading)

let app = null

const render = (tcb, options = {}) => {
  Vue.prototype.$tcb = tcb
  Vue.prototype.$twikoo = options
  app = new Vue({ render: h => h(App) })
  app.$mount(options.el || '#twikoo')
  return app
}

export {
  app,
  render
}
