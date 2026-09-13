'use client';

/**
 * FlowPage — the ONE drawing of a flow (story/ad) newspaper page: running
 * header, section flag, optional publication-info rail, and the story/ad
 * bands (corner quarter ads, bottom-pinned third ads, spacing). Used by the
 * page editor preview, Edit Page Layout, View / Print PDF and the whole-issue
 * press export, so all four match by construction. Edit Page Layout passes
 * `edit` hooks to layer selection + photo handles on top; everything else
 * renders exactly what prints.
 *
 * The frame is a fixed CONTENT_W × CONTENT_H flex column and never clips —
 * callers that must show only the printable area wrap it in a clipping box.
 */
import type { Ref } from 'react';
import { PageHeader } from '@/components/newspaper/page-header';
import { SectionFlag } from '@/components/newspaper/section-flag';
import { ColophonRail } from '@/components/newspaper/colophon-rail';
import { COLOPHON_RAIL_W, COLOPHON_GAP } from '@/lib/newspaper/colophon';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { ProofBands, type ProofItem, type ProofEditHooks } from './proof-bands';

export function FlowPage({
  items,
  pageNumber,
  dateLabel,
  sectionName,
  showColophon,
  photoScale,
  spaceScale,
  columns,
  onTextOverflow,
  emptyText,
  edit,
  frameRef,
}: {
  items: ProofItem[];
  pageNumber: number;
  dateLabel?: string;
  sectionName?: string | null;
  showColophon?: boolean;
  /** Page-wide fit levers (page editor). Stories saved from Edit Page Layout
   *  (layout.custom) ignore photoScale + columns. */
  photoScale?: number;
  spaceScale?: number;
  columns?: number;
  onTextOverflow?: (overflowing: boolean) => void;
  /** Shown when the page has no items; omit to render nothing. */
  emptyText?: string;
  edit?: ProofEditHooks;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const empty = items.length === 0;
  const emptyNote = emptyText ? <p className="text-sm text-zinc-400 italic">{emptyText}</p> : null;
  const bands = (contentWidthPx?: number) => (
    <ProofBands
      items={items}
      contentWidthPx={contentWidthPx}
      photoScale={photoScale}
      spaceScale={spaceScale}
      columns={columns}
      pageOrdinal={pageNumber}
      onTextOverflow={onTextOverflow}
      edit={edit}
    />
  );

  return (
    // Fixed height + flex column: ProofBands receives the remaining page
    // height so a corner quarter ad / third ad can pin to the page bottom.
    <div ref={frameRef} style={{ width: CONTENT_W_PX, height: CONTENT_H_PX, display: 'flex', flexDirection: 'column' }}>
      <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />
      <SectionFlag label={sectionName} />
      {showColophon ? (
        <div style={{ display: 'flex', gap: COLOPHON_GAP, width: CONTENT_W_PX, flex: '1 1 0%', minHeight: 0 }}>
          <div style={{ width: CONTENT_W_PX - COLOPHON_RAIL_W - COLOPHON_GAP, display: 'flex', flexDirection: 'column' }}>
            {empty ? emptyNote : bands(CONTENT_W_PX - COLOPHON_RAIL_W - COLOPHON_GAP)}
          </div>
          <ColophonRail width={COLOPHON_RAIL_W} />
        </div>
      ) : empty ? (
        emptyNote
      ) : (
        bands()
      )}
    </div>
  );
}
