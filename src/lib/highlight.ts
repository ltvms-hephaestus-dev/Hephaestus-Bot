/** A very small syntax highlighter for the two languages lessons use. */
import type { Lang } from '../config';

const KEYWORDS: Record<Lang, Set<string>> = {
  python: new Set(
    'def return import from as if elif else for while in not and or is None True False class with try except raise lambda async await pass break continue yield'.split(' '),
  ),
  typescript: new Set(
    'const let var function return import from export default if else for while of in new class extends async await try catch throw null undefined true false type interface as typeof break continue'.split(' '),
  ),
};

export interface Tok {
  cls: 'c' | 's' | 'n' | 'k' | 'f' | '';
  text: string;
}

const STRING = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` + '`(?:[^`\\\\]|\\\\.)*`';
// A blank is passed through as \uE000name\uE001 and must stay in one piece.
const BLANK = '\uE000[^\uE001]*\uE001';
const RX: Record<Lang, RegExp> = {
  python: new RegExp(`(#.*$)|(${STRING})|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_]\\w*)|${BLANK}`, 'g'),
  typescript: new RegExp(`(//.*$)|(${STRING})|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_$][\\w$]*)|${BLANK}`, 'g'),
};

export function highlight(line: string, lang: Lang): Tok[] {
  const out: Tok[] = [];
  const rx = new RegExp(RX[lang].source, 'g');
  let last = 0;
  for (let m = rx.exec(line); m; m = rx.exec(line)) {
    if (m.index > last) out.push({ cls: '', text: line.slice(last, m.index) });
    let cls: Tok['cls'] = '';
    if (m[1]) cls = 'c';
    else if (m[2]) cls = 's';
    else if (m[3]) cls = 'n';
    else if (m[4]) cls = KEYWORDS[lang].has(m[4]) ? 'k' : line[rx.lastIndex] === '(' ? 'f' : '';
    out.push({ cls, text: m[0] });
    last = rx.lastIndex;
  }
  if (last < line.length) out.push({ cls: '', text: line.slice(last) });
  return out;
}
