/**
 * Colophon rail geometry (px at print scale) — kept in a PLAIN module on
 * purpose: the rail component is 'use client' (it auto-fits its bottom
 * blocks), and constants exported from a client module become client
 * references when imported by a SERVER page, so width arithmetic like
 * `CONTENT_W_PX - COLOPHON_RAIL_W` silently evaluates to NaN and React drops
 * the style — which squeezed the rail and blew up the band widths.
 */
export const COLOPHON_RAIL_W = 215;
export const COLOPHON_GAP = 16;
