import marked from 'marked'

/**
 * https://marked.js.org/#/USING_ADVANCED.md
 */
marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: true,
  pedantic: false,
  sanitize: true,
  smartLists: true,
  smartypants: true
})

export default marked
