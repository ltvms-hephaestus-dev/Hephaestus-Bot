/**
 * A real BPE tokenizer (the o200k_base vocabulary), loaded only when a level needs
 * it because the vocabulary file is large.
 */
type Enc = { encode: (t: string) => number[]; decode: (ids: number[]) => string };

let loading: Promise<Enc> | null = null;

function load(): Promise<Enc> {
  loading ??= import('gpt-tokenizer/encoding/o200k_base').then((m) => ({ encode: m.encode, decode: m.decode }));
  return loading;
}

export interface Token {
  id: number;
  text: string;
}

export async function tokenize(text: string): Promise<Token[]> {
  const enc = await load();
  return enc.encode(text).map((id) => ({ id, text: enc.decode([id]) }));
}

export async function countTokens(text: string): Promise<number> {
  return (await load()).encode(text).length;
}
