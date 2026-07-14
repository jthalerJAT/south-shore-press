'use client';

/**
 * ClassifiedPage — renders a `classifieds` template page.
 *
 * COMPOSED model (matches p22 of the printed 2026-07-15 issue): running
 * PageHeader, navy "THE CLASSIFIEDS" banner, two columns of stacked classified
 * ads — each column top/bottom-JUSTIFIED (first ad flush to the top, last ad
 * flush to the bottom, spacing between distributed automatically) — a navy
 * house rail on the right ("LIST YOUR CLASSIFIED AD IN THE SOUTH SHORE PRESS /
 * CONTACT US"), and the navy footer bar with the ads phone + email.
 *
 * AUTO-FIT: when a column's ads stack taller than the page area, every ad in
 * that column is scaled down proportionally (aspect preserved, centered) until
 * the stack fits with even gaps — nothing is ever clipped on print.
 *
 * LEGACY model: one uploaded whole-page file (no running head), kept so
 * previously built pages render unchanged.
 *
 * Shared by the editor preview, per-page proof, View File, and the press
 * route — so screen == print.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { PageHeader } from './page-header';
import { Seagull } from './seagull';
import { classifiedFileUrl, type ClassifiedPageData, type ClassifiedAd } from '@/lib/newspaper/classified';

const NAVY = '#1e3a8a';
const CONDENSED_FONT = "var(--font-news-condensed), 'Arial Narrow', sans-serif";
/** Right house-rail width (printed p22 proportion: ~178/1100 of the sheet). */
const RAIL_W = 155;
const COL_GAP = 14;
const FOOTER_H = 46;

function isPdf(data: ClassifiedPageData): boolean {
  const name = (data.file_name ?? data.storage_path ?? '').toLowerCase();
  return name.endsWith('.pdf');
}

/** Minimum breathing room kept between ads when a column has to shrink. */
const MIN_AD_GAP = 8;

/** One ad column: stacked creatives, top & bottom justified. With a single ad
 *  it sits at the top; with several, the gaps distribute evenly. When the
 *  stack's natural height exceeds the column, every ad shrinks by the same
 *  factor (aspect preserved, centered) so the whole stack always fits. */
function AdColumn({ ads }: { ads: ClassifiedAd[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  // Natural height/width ratio per creative, keyed by storage path (stable).
  const ratios = useRef<Map<string, number>>(new Map());
  const [loadedCount, setLoadedCount] = useState(0);

  function recordRatio(path: string, img: HTMLImageElement | null) {
    if (!img) return;
    const record = () => {
      if (img.naturalWidth > 0 && !ratios.current.has(path)) {
        ratios.current.set(path, img.naturalHeight / img.naturalWidth);
        setLoadedCount((n) => n + 1);
      }
    };
    if (img.complete) record();
    else img.onload = record;
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || ads.length === 0) {
      setScale(1);
      return;
    }
    const known = ads.filter((a) => ratios.current.has(a.storage_path));
    if (known.length < ads.length) return; // wait until every creative measured
    const colW = el.clientWidth;
    const colH = el.clientHeight;
    if (colW <= 0 || colH <= 0) return;
    const naturalSum = ads.reduce(
      (sum, a) => sum + colW * (ratios.current.get(a.storage_path) ?? 0),
      0
    );
    const avail = colH - MIN_AD_GAP * Math.max(0, ads.length - 1);
    setScale(naturalSum > avail ? Math.max(0.2, avail / naturalSum) : 1);
  }, [ads, loadedCount]);

  return (
    <div
      ref={ref}
      data-classified-column
      data-fit-scale={scale.toFixed(3)}
      style={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: ads.length > 1 ? 'space-between' : 'flex-start',
        overflow: 'hidden',
      }}
    >
      {ads.map((ad) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={ad.id}
          ref={(img) => recordRatio(ad.storage_path, img)}
          src={classifiedFileUrl(ad.storage_path)}
          alt={ad.file_name ?? 'Classified ad'}
          style={{ width: `${scale * 100}%`, height: 'auto', display: 'block' }}
        />
      ))}
    </div>
  );
}

/** The navy house rail on the right of the printed classifieds page. */
function HouseRail() {
  const word: React.CSSProperties = {
    fontFamily: CONDENSED_FONT,
    fontWeight: 700,
    fontSize: 26,
    lineHeight: 1.25,
    letterSpacing: '0.04em',
    textAlign: 'center',
  };
  return (
    <div
      style={{
        width: RAIL_W,
        flexShrink: 0,
        height: '100%',
        background: NAVY,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '36px 10px 24px',
      }}
    >
      <Seagull width={44} color="#fff" />
      <div style={word}>
        LIST
        <br />
        YOUR
        <br />
        CLASSIFIED
        <br />
        AD IN
      </div>
      <div style={word}>
        THE
        <br />
        SOUTH
        <br />
        SHORE
        <br />
        PRESS
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...word, fontSize: 18 }}>CONTACT US</div>
        <div
          style={{
            fontFamily: 'var(--font-crimson), Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 17,
            marginTop: 4,
          }}
        >
          631-878-0888
        </div>
        <div
          style={{
            fontFamily: 'var(--font-crimson), Georgia, serif',
            fontStyle: 'italic',
            fontSize: 11.5,
            marginTop: 2,
          }}
        >
          ads@southshorepress.com
        </div>
      </div>
    </div>
  );
}

export function ClassifiedPage({
  data,
  pageNumber,
  dateLabel,
  editing = false,
}: {
  data: ClassifiedPageData;
  pageNumber?: number;
  dateLabel?: string;
  /** When true (editor/proof preview) show a placeholder if no content. */
  editing?: boolean;
}) {
  const ads = data.ads ?? [];
  const composed = ads.length > 0;
  const legacySrc = data.storage_path ? classifiedFileUrl(data.storage_path) : null;

  // ── LEGACY: one whole-page file, no running head ──────────────
  if (!composed && legacySrc) {
    return (
      <div
        style={{
          width: CONTENT_W_PX,
          height: CONTENT_H_PX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        {isPdf(data) ? (
          <iframe
            src={`${legacySrc}#toolbar=0&navpanes=0&view=FitH`}
            title={data.file_name ?? 'Classified'}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={legacySrc}
            alt={data.file_name ?? 'Classifieds'}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        )}
      </div>
    );
  }

  // ── COMPOSED: the printed classifieds layout ──────────────────
  const col1 = ads.filter((a) => a.column === 1);
  const col2 = ads.filter((a) => a.column === 2);

  return (
    <div
      className="flex flex-col"
      style={{ width: CONTENT_W_PX, height: CONTENT_H_PX, background: '#fff', color: '#111' }}
    >
      <PageHeader pageNumber={pageNumber ?? 22} dateLabel={dateLabel} />

      {/* ── THE CLASSIFIEDS banner ─────────────────────────── */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          background: NAVY,
          color: '#fff',
          height: 38,
          fontFamily: CONDENSED_FONT,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: '0.1em',
        }}
      >
        THE CLASSIFIEDS
      </div>

      {/* ── Ad columns + house rail ────────────────────────── */}
      <div
        className="flex-1"
        style={{ minHeight: 0, display: 'flex', gap: COL_GAP, padding: '10px 0' }}
      >
        {composed ? (
          <>
            <AdColumn ads={col1} />
            <AdColumn ads={col2} />
          </>
        ) : editing ? (
          <div
            className="border-2 border-dashed border-zinc-300 text-zinc-400 text-sm flex items-center justify-center text-center px-8"
            style={{ flex: 1, height: '100%' }}
          >
            No classifieds placed — drop the ad PDFs advertisers send onto “+ Add Classified”.
            <br />
            Each ad is cropped out of its PDF automatically and stacked here.
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <HouseRail />
      </div>

      {/* ── Footer bar ─────────────────────────────────────── */}
      <div className="shrink-0" style={{ display: 'flex', gap: COL_GAP, height: FOOTER_H }}>
        <div
          style={{
            flex: 1,
            background: NAVY,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: CONDENSED_FONT,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: '0.06em',
          }}
        >
          LIST YOUR CLASSIFIED AD IN THE SOUTH SHORE PRESS
        </div>
        <div
          style={{
            width: RAIL_W,
            flexShrink: 0,
            background: NAVY,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1.1,
          }}
        >
          <div style={{ fontFamily: CONDENSED_FONT, fontWeight: 700, fontSize: 19 }}>631-878-0888</div>
          <div style={{ fontFamily: 'var(--font-crimson), Georgia, serif', fontStyle: 'italic', fontSize: 10.5 }}>
            ads@southshorepress.com
          </div>
        </div>
      </div>
    </div>
  );
}
