/** Plays a lesson saved in this browser by the Forge. */
import { useEffect, useState } from 'preact/hooks';
import type { Prepared } from '../lib/prepare';
import { readMyLessons } from '../lib/progress';
import { LevelSchema } from '../lib/schema';
import { prepareCustom } from './Forge';
import LevelPlayer from './LevelPlayer';

export default function CustomPlay({ forgeUrl }: { forgeUrl: string }) {
  const [data, setData] = useState<Prepared | null | undefined>(undefined);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('id');
    const raw = readMyLessons().find((l) => l.id === id);
    const ok = raw ? LevelSchema.safeParse(raw) : null;
    setData(ok?.success ? prepareCustom(ok.data, 7, forgeUrl) : null);
  }, []);

  if (data === undefined) return <p style={{ padding: '3rem 0' }}>Loading your lesson…</p>;
  if (data === null) {
    return (
      <div class="page-head">
        <h1>That lesson is not in this browser</h1>
        <p class="prose">
          Lessons made in the forge are stored in the browser that made them. <a href={forgeUrl}>Open the lesson forge</a> to write one or import
          one from a file or a link.
        </p>
      </div>
    );
  }
  return <LevelPlayer data={data} />;
}
