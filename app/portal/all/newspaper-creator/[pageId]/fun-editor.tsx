'use client';

/**
 * FunEditor — editor for a "Fun Stuff" page (Box Office / Puzzles / Funny Pages /
 * History). The "Pull from <app>" button loads the standalone app off-screen with
 * `?ssp_embed=1`; the app runs its normal generation and postMessages its finished
 * page (HTML + CSS) back. We snapshot that into template_data and preview it at
 * 11×15 via <FunPage>. Save persists + locks the page.
 *
 * Nothing here changes the standalone app: the `?ssp_embed=1` flag is the only
 * thing that activates the app's (additive, gated) export hook.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { createClient } from '@/lib/supabase/client';
import { FunPage } from '@/components/newspaper/fun-page';
import { isFunPullMessage, type FunPageData, type FunSource } from '@/lib/newspaper/fun-page';
import { saveFunPage, requestAdUploadUrl } from '../actions';

const PREVIEW_SCALE = 0.4;
const NEWSPAPER_ADS_BUCKET = 'newspaper-ads';
// Funny Pages can take several minutes (per-panel image generation); be generous.
const PULL_TIMEOUT_MS = 12 * 60 * 1000;

type AdLite = {
  id: string;
  business_name: string;
  copy_file_name: string | null;
  copy_storage_path: string | null;
};

export function FunEditor({
  pageId,
  source,
  initialData,
  ads,
}: {
  pageId: string;
  source: FunSource;
  initialData: FunPageData;
  /** Ad Database entries (for the bottom-third ad picker). */
  ads: AdLite[];
}) {
  const router = useRouter();
  const [data, setData] = useState<FunPageData>(initialData);
  const [pulling, setPulling] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAd, setUploadingAd] = useState(false);
  const adFileRef = useRef<HTMLInputElement | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appOrigin = (() => {
    try {
      return new URL(source.appUrl).origin;
    } catch {
      return source.appUrl;
    }
  })();

  const stopPull = useCallback(() => {
    setPulling(false);
    setEmbedSrc(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    timeoutRef.current = null;
    tickRef.current = null;
  }, []);

  useEffect(() => {
    if (!pulling) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== appOrigin) return;
      if (!isFunPullMessage(e.data)) return;
      // Merge so a re-pull keeps the placed bottom-third ad.
      setData((d) => ({
        ...d,
        v: 1,
        html: e.data.html,
        css: e.data.css,
        pulled_at: new Date().toISOString(),
        source_label: source.label,
      }));
      setSaved(false);
      setError(null);
      stopPull();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pulling, appOrigin, source.label, stopPull]);

  // Clean up timers if the component unmounts mid-pull.
  useEffect(() => () => stopPull(), [stopPull]);

  function startPull() {
    setError(null);
    setSaved(false);
    setElapsed(0);
    setPulling(true);
    // Cache-bust so each pull forces a fresh generation in the app.
    const nonce = `${Date.now()}`;
    setEmbedSrc(`${source.appUrl}/?ssp_embed=1&_pull=${nonce}`);
    tickRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    timeoutRef.current = setTimeout(() => {
      setError(
        `Timed out waiting for ${source.label}. Check the app URL and that it has the embed hook, then try again.`
      );
      stopPull();
    }, PULL_TIMEOUT_MS);
  }

  function pickAd(adId: string) {
    const ad = ads.find((a) => a.id === adId);
    if (!ad || !ad.copy_storage_path) {
      setError('That ad has no uploaded copy yet.');
      return;
    }
    setData((d) => ({
      ...d,
      ad_storage_path: ad.copy_storage_path ?? undefined,
      ad_file_name: ad.copy_file_name ?? ad.business_name,
    }));
    setSaved(false);
  }

  async function uploadAd(file: File | null) {
    if (!file) return;
    setError(null);
    setUploadingAd(true);
    try {
      const signed = await requestAdUploadUrl(file.name);
      if (!signed.ok || !signed.path || !signed.token) {
        setError(signed.error ?? 'Ad upload failed.');
        return;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(NEWSPAPER_ADS_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (upErr) {
        setError(`Ad upload failed: ${upErr.message}`);
        return;
      }
      setData((d) => ({ ...d, ad_storage_path: signed.path, ad_file_name: file.name }));
      setSaved(false);
    } catch {
      setError('Something went wrong uploading the ad.');
    } finally {
      setUploadingAd(false);
    }
  }

  function removeAd() {
    setData((d) => ({ ...d, ad_storage_path: undefined, ad_file_name: undefined }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await saveFunPage(pageId, data as unknown as Record<string, unknown>);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
      {/* ── Controls ───────────────────────────────────────── */}
      <div className="max-w-xl space-y-5">
        <p className="text-sm text-zinc-600">
          This page is generated by the <span className="font-medium">{source.label}</span> app.
          Click <strong>Pull from {source.label}</strong> to generate a fresh page and bring it in —
          it renders at 11×15 with the section header. Then <strong>Save Page</strong>.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startPull}
            disabled={pulling}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            {pulling ? 'Pulling…' : `Pull from ${source.label}`}
          </button>
          {pulling ? (
            <button
              type="button"
              onClick={() => {
                stopPull();
                setError(null);
              }}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-zinc-600 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
            >
              Cancel
            </button>
          ) : null}
          <a
            href={source.appUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-brand-red hover:underline"
          >
            Open {source.label} app ↗
          </a>
        </div>

        {pulling ? (
          <div className="text-sm text-zinc-600 bg-zinc-50 border border-zinc-200 rounded px-3 py-2">
            Generating in {source.label}… {mins}:{String(secs).padStart(2, '0')} elapsed. This can take
            several minutes (especially Funny Pages). Keep this tab open.
          </div>
        ) : null}

        {data.pulled_at ? (
          <p className="text-xs text-zinc-500">
            Last pulled {new Date(data.pulled_at).toLocaleString()}
            {data.source_label ? ` from ${data.source_label}` : ''}.
          </p>
        ) : null}

        {/* ── Bottom-third ad ────────────────────────────────── */}
        <div className="pt-3 border-t border-zinc-200">
          <div className="text-sm font-medium text-zinc-700">Ad — bottom third</div>
          {data.ad_file_name ? (
            <p className="mt-1 text-sm text-zinc-700">
              <span className="font-medium">{data.ad_file_name}</span>{' '}
              <button type="button" onClick={removeAd} className="ml-1 text-red-600 hover:underline">
                remove
              </button>
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              The pulled page fills the top two-thirds; place an ad in the bottom third.
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) pickAd(e.target.value);
                e.target.value = '';
              }}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none"
            >
              <option value="">Choose from Ad Database…</option>
              {ads
                .filter((a) => a.copy_storage_path)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.business_name}
                    {a.copy_file_name ? ` — ${a.copy_file_name}` : ''}
                  </option>
                ))}
            </select>
            <span className="text-xs text-zinc-400">or</span>
            <input
              ref={adFileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => uploadAd(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => adFileRef.current?.click()}
              disabled={uploadingAd}
              className="inline-flex items-center px-3 py-1.5 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 text-sm font-medium text-zinc-700 rounded transition-colors"
            >
              {uploadingAd ? 'Uploading…' : '+ Upload Ad'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !data.html}
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
            <FunPage data={data} editing />
          </div>
        </div>
      </div>

      {/* Off-screen embed that runs the source app's generation during a pull. */}
      {embedSrc ? (
        <iframe
          title={`${source.label} generator`}
          src={embedSrc}
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: 'fixed',
            left: -99999,
            top: 0,
            width: 820,
            height: 1240,
            border: 0,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
}
