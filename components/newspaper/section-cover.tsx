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
  const headerH = 150;
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" style={{ height: 88, width: 'auto', objectFit: 'contain' }} className="mx-auto" />
            <div className="flex items-end justify-between mt-1" style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>{data.year_issue || '— YEAR • ISSUE —'}</span>
              <span style={{ fontStyle: 'italic', fontWeight: 600 }}>{data.tagline}</span>
              <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{data.issue_date || '— DATE —'}</span>
            </div>
          </>
        )}
        <div style={{ borderBottom: '2px solid #000', marginTop: 6 }} />
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
            <div className="font-headline" style={{ ...outlinedHeadline, fontSize: 84 }}>
              {data.hero.headline}
            </div>
          ) : null}
          {data.hero.subhead ? (
            <div className="font-headline" style={{ color: '#fff', textShadow: '1px 1px 0 #000', fontWeight: 800, fontSize: 30, marginTop: 4 }}>
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
            className="absolute bottom-0 right-0 font-headline"
            style={{ background: 'var(--brand-red, #c8102e)', color: '#fff', fontWeight: 800, fontSize: 26, padding: '4px 16px' }}
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
    <div className="relative flex flex-col" style={{ background: SSP_BLUE }}>
      <div className="relative" style={{ height: 110, background: '#9ca3af', overflow: 'hidden' }}>
        {tile.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
        {tile.section_label ? (
          <span
            className="absolute top-1 left-1"
            style={{ background: NAVY, color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', padding: '2px 8px', transform: 'skewX(-10deg)' }}
          >
            <span style={{ display: 'inline-block', transform: 'skewX(10deg)' }}>{tile.section_label}</span>
          </span>
        ) : null}
        {tile.credit ? (
          <span className="absolute bottom-0 left-0" style={{ color: '#fff', fontSize: 9, padding: '1px 4px', textShadow: '1px 1px 0 #000' }}>
            Credit: {tile.credit}
          </span>
        ) : null}
      </div>
      <div className="flex-1 px-2 py-1 flex flex-col">
        <div className="font-headline" style={{ color: '#fff', fontWeight: 800, fontSize: 18, lineHeight: 1.02 }}>
          {tile.headline || <span style={{ opacity: 0.6 }}>Headline</span>}
        </div>
        <div className="mt-auto text-right" style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>
          {tile.page_ref ? `Story on pg. ${tile.page_ref}` : ''}
        </div>
      </div>
    </div>
  );
}
