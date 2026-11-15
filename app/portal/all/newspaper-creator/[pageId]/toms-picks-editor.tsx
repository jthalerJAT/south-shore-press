'use client';

/**
 * TomsPicksEditor - the bespoke editor for a `toms_picks` template page.
 * Left: the header fields (logotype, headshot, bio), then the two pick
 * columns as three fixed tile cards each, then the standing disclaimer.
 * Right: a live to-scale TomsPicksPage preview. Save persists template_data
 * and locks the page.
 *
 * The tile count is fixed at TILES_PER_COLUMN by the page design, so there is
 * no add/remove - an unused tile is simply left blank and prints as white
 * space. "Reset to standard copy" restores the stock bio and disclaimer,
 * which is the usual reason an editor would want them back after a trim.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { TomsPicksPage } from '@/components/newspaper/toms-picks-page';
import {
  DEFAULT_TOMS_PICKS_BIO,
  DEFAULT_TOMS_PICKS_DISCLAIMER,
  TILES_PER_COLUMN,
  type PickTile,
  type TomsPicksData,
} from '@/lib/newspaper/toms-picks';
import { PhotoUrlField } from '../photo-url-field';
import { saveTomsPicks } from '../actions';

const PREVIEW_SCALE = 0.4;

type ColumnKey = 'college' | 'pro';

export function TomsPicksEditor({
  pageId,
  pageNumber,
  dateLabel,
  initialData,
}: {
  pageId: string;
  pageNumber?: number;
  dateLabel?: string;
  initialData: TomsPicksData;
}) {
  const router = useRouter();
  const [data, setData] = useState<TomsPicksData>(initialData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof TomsPicksData>(k: K, v: TomsPicksData[K]) {
    setSaved(false);
    setData((d) => ({ ...d, [k]: v }));
  }

  function setTile(col: ColumnKey, index: number, patch: Partial<PickTile>) {
    setSaved(false);
    setData((d) => ({
      ...d,
      [col]: d[col].map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  }

  function resetStandingCopy() {
    setSaved(false);
    setData((d) => ({ ...d, bio: DEFAULT_TOMS_PICKS_BIO, disclaimer: DEFAULT_TOMS_PICKS_DISCLAIMER }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await saveTomsPicks(pageId, data as unknown as Record<string, unknown>);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const handleMissing = data.bio.includes('@xxx');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
      {/* Fields */}
      <div className="max-w-xl space-y-6">
        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest font-bold text-zinc-500">Header</h2>
          <TextField label="Column Title" value={data.headline} onChange={(v) => set('headline', v)} />
          <PhotoUrlField
            label="Tom's Headshot"
            value={data.photo_url}
            onChange={(v) => set('photo_url', v)}
            addLabel="+ Upload Headshot"
            hint="Printed in a circle - a square, head-and-shoulders crop reads best."
          />
          <TextAreaField
            label="Bio"
            rows={4}
            value={data.bio}
            onChange={(v) => set('bio', v)}
          />
          {handleMissing ? (
            <p className="-mt-2 text-xs text-amber-700">
              The bio still contains the placeholder <code>@xxx</code> - replace it with Tom&apos;s
              real X handle before this page runs.
            </p>
          ) : null}
        </section>

        {(['college', 'pro'] as const).map((col) => (
          <section key={col} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs uppercase tracking-widest font-bold text-zinc-500">
                {col === 'college' ? 'College Column' : 'Pro Column'}
              </h2>
              <input
                value={col === 'college' ? data.college_label : data.pro_label}
                onChange={(e) => set(col === 'college' ? 'college_label' : 'pro_label', e.target.value)}
                aria-label={`${col} column heading`}
                className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs uppercase tracking-widest focus:border-brand-red focus:outline-none"
              />
            </div>
            {data[col].slice(0, TILES_PER_COLUMN).map((tile, i) => (
              <div key={tile.id} className="rounded border border-zinc-200 p-4 space-y-3 bg-white">
                <div className="text-[11px] uppercase tracking-widest font-bold text-zinc-400">
                  Pick {i + 1}
                </div>
                <PhotoUrlField
                  label="Team Logo"
                  value={tile.logo_url}
                  onChange={(v) => setTile(col, i, { logo_url: v })}
                  addLabel="+ Upload Logo"
                />
                <TextField
                  label="Pick"
                  value={tile.title}
                  onChange={(v) => setTile(col, i, { title: v })}
                  placeholder="Ohio State +10"
                />
                <TextAreaField
                  label="Blurb"
                  rows={3}
                  value={tile.blurb}
                  onChange={(v) => setTile(col, i, { blurb: v })}
                />
              </div>
            ))}
          </section>
        ))}

        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest font-bold text-zinc-500">Disclaimer</h2>
          <TextAreaField
            label=""
            rows={6}
            value={data.disclaimer}
            onChange={(v) => set('disclaimer', v)}
          />
          <button
            type="button"
            onClick={resetStandingCopy}
            className="text-xs text-zinc-600 hover:text-brand-red hover:underline"
          >
            Reset bio + disclaimer to the standard copy
          </button>
        </section>

        <div className="flex items-center gap-3 pt-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            {saving ? 'Saving…' : 'Save Page'}
          </button>
          <Link
            href={`/portal/all/newspaper-creator/${pageId}/print`}
            target="_blank"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
          >
            View / Print PDF
          </Link>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
          {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Preview</div>
        <div
          className="border border-zinc-300 shadow-sm overflow-hidden bg-white"
          style={{ width: CONTENT_W_PX * PREVIEW_SCALE, height: CONTENT_H_PX * PREVIEW_SCALE }}
        >
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
            <TomsPicksPage data={data} pageNumber={pageNumber ?? 1} dateLabel={dateLabel} editing />
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      {label ? <label className="block text-sm font-medium text-zinc-700">{label}</label> : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`${label ? 'mt-1' : ''} block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red`}
      />
    </div>
  );
}
