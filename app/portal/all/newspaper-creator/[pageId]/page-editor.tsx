'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AD_SIZES, type SlotDef } from '@/lib/newspaper-templates';
import { CONTENT_W_PX, CONTENT_H_PX, MIN_COLUMNS, MAX_COLUMNS } from '@/lib/newspaper/layout-engine';
import type { EditorStoryRow } from '@/lib/queries/editor-stories';
import type { Ad } from '@/lib/queries/ads';
import { SectionFlag } from '@/components/newspaper/section-flag';
import { PageHeader } from '@/components/newspaper/page-header';
import { ColophonRail } from '@/components/newspaper/colophon-rail';
import { COLOPHON_RAIL_W, COLOPHON_GAP } from '@/lib/newspaper/colophon';
import { StoryFillPicker } from '@/components/portal/story-fill-picker';
import { ProofBands, type ProofItem } from './print/proof-bands';
import { PhotoUrlField } from '../photo-url-field';
import { HeadlineField } from '../headline-field';
import { savePage, requestAdUploadUrl, setColophonRail, setPageFit, fetchStoryDetail, type SavedItem } from '../actions';

const ADS_BUCKET = 'newspaper-ads';
const PREVIEW_SCALE = 0.42;

type EditorItem = {
  localId: string;
  type: 'story' | 'ad';
  slot_key: string | null;
  source_story_id: string | null;
  data: Record<string, any>;
};

let counter = 0;
function newLocalId() {
  counter += 1;
  return `it-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PageEditor({
  pageId,
  slots,
  initialSectionName,
  initialItems,
  initialShowColophon = false,
  initialPhotoScale = 1,
  initialSpaceScale = 1,
  initialColumns = null,
  editorStories,
  ads = [],
  pageNumber = 1,
  dateLabel,
}: {
  pageId: string;
  pageTitle: string;
  kind: string;
  slots: SlotDef[] | null;
  initialSectionName: string;
  initialItems: Array<Pick<EditorItem, 'type' | 'slot_key' | 'source_story_id' | 'data'>>;
  initialShowColophon?: boolean;
  initialPhotoScale?: number;
  initialSpaceScale?: number;
  initialColumns?: number | null;
  /** Website stories for the per-card "Fill from story" picker. */
  editorStories: EditorStoryRow[];
  /** Ad Database rows for the per-ad "Choose from Ad Database" picker. */
  ads?: Ad[];
  /** Ordinal + issue date for the running PageHeader — the preview must render
   *  it so the fit measurement matches the real proof. */
  pageNumber?: number;
  dateLabel?: string;
}) {
  const router = useRouter();
  const [sectionName, setSectionName] = useState(initialSectionName);
  const [showColophon, setShowColophon] = useState(initialShowColophon);
  const [photoScale, setPhotoScale] = useState(initialPhotoScale);
  const [spaceScale, setSpaceScale] = useState(initialSpaceScale);
  // Page-wide column override (null = use each story's default). Default the
  // control to 4 (the house default) when unset.
  const [columns, setColumns] = useState<number>(initialColumns ?? 4);

  // Preview overflow measurement + "adjust to fit".
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [naturalHeight, setNaturalHeight] = useState(CONTENT_H_PX);
  const [fitting, setFitting] = useState(false);
  const overflow = naturalHeight > CONTENT_H_PX + 4;
  // Empty page → start with two blank article slots so the editor shows fields
  // to fill (with "Fill from story") instead of a blank form.
  const [items, setItems] = useState<EditorItem[]>(() =>
    initialItems.length > 0
      ? initialItems.map((it) => ({ ...it, localId: newLocalId() }))
      : [
          { localId: newLocalId(), type: 'story', slot_key: null, source_story_id: null, data: {} },
          { localId: newLocalId(), type: 'story', slot_key: null, source_story_id: null, data: {} },
        ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const update = () => setNaturalHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Tighten spacing first (to a floor), then shrink photos, until the page fits.
  async function adjustToFit() {
    setFitting(true);
    const MIN_SPACE = 0.3;
    const MIN_PHOTO = 0.4;
    const STEP = 0.06;
    const nextFrame = () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    let space = spaceScale;
    let photo = photoScale;
    for (let i = 0; i < 50; i++) {
      await nextFrame();
      const h = pageRef.current?.offsetHeight ?? 0;
      if (h <= CONTENT_H_PX + 4) break;
      if (space > MIN_SPACE) {
        space = Math.max(MIN_SPACE, +(space - STEP).toFixed(3));
        setSpaceScale(space);
        setSaved(false);
      } else if (photo > MIN_PHOTO) {
        photo = Math.max(MIN_PHOTO, +(photo - STEP).toFixed(3));
        setPhotoScale(photo);
        setSaved(false);
      } else {
        break;
      }
    }
    setFitting(false);
  }

  function patch(localId: string, partial: Record<string, any>) {
    setSaved(false);
    setItems((prev) =>
      prev.map((it) =>
        it.localId === localId ? { ...it, data: { ...it.data, ...partial } } : it
      )
    );
  }
  function setSlot(localId: string, slotKey: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.localId === localId ? { ...it, slot_key: slotKey || null } : it
      )
    );
  }
  function remove(localId: string) {
    setItems((prev) => prev.filter((it) => it.localId !== localId));
  }
  async function fillFromStory(localId: string, storyId: string) {
    const d = await fetchStoryDetail(storyId);
    if (!d) return;
    setItems((prev) =>
      prev.map((it) =>
        it.localId === localId
          ? {
              ...it,
              source_story_id: storyId,
              data: {
                ...it.data,
                headline: d.headline,
                byline: d.byline,
                body: d.body,
                hero_photo_url: d.hero_photo_url,
              },
            }
          : it
      )
    );
    setSaved(false);
  }
  function addStory() {
    setItems((prev) => [
      ...prev,
      { localId: newLocalId(), type: 'story', slot_key: null, source_story_id: null, data: {} },
    ]);
  }
  function addAd() {
    setItems((prev) => [
      ...prev,
      { localId: newLocalId(), type: 'ad', slot_key: null, source_story_id: null, data: { ad_size: 'quarter' } },
    ]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload: SavedItem[] = items.map((it) => ({
      type: it.type,
      slot_key: it.slot_key,
      source_story_id: it.source_story_id,
      data: it.data,
    }));
    const res = await savePage(pageId, sectionName, payload);
    if (res.ok) {
      // Persist the page-level fit levers into template_data (separate from the
      // np_items savePage replaces).
      await setPageFit(pageId, { photo_scale: photoScale, space_scale: spaceScale, columns });
    }
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const stories = items.filter((i) => i.type === 'story');
  const hasPhotos = items.some((it) => it.type === 'story' && it.data.hero_photo_url);
  const proofItems: ProofItem[] = items.map((it) => ({
    id: it.localId,
    type: it.type,
    data: it.data as ProofItem['data'],
    layout: {},
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
      <div className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/portal/all/newspaper-creator/${pageId}/layout`}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors"
        >
          Edit Page Layout
        </Link>
        <Link
          href={`/portal/all/newspaper-creator/${pageId}/print`}
          target="_blank"
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
        >
          View / Print PDF
        </Link>
      </div>

      <div className="mt-6">
        <label htmlFor="section_name" className="block text-sm font-medium text-zinc-700">
          Section Name <span className="text-zinc-400 font-normal">(optional — flagged at the top-left of the first story)</span>
        </label>
        <input
          id="section_name"
          value={sectionName}
          onChange={(e) => {
            setSectionName(e.target.value);
            setSaved(false);
          }}
          className="mt-1 block w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      <div className="mt-4">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={showColophon}
            onChange={(e) => {
              const v = e.target.checked;
              setShowColophon(v);
              setColophonRail(pageId, v);
            }}
            className="h-4 w-4 rounded border-zinc-300 text-brand-red focus:ring-brand-red"
          />
          Show the publication-info rail (masthead / staff / subscriptions) down the right side
        </label>
      </div>

      <div className="mt-8 space-y-6">
        {items.map((it, idx) =>
          it.type === 'story' ? (
            <StoryCard
              key={it.localId}
              item={it}
              index={stories.indexOf(it) + 1}
              slots={slots}
              editorStories={editorStories}
              onFill={fillFromStory}
              onPatch={patch}
              onSlot={setSlot}
              onRemove={remove}
            />
          ) : (
            <AdCard
              key={it.localId}
              item={it}
              slots={slots}
              ads={ads}
              onPatch={patch}
              onSlot={setSlot}
              onRemove={remove}
            />
          )
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addStory}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-brand-red border border-brand-red/40 hover:bg-red-50 rounded transition-colors"
        >
          + Additional Story
        </button>
        <button
          type="button"
          onClick={addAd}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
        >
          + Insert Ad
        </button>
      </div>

      {error ? (
        <div role="alert" className="mt-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div role="status" className="mt-5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          Page content saved and locked.
        </div>
      ) : null}

      <div className="mt-6 pt-6 border-t border-zinc-200">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
        >
          {saving ? 'Saving…' : 'Save Page Content'}
        </button>
        <p className="mt-2 text-xs text-zinc-500">
          Saving locks this page&apos;s content. You can reopen and re-save to change it. Note: saving
          content here resets a custom page layout to the default — arrange the layout last, in{' '}
          <strong>Edit Page Layout</strong>.
        </p>
      </div>
      </div>

      {/* ── Right: live preview + fit controls ─────────────── */}
      <div className="lg:sticky lg:top-6 lg:self-start" style={{ width: CONTENT_W_PX * PREVIEW_SCALE }}>
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Preview</div>
        <div
          className="border border-zinc-300 shadow-sm overflow-hidden bg-white"
          style={{ width: CONTENT_W_PX * PREVIEW_SCALE, height: CONTENT_H_PX * PREVIEW_SCALE }}
        >
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
            {/* MUST mirror the proof/View File/press render exactly (PageHeader +
                flag + colophon layout) — this box is what the overflow warning
                and "adjust to fit" measure. Anything the real page adds that the
                preview doesn't gets silently cut on print. */}
            <div ref={pageRef} style={{ width: CONTENT_W_PX, background: '#fff', color: '#111' }}>
              <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />
              <SectionFlag label={sectionName} />
              {proofItems.length > 0 ? (
                showColophon ? (
                  <div style={{ display: 'flex', gap: COLOPHON_GAP, width: CONTENT_W_PX }}>
                    <div style={{ width: CONTENT_W_PX - COLOPHON_RAIL_W - COLOPHON_GAP }}>
                      <ProofBands
                        items={proofItems}
                        contentWidthPx={CONTENT_W_PX - COLOPHON_RAIL_W - COLOPHON_GAP}
                        photoScale={photoScale}
                        spaceScale={spaceScale}
                        columns={columns}
                        pageOrdinal={pageNumber}
                      />
                    </div>
                    <ColophonRail width={COLOPHON_RAIL_W} />
                  </div>
                ) : (
                  <ProofBands items={proofItems} photoScale={photoScale} spaceScale={spaceScale} columns={columns} pageOrdinal={pageNumber} />
                )
              ) : (
                <p className="text-sm text-zinc-400 italic">Add a story or ad to see the preview.</p>
              )}
            </div>
          </div>
        </div>

        {overflow ? (
          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            ⚠ Content overflows the page by ~{Math.round((naturalHeight - CONTENT_H_PX) / 96 * 100) / 100}in.
            It will be clipped on the printed sheet — shrink photos, tighten spacing, or trim text.
          </div>
        ) : null}

        <div className="mt-3 rounded border border-zinc-200 p-3 space-y-3">
          <button
            type="button"
            onClick={adjustToFit}
            disabled={fitting}
            className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 rounded transition-colors"
          >
            {fitting ? 'Adjusting…' : 'Adjust to fit page'}
          </button>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">Columns</span>
            <div className="inline-flex items-center border border-zinc-300 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => { setColumns((c) => Math.max(MIN_COLUMNS, c - 1)); setSaved(false); }}
                disabled={columns <= MIN_COLUMNS}
                className="px-2.5 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                −
              </button>
              <span className="px-3 py-1 text-sm tabular-nums border-x border-zinc-300 min-w-[2.25rem] text-center">{columns}</span>
              <button
                type="button"
                onClick={() => { setColumns((c) => Math.min(MAX_COLUMNS, c + 1)); setSaved(false); }}
                disabled={columns >= MAX_COLUMNS}
                className="px-2.5 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between text-xs text-zinc-600">
              <span>Article spacing</span>
              <span>{Math.round(spaceScale * 100)}%</span>
            </label>
            <input
              type="range"
              min={0.3}
              max={1.6}
              step={0.05}
              value={spaceScale}
              onChange={(e) => { setSpaceScale(Number(e.target.value)); setSaved(false); }}
              className="w-full accent-brand-red"
            />
          </div>
          <div>
            <label className="flex items-center justify-between text-xs text-zinc-600">
              <span>Photo size</span>
              <span>{Math.round(photoScale * 100)}%</span>
            </label>
            <input
              type="range"
              min={0.4}
              max={1.8}
              step={0.02}
              value={photoScale}
              onChange={(e) => { setPhotoScale(Number(e.target.value)); setSaved(false); }}
              disabled={!hasPhotos}
              className="w-full accent-brand-red disabled:opacity-50"
            />
          </div>
          <p className="text-[11px] text-zinc-400">
            Columns, spacing and photo size apply to the whole page. Click <strong>Save Page Content</strong> to keep them.
          </p>
        </div>
      </div>
    </div>
  );
}

function SlotSelect({
  slots,
  value,
  onChange,
}: {
  slots: SlotDef[] | null;
  value: string | null;
  onChange: (v: string) => void;
}) {
  if (!slots) return null;
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-zinc-300 px-2 py-1 text-xs focus:border-brand-red focus:outline-none"
    >
      <option value="">— Tile —</option>
      {slots.map((s) => (
        <option key={s.key} value={s.key}>{s.label}</option>
      ))}
    </select>
  );
}

function CardShell({
  title,
  slots,
  slotValue,
  onSlot,
  onRemove,
  children,
}: {
  title: string;
  slots: SlotDef[] | null;
  slotValue: string | null;
  onSlot: (v: string) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-headline text-base font-bold text-zinc-900">{title}</h3>
        <div className="flex items-center gap-2">
          <SlotSelect slots={slots} value={slotValue} onChange={onSlot} />
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StoryCard({
  item,
  index,
  slots,
  editorStories,
  onFill,
  onPatch,
  onSlot,
  onRemove,
}: {
  item: EditorItem;
  index: number;
  slots: SlotDef[] | null;
  editorStories: EditorStoryRow[];
  onFill: (id: string, storyId: string) => void;
  onPatch: (id: string, p: Record<string, any>) => void;
  onSlot: (id: string, v: string) => void;
  onRemove: (id: string) => void;
}) {
  const d = item.data;
  const wordCount = String(d.body ?? '').trim() ? String(d.body).trim().split(/\s+/).length : 0;
  const extra: string[] = Array.isArray(d.extra_photo_urls) ? d.extra_photo_urls : [];

  return (
    <CardShell
      title={`Story ${index}`}
      slots={slots}
      slotValue={item.slot_key}
      onSlot={(v) => onSlot(item.localId, v)}
      onRemove={() => onRemove(item.localId)}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Fill this slot from a website story</label>
          <div className="max-w-md">
            <StoryFillPicker stories={editorStories} onPick={(id) => onFill(item.localId, id)} />
          </div>
        </div>
        <HeadlineField label="Headline" value={d.headline ?? ''} onChange={(v) => onPatch(item.localId, { headline: v })} />
        <Field label="Deck / Subline" value={d.subline ?? ''} onChange={(v) => onPatch(item.localId, { subline: v })} />
        <Field label="Byline" value={d.byline ?? ''} onChange={(v) => onPatch(item.localId, { byline: v })} />

        <div>
          <label className="block text-sm font-medium text-zinc-700">Body</label>
          <textarea
            rows={8}
            value={d.body ?? ''}
            onChange={(e) => onPatch(item.localId, { body: e.target.value })}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
          <p className="mt-1 text-xs text-zinc-400">{wordCount} words</p>
        </div>

        <PhotoUrlField label="Hero Photo URL" value={d.hero_photo_url} onChange={(v) => onPatch(item.localId, { hero_photo_url: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Photo Caption" value={d.photo_caption ?? ''} onChange={(v) => onPatch(item.localId, { photo_caption: v })} />
          <Field label="Photo Credit" value={d.photo_credit ?? ''} onChange={(v) => onPatch(item.localId, { photo_credit: v })} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Additional photos</label>
          <div className="mt-1 flex flex-col gap-3">
            {extra.map((url, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1">
                  <PhotoUrlField
                    value={url}
                    onChange={(v) => {
                      const next = [...extra];
                      next[i] = v;
                      onPatch(item.localId, { extra_photo_urls: next });
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onPatch(item.localId, { extra_photo_urls: extra.filter((_, j) => j !== i) })}
                  className="px-2 py-2 text-zinc-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onPatch(item.localId, { extra_photo_urls: [...extra, ''] })}
              className="self-start text-xs font-medium text-brand-red hover:underline"
            >
              + Add another photo
            </button>
          </div>
        </div>

        {/* Blue flag byline */}
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            checked={Boolean(d.blue_flag)}
            onChange={(e) => onPatch(item.localId, { blue_flag: e.target.checked })}
            className="h-4 w-4 accent-brand-red"
          />
          Add Blue Flag Byline
        </label>
        {d.blue_flag ? (
          <div className="rounded border border-blue-200 bg-blue-50/50 p-3 flex flex-col gap-3">
            <Field
              label="Blue flag section title"
              value={d.blue_flag_section ?? ''}
              onChange={(v) => onPatch(item.localId, { blue_flag_section: v })}
              hint="e.g. NEWSROOM, CONGRESSIONAL CORNER (may be blank)"
            />
            <PhotoUrlField
              label="Author Photo URL"
              value={d.author_photo_url}
              onChange={(v) => onPatch(item.localId, { author_photo_url: v })}
            />
          </div>
        ) : null}
      </div>
    </CardShell>
  );
}

function AdCard({
  item,
  slots,
  ads,
  onPatch,
  onSlot,
  onRemove,
}: {
  item: EditorItem;
  slots: SlotDef[] | null;
  ads: Ad[];
  onPatch: (id: string, p: Record<string, any>) => void;
  onSlot: (id: string, v: string) => void;
  onRemove: (id: string) => void;
}) {
  const d = item.data;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const signed = await requestAdUploadUrl(file.name);
      if (!signed.ok || !signed.path || !signed.token) {
        setUploadErr(signed.error ?? 'Upload failed.');
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(ADS_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) {
        setUploadErr(`Upload failed: ${error.message}`);
        return;
      }
      onPatch(item.localId, { storage_path: signed.path, file_name: file.name });
    } catch {
      setUploadErr('Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <CardShell
      title="Ad"
      slots={slots}
      slotValue={item.slot_key}
      onSlot={(v) => onSlot(item.localId, v)}
      onRemove={() => onRemove(item.localId)}
    >
      <div className="flex flex-col gap-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Ad Size</label>
          <select
            value={d.ad_size ?? 'quarter'}
            onChange={(e) => onPatch(item.localId, { ad_size: e.target.value })}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          >
            {AD_SIZES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {!d.file_name ? (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Select from the Ad Database</label>
            <select
              value=""
              onChange={(e) => {
                const ad = ads.find((a) => a.id === e.target.value);
                if (ad?.copy_storage_path) {
                  onPatch(item.localId, {
                    storage_path: ad.copy_storage_path,
                    file_name: ad.copy_file_name ?? ad.business_name,
                  });
                }
                e.target.value = '';
              }}
              className="block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none"
            >
              <option value="">Choose an ad…</option>
              {ads
                .filter((a) => a.copy_storage_path)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.business_name}
                    {a.copy_file_name ? ` — ${a.copy_file_name}` : ''}
                  </option>
                ))}
            </select>
          </div>
        ) : null}

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className="rounded-lg border-2 border-dashed border-zinc-300 bg-white px-6 py-6 text-center"
        >
          {d.file_name ? (
            <p className="text-sm text-zinc-700">
              <span className="font-medium">{d.file_name}</span>{' '}
              <button
                type="button"
                onClick={() => onPatch(item.localId, { storage_path: '', file_name: '' })}
                className="ml-2 text-brand-red hover:underline"
              >
                remove
              </button>
            </p>
          ) : (
            <p className="text-sm text-zinc-500">…or drag &amp; drop a new ad here, or</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {!d.file_name ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-3 inline-flex items-center px-3 py-1.5 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 text-sm font-medium text-zinc-700 rounded transition-colors"
            >
              {uploading ? 'Uploading…' : '+ Ad'}
            </button>
          ) : null}
        </div>
        {uploadErr ? (
          <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {uploadErr}
          </div>
        ) : null}
      </div>
    </CardShell>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
