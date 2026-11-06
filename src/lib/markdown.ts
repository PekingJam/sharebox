import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/common'
import DOMPurify from 'dompurify'

const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      try {
        const language = lang?.trim()
        if (language && hljs.getLanguage(language)) {
          return hljs.highlight(code, { language, ignoreIllegals: true }).value
        }
        return escapeHtml(code)
      } catch {
        return escapeHtml(code)
      }
    },
  }),
)

marked.setOptions({
  gfm: true,
  breaks: true,
})

// 允许 GFM 任务列表的只读复选框，其余表单控件一律移除
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'input') return
  const input = node as HTMLInputElement
  if (input.getAttribute('type') !== 'checkbox') {
    input.remove()
    return
  }
  input.setAttribute('disabled', '')
})

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName !== 'INPUT') return
  const input = node as HTMLInputElement
  for (const attribute of Array.from(input.attributes)) {
    if (!['type', 'checked', 'disabled'].includes(attribute.name)) {
      input.removeAttribute(attribute.name)
    }
  }
  input.disabled = true
})

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 渲染并清洗 Markdown，防止 XSS */
export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { async: false }) as string
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  })
}
