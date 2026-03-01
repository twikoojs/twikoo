import Vue from 'vue'
import App from './App.vue'
import Button from 'element-ui/lib/button'
import Input from 'element-ui/lib/input'
import Loading from 'element-ui/lib/loading'
import Select from 'element-ui/lib/select'
import Option from 'element-ui/lib/option'
import 'element-ui/lib/theme-chalk/button.css'
import 'element-ui/lib/theme-chalk/input.css'
import 'element-ui/lib/theme-chalk/loading.css'
import 'element-ui/lib/theme-chalk/select.css'
import 'element-ui/lib/theme-chalk/option.css'
import '../lib/owo.css'

Vue.use(Button)
Vue.use(Input)
Vue.use(Loading)
Vue.use(Select)
Vue.use(Option)

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
