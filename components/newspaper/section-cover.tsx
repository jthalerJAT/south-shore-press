'use client';

/**
 * SectionCover — to-scale (11×15) wireframe renderer for a section-cover page
 * (Front Page, Sports cover). Reused by the cover editor preview, the print
 * proof, and View File. Renders at the page content size in unscaled print px;
 * callers apply zoom via CSS transform. Client component: the hero headline is
 * measured + auto-fitted to the photo.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { SITE } from '@/lib/site-config';
import type { SectionCoverData, CoverTile } from '@/lib/newspaper/section-cover';

const NAVY = '#0b2a4a';
const SSP_BLUE = '#1559b0';

// The printed front page's display faces: Impact (hero) → Anton; Oswald Bold
// (sub-headline, section tabs, tile headlines, page-ref). Newspaper only.
const DISPLAY_FONT = "var(--font-news-display), Impact, 'Arial Narrow', sans-serif";
const CONDENSED_FONT = "var(--font-news-condensed), 'Arial Narrow', sans-serif";

const outlinedHeadline: CSSProperties = {
  color: '#fff',
  WebkitTextStroke: '2px #000',
  // Fallback stroke for non-WebKit print engines.
  textShadow: '2px 2px 0 #000, -1px -1px 0 #000',
  fontWeight: 800,
  textTransform: 'uppercase',
  lineHeight: 0.92,
  letterSpacing: '-0.01em',
};

/** House hero size from the printed template ("TOXIC / TIDE TURNS", 2026-06-17
 *  issue): ~123px at our 960px content width. Long headlines shrink from here
 *  to stay inside the photo. */
const HERO_MAX_FS = 124;

/** Split a hero headline into stacked lines like the printed front page.
 *  Manual line breaks win; otherwise pick the word break(s) that give the most
 *  balanced stack (2 lines, or 3 for very long headlines). */
function stackHeadlineLines(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];
  if (/\n/.test(text)) return text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const words = text.split(/\s+/);
  if (words.length < 2 || text.length <= 12) return [text];
  const lineCount = text.length > 30 && words.length >= 3 ? 3 : 2;
  let best: string[] = [text];
  let bestLen = Infinity;
  if (lineCount === 2) {
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const len = Math.max(...lines.map((l) => l.length));
      if (len < bestLen) {
        bestLen = len;
        best = lines;
      }
    }
  } else {
    for (let i = 1; i < words.length - 1; i++) {
      for (let j = i + 1; j < words.length; j++) {
        const lines = [words.slice(0, i).join(' '), words.slice(i, j).join(' '), words.slice(j).join(' ')];
        const len = Math.max(...lines.map((l) => l.length));
        if (len < bestLen) {
          bestLen = len;
          best = lines;
        }
      }
    }
  }
  return best;
}

/** The stacked, outlined hero headline, font-fitted so every line stays within
 *  the photo (maxW) and the stack within maxH. Renders an estimate first (so
 *  print without layout still looks sane), then measures and corrects. */
function HeroHeadline({ text, maxW, maxH }: { text: string; maxW: number; maxH: number }) {
  const lines = useMemo(() => stackHeadlineLines(text), [text]);
  const ref = useRef<HTMLDivElement | null>(null);
  const longest = Math.max(1, ...lines.map((l) => l.length));
  // Anton is condensed (~0.52em average uppercase advance) — first estimate
  // from character count; the layout effect measures the real render.
  const estimate = Math.max(
    24,
    Math.min(HERO_MAX_FS, maxW / (0.52 * longest), maxH / (0.92 * Math.max(1, lines.length)))
  );
  const [fontSize, setFontSize] = useState(estimate);
  const [fontsTick, setFontsTick] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready?.then(() => {
      if (alive) setFontsTick((t) => t + 1);
    });
    return () => {
      alive = false;
    };
  }, []);
  useLayoutEffect(() => {
    setFontSize(estimate);
  }, [estimate]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || lines.length === 0) return;
    const widest = Math.max(0, ...Array.from(el.children).map((c) => (c as HTMLElement).scrollWidth));
    if (widest <= 0) return;
    const corrected = Math.min(
      HERO_MAX_FS,
      fontSize * (maxW / widest),
      maxH / (0.92 * lines.length)
    );
    if (Math.abs(corrected - fontSize) > 0.5) setFontSize(corrected);
  }, [lines, maxW, maxH, fontSize, fontsTick]);
  return (
    <div ref={ref} style={{ ...outlinedHeadline, fontFamily: DISPLAY_FONT, fontSize }}>
      {lines.map((l, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap', width: 'fit-content' }}>
          {l}
        </div>
      ))}
    </div>
  );
}

export function SectionCover({
  data,
  variant,
  mastheadWord,
  logoUrl = SITE.logoUrl,
  issueDate,
  editing,
}: {
  data: SectionCoverData;
  variant: 'news' | 'sports';
  mastheadWord?: string;
  logoUrl?: string;
  /** Issue date from the Front Page — the fallback when this cover hasn't
   *  typed its own, so every page shows the same date automatically. */
  issueDate?: string;
  /** True in the cover editor preview only: shows edit-time affordances (the
   *  mailing-panel label). NEVER set on the proof/print/View File paths. */
  editing?: boolean;
}) {
  const dateLabel = (data.issue_date ?? '').trim() || (issueDate ?? '').trim();
  // The sports back-cover header is a single compact band (date + logo/navy
  // row); the news front's stacked masthead needs more room.
  const headerH = variant === 'sports' ? 150 : 198;
  const bannerH = data.banner_text ? 36 : 0;
  const tiles = data.tiles.slice(0, data.tile_count);
  const tilesH = tiles.length > 0 ? 220 : 0;
  const heroH = Math.max(160, CONTENT_H_PX - headerH - tilesH - bannerH);

  return (
    <div style={{ position: 'relative', width: CONTENT_W_PX, height: CONTENT_H_PX, background: '#fff', color: '#111' }}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ height: headerH }} className="flex flex-col">
        {variant === 'sports' ? (
          // Sports back-cover header (p32 of the 2026-06-17 issue): issue date
          // top-right, logo left, and a navy masthead block with a slanted left
          // edge holding the big "Sports" word + the section tagline. No black
          // rule below — the navy block's bottom edge is the divider.
          <>
            <div className="text-right" style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', padding: '2px 2px 4px 0' }}>
              {dateLabel || '— DATE —'}
            </div>
            <div className="flex items-stretch flex-1" style={{ minHeight: 0 }}>
              {/* The logo PNG carries transparent padding top/bottom, so
                  object-fit COVER in the wide left box crops it and the artwork
                  spans the full band height — top of the logo to the bottom of
                  the Sports word. */}
              <div style={{ flex: '0 0 58%', minWidth: 0, overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'left center' }}
                />
              </div>
              <div
                className="flex-1 flex flex-col justify-center"
                style={{
                  background: NAVY,
                  color: '#fff',
                  clipPath: 'polygon(36px 0, 100% 0, 100% 100%, 0 100%)',
                  paddingLeft: 52,
                  paddingRight: 10,
                }}
              >
                {/* House newspaper headline face (Montserrat), same as the rest
                    of the paper — NOT the website's Playfair. Just the word,
                    no tagline underneath. */}
                <span
                  style={{
                    fontFamily: "var(--font-news-headline), 'Helvetica Neue', Arial, sans-serif",
                    fontSize: 80,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  {mastheadWord ?? 'Sports'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Masthead spans the full header width. The source PNG has ~16%
                transparent padding top/bottom — object-fit cover in a 174px
                band crops it so the artwork sits edge-to-edge, mirroring the
                printed paper's tight top margin. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt=""
              style={{ width: '100%', height: 174, objectFit: 'cover', objectPosition: 'center', display: 'block' }}
            />
            <div className="flex items-end justify-between" style={{ fontSize: 12, marginTop: 3 }}>
              <span style={{ fontWeight: 700 }}>{data.year_issue || '— YEAR • ISSUE —'}</span>
              <span style={{ fontStyle: 'italic', fontWeight: 600 }}>{data.tagline}</span>
              <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{dateLabel || '— DATE —'}</span>
            </div>
          </>
        )}
        {variant === 'news' ? <div style={{ borderBottom: '2px solid #000', marginTop: 3 }} /> : <div style={{ height: 6 }} />}
      </div>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative" style={{ height: heroH, background: '#d4d4d8', overflow: 'hidden' }}>
        {data.hero.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.hero.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
            Hero photo
          </div>
        )}

        <div className="absolute left-0 right-0 bottom-0 p-3">
          {data.hero.headline ? (
            <HeroHeadline text={data.hero.headline} maxW={CONTENT_W_PX - 24} maxH={heroH * 0.55} />
          ) : null}
          {data.hero.subhead ? (
            <div style={{ fontFamily: CONDENSED_FONT, color: '#fff', textShadow: '1px 1px 0 #000', fontWeight: 700, fontSize: 30, marginTop: 4, whiteSpace: 'pre-line' }}>
              {data.hero.subhead}
            </div>
          ) : null}
          {data.hero.credit ? (
            <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, marginTop: 2, textShadow: '1px 1px 0 #000' }}>
              Credit: {data.hero.credit}
            </div>
          ) : null}
        </div>

        {data.hero.page_ref ? (
          <div
            className="absolute bottom-0 right-0"
            style={{ fontFamily: CONDENSED_FONT, background: 'var(--brand-red, #c8102e)', color: '#fff', fontWeight: 700, fontSize: 26, padding: '4px 16px' }}
          >
            PAGE {data.hero.page_ref}
          </div>
        ) : null}
      </div>

      {/* ── Bottom tiles ─────────────────────────────────────── */}
      {tiles.length > 0 ? (
        <div style={{ height: tilesH, background: SSP_BLUE, padding: 8 }}>
          <div
            className="grid h-full"
            style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`, gap: 8 }}
          >
            {tiles.map((t, i) => (
              <Tile key={i} tile={t} />
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Banner ───────────────────────────────────────────── */}
      {data.banner_text ? (
        <div
          className="flex items-center justify-center font-headline"
          style={{ height: bannerH, background: NAVY, color: '#fff', fontStyle: 'italic', fontWeight: 800, fontSize: 18 }}
        >
          {data.banner_text}
        </div>
      ) : null}

      {/* ── Mailing-label knockout ───────────────────────────── */}
      {/* A pure-white 3.5in × 1.5in rectangle pasted OVER the bottom-corner
          content (no border) — the printer sprays the mailing address here.
          Toggled per issue in the cover editor so mailed and non-mailed
          versions can both be printed. 96 px/in: 336 × 144. */}
      {data.mailing_label ? (
        <div
          style={{ position: 'absolute', right: 0, bottom: 0, width: 336, height: 144, background: '#fff', zIndex: 10 }}
        >
          {editing ? (
            <div
              className="h-full flex items-center justify-center text-center"
              style={{ color: '#d4d4d8', fontSize: 12, fontWeight: 600, padding: 8 }}
            >
              Mailing label area (prints pure white)
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Tile({ tile }: { tile: CoverTile }) {
  return (
    <div className="relative overflow-hidden" style={{ height: '100%', background: SSP_BLUE }}>
      {/* Full-bleed photo */}
      {tile.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tile.photo_url}
          alt=""
          className="absolute inset-0"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : null}
      {/* Bottom gradient for text legibility */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))' }}
      />

      {/* Section tab, top-left */}
      {tile.section_label ? (
        <span
          className="absolute top-1 left-1"
          style={{ fontFamily: CONDENSED_FONT, background: NAVY, color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', padding: '2px 8px', transform: 'skewX(-10deg)' }}
        >
          <span style={{ display: 'inline-block', transform: 'skewX(10deg)' }}>{tile.section_label}</span>
        </span>
      ) : null}

      {/* Headline above credit, bottom-left */}
      <div className="absolute left-2 bottom-1" style={{ right: 80 }}>
        <div style={{ fontFamily: CONDENSED_FONT, color: '#fff', fontWeight: 700, fontSize: 19, lineHeight: 1.02, textShadow: '1px 1px 2px #000', whiteSpace: 'pre-line' }}>
          {tile.headline || <span style={{ opacity: 0.6 }}>Headline</span>}
        </div>
        {tile.credit ? (
          <div style={{ color: '#fff', fontSize: 9, fontWeight: 600, marginTop: 1, textShadow: '1px 1px 1px #000' }}>
            Credit: {tile.credit}
          </div>
        ) : null}
      </div>

      {/* Story-on, lower-right corner */}
      {tile.page_ref ? (
        <div className="absolute bottom-1 right-2" style={{ color: '#fff', fontSize: 11, fontWeight: 700, textShadow: '1px 1px 2px #000' }}>
          Story on pg. {tile.page_ref}
        </div>
      ) : null}
    </div>
  );
}
