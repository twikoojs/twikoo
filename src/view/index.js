import Vue from 'vue'
import App from './App.vue'
import Button from 'element-ui/lib/button'
import Input from 'element-ui/lib/input'
import Loading from 'element-ui/lib/loading'
import Tabs from 'element-ui/lib/tabs'
import TabPane from 'element-ui/lib/tab-pane'
import 'element-ui/lib/theme-chalk/button.css'
import 'element-ui/lib/theme-chalk/input.css'
import 'element-ui/lib/theme-chalk/loading.css'
import 'element-ui/lib/theme-chalk/tabs.css'
import 'element-ui/lib/theme-chalk/tab-pane.css'

Vue.use(Button)
Vue.use(Input)
Vue.use(Loading)
Vue.use(Tabs)
Vue.use(TabPane)

const render = (data = {}, options = {}) => {
  Vue.prototype.$tcb = data
  Vue.prototype.$twikoo = options
  return new Vue({
    render: h => h(App)
  }).$mount(options.el || '#twikoo')
}

export {
  render
}
