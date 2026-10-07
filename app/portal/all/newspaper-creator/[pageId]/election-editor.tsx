'use client';

/**
 * ElectionEditor — the Election Issue voter-guide SECTION editor. Opening any
 * election page lands here: the section (intro + race tiles) is edited once
 * and spans every election page in the issue. Tiles are packed onto pages in
 * order, whole tiles only — when a page fills, the next tile starts the next
 * page (see components/newspaper/election-page.tsx). The live preview shows
 * all the section's pages; a warning appears when the tiles need more pages
 * than the issue has.
 *
 * Text boxes auto-grow: the rationale defaults to two lines, each candidate
 * bio to six, and both stretch to fit whatever is typed (the print tile grows
 * the same way; headshots stay a constant size).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { ElectionPage } from '@/components/newspaper/election-page';
import {
  emptyTile,
  type ElectionSectionData,
  type ElectionTile,
  type ElectionCandidate,
} from '@/lib/newspaper/election-page';
import { PhotoUrlField } from '../photo-url-field';
import { saveElectionSection } from '../actions';

const PREVIEW_SCALE = 0.32;

let counter = 0;
function newId() {
  counter += 1;
  return `race-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Textarea that grows with its content (never scrolls). */
function GrowArea({
  value,
  onChange,
  minRows,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  minRows: number;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={
        className ??
        'block w-full resize-none overflow-hidden rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none'
      }
    />
  );
}

export function ElectionEditor({
  firstPageId,
  otherPageIds,
  pageOrdinals,
  dateLabel,
  initialData,
}: {
  /** The election page that stores the section data. */
  firstPageId: string;
  /** The remaining election pages, in order. */
  otherPageIds: string[];
  /** Printed page numbers of ALL election pages, in order (e.g. [3,4,5,6,7,8]). */
  pageOrdinals: number[];
  dateLabel?: string;
  initialData: ElectionSectionData;
}) {
  const router = useRouter();
  const [data, setData] = useState<ElectionSectionData>(initialData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagesNeeded, setPagesNeeded] = useState(1);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const pageCount = pageOrdinals.length;

  function touch() {
    setSaved(false);
  }
  function patch(p: Partial<ElectionSectionData>) {
    touch();
    setData((d) => ({ ...d, ...p }));
  }
  function patchTile(id: string, p: Partial<ElectionTile>) {
    touch();
    setData((d) => ({ ...d, tiles: d.tiles.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  }
  function patchCand(id: string, side: 'left' | 'right', p: Partial<ElectionCandidate>) {
    touch();
    setData((d) => ({
      ...d,
      tiles: d.tiles.map((t) => (t.id === id ? { ...t, [side]: { ...t[side], ...p } } : t)),
    }));
  }
  function addTile() {
    touch();
    setData((d) => ({ ...d, tiles: [...d.tiles, emptyTile(newId())] }));
  }
  function removeTile(id: string) {
    touch();
    setData((d) => ({ ...d, tiles: d.tiles.filter((t) => t.id !== id) }));
  }
  function moveTile(id: string, dir: -1 | 1) {
    touch();
    setData((d) => {
      const idx = d.tiles.findIndex((t) => t.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= d.tiles.length) return d;
      const next = [...d.tiles];
      const [t] = next.splice(idx, 1);
      next.splice(to, 0, t);
      return { ...d, tiles: next };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await saveElectionSection(
      firstPageId,
      data as unknown as Record<string, unknown>,
      otherPageIds
    );
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  // The print component reports how many pages the tiles actually need via a
  // data attribute — poll it after each change settles.
  useEffect(() => {
    const t = setTimeout(() => {
      const el = previewRef.current?.querySelector('[data-election-pages-needed]');
      const n = el ? parseInt(el.getAttribute('data-election-pages-needed') ?? '1', 10) : 1;
      setPagesNeeded(Number.isFinite(n) && n > 0 ? n : 1);
    }, 150);
    return () => clearTimeout(t);
  }, [data]);

  const candBox = 'rounded border border-zinc-200 p-3 space-y-2';
  const inputCls =
    'block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-8">
      {/* ── Controls ───────────────────────────────────────── */}
      <div className="max-w-2xl space-y-5">
        <p className="text-sm text-zinc-600">
          One set of race tiles fills all {pageCount} election page{pageCount === 1 ? '' : 's'} of
          this issue, in order. Tiles never split across a page break — when a page fills, the next
          race starts the following page. Text boxes grow as you type; headshots stay a fixed size.
        </p>

        {/* Intro box */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Intro Box (top of page {pageOrdinals[0] ?? 3})
            </span>
            {data.intro === null ? (
              <button
                type="button"
                onClick={() => patch({ intro: '' })}
                className="text-xs font-medium text-brand-red hover:underline"
              >
                + Add intro box
              </button>
            ) : (
              <button
                type="button"
                onClick={() => patch({ intro: null })}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Remove intro box
              </button>
            )}
          </div>
          {data.intro !== null ? (
            <>
              <input
                type="text"
                value={data.intro_title}
                onChange={(e) => patch({ intro_title: e.target.value })}
                placeholder="Your Guide to the Ballot"
                className={inputCls}
              />
              <GrowArea
                value={data.intro}
                onChange={(v) => patch({ intro: v })}
                minRows={3}
                placeholder="Describe what readers will find in the section below…"
              />
            </>
          ) : (
            <p className="text-xs text-zinc-400">
              Removed — the first race tile starts at the top of the page.
            </p>
          )}
        </div>

        {/* Section / footer labels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Section flag</label>
            <input
              type="text"
              value={data.section_label}
              onChange={(e) => patch({ section_label: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Footer bar</label>
            <input
              type="text"
              value={data.footer_label}
              onChange={(e) => patch({ footer_label: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        {/* Race tiles */}
        {data.tiles.map((t, i) => (
          <div key={t.id} className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Race {i + 1}
                {t.race.trim() ? ` — ${t.race.trim().toUpperCase()}` : ''}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => moveTile(t.id, -1)} disabled={i === 0} className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => moveTile(t.id, 1)} disabled={i === data.tiles.length - 1} className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => removeTile(t.id)} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Race name</label>
                <input
                  type="text"
                  value={t.race}
                  onChange={(e) => patchTile(t.id, { race: e.target.value })}
                  placeholder="County Treasurer"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  South Shore Press Verdict
                </label>
                <input
                  type="text"
                  value={t.verdict}
                  onChange={(e) => patchTile(t.id, { verdict: e.target.value })}
                  placeholder="Candidate we endorse"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Endorsement rationale
              </label>
              <GrowArea
                value={t.rationale}
                onChange={(v) => patchTile(t.id, { rationale: v })}
                minRows={2}
                placeholder="Why the editorial board recommends this candidate…"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['left', 'right'] as const).map((side) => (
                <div key={side} className={candBox}>
                  <div
                    className={`text-[11px] font-bold uppercase tracking-widest ${side === 'left' ? 'text-red-700' : 'text-blue-700'}`}
                  >
                    {side === 'left' ? 'Left (red) candidate' : 'Right (blue) candidate'}
                  </div>
                  <input
                    type="text"
                    value={t[side].party}
                    onChange={(e) => patchCand(t.id, side, { party: e.target.value })}
                    placeholder="Party"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={t[side].name}
                    onChange={(e) => patchCand(t.id, side, { name: e.target.value })}
                    placeholder="Candidate name"
                    className={inputCls}
                  />
                  <PhotoUrlField
                    value={t[side].photo_url}
                    onChange={(url) => patchCand(t.id, side, { photo_url: url })}
                    addLabel="+ Add Photo"
                    placeholder="Headshot URL, or upload →"
                  />
                  <GrowArea
                    value={t[side].bio}
                    onChange={(v) => patchCand(t.id, side, { bio: v })}
                    minRows={6}
                    placeholder="Background / bio…"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div>
          <button
            type="button"
            onClick={addTile}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            + Add New Tile
          </button>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            {saving ? 'Saving…' : 'Save Section'}
          </button>
          <Link
            href={`/portal/all/newspaper-creator/${firstPageId}/print`}
            target="_blank"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
          >
            View / Print PDF
          </Link>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
          {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
        </div>
      </div>

      {/* ── Live preview: every election page of the section ── */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">
          Preview — fills {Math.min(pagesNeeded, pageCount)} of {pageCount} page
          {pageCount === 1 ? '' : 's'}
        </div>
        {pagesNeeded > pageCount ? (
          <div className="mb-2 max-w-xs text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            ⚠ The races need {pagesNeeded} pages but this issue has {pageCount} election page
            {pageCount === 1 ? '' : 's'} — tiles past page {pageCount} won&apos;t print. Add
            Election Pages from &ldquo;+ Add Page&rdquo; on the board, or trim content.
          </div>
        ) : null}
        <div ref={previewRef} className="space-y-4">
          {pageOrdinals.map((ordinal, idx) => (
            <div key={ordinal}>
              <div className="text-[11px] text-zinc-400 mb-1">Page {ordinal}</div>
              <div
                className="border border-zinc-300 shadow-sm overflow-hidden bg-white"
                style={{ width: CONTENT_W_PX * PREVIEW_SCALE, height: CONTENT_H_PX * PREVIEW_SCALE }}
              >
                <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
                  <ElectionPage
                    data={data}
                    sectionIndex={idx}
                    pageNumber={ordinal}
                    dateLabel={dateLabel}
                    editing
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
