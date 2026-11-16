/**
 * Temper colours: the colours steel passes through as a smith heats it, from pale
 * straw to blue. Each world takes the next colour, so progress through the game
 * reads as a bar of steel being tempered. Worlds beyond the seventh cycle round.
 */
export const TEMPER = [
  { name: 'pale straw', color: '#ecd77f', ink: '#1b2327' },
  { name: 'gold', color: '#dba640', ink: '#1b2327' },
  { name: 'bronze', color: '#c27c36', ink: '#1b2327' },
  { name: 'purple', color: '#8b4f87', ink: '#ffffff' },
  { name: 'violet', color: '#5a4a9e', ink: '#ffffff' },
  { name: 'blue', color: '#2d6db0', ink: '#ffffff' },
  { name: 'pale blue', color: '#86b9d3', ink: '#1b2327' },
] as const;

export function temper(order: number) {
  return TEMPER[(Math.max(1, order) - 1) % TEMPER.length]!;
}

export function temperStyle(order: number): string {
  const t = temper(order);
  return `--temper:${t.color};--temper-ink:${t.ink};`;
}
