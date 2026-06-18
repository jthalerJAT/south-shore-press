'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { PageTwo } from '@/components/newspaper/page-two';
import type { OpEdData, OpEdMain, OpEdSecond } from '@/lib/newspaper/oped';
import type { EditorStoryRow } from '@/lib/queries/editor-stories';
import type { Ad } from '@/lib/queries/ads';
import { saveOpEd } from '../actions';
import { uploadImage } from '../image-upload-client';

const PREVIEW_SCALE = 0.42;

export function OpEdEditor({
  pageId,
  pageNumber,
  dateLabel,
  initialData,
  stories,
  ads,
}: {
  pageId: string;
  pageNumber: number;
  dateLabel: string;
  initialData: OpEdData;
  stories: EditorStoryRow[];
  ads: Ad[];
}) {
  const router = useRouter();
  const [data, setData] = useState<OpEdData>(initialData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function touch() {
    setSaved(false);
  }
  function setMain(p: Partial<OpEdMain>) {
    touch();
    setData((d) => ({ ...d, main: { ...d.main, ...p } }));
  }
  function setSecond(p: Partial<OpEdSecond>) {
    touch();
    setData((d) => ({ ...d, second: { ...d.second, ...p } }));
  }

  function fillMainFromStory(id: string) {
    const s = stories.find((x) => x.id === id);
    if (!s) return;
    setMain({ title: s.headline ?? '', author: s.byline ?? '', photo_url: s.hero_photo_url ?? '' });
  }
  function fillSecondFromStory(id: string) {
    const s = stories.find((x) => x.id === id);
    if (!s) return;
    setSecond({ headline: s.headline ?? '', author: s.byline ?? '', photo_url: s.hero_photo_url ?? '' });
  }
  function insertAd(id: string) {
    const a = ads.find((x) => x.id === id);
    if (!a) return;
    touch();
    setData((d) => ({
      ...d,
      bottom_ad: { ad_id: a.id, storage_path: a.copy_storage_path ?? undefined, file_name: a.copy_file_name ?? undefined },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await saveOpEd(pageId, data as unknown as Record<string, unknown>);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
      <div className="max-w-xl space-y-6">
        {/* Main OpEd */}
        <Section title="Main OpEd">
          <StoryPicker stories={stories} onPick={fillMainFromStory} />
          <PhotoField label="Author photo" value={data.main.author_photo_url} onChange={(v) => setMain({ author_photo_url: v })} onError={setError} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Column name" value={data.main.column_name ?? ''} onChange={(v) => setMain({ column_name: v })} placeholder="NEWSROOM" />
            <TextField label="Author" value={data.main.author ?? ''} onChange={(v) => setMain({ author: v })} />
          </div>
          <TextField label="Title" value={data.main.title ?? ''} onChange={(v) => setMain({ title: v })} />
          <TextArea label="Text" value={data.main.text ?? ''} onChange={(v) => setMain({ text: v })} rows={8} />
          <PhotoField label="Photo" value={data.main.photo_url} onChange={(v) => setMain({ photo_url: v })} onError={setError} />
          <TextField label="Photo caption" value={data.main.photo_caption ?? ''} onChange={(v) => setMain({ photo_caption: v })} />
        </Section>

        {/* Second Story */}
        <Section title="Second Story">
          <StoryPicker stories={stories} onPick={fillSecondFromStory} />
          <TextField label="Headline" value={data.second.headline ?? ''} onChange={(v) => setSecond({ headline: v })} />
          <TextField label="Author" value={data.second.author ?? ''} onChange={(v) => setSecond({ author: v })} />
          <TextArea label="Text" value={data.second.text ?? ''} onChange={(v) => setSecond({ text: v })} rows={5} />
          <PhotoField label="Photo" value={data.second.photo_url} onChange={(v) => setSecond({ photo_url: v })} onError={setError} />
          <PhotoField label="Additional photo" addLabel="+ Add Photo" value={data.second.extra_photo_url} onChange={(v) => setSecond({ extra_photo_url: v })} onError={setError} />
          <TextField label="Photo caption" value={data.second.photo_caption ?? ''} onChange={(v) => setSecond({ photo_caption: v })} />
        </Section>

        {/* Bottom Ad */}
        <Section title="Bottom Ad">
          {data.bottom_ad ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-700">{data.bottom_ad.file_name || 'Ad placed'}</span>
              <button
                type="button"
                onClick={() => {
                  touch();
                  setData((d) => ({ ...d, bottom_ad: null }));
                }}
                className="px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
              >
                Delete Ad
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">+ Insert Ad</label>
              <select
                value=""
                onChange={(e) => e.target.value && insertAd(e.target.value)}
                className="block w-full max-w-sm rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none"
              >
                <option value="">Choose an ad from the database…</option>
                {ads.map((a) => (
                  <option key={a.id} value={a.id}>{a.business_name}</option>
                ))}
              </select>
            </div>
          )}
        </Section>

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
            <PageTwo data={data} pageNumber={pageNumber} dateLabel={dateLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-500">{title}</h3>
      {children}
    </section>
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

function TextArea({
  label,
  value,
  onChange,
  rows = 6,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}

function PhotoField({
  label,
  value,
  onChange,
  onError,
  addLabel = '+ Photo',
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  onError: (msg: string) => void;
  addLabel?: string;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    const res = await uploadImage(file);
    setUploading(false);
    if (!res.ok) {
      onError(res.error ?? 'Upload failed.');
      return;
    }
    onChange(res.url!);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className="rounded-lg border-2 border-dashed border-zinc-300 bg-white px-4 py-3 flex items-center gap-3"
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="w-14 h-14 object-cover bg-zinc-100 rounded" />
            <button type="button" onClick={() => onChange('')} className="text-xs text-red-600 hover:underline">
              remove
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-zinc-500">Drag &amp; drop, or</span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center px-3 py-1.5 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 text-sm font-medium text-zinc-700 rounded"
            >
              {uploading ? 'Uploading…' : addLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StoryPicker({ stories, onPick }: { stories: EditorStoryRow[]; onPick: (id: string) => void }) {
  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
        e.target.value = '';
      }}
      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 focus:border-brand-red focus:outline-none"
    >
      <option value="">Fill from story…</option>
      {stories.map((s) => (
        <option key={s.id} value={s.id}>
          {s.headline.length > 60 ? s.headline.slice(0, 57) + '…' : s.headline}
        </option>
      ))}
    </select>
  );
}
