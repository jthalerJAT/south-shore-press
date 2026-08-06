'use client';

/**
 * FunEditor — editor for a "Fun Stuff" page (Box Office / Puzzles / Funny Pages /
 * History).
 *  - "Pull from <app>" loads the standalone app off-screen with `?ssp_embed=1`,
 *    the app runs its normal generation and postMessages its finished page back;
 *    we snapshot it into template_data and preview it at 11×15 via <FunPage>.
 *  - "Add Article" / "Add Advertisement" add blocks to the bottom band. Ads pick
 *    a size (1/4 or 1/3 page) + location (bottom-left/right; 1/3 spans the full
 *    width); articles are typed or filled from a website story.
 * Nothing here changes the standalone apps — the `?ssp_embed=1` flag is the only
 * thing that activates their (additive, gated) export hook.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { createClient } from '@/lib/supabase/client';
import { FunPage } from '@/components/newspaper/fun-page';
import { StoryFillPicker } from '@/components/portal/story-fill-picker';
import {
  isFunPullMessage,
  type FunPageData,
  type FunBlock,
  type FunSource,
} from '@/lib/newspaper/fun-page';
import { NEWSPAPER_IMAGES_BUCKET } from '@/lib/newspaper-images';
import type { Ad } from '@/lib/queries/ads';
import { AdCopyPicker } from '../ad-copy-picker';
import { saveFunPage, requestAdUploadUrl, requestImageUploadUrl, fetchStoryDetail } from '../actions';

const PREVIEW_SCALE = 0.4;
const NEWSPAPER_ADS_BUCKET = 'newspaper-ads';
// Generous: Chrome throttles timers in hidden/background tabs, which can
// stretch a ~9-minute Funny Pages generation well past 20 minutes.
const PULL_TIMEOUT_MS = 25 * 60 * 1000;

type StoryLite = { id: string; headline: string; categories?: string[] | null };

let blockCounter = 0;
function newBlockId() {
  blockCounter += 1;
  return `b-${blockCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function FunEditor({
  pageId,
  source,
  pageNumber,
  dateLabel,
  initialData,
  ads,
  stories,
}: {
  pageId: string;
  source: FunSource;
  pageNumber?: number;
  dateLabel?: string;
  initialData: FunPageData;
  ads: Ad[];
  stories: StoryLite[];
}) {
  const router = useRouter();
  const [data, setData] = useState<FunPageData>(initialData);
  const [pulling, setPulling] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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
      // Merge so a re-pull keeps the placed bottom-band blocks.
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

  useEffect(() => () => stopPull(), [stopPull]);

  function startPull() {
    setError(null);
    setSaved(false);
    setElapsed(0);
    setPulling(true);
    const nonce = `${Date.now()}`;
    setEmbedSrc(`${source.appUrl}/?ssp_embed=1&_pull=${nonce}`);
    tickRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    timeoutRef.current = setTimeout(() => {
      setError(`Timed out waiting for ${source.label}. Check the app URL and that it has the embed hook, then try again.`);
      stopPull();
    }, PULL_TIMEOUT_MS);
  }

  // ── Block helpers ──────────────────────────────────────────────
  function patchBlock(id: string, patch: Partial<FunBlock>) {
    setData((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
    setSaved(false);
  }
  function removeBlock(id: string) {
    setData((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
    setSaved(false);
  }
  function addArticle() {
    setData((d) => ({ ...d, blocks: [...d.blocks, { id: newBlockId(), kind: 'article', slot: 'full' }] }));
    setSaved(false);
  }
  function addAd() {
    setData((d) => ({ ...d, blocks: [...d.blocks, { id: newBlockId(), kind: 'ad', slot: 'full', ad_size: 'third' }] }));
    setSaved(false);
  }
  function setAdSize(id: string, size: 'quarter' | 'third') {
    // A third-page ad always spans the full width; a quarter defaults to the left.
    patchBlock(id, { ad_size: size, slot: size === 'third' ? 'full' : 'left' });
  }
  function pickAdCopy(id: string, adId: string) {
    const ad = ads.find((a) => a.id === adId);
    if (!ad || !ad.copy_storage_path) {
      setError('That ad has no uploaded copy yet.');
      return;
    }
    patchBlock(id, { ad_storage_path: ad.copy_storage_path ?? undefined, ad_file_name: ad.copy_file_name ?? ad.business_name });
  }
  async function uploadAdCopy(id: string, file: File | null) {
    if (!file) return;
    setError(null);
    setUploadingId(id);
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
      patchBlock(id, { ad_storage_path: signed.path, ad_file_name: file.name });
    } catch {
      setError('Something went wrong uploading the ad.');
    } finally {
      setUploadingId(null);
    }
  }
  async function fillArticleFromStory(id: string, storyId: string) {
    const d = await fetchStoryDetail(storyId);
    if (!d) return;
    patchBlock(id, {
      source_story_id: storyId,
      headline: d.headline,
      byline: d.byline,
      body: d.body,
      photo_url: d.hero_photo_url ?? undefined,
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let payload: FunPageData = data;
      // A freshly pulled snapshot carries every panel image inline — far too
      // large for a server-action body (1MB cap) or a np_pages row. Upload it
      // to Storage and save only the reference.
      if (data.html) {
        const signed = await requestImageUploadUrl(`fun-snapshot-${source.key}.json`);
        if (!signed.ok || !signed.path || !signed.token) {
          throw new Error(signed.error ?? 'Could not start the snapshot upload.');
        }
        const supabase = createClient();
        const blob = new Blob([JSON.stringify({ html: data.html, css: data.css ?? '' })], {
          type: 'application/json',
        });
        const { error: upErr } = await supabase.storage
          .from(NEWSPAPER_IMAGES_BUCKET)
          .uploadToSignedUrl(signed.path, signed.token, blob, { contentType: 'application/json' });
        if (upErr) throw new Error(`Snapshot upload failed: ${upErr.message}`);
        payload = { ...data, snapshot_path: signed.path, html: undefined, css: undefined };
      }
      const res = await saveFunPage(pageId, payload as unknown as Record<string, unknown>);
      if (!res.ok) throw new Error(res.error ?? 'Could not save.');
      // Keep the inline html for the live preview, but remember the stored path.
      if (payload.snapshot_path) {
        setData((d) => ({ ...d, snapshot_path: payload.snapshot_path }));
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving the page.');
    } finally {
      setSaving(false);
    }
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
      {/* ── Controls ───────────────────────────────────────── */}
      <div className="max-w-xl space-y-5">
        <p className="text-sm text-zinc-600">
          This page is generated by the <span className="font-medium">{source.label}</span> app.
          Click <strong>Pull from {source.label}</strong> for a fresh page, then add articles/ads to
          the bottom band and <strong>Save Page</strong>.
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
          <a href={source.appUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-red hover:underline">
            Open {source.label} app ↗
          </a>
        </div>

        {pulling ? (
          <div className="text-sm text-zinc-600 bg-zinc-50 border border-zinc-200 rounded px-3 py-2">
            Generating in {source.label}… {mins}:{String(secs).padStart(2, '0')} elapsed. This can take
            several minutes (especially Funny Pages).{' '}
            <strong>Keep this tab open and in front</strong> — Chrome slows hidden tabs, which can
            more than double the wait.
          </div>
        ) : null}

        {data.pulled_at ? (
          <p className="text-xs text-zinc-500">
            Last pulled {new Date(data.pulled_at).toLocaleString()}
            {data.source_label ? ` from ${data.source_label}` : ''}.
          </p>
        ) : null}

        {/* ── Bottom-band blocks ─────────────────────────────── */}
        <div className="pt-3 border-t border-zinc-200">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-700">Bottom band — articles &amp; ads</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addArticle}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-brand-red border border-brand-red/40 hover:bg-red-50 rounded transition-colors"
              >
                + Add Article
              </button>
              <button
                type="button"
                onClick={addAd}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-brand-red border border-brand-red/40 hover:bg-red-50 rounded transition-colors"
              >
                + Add Advertisement
              </button>
            </div>
          </div>

          {data.blocks.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              The pulled page fills the top of the page. Add an article or ad to place it in the bottom band.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {data.blocks.map((b) => (
                <BlockCard
                  key={b.id}
                  block={b}
                  ads={ads}
                  stories={stories}
                  uploading={uploadingId === b.id}
                  onPatch={(patch) => patchBlock(b.id, patch)}
                  onAdSize={(size) => setAdSize(b.id, size)}
                  onPickAd={(adId) => pickAdCopy(b.id, adId)}
                  onUploadAd={(file) => uploadAdCopy(b.id, file)}
                  onFillStory={(storyId) => fillArticleFromStory(b.id, storyId)}
                  onRemove={() => removeBlock(b.id)}
                />
              ))}
            </div>
          )}
        </div>

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
            <FunPage data={data} pageNumber={pageNumber} dateLabel={dateLabel} editing />
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
          style={{ position: 'fixed', left: -99999, top: 0, width: 820, height: 1240, border: 0, opacity: 0, pointerEvents: 'none' }}
        />
      ) : null}
    </div>
  );
}

function BlockCard({
  block,
  ads,
  stories,
  uploading,
  onPatch,
  onAdSize,
  onPickAd,
  onUploadAd,
  onFillStory,
  onRemove,
}: {
  block: FunBlock;
  ads: Ad[];
  stories: StoryLite[];
  uploading: boolean;
  onPatch: (patch: Partial<FunBlock>) => void;
  onAdSize: (size: 'quarter' | 'third') => void;
  onPickAd: (adId: string) => void;
  onUploadAd: (file: File | null) => void;
  onFillStory: (storyId: string) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const isQuarter = block.kind === 'ad' && block.ad_size === 'quarter';

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-800">
            {block.kind === 'ad' ? 'Advertisement' : 'Article'}
          </span>
          {block.kind === 'ad' ? (
            <>
              <select
                value={block.ad_size ?? 'third'}
                onChange={(e) => onAdSize(e.target.value as 'quarter' | 'third')}
                className="rounded border border-zinc-300 px-2 py-1 text-xs focus:border-brand-red focus:outline-none"
              >
                <option value="quarter">1/4 page</option>
                <option value="third">1/3 page (full bottom)</option>
              </select>
              {isQuarter ? (
                <select
                  value={block.slot === 'right' ? 'right' : 'left'}
                  onChange={(e) => onPatch({ slot: e.target.value as 'left' | 'right' })}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs focus:border-brand-red focus:outline-none"
                >
                  <option value="left">Bottom-left</option>
                  <option value="right">Bottom-right</option>
                </select>
              ) : null}
            </>
          ) : (
            <select
              value={block.slot}
              onChange={(e) => onPatch({ slot: e.target.value as 'left' | 'right' | 'full' })}
              className="rounded border border-zinc-300 px-2 py-1 text-xs focus:border-brand-red focus:outline-none"
            >
              <option value="full">Full width</option>
              <option value="left">Bottom-left</option>
              <option value="right">Bottom-right</option>
            </select>
          )}
        </div>
        <button type="button" onClick={onRemove} className="text-xs font-medium text-red-600 hover:underline">
          Remove
        </button>
      </div>

      {block.kind === 'ad' ? (
        <div className="flex flex-col gap-2">
          {block.ad_file_name ? (
            <span className="text-sm text-zinc-700">
              {block.ad_file_name}{' '}
              <button
                type="button"
                onClick={() => onPatch({ ad_storage_path: undefined, ad_file_name: undefined })}
                className="ml-1 text-red-600 hover:underline"
              >
                remove
              </button>
            </span>
          ) : (
            <>
              <div className="max-w-sm">
                <AdCopyPicker ads={ads} onPick={(a) => onPickAd(a.id)} label="Choose from Ad Database" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">or</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => onUploadAd(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center px-3 py-1.5 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 text-sm font-medium text-zinc-700 rounded transition-colors"
                >
                  {uploading ? 'Uploading…' : '+ Upload Ad'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="max-w-md">
            <StoryFillPicker stories={stories} onPick={onFillStory} />
          </div>
          <input
            value={block.headline ?? ''}
            onChange={(e) => onPatch({ headline: e.target.value })}
            placeholder="Headline"
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
          />
          <input
            value={block.byline ?? ''}
            onChange={(e) => onPatch({ byline: e.target.value })}
            placeholder="Byline (optional)"
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
          />
          <textarea
            rows={4}
            value={block.body ?? ''}
            onChange={(e) => onPatch({ body: e.target.value })}
            placeholder="Body"
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
          />
          <input
            value={block.photo_url ?? ''}
            onChange={(e) => onPatch({ photo_url: e.target.value })}
            placeholder="Photo URL (optional)"
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
