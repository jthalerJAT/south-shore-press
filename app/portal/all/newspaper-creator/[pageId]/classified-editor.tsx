'use client';

/**
 * ClassifiedEditor — bespoke editor for a `classifieds` template page. Pick an
 * uploaded classified (from the Classified Upload library) to fill the whole
 * page, with a live to-scale preview. Save persists template_data + locks.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { ClassifiedPage } from '@/components/newspaper/classified-page';
import { type ClassifiedPageData, fillClassifiedFromRecord } from '@/lib/newspaper/classified';
import { saveClassifiedPage } from '../actions';

const PREVIEW_SCALE = 0.4;

export type ClassifiedOption = {
  id: string;
  dateLabel: string;
  fileName: string | null;
  storagePath: string;
};

export function ClassifiedEditor({
  pageId,
  initialData,
  options,
}: {
  pageId: string;
  initialData: ClassifiedPageData;
  options: ClassifiedOption[];
}) {
  const router = useRouter();
  const [data, setData] = useState<ClassifiedPageData>(initialData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(id: string) {
    const rec = options.find((o) => o.id === id);
    if (!rec) return;
    setSaved(false);
    setData((d) => fillClassifiedFromRecord(d, { id: rec.id, storage_path: rec.storagePath, file_name: rec.fileName }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await saveClassifiedPage(pageId, data as unknown as Record<string, unknown>);
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
      <div className="max-w-md space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Choose a classified</label>
          <select
            value={data.classified_id ?? ''}
            onChange={(e) => e.target.value && pick(e.target.value)}
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
          >
            <option value="">Select an uploaded classified…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.dateLabel}{o.fileName ? ` — ${o.fileName}` : ''}
              </option>
            ))}
          </select>
          {options.length === 0 ? (
            <p className="mt-1 text-[11px] text-zinc-400">
              No classifieds uploaded yet — add one in{' '}
              <Link href="/portal/all/classifieds" className="text-brand-red hover:underline">Classified Upload</Link>.
            </p>
          ) : null}
        </div>

        {data.storage_path ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-700">{data.file_name || 'Classified placed'}</span>
            <button
              type="button"
              onClick={() => { setSaved(false); setData({ v: 1 }); }}
              className="px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        ) : null}

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

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Preview</div>
        <div
          className="border border-zinc-300 shadow-sm overflow-hidden bg-white"
          style={{ width: CONTENT_W_PX * PREVIEW_SCALE, height: CONTENT_H_PX * PREVIEW_SCALE }}
        >
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
            <ClassifiedPage data={data} editing />
          </div>
        </div>
      </div>
    </div>
  );
}
