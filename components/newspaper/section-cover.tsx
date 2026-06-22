/**
 * SectionCover — to-scale (11×15) wireframe renderer for a section-cover page
 * (Front Page, Sports cover). Pure presentational; reused by the cover editor
 * preview, the print proof, and View File. Renders at the page content size in
 * unscaled print px; callers apply zoom via CSS transform.
 */
import type { CSSProperties } from 'react';
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

export function SectionCover({
  data,
  variant,
  mastheadWord,
  logoUrl = SITE.logoUrl,
}: {
  data: SectionCoverData;
  variant: 'news' | 'sports';
  mastheadWord?: string;
  logoUrl?: string;
}) {
  const headerH = 198;
  const bannerH = data.banner_text ? 36 : 0;
  const tiles = data.tiles.slice(0, data.tile_count);
  const tilesH = tiles.length > 0 ? 220 : 0;
  const heroH = Math.max(160, CONTENT_H_PX - headerH - tilesH - bannerH);

  return (
    <div style={{ width: CONTENT_W_PX, height: CONTENT_H_PX, background: '#fff', color: '#111' }}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ height: headerH }} className="flex flex-col">
        {variant === 'sports' ? (
          <div className="flex items-center justify-between gap-4 px-1 pt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" style={{ height: 64, width: 'auto', objectFit: 'contain' }} />
            <div className="flex-1 flex flex-col items-end justify-center" style={{ background: NAVY, color: '#fff', height: 96, paddingRight: 16 }}>
              <span className="font-headline" style={{ fontSize: 60, fontWeight: 800, lineHeight: 1 }}>
                {mastheadWord ?? 'Sports'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, maxWidth: 320, textAlign: 'right' }}>
                {data.tagline}
              </span>
            </div>
          </div>
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
              <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{data.issue_date || '— DATE —'}</span>
            </div>
          </>
        )}
        <div style={{ borderBottom: '2px solid #000', marginTop: 3 }} />
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
            <div style={{ ...outlinedHeadline, fontFamily: DISPLAY_FONT, fontSize: 88, whiteSpace: 'pre-line' }}>
              {data.hero.headline}
            </div>
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
