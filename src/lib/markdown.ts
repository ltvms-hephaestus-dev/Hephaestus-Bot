/** Markdown to HTML for lesson text. Works at build time and in the browser. */
import { Marked } from 'marked';

const marked = new Marked({
  gfm: true,
  renderer: {
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      const safe = /^https?:\/\//.test(href) ? href : '#';
      return `<a href="${safe.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

/** Replace {{fact.key}} with values from content/facts.yaml. */
export function withFacts(src: string, facts: Record<string, string> = {}): string {
  return src.replace(/\{\{fact\.([a-z0-9_]+)\}\}/gi, (whole, key: string) => facts[key] ?? whole);
}

export function renderMd(src: string, facts?: Record<string, string>): string {
  return marked.parse(withFacts(src, facts), { async: false }) as string;
}
