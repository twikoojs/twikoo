import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'

export default {
  ...DefaultTheme,
  // override the Layout with a wrapper component that
  // injects the slots
  Layout
}
