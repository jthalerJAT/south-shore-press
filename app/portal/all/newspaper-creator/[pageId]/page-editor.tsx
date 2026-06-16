'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AD_SIZES, type SlotDef } from '@/lib/newspaper-templates';
import { savePage, requestAdUploadUrl, type SavedItem } from '../actions';

const ADS_BUCKET = 'newspaper-ads';

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
}: {
  pageId: string;
  pageTitle: string;
  kind: string;
  slots: SlotDef[] | null;
  initialSectionName: string;
  initialItems: Array<Pick<EditorItem, 'type' | 'slot_key' | 'source_story_id' | 'data'>>;
}) {
  const router = useRouter();
  const [sectionName, setSectionName] = useState(initialSectionName);
  const [items, setItems] = useState<EditorItem[]>(() =>
    initialItems.map((it) => ({ ...it, localId: newLocalId() }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const stories = items.filter((i) => i.type === 'story');

  return (
    <div className="max-w-3xl">
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

      <div className="mt-8 space-y-6">
        {items.map((it, idx) =>
          it.type === 'story' ? (
            <StoryCard
              key={it.localId}
              item={it}
              index={stories.indexOf(it) + 1}
              slots={slots}
              onPatch={patch}
              onSlot={setSlot}
              onRemove={remove}
            />
          ) : (
            <AdCard
              key={it.localId}
              item={it}
              slots={slots}
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
  onPatch,
  onSlot,
  onRemove,
}: {
  item: EditorItem;
  index: number;
  slots: SlotDef[] | null;
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
        <Field label="Headline" value={d.headline ?? ''} onChange={(v) => onPatch(item.localId, { headline: v })} />
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

        <Field label="Hero photo URL" value={d.hero_photo_url ?? ''} onChange={(v) => onPatch(item.localId, { hero_photo_url: v })} />

        <div>
          <label className="block text-sm font-medium text-zinc-700">Additional photos</label>
          <div className="mt-1 flex flex-col gap-2">
            {extra.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => {
                    const next = [...extra];
                    next[i] = e.target.value;
                    onPatch(item.localId, { extra_photo_urls: next });
                  }}
                  className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => onPatch(item.localId, { extra_photo_urls: extra.filter((_, j) => j !== i) })}
                  className="px-2 text-zinc-400 hover:text-red-600"
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
            <Field
              label="Author photo URL"
              value={d.author_photo_url ?? ''}
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
  onPatch,
  onSlot,
  onRemove,
}: {
  item: EditorItem;
  slots: SlotDef[] | null;
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
            <p className="text-sm text-zinc-500">Drag &amp; drop the ad here, or</p>
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
