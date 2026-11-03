/**
 * `/llms.txt` — a plain index of the site for language-model readers (llmstxt.org): a title,
 * a one-line summary, then a Markdown list of links. Here the list is the pages and templates,
 * with what each is beside the link, so an answer engine can answer without
 * crawling every page first.
 *
 * Pure: the route (`src/app/llms.txt/route.ts`) fetches and passes everything in.
 */

export type LlmsTxtSection = {
  title: string
  links: { name: string; url: string; note?: string }[]
}

/** Markdown link text cannot hold `[` `]`, and a newline would end the list item. */
const clean = (value: string): string => value.replace(/[[\]\r\n]+/g, ' ').trim()

/** A paragraph stays one paragraph: a blank line inside it would split it. */
const paragraph = (value: string): string => value.replace(/\s*[\r\n]+\s*/g, ' ').trim()

export const buildLlmsTxt = ({
  title,
  summary,
  details = [],
  sections,
}: {
  title: string
  summary: string
  /** Free-text paragraphs between the summary and the link sections (llmstxt.org allows them). */
  details?: readonly string[]
  sections: readonly LlmsTxtSection[]
}): string => {
  const blocks = [
    `# ${clean(title)}`,
    `> ${clean(summary)}`,
    ...details.map(paragraph).filter(Boolean),
    ...sections
      .filter((section) => section.links.length)
      .map((section) =>
        [
          `## ${clean(section.title)}`,
          ...section.links.map(({ name, url, note }) =>
            note?.trim() ? `- [${clean(name)}](${url}): ${clean(note)}` : `- [${clean(name)}](${url})`
          ),
        ].join('\n')
      ),
  ]
  return `${blocks.join('\n\n')}\n`
}
