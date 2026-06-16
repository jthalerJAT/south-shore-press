'use client';

/**
 * PhotoOverlay — the draggable/resizable handle layer drawn over a story band's
 * embedded photo in the layout editor. It moves a transient CSS box during the
 * gesture (no text reflow per-pixel) and, on release, snaps horizontally to the
 * column grid and commits the new geometry — at which point the parent re-runs
 * the flow so text wraps around the new position.
 *
 * All pointer deltas are divided by `zoom` because the overlay lives inside the
 * CSS-scaled page.
 */
import { useEffect, useRef, useState } from 'react';
import {
  columnRects,
  COLUMN_GAP_PX,
  CONTENT_H_PX,
  type PhotoRectPx,
} from '@/lib/newspaper/layout-engine';

type Rect = { left: number; top: number; width: number; height: number };

export type PhotoCommit = {
  col_start: number;
  col_span: number;
  top: number;
  height: number;
};

const MIN_W = 40;
const MIN_H = 40;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function PhotoOverlay({
  photo,
  bodyHeightPx,
  contentWidthPx,
  columns,
  zoom,
  onCommit,
}: {
  photo: PhotoRectPx;
  bodyHeightPx: number;
  contentWidthPx: number;
  columns: number;
  zoom: number;
  onCommit: (next: PhotoCommit) => void;
}) {
  const [drag, setDrag] = useState<Rect | null>(null);
  const start = useRef<{ x: number; y: number; rect: Rect; mode: 'move' | 'resize' } | null>(null);

  // Reset any transient rect whenever the committed photo changes.
  useEffect(() => {
    setDrag(null);
  }, [photo.left, photo.top, photo.width, photo.height]);

  const rect: Rect = drag ?? {
    left: photo.left,
    top: photo.top,
    width: photo.width,
    height: photo.height,
  };

  function begin(mode: 'move' | 'resize', e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = {
      x: e.clientX,
      y: e.clientY,
      rect: { left: photo.left, top: photo.top, width: photo.width, height: photo.height },
      mode,
    };
    setDrag(start.current.rect);
  }

  function move(e: React.PointerEvent) {
    if (!start.current) return;
    const dx = (e.clientX - start.current.x) / zoom;
    const dy = (e.clientY - start.current.y) / zoom;
    const s = start.current.rect;
    if (start.current.mode === 'move') {
      setDrag({
        width: s.width,
        height: s.height,
        left: clamp(s.left + dx, 0, contentWidthPx - s.width),
        top: clamp(s.top + dy, 0, Math.max(0, bodyHeightPx - s.height)),
      });
    } else {
      const width = clamp(s.width + dx, MIN_W, contentWidthPx - s.left);
      const height = clamp(s.height + dy, MIN_H, Math.max(MIN_H, bodyHeightPx - s.top));
      setDrag({ left: s.left, top: s.top, width, height });
    }
  }

  function end(e: React.PointerEvent) {
    if (!start.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const r = drag ?? start.current.rect;
    start.current = null;
    onCommit(snap(r, contentWidthPx, columns));
  }

  return (
    <div
      onPointerDown={(e) => begin('move', e)}
      onPointerMove={move}
      onPointerUp={end}
      className="absolute cursor-move ring-2 ring-brand-red/80 bg-brand-red/5"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, touchAction: 'none' }}
    >
      <div className="absolute -top-5 left-0 text-[10px] font-bold uppercase tracking-wide text-brand-red bg-white/90 px-1">
        Photo
      </div>
      <div
        onPointerDown={(e) => begin('resize', e)}
        onPointerMove={move}
        onPointerUp={end}
        className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-brand-red rounded-sm cursor-nwse-resize"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}

/** Snap a free px rect to the column grid + return stored fractions. */
function snap(r: Rect, contentWidthPx: number, columns: number): PhotoCommit {
  const rects = columnRects(contentWidthPx, columns, COLUMN_GAP_PX);
  // Nearest column start to the left edge.
  let colStart0 = 0;
  let bestS = Infinity;
  rects.forEach((rc, i) => {
    const d = Math.abs(rc.x - r.left);
    if (d < bestS) {
      bestS = d;
      colStart0 = i;
    }
  });
  // Nearest column end to the right edge.
  const right = r.left + r.width;
  let colEnd0 = colStart0;
  let bestE = Infinity;
  rects.forEach((rc, i) => {
    const re = rc.x + rc.w;
    const d = Math.abs(re - right);
    if (d < bestE) {
      bestE = d;
      colEnd0 = i;
    }
  });
  colEnd0 = Math.max(colStart0, colEnd0);
  return {
    col_start: colStart0 + 1,
    col_span: colEnd0 - colStart0 + 1,
    top: r.top / CONTENT_H_PX,
    height: r.height / CONTENT_H_PX,
  };
}
