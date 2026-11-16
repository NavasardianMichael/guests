/**
 * The two inline marks content and legal copy use: `[label](/path)` links and `**bold**`.
 * Parsed here (pure, tested); `RichText` renders the tokens.
 */
export type InlineToken = { type: 'text'; value: string } | { type: 'bold'; value: string } | { type: 'link'; label: string; href: string }

const MARK = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g

export const parseInline = (text: string): InlineToken[] => {
  const tokens: InlineToken[] = []
  let last = 0
  for (const match of text.matchAll(MARK)) {
    const index = match.index ?? 0
    if (index > last) tokens.push({ type: 'text', value: text.slice(last, index) })
    if (match[1] !== undefined) tokens.push({ type: 'link', label: match[1], href: match[2] })
    else tokens.push({ type: 'bold', value: match[3] })
    last = index + match[0].length
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) })
  return tokens
}

/** The text as read, marks removed: JSON-LD answers, meta tags. */
export const plainText = (text: string): string =>
  parseInline(text)
    .map((token) => (token.type === 'link' ? token.label : token.value))
    .join('')

/** Every link target in the text. */
export const inlineLinks = (text: string): string[] =>
  parseInline(text).flatMap((token) => (token.type === 'link' ? [token.href] : []))
