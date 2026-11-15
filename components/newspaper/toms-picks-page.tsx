'use client';

/**
 * TomsPicksPage - to-scale renderer for a `toms_picks` template page.
 *
 * Layout, top to bottom:
 *   - the standard running head,
 *   - a header band: circular headshot beside the column logotype,
 *   - a brand rule (heavy navy over a red hairline),
 *   - the standing bio paragraph,
 *   - two pick columns (college / pro) under navy band headings, THREE fixed
 *     tiles each: a team logo, the pick line and a short blurb,
 *   - the standing legal disclaimer along the bottom.
 *
 * Shared by the editor preview, the per-page proof, View File and the press
 * route, so screen == print. The tile grid divides the REMAINING height by
 * TILES_PER_COLUMN rather than growing with content - the page is a fixed
 * 10x14in text box and the grid has to stay square week to week. A long blurb
 * clips inside its own tile instead of pushing the disclaimer off the sheet.
 */
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { PageHeader } from './page-header';
import { TILES_PER_COLUMN, type PickTile, type TomsPicksData } from '@/lib/newspaper/toms-picks';

const NAVY = '#1a2238';
const RED = '#c8102e';
const CONDENSED_FONT = "var(--font-news-condensed), 'Arial Narrow', sans-serif";
const SERIF_FONT = "var(--font-crimson), Georgia, 'Times New Roman', serif";
/** Yellowtail, registered in app/layout.tsx. */
const SCRIPT_FONT = "var(--font-script), 'Brush Script MT', cursive";

const PHOTO_PX = 150;
/** How far the headshot hangs below the brand rule. */
const OVERHANG = 30;
/** Banner box, measured to the BOTTOM of the rule - the photo's overhang
 *  lives outside it and is paid for by the banner's margin-bottom. */
const BANNER_H = 150;

function Tile({ tile, editing }: { tile: PickTile; editing: boolean }) {
  const blank = !tile.logo_url && !tile.title.trim() && !tile.blurb.trim();
  if (blank) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{
          minHeight: 0,
          border: editing ? '2px dashed #d4d4d8' : undefined,
          color: '#a1a1aa',
          fontFamily: CONDENSED_FONT,
          fontSize: 16,
          letterSpacing: '0.08em',
        }}
      >
        {editing ? 'EMPTY PICK' : null}
      </div>
    );
  }
  return (
    // Centered in its slot, not top-aligned: every slot is an equal third of
    // the column whatever the blurb length, so top-aligning leaves a ragged
    // gap under each pick that reads as missing content rather than design.
    <div className="flex-1 flex items-center" style={{ minHeight: 0, gap: 14, overflow: 'hidden' }}>
      {/* Logo well - a fixed square so the pick lines align across both
          columns whatever shape the team mark happens to be. */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: 92, height: 92, background: '#f4f4f5', border: '1px solid #e4e4e7' }}
      >
        {tile.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tile.logo_url}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : null}
      </div>
      <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            fontFamily: CONDENSED_FONT,
            fontWeight: 800,
            fontSize: 29,
            lineHeight: 1.08,
            color: NAVY,
            letterSpacing: '0.01em',
          }}
        >
          {tile.title}
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: SERIF_FONT,
            fontSize: 14.5,
            lineHeight: 1.34,
            color: '#18181b',
            textAlign: 'justify',
          }}
        >
          {tile.blurb}
        </div>
      </div>
    </div>
  );
}

function PickColumn({
  label,
  tiles,
  editing,
}: {
  label: string;
  tiles: PickTile[];
  editing: boolean;
}) {
  return (
    <div className="flex flex-col" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      {/* data-pdf-vcenter: the Customer Draft PDF repaints these bars exactly
          centered on the capture canvas - html2canvas draws flex-centered
          condensed-font text slightly high. Screen/print are untouched. */}
      <div
        className="flex items-center justify-center shrink-0"
        data-pdf-vcenter
        style={{
          background: NAVY,
          color: '#fff',
          height: 38,
          fontFamily: CONDENSED_FONT,
          fontWeight: 700,
          fontSize: 23,
          letterSpacing: '0.14em',
        }}
      >
        {label}
      </div>
      <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
        {tiles.slice(0, TILES_PER_COLUMN).map((t, i) => (
          <div
            key={t.id}
            className="flex flex-col"
            style={{
              flex: 1,
              minHeight: 0,
              padding: '12px 0',
              borderTop: i === 0 ? undefined : '1px solid #d4d4d8',
            }}
          >
            <Tile tile={t} editing={editing} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TomsPicksPage({
  data,
  pageNumber,
  dateLabel,
  editing = false,
}: {
  data: TomsPicksData;
  pageNumber: number;
  dateLabel?: string;
  editing?: boolean;
}) {
  return (
    <div
      className="flex flex-col"
      style={{ width: CONTENT_W_PX, height: CONTENT_H_PX, background: '#fff', color: '#111' }}
    >
      <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />

      {/* Banner: the red script logotype sitting over the brand rule, with
          the headshot RIDING the rule - the circle is absolutely placed and
          hangs OVERHANG px past the bottom, so the rule runs behind it. The
          white + navy rings are drawn with box-shadow rather than a border:
          a shadow is painted outside the border box, so it is not touched by
          the overflow:hidden that crops the photo to the circle. */}
      <div
        className="shrink-0"
        style={{ position: 'relative', height: BANNER_H, marginBottom: OVERHANG - 2 }}
      >
        <div
          style={{
            position: 'absolute',
            left: PHOTO_PX + 34,
            right: 0,
            bottom: 16,
            fontFamily: SCRIPT_FONT,
            fontSize: 104,
            lineHeight: 1,
            color: RED,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {data.headline}
        </div>

        {/* Brand rule: heavy navy over a red hairline. */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <div style={{ height: 4, background: NAVY }} />
          <div style={{ height: 1.5, background: RED, marginTop: 2.5 }} />
        </div>

        <div
          className="flex items-center justify-center"
          style={{
            position: 'absolute',
            left: 6,
            bottom: -OVERHANG,
            zIndex: 2,
            width: PHOTO_PX,
            height: PHOTO_PX,
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#f4f4f5',
            boxShadow: `0 0 0 5px #fff, 0 0 0 8px ${NAVY}`,
          }}
        >
          {data.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.photo_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : editing ? (
            <span
              style={{
                fontFamily: CONDENSED_FONT,
                fontSize: 15,
                color: '#a1a1aa',
                textAlign: 'center',
                padding: 8,
              }}
            >
              ADD
              <br />
              PHOTO
            </span>
          ) : null}
        </div>
      </div>

      {/* Standing bio */}
      {data.bio.trim() ? (
        <div
          className="shrink-0"
          style={{
            marginTop: 12,
            fontFamily: SERIF_FONT,
            fontSize: 17,
            lineHeight: 1.4,
            color: '#18181b',
            textAlign: 'justify',
          }}
        >
          {data.bio}
        </div>
      ) : null}

      {/* Two pick columns */}
      <div
        className="flex"
        style={{ flex: 1, minHeight: 0, marginTop: 14, gap: 26, overflow: 'hidden' }}
      >
        <PickColumn label={data.college_label} tiles={data.college} editing={editing} />
        {/* Hairline gutter, as the printed sports pages run. */}
        <div className="shrink-0" style={{ width: 1, background: '#d4d4d8' }} />
        <PickColumn label={data.pro_label} tiles={data.pro} editing={editing} />
      </div>

      {/* Disclaimer */}
      {data.disclaimer.trim() ? (
        <div
          className="shrink-0"
          style={{
            marginTop: 12,
            borderTop: `3px solid ${NAVY}`,
            paddingTop: 8,
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 10,
            lineHeight: 1.3,
            color: '#3f3f46',
            textAlign: 'justify',
          }}
        >
          {data.disclaimer}
        </div>
      ) : null}
    </div>
  );
}
