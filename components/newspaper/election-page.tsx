'use client';

/**
 * ElectionPage — one printed page of the Election Issue voter-guide section
 * (publisher direction 2026-10-07; template approved from the 10-05 mock).
 *
 * The SECTION is a single list of race tiles spanning several consecutive
 * election pages. Every page instance measures the intro + every tile at full
 * content width in a hidden pass, then packs WHOLE tiles onto pages in order:
 * a tile that doesn't fit in the space left on a page starts the next page as
 * its first tile — tiles never split across a page break. The packing is
 * deterministic (same data, same width, same fonts), so each page instance
 * independently computes the same assignment and renders only its own slice
 * (`sectionIndex` = this page's 0-based position among the election pages).
 *
 * Tile anatomy (top to bottom): navy race band → red "SOUTH SHORE PRESS
 * VERDICT" band (the larger of the two) → rationale (min two lines, grows
 * with the text) → two candidate halves: red party band left / blue right,
 * each with a fixed 72×90 headshot beside a bio that defaults to six lines
 * and grows. Colors are solid print-safe fills (no transparency) for the
 * PDF/X-1a newsprint pipeline.
 *
 * The root carries data-election-pages-needed so the editor can warn when the
 * tiles need more pages than the issue has.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { PageHeader } from './page-header';
import { SectionFlag } from './section-flag';
import type { ElectionSectionData, ElectionTile, ElectionCandidate } from '@/lib/newspaper/election-page';

const NAVY = '#1e3a8a';
const GOP_RED = '#c8102e';
const DEM_BLUE = '#1559b0';

const HEADLINE_FONT = "var(--font-news-headline), 'Helvetica Neue', Arial, sans-serif";
const CONDENSED_FONT = "var(--font-news-condensed), 'Arial Narrow', sans-serif";
const BODY_FONT = "var(--font-crimson), Georgia, 'Times New Roman', serif";

/** Vertical gap between stacked tiles (matches the engine's column gap). */
const TILE_GAP = 14;

function PhotoBox({ url, editing }: { url: string; editing?: boolean }) {
  const style: React.CSSProperties = {
    width: 72,
    height: 90,
    flex: 'none',
    background: '#e4e4e7',
    border: '1px solid #a1a1aa',
    overflow: 'hidden',
  };
  if (url.trim()) {
    return (
      <div style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        color: '#52525b',
      }}
    >
      {editing ? (
        <>
          <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 600 }}>+</span>
          <span style={{ fontSize: 9, fontWeight: 600 }}>Add Photo</span>
        </>
      ) : null}
    </div>
  );
}

function CandidateHalf({
  cand,
  color,
  editing,
}: {
  cand: ElectionCandidate;
  color: string;
  editing?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          background: color,
          color: '#fff',
          fontFamily: CONDENSED_FONT,
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '3px 6px',
        }}
      >
        {cand.party.trim() || ' '}
      </div>
      <div
        style={{
          fontFamily: HEADLINE_FONT,
          fontWeight: 800,
          fontSize: 13.5,
          textAlign: 'center',
          padding: '4px 6px 2px',
          color: NAVY,
        }}
      >
        {cand.name.trim() || (editing ? 'Candidate Name' : ' ')}
      </div>
      <div style={{ display: 'flex', gap: 7, padding: '6px 8px 8px', alignItems: 'flex-start' }}>
        <PhotoBox url={cand.photo_url} editing={editing} />
        <div
          style={{
            fontFamily: BODY_FONT,
            fontSize: 11,
            lineHeight: 1.3,
            minHeight: 'calc(6 * 1.3em)',
            flex: 1,
            minWidth: 0,
            whiteSpace: 'pre-wrap',
          }}
        >
          {cand.bio}
        </div>
      </div>
    </div>
  );
}

function TileView({ tile, editing }: { tile: ElectionTile; editing?: boolean }) {
  return (
    <div style={{ border: '1.5px solid #000', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div
        style={{
          background: NAVY,
          color: '#fff',
          fontFamily: CONDENSED_FONT,
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '4px 8px',
        }}
      >
        {tile.race.trim() || (editing ? 'Race Name' : ' ')}
      </div>
      <div
        style={{
          background: GOP_RED,
          color: '#fff',
          fontFamily: CONDENSED_FONT,
          fontWeight: 700,
          fontSize: 19,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '6px 8px',
        }}
      >
        South Shore Press Verdict:{' '}
        <span style={{ borderBottom: '2px solid #fff', paddingBottom: 1 }}>
          {tile.verdict.trim() || (editing ? 'Our Pick' : ' ')}
        </span>
      </div>
      <div
        style={{
          fontFamily: BODY_FONT,
          fontSize: 12.5,
          lineHeight: 1.32,
          padding: '7px 10px',
          minHeight: '2.64em',
          borderBottom: '1.5px solid #000',
          whiteSpace: 'pre-wrap',
        }}
      >
        {tile.rationale}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <CandidateHalf cand={tile.left} color={GOP_RED} editing={editing} />
        <div style={{ borderLeft: '1.5px solid #000', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <CandidateHalf cand={tile.right} color={DEM_BLUE} editing={editing} />
        </div>
      </div>
    </div>
  );
}

function IntroBox({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        border: '1.5px solid #000',
        padding: '10px 14px',
        fontFamily: BODY_FONT,
        fontSize: 14.5,
        lineHeight: 1.35,
        whiteSpace: 'pre-wrap',
      }}
    >
      <span
        style={{
          fontFamily: HEADLINE_FONT,
          fontWeight: 800,
          color: NAVY,
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'block',
          marginBottom: 3,
        }}
      >
        {title}
      </span>
      {text}
    </div>
  );
}

function FooterBar({ label }: { label: string }) {
  return (
    <div style={{ flex: 'none', marginTop: 12 }}>
      <div
        style={{
          background: NAVY,
          color: '#fff',
          fontFamily: CONDENSED_FONT,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '7px 8px',
          borderTop: '3px solid #000',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function ElectionPage({
  data,
  sectionIndex,
  pageNumber,
  dateLabel,
  editing,
}: {
  data: ElectionSectionData;
  /** This page's 0-based position among the issue's election pages. */
  sectionIndex: number;
  pageNumber: number;
  dateLabel?: string;
  editing?: boolean;
}) {
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [perPage, setPerPage] = useState<number[] | null>(null);

  // Hidden measuring pass → deterministic whole-tile packing. Re-runs on data
  // changes and again once fonts are ready (metrics shift when Oswald /
  // Montserrat / Crimson swap in).
  useLayoutEffect(() => {
    let cancelled = false;

    function compute() {
      const root = measureRef.current;
      if (!root || cancelled) return;
      const chrome = root.querySelector<HTMLElement>('[data-m="chrome"]');
      const intro = root.querySelector<HTMLElement>('[data-m="intro"]');
      const tileEls = Array.from(root.querySelectorAll<HTMLElement>('[data-m="tile"]'));
      // Small slack so rounding and sub-pixel metrics can't nudge a tile past
      // the footer on press output.
      const SLACK = 4;
      const chromeH = chrome?.offsetHeight ?? 110;
      const introH = intro ? intro.offsetHeight + TILE_GAP : 0;
      const firstCap = CONTENT_H_PX - chromeH - introH - SLACK;
      const restCap = CONTENT_H_PX - chromeH - SLACK;

      const pages: number[] = [];
      let used = 0;
      let count = 0;
      let cap = firstCap;
      for (const el of tileEls) {
        const h = el.offsetHeight;
        const need = count === 0 ? h : h + TILE_GAP;
        if (count > 0 && used + need > cap) {
          pages.push(count);
          count = 0;
          used = 0;
          cap = restCap;
        }
        used += count === 0 ? h : h + TILE_GAP;
        count += 1;
      }
      if (count > 0) pages.push(count);
      if (pages.length === 0) pages.push(0);
      setPerPage(pages);
    }

    compute();
    // Recompute once web fonts land (no-op if already active).
    if (typeof document !== 'undefined' && 'fonts' in document) {
      (document as Document & { fonts: FontFaceSet }).fonts.ready.then(() => {
        if (!cancelled) compute();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [data]);

  const assigned = perPage ?? [];
  const start = assigned.slice(0, sectionIndex).reduce((a, b) => a + b, 0);
  const count = assigned[sectionIndex] ?? 0;
  const tiles = perPage ? data.tiles.slice(start, start + count) : [];
  const pagesNeeded = perPage ? Math.max(assigned.length, 1) : 1;

  return (
    <div
      data-election-page
      data-election-pages-needed={pagesNeeded}
      style={{
        width: CONTENT_W_PX,
        height: CONTENT_H_PX,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        color: '#111',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />
      <SectionFlag label={data.section_label} />

      {sectionIndex === 0 && data.intro !== null ? (
        <div style={{ marginBottom: TILE_GAP }}>
          <IntroBox title={data.intro_title} text={data.intro} />
        </div>
      ) : null}

      <div
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: TILE_GAP,
          overflow: 'hidden',
        }}
      >
        {tiles.map((t) => (
          <TileView key={t.id} tile={t} editing={editing} />
        ))}
        {editing && perPage && tiles.length === 0 ? (
          <p style={{ fontFamily: BODY_FONT, fontSize: 13, color: '#a1a1aa', fontStyle: 'italic' }}>
            No races reach this page yet.
          </p>
        ) : null}
      </div>

      <FooterBar label={data.footer_label} />

      {/* ── Hidden measuring pass: chrome + intro + every tile at full width ── */}
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: -99999,
          top: 0,
          width: CONTENT_W_PX,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* overflow:hidden forms a BFC so the children's margins (PageHeader's
            mb-3, SectionFlag's mb-4, the footer's marginTop) count toward the
            measured height instead of collapsing out of it. */}
        <div data-m="chrome" style={{ overflow: 'hidden' }}>
          <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />
          <SectionFlag label={data.section_label} />
          <FooterBar label={data.footer_label} />
        </div>
        {data.intro !== null ? (
          <div data-m="intro">
            <IntroBox title={data.intro_title} text={data.intro} />
          </div>
        ) : null}
        {data.tiles.map((t) => (
          <div data-m="tile" key={t.id} style={{ marginBottom: 1 }}>
            <TileView tile={t} editing={editing} />
          </div>
        ))}
      </div>
    </div>
  );
}
