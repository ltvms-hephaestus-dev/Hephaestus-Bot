/** Project-wide settings. Change `repo` if you fork the project. */
export const SITE = {
  name: 'Hephaestus Bot',
  tagline: 'Forge a robot. Understand AI.',
  repo: 'ltvms-hephaestus-dev/Hephaestus-Bot',
  branch: 'main',
} as const;

export const LANGS = ['python', 'typescript'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABEL: Record<Lang, string> = { python: 'Python', typescript: 'TypeScript' };
