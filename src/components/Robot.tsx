/**
 * The robot the player forges. `parts` is how many worlds' worth of parts it has:
 * 1 brain, 2 voice, 3 hands, 4 plug, 5 legs, 6 gauge and antenna, 7 spark.
 */
export type Mood = 'idle' | 'happy' | 'sad';

interface Props {
  parts?: number;
  mood?: Mood;
  class?: string;
  label?: string;
}

const PART_NAMES = ['a brain', 'a voice', 'hands', 'a universal plug', 'legs', 'a gauge', 'a graduation spark'];

export function Robot({ parts = 1, mood = 'idle', class: cls = '', label }: Props) {
  const has = (n: number) => parts >= n;
  const owned = PART_NAMES.slice(0, Math.max(0, Math.min(parts, 7)));
  const aria = label ?? `The robot${owned.length ? `, with ${owned.join(', ')}` : ', still an empty shell'}`;
  return (
    <svg viewBox="0 0 200 250" class={`robot robot--${mood} ${cls}`} role="img" aria-label={aria}>
      <g class="robot__body">
        {has(5) ? (
          <g>
            <rect x="72" y="200" width="18" height="30" class="r-dark" />
            <rect x="110" y="200" width="18" height="30" class="r-dark" />
            <path d="M62 230h34v12H56z" class="r-plate" />
            <path d="M104 230h34l6 12h-40z" class="r-plate" />
          </g>
        ) : (
          <g>
            <rect x="88" y="200" width="24" height="24" class="r-dark" />
            <path d="M58 224h84l8 18H50z" class="r-plate" />
          </g>
        )}

        {has(3) && (
          <g class="robot__arms">
            <path d="M60 146 36 168l4 26" class="r-limb" />
            <path d="M33 196l7-4 7 4-3 12h-8z" class="r-temper" />
            <path d="M140 146l24 22-4 26" class="r-limb" />
            <path d="M153 196l7-4 7 4-3 12h-8z" class="r-temper" />
          </g>
        )}

        <path d="M62 132h76l10 70H52z" class="r-plate" />
        {has(4) && (
          <g>
            <rect x="84" y="150" width="32" height="24" rx="4" class="r-dark" />
            <rect x="92" y="157" width="5" height="10" class="r-temper" />
            <rect x="103" y="157" width="5" height="10" class="r-temper" />
          </g>
        )}
        {has(6) && (
          <g>
            <circle cx="126" cy="186" r="8" class="r-face" />
            <path d="M126 186l5-5" class="r-line" />
            <path d="M100 48V30" class="r-line" />
            <circle cx="100" cy="26" r="5" class="r-temper" />
          </g>
        )}

        <rect x="90" y="118" width="20" height="16" class="r-dark" />
        <rect x="52" y="48" width="96" height="74" rx="14" class="r-plate" />
        <circle cx="62" cy="58" r="2.2" class="r-rivet" />
        <circle cx="138" cy="58" r="2.2" class="r-rivet" />
        <circle cx="62" cy="112" r="2.2" class="r-rivet" />
        <circle cx="138" cy="112" r="2.2" class="r-rivet" />

        {has(1) && (
          <g class="robot__brain">
            <rect x="82" y="54" width="36" height="12" rx="6" class="r-dark" />
            <circle cx="100" cy="60" r="4" class="r-ember" />
          </g>
        )}

        <rect x="64" y="72" width="72" height="26" rx="10" class="r-face" />
        {mood === 'happy' ? (
          <g class="r-eye-line">
            <path d="M74 88q8-10 16 0" />
            <path d="M110 88q8-10 16 0" />
          </g>
        ) : (
          <g>
            <circle cx="82" cy="85" r="6" class={has(1) ? 'r-eye' : 'r-eye r-eye--off'} />
            <circle cx="118" cy="85" r="6" class={has(1) ? 'r-eye' : 'r-eye r-eye--off'} />
            {mood === 'sad' && (
              <g class="r-eye-line">
                <path d="M73 80l16-5" />
                <path d="M127 80l-16-5" />
              </g>
            )}
          </g>
        )}

        {has(2) && (
          <g class="r-line">
            <path d="M84 106h32" />
            <path d="M88 111h24" />
          </g>
        )}

        {has(7) && <path d="M100 2l4 10 10 2-8 7 2 11-8-6-8 6 2-11-8-7 10-2z" class="r-ember robot__spark" />}
      </g>
    </svg>
  );
}
