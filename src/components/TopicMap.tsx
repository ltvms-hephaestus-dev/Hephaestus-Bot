/** The zoomable topic map. The tree is generated from the lessons at build time. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { TreeNode } from '../lib/content';
import { TEMPER } from '../lib/temper';

interface Props {
  tree: TreeNode;
  /** Zoom and drag. Off on pages where the map sits inside scrolling content. */
  interactive?: boolean;
  tall?: boolean;
  /** Roughly how many lines of text the open map shows; sets its height. */
  rows?: number;
  expand?: number;
}

export default function TopicMap({ tree, interactive = false, tall = false, rows, expand = 2 }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: { destroy: () => void } | undefined;
    let dead = false;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Wait for the web fonts: the map measures its labels once, and measuring with
    // a fallback font clips the text.
    Promise.all([import('markmap-view'), document.fonts?.ready])
      .then(([{ Markmap }]) => {
        if (dead || !ref.current) return;
        map = Markmap.create(
          ref.current,
          {
            initialExpandLevel: expand,
            duration: still ? 0 : 250,
            zoom: interactive,
            pan: interactive,
            maxWidth: 240,
            maxInitialScale: 1.25,
            spacingVertical: 8,
            color: (node) => {
              const world = Number((node.payload as { world?: number } | undefined)?.world ?? 0);
              // Darkened a little: the pale temper colours are too faint as thin lines.
              return world ? `color-mix(in srgb, ${TEMPER[(world - 1) % TEMPER.length]!.color} 72%, #1b2327)` : '#1b2327';
            },
          },
          tree,
        );
      })
      .catch(() => setFailed(true));
    return () => {
      dead = true;
      map?.destroy();
    };
  }, []);

  if (failed) return <p class="muted" style={{ padding: '1rem' }}>The map could not load. The list version below has the same content.</p>;
  const height = rows ? `${Math.min(46, Math.max(20, rows * 1.55))}rem` : undefined;
  return <svg ref={ref} class={`topicmap${tall ? ' topicmap--tall' : ''}`} style={height ? { height } : undefined} role="img" aria-label="Topic map. A list version follows." />;
}
