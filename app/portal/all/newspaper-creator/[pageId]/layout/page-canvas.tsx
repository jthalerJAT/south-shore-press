'use client';

/**
 * PageCanvas — the to-scale 11×15 tabloid surface. Everything inside is laid
 * out in unscaled print px; the surface is CSS-`scale()`d for zoom, and a
 * spacer sized to the scaled surface keeps scrollbars honest. A dashed red line
 * marks the true page bottom so overflow past the printable area is visible.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  PAGE_W_PX,
  PAGE_H_PX,
  CONTENT_W_PX,
  CONTENT_H_PX,
  MARGIN_IN,
  DPI,
} from '@/lib/newspaper/layout-engine';

const MARGIN_PX = Math.round(MARGIN_IN * DPI);

export function PageCanvas({ zoom, children }: { zoom: number; children: ReactNode }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: PAGE_W_PX, h: PAGE_H_PX });

  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative h-full overflow-auto bg-zinc-300/60 rounded border border-zinc-200">
      {/* Scroll spacer sized to the scaled surface. */}
      <div style={{ width: size.w * zoom, height: size.h * zoom, padding: 16 * zoom }}>
        <div
          ref={surfaceRef}
          style={{
            width: PAGE_W_PX,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        >
          <div
            className="bg-white shadow-md relative"
            style={{
              width: PAGE_W_PX,
              minHeight: PAGE_H_PX,
              boxSizing: 'border-box',
              padding: MARGIN_PX,
            }}
          >
            {/* Printable-area guide. */}
            <div
              className="pointer-events-none absolute"
              style={{
                left: MARGIN_PX,
                top: MARGIN_PX,
                width: CONTENT_W_PX,
                height: CONTENT_H_PX,
                outline: '1px dashed #d4d4d8',
              }}
            />
            {/* True page bottom. */}
            <div
              className="pointer-events-none absolute left-0 right-0"
              style={{ top: PAGE_H_PX, borderTop: '2px dashed #ef4444' }}
            >
              <span className="absolute right-1 -top-4 text-[10px] font-bold uppercase tracking-wide text-red-500">
                Page bottom
              </span>
            </div>

            <div className="relative flex flex-col gap-6" style={{ width: CONTENT_W_PX }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
