import { marked } from '../lib/marked/marked'

/**
 * https://marked.js.org/#/USING_ADVANCED.md
 */
marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: true,
  pedantic: false,
  smartLists: true,
  smartypants: true
})

// Comment UIs rarely use indented (4-space) code blocks, but users often
// prefix lines with spaces for visual indentation — which Markdown would
// otherwise render as a code block (#855).
marked.use({
  tokenizer: {
    code () {
      return undefined
    }
  }
})

export default marked
