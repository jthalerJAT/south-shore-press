'use client';

/**
 * LegalEditor — editor for a Legal Notices template page. "+ Add New Legal"
 * places a notice either from the Legal Notices DATABASE (saved copy — NY
 * publication notices run six consecutive weeks, so re-picking is the normal
 * workflow) or from pasted copy, which is saved to the database automatically
 * so next week's page can re-pick it. Right: a live to-scale LegalPage preview
 * with an overflow warning when the copy exceeds the page's columns.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { LegalPage } from '@/components/newspaper/legal-page';
import {
  legalNoticeLabel,
  DEFAULT_LEGAL_HEADER,
  LEGAL_PAGE_COLUMNS,
  type LegalPageData,
  type PlacedLegalNotice,
} from '@/lib/newspaper/legal-page';
import type { LegalNotice } from '@/lib/queries/legal-notices';
import { createLegalNotice, saveLegalPage } from '../actions';

const PREVIEW_SCALE = 0.4;

let counter = 0;
function newId() {
  counter += 1;
  return `pl-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function LegalEditor({
  pageId,
  pageNumber,
  dateLabel,
  initialData,
  savedNotices,
}: {
  pageId: string;
  pageNumber: number;
  dateLabel?: string;
  initialData: LegalPageData;
  savedNotices: LegalNotice[];
}) {
  const router = useRouter();
  const [data, setData] = useState<LegalPageData>(initialData);
  const [notices, setNotices] = useState<LegalNotice[]>(savedNotices);
  const [adding, setAdding] = useState(false);
  const [newHeader, setNewHeader] = useState(DEFAULT_LEGAL_HEADER);
  const [newCopy, setNewCopy] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  function touch() {
    setSaved(false);
  }
  function place(notice: PlacedLegalNotice) {
    touch();
    setData((d) => ({ ...d, notices: [...d.notices, notice] }));
  }
  function patchBody(id: string, body: string) {
    touch();
    setData((d) => ({ ...d, notices: d.notices.map((n) => (n.id === id ? { ...n, body } : n)) }));
  }
  function patchHeader(id: string, header: string) {
    touch();
    setData((d) => ({ ...d, notices: d.notices.map((n) => (n.id === id ? { ...n, header } : n)) }));
  }
  function patchCancelled(id: string, cancelled: boolean) {
    touch();
    setData((d) => ({
      ...d,
      notices: d.notices.map((n) => (n.id === id ? { ...n, cancelled: cancelled || undefined } : n)),
    }));
  }
  function remove(id: string) {
    touch();
    setData((d) => ({ ...d, notices: d.notices.filter((n) => n.id !== id) }));
  }
  function move(id: string, dir: -1 | 1) {
    touch();
    setData((d) => {
      const idx = d.notices.findIndex((n) => n.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= d.notices.length) return d;
      const next = [...d.notices];
      const [n] = next.splice(idx, 1);
      next.splice(to, 0, n);
      return { ...d, notices: next };
    });
  }

  function pickFromDatabase(noticeId: string) {
    const n = notices.find((x) => x.id === noticeId);
    if (!n) return;
    place({ id: newId(), notice_id: n.id, header: n.header ?? undefined, body: n.body });
  }

  async function addNewCopy() {
    const body = newCopy.trim();
    if (!body) return;
    const header = newHeader.trim() || DEFAULT_LEGAL_HEADER;
    setBusy(true);
    setError(null);
    const res = await createLegalNotice(body, header);
    setBusy(false);
    if (!res.ok || !res.id) {
      setError(res.error ?? 'Could not save the notice.');
      return;
    }
    // It's in the database now — future pages can re-pick it.
    setNotices((prev) => [
      { id: res.id!, label: legalNoticeLabel(body), header, body, created_at: new Date().toISOString() },
      ...prev,
    ]);
    place({ id: newId(), notice_id: res.id, header, body });
    setNewHeader(DEFAULT_LEGAL_HEADER);
    setNewCopy('');
    setAdding(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await saveLegalPage(pageId, data as unknown as Record<string, unknown>);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  // Overflow check: with a fixed page height, CSS multicol pushes excess copy
  // into clipped extra columns off the right edge — detect and warn.
  useEffect(() => {
    const t = setTimeout(() => {
      const el = previewRef.current?.querySelector('[data-legal-columns]');
      setOverflowing(Boolean(el && el.scrollWidth > el.clientWidth + 2));
    }, 80);
    return () => clearTimeout(t);
  }, [data]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
      {/* ── Controls ───────────────────────────────────────── */}
      <div className="max-w-xl space-y-5">
        <p className="text-sm text-zinc-600">
          Legal notices flow into {data.columns ?? LEGAL_PAGE_COLUMNS} dense columns under the LEGAL NOTICES banner,
          exactly like the printed page. Add copy with <strong>+ Add New Legal</strong> — pasted
          copy is saved to the Legal Notices database so it can be re-picked in future issues
          (publication notices typically run six consecutive weeks).
        </p>

        <div>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            + Add New Legal
          </button>
        </div>

        {adding ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Choose from the Legal Notices database
              </label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) pickFromDatabase(e.target.value);
                  e.target.value = '';
                }}
                className="block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none"
              >
                <option value="">Choose a saved notice…</option>
                {notices.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} — {new Date(n.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-zinc-400 text-center uppercase tracking-widest">or</div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Header</label>
              <input
                type="text"
                value={newHeader}
                onChange={(e) => setNewHeader(e.target.value)}
                placeholder={DEFAULT_LEGAL_HEADER}
                className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                The centered title printed above this notice — e.g. PUBLIC NOTICE or Attorney.
              </p>
              <label className="block text-sm font-medium text-zinc-700 mb-1 mt-3">Paste new copy</label>
              <textarea
                rows={8}
                value={newCopy}
                onChange={(e) => setNewCopy(e.target.value)}
                placeholder={'NOTICE OF FORMATION\nNotice of Formation of …'}
                className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
              />
              <button
                type="button"
                onClick={addNewCopy}
                disabled={busy || !newCopy.trim()}
                className="mt-2 inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold rounded transition-colors"
              >
                {busy ? 'Adding…' : 'Add to Page'}
              </button>
            </div>
          </div>
        ) : null}

        {/* Placed notices */}
        {data.notices.length > 0 ? (
          <div className="space-y-3">
            {data.notices.map((n, i) => (
              <div key={n.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Notice {i + 1} — {(n.header?.trim() || DEFAULT_LEGAL_HEADER).toUpperCase()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => move(n.id, -1)} disabled={i === 0} className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => move(n.id, 1)} disabled={i === data.notices.length - 1} className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => remove(n.id)} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                  </div>
                </div>
                <input
                  type="text"
                  value={n.header ?? DEFAULT_LEGAL_HEADER}
                  onChange={(e) => patchHeader(n.id, e.target.value)}
                  placeholder={DEFAULT_LEGAL_HEADER}
                  className="mb-2 block w-full rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold focus:border-brand-red focus:outline-none"
                />
                <textarea
                  rows={5}
                  value={n.body}
                  onChange={(e) => patchBody(n.id, e.target.value)}
                  className="block w-full rounded border border-zinc-300 px-3 py-2 text-xs leading-relaxed focus:border-brand-red focus:outline-none"
                />
                <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={n.cancelled === true}
                    onChange={(e) => patchCancelled(n.id, e.target.checked)}
                    className="h-4 w-4 accent-red-600 cursor-pointer"
                  />
                  Cancelled
                  <span className="font-normal text-zinc-400">
                    — still runs, but prints with a diagonal CANCELLED stamp
                  </span>
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No notices on this page yet.</p>
        )}

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

      {/* ── Live preview ───────────────────────────────────── */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Preview</div>
        <div
          className="border border-zinc-300 shadow-sm overflow-hidden bg-white"
          style={{ width: CONTENT_W_PX * PREVIEW_SCALE, height: CONTENT_H_PX * PREVIEW_SCALE }}
        >
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
            <div ref={previewRef}>
              <LegalPage data={data} pageNumber={pageNumber} dateLabel={dateLabel} editing />
            </div>
          </div>
        </div>
        {overflowing ? (
          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            ⚠ Too much copy for this page — the overflow is clipped on print. Move the last
            notice(s) to the second Legal Notices page.
          </div>
        ) : null}
      </div>
    </div>
  );
}
