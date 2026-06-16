'use client';

/**
 * LayoutEditor — the visual "Edit Page Layout" tool (Phase 2A). Owns the band
 * list + per-band geometry, drives the to-scale canvas, and persists geometry
 * via savePage. Column count + photo placement reflow real column text through
 * the shared layout engine; band order, zoom, and save live here.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  normalizeStoryLayout,
  normalizeAdLayout,
  defaultStoryLayout,
  AD_HEIGHT_FRAC,
  MIN_COLUMNS,
  MAX_COLUMNS,
  PAGE_W_PX,
  type StoredStoryLayout,
  type StoredAdLayout,
} from '@/lib/newspaper/layout-engine';
import { useComputedBands, type BandInput } from '@/lib/newspaper/use-bands';
import type { NpStoryData, NpAdData } from '@/lib/queries/newspaper';
import { savePage, type SavedItem } from '../../actions';
import { PageCanvas } from './page-canvas';
import { StoryBand } from './story-band';
import type { PhotoCommit } from './photo-overlay';

const ADS_BUCKET = 'newspaper-ads';
function adUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${ADS_BUCKET}/${path}`;
}

export type EditorBand = {
  id: string;
  type: 'story' | 'ad';
  slot_key: string | null;
  source_story_id: string | null;
  data: NpStoryData & NpAdData;
  story?: StoredStoryLayout;
  ad?: StoredAdLayout;
};

export type InitialItem = {
  id: string;
  type: 'story' | 'ad';
  slot_key: string | null;
  source_story_id: string | null;
  data: NpStoryData & NpAdData;
  layout: Record<string, unknown>;
};

const ZOOM_PRESETS = [0.5, 0.75, 1] as const;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function LayoutEditor({
  pageId,
  pageTitle,
  sectionName,
  initialItems,
}: {
  pageId: string;
  pageTitle: string;
  sectionName: string;
  initialItems: InitialItem[];
}) {
  const router = useRouter();

  const [bands, setBands] = useState<EditorBand[]>(() =>
    initialItems.map((it, i) => ({
      id: it.id,
      type: it.type,
      slot_key: it.slot_key,
      source_story_id: it.source_story_id,
      data: it.data,
      story:
        it.type === 'story'
          ? normalizeStoryLayout(it.layout, i, Boolean(it.data.hero_photo_url))
          : undefined,
      ad: it.type === 'ad' ? normalizeAdLayout(it.layout, i, it.data.ad_size ?? 'quarter') : undefined,
    }))
  );
  const [selectedId, setSelectedId] = useState<string | null>(bands[0]?.id ?? null);
  const [zoom, setZoom] = useState(0.75);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasColRef = useRef<HTMLDivElement>(null);
  const fitZoom = useCallback(() => {
    const el = canvasColRef.current;
    if (!el) return;
    setZoom(clamp((el.clientWidth - 48) / PAGE_W_PX, 0.25, 1.5));
  }, []);
  useLayoutEffect(() => {
    fitZoom();
    window.addEventListener('resize', fitZoom);
    return () => window.removeEventListener('resize', fitZoom);
  }, [fitZoom]);

  const inputs: BandInput[] = useMemo(
    () => bands.map((b) => ({ id: b.id, type: b.type, data: b.data, story: b.story, ad: b.ad })),
    [bands]
  );
  const { computed } = useComputedBands(inputs);
  const computedById = useMemo(() => {
    const m: Record<string, (typeof computed)[number]> = {};
    computed.forEach((c) => (m[c.id] = c));
    return m;
  }, [computed]);

  const selected = bands.find((b) => b.id === selectedId) ?? null;
  const selectedComputed = selectedId ? computedById[selectedId] : null;

  // ── Mutators ──────────────────────────────────────────────────────────────
  const dirty = useRef(false);
  function updateStory(id: string, fn: (s: StoredStoryLayout) => StoredStoryLayout) {
    dirty.current = true;
    setSaved(false);
    setBands((prev) =>
      prev.map((b) => (b.id === id && b.story ? { ...b, story: fn(b.story) } : b))
    );
  }
  function updateAd(id: string, fn: (a: StoredAdLayout) => StoredAdLayout) {
    dirty.current = true;
    setSaved(false);
    setBands((prev) => prev.map((b) => (b.id === id && b.ad ? { ...b, ad: fn(b.ad) } : b)));
  }

  function setColumns(id: string, n: number) {
    updateStory(id, (s) => {
      const column_count = clamp(n, MIN_COLUMNS, MAX_COLUMNS);
      let photo = s.photo;
      if (photo) {
        const col_span = clamp(photo.col_span, 1, column_count);
        const col_start = clamp(photo.col_start, 1, column_count - col_span + 1);
        photo = { ...photo, col_span, col_start };
      }
      return { ...s, column_count, photo };
    });
  }

  const onPhotoCommit = useCallback(
    (id: string, c: PhotoCommit) => {
      updateStory(id, (s) => ({ ...s, photo: { mode: 'column', ...c } }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function resetPhoto(id: string, hasHero: boolean) {
    updateStory(id, (s) => ({ ...s, photo: defaultStoryLayout(s.band_index, hasHero).photo }));
  }
  function removePhoto(id: string) {
    updateStory(id, (s) => ({ ...s, photo: null }));
  }
  function setAdSize(id: string, size: StoredAdLayout['size']) {
    updateAd(id, (a) => ({ ...a, size, height: AD_HEIGHT_FRAC[size] }));
  }

  function moveBand(id: string, dir: -1 | 1) {
    dirty.current = true;
    setSaved(false);
    setBands((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const items: SavedItem[] = bands.map((b) => ({
      type: b.type,
      slot_key: b.slot_key,
      source_story_id: b.source_story_id,
      data: b.data as Record<string, unknown>,
      layout: (b.type === 'story' ? b.story : b.ad) as unknown as Record<string, unknown>,
    }));
    const res = await savePage(pageId, sectionName, items);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save the layout.');
      return;
    }
    dirty.current = false;
    setSaved(true);
    router.refresh();
  }

  const anyOverflow = computed.some((c) => c.layoutResult && !c.layoutResult.fits);

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] min-h-[32rem]">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-zinc-200">
        <Link
          href={`/portal/all/newspaper-creator/${pageId}`}
          className="text-sm font-medium text-brand-red hover:underline"
        >
          ← Back to content
        </Link>
        <span className="text-sm text-zinc-500">·</span>
        <span className="text-sm font-medium text-zinc-700">{pageTitle} — layout</span>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded border border-zinc-300 overflow-hidden">
            <button
              type="button"
              onClick={fitZoom}
              className="px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 border-r border-zinc-300"
            >
              Fit
            </button>
            {ZOOM_PRESETS.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={cn(
                  'px-2 py-1 text-xs font-medium border-r border-zinc-300 last:border-r-0 hover:bg-zinc-50',
                  Math.abs(zoom - z) < 0.001 ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600'
                )}
              >
                {Math.round(z * 100)}%
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-1.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold rounded transition-colors"
          >
            {saving ? 'Saving…' : 'Save Layout'}
          </button>
        </div>
      </div>

      {(error || saved || anyOverflow) && (
        <div className="pt-2 flex flex-wrap gap-2 text-xs">
          {error ? (
            <span className="text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</span>
          ) : null}
          {saved ? (
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
              Layout saved.
            </span>
          ) : null}
          {anyOverflow ? (
            <span className="text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              Some content overflows the page — carrying to another page comes in the next phase.
            </span>
          ) : null}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-[1fr_18rem] gap-4 pt-3">
        {/* Canvas */}
        <div ref={canvasColRef} className="min-w-0">
          <PageCanvas zoom={zoom}>
            {bands.length === 0 ? (
              <p className="text-sm text-zinc-400 italic p-4">
                This page has no content yet. Add stories from the Newspaper Creator board, then
                arrange them here.
              </p>
            ) : (
              bands.map((b) => {
                const c = computedById[b.id];
                if (!c) return null;
                return (
                  <StoryBand
                    key={b.id}
                    band={b}
                    computed={c}
                    selected={b.id === selectedId}
                    zoom={zoom}
                    onSelect={() => setSelectedId(b.id)}
                    onPhotoCommit={(pc) => onPhotoCommit(b.id, pc)}
                    adPublicUrl={adUrl}
                  />
                );
              })
            )}
          </PageCanvas>
        </div>

        {/* Inspector */}
        <aside className="min-h-0 overflow-y-auto rounded border border-zinc-200 bg-white p-4">
          <Inspector
            band={selected}
            computed={selectedComputed}
            index={selected ? bands.findIndex((b) => b.id === selected.id) : -1}
            count={bands.length}
            onColumns={(n) => selected && setColumns(selected.id, n)}
            onResetPhoto={() => selected && resetPhoto(selected.id, Boolean(selected.data.hero_photo_url))}
            onRemovePhoto={() => selected && removePhoto(selected.id)}
            onAdSize={(s) => selected && setAdSize(selected.id, s)}
            onMove={(dir) => selected && moveBand(selected.id, dir)}
          />
        </aside>
      </div>
    </div>
  );
}

function Inspector({
  band,
  computed,
  index,
  count,
  onColumns,
  onResetPhoto,
  onRemovePhoto,
  onAdSize,
  onMove,
}: {
  band: EditorBand | null;
  computed: { layoutResult: { fits: boolean } | null } | null | undefined;
  index: number;
  count: number;
  onColumns: (n: number) => void;
  onResetPhoto: () => void;
  onRemovePhoto: () => void;
  onAdSize: (s: StoredAdLayout['size']) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  if (!band) {
    return <p className="text-sm text-zinc-400">Select a story or ad on the page to edit its layout.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-500">
          {band.type === 'ad' ? 'Advertisement' : 'Story'}
        </h3>
        <p className="mt-1 text-sm font-medium text-zinc-900 line-clamp-2">
          {band.type === 'ad' ? band.data.file_name ?? 'Ad' : band.data.headline || 'Untitled story'}
        </p>
      </div>

      {band.type === 'story' && band.story ? (
        <>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
              Columns
            </label>
            <div className="inline-flex items-center rounded border border-zinc-300 overflow-hidden">
              <button
                type="button"
                onClick={() => onColumns(band.story!.column_count - 1)}
                disabled={band.story.column_count <= MIN_COLUMNS}
                className="px-3 py-1.5 text-lg leading-none text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                −
              </button>
              <span className="px-4 py-1.5 text-sm font-semibold tabular-nums border-x border-zinc-300">
                {band.story.column_count}
              </span>
              <button
                type="button"
                onClick={() => onColumns(band.story!.column_count + 1)}
                disabled={band.story.column_count >= MAX_COLUMNS}
                className="px-3 py-1.5 text-lg leading-none text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">Fewer columns ⇒ taller; more ⇒ shorter.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
              Photo
            </label>
            {band.data.hero_photo_url ? (
              band.story.photo ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] text-zinc-500">
                    Drag the photo on the page to reposition; text wraps around it. Drag the corner to
                    resize.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onResetPhoto}
                      className="px-2 py-1 text-xs font-medium text-zinc-700 border border-zinc-300 rounded hover:bg-zinc-50"
                    >
                      Reset position
                    </button>
                    <button
                      type="button"
                      onClick={onRemovePhoto}
                      className="px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onResetPhoto}
                  className="px-2 py-1 text-xs font-medium text-brand-red border border-brand-red/40 rounded hover:bg-red-50"
                >
                  Place photo
                </button>
              )
            ) : (
              <p className="text-[11px] text-zinc-400">This story has no hero photo.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
              Fit
            </label>
            {computed?.layoutResult ? (
              computed.layoutResult.fits ? (
                <span className="text-xs text-emerald-700">✓ Fits the page</span>
              ) : (
                <span className="text-xs text-red-600">Overflows — extends past the page bottom</span>
              )
            ) : (
              <span className="text-xs text-zinc-400">—</span>
            )}
          </div>
        </>
      ) : null}

      {band.type === 'ad' && band.ad ? (
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
            Ad size
          </label>
          <select
            value={band.ad.size}
            onChange={(e) => onAdSize(e.target.value as StoredAdLayout['size'])}
            className="block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none"
          >
            <option value="full">Full Page</option>
            <option value="half">Half Page</option>
            <option value="quarter">Quarter Page</option>
          </select>
        </div>
      ) : null}

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
          Order
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index <= 0}
            className="px-2 py-1 text-xs font-medium text-zinc-700 border border-zinc-300 rounded hover:bg-zinc-50 disabled:opacity-40"
          >
            ↑ Move up
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index >= count - 1}
            className="px-2 py-1 text-xs font-medium text-zinc-700 border border-zinc-300 rounded hover:bg-zinc-50 disabled:opacity-40"
          >
            ↓ Move down
          </button>
        </div>
      </div>
    </div>
  );
}
