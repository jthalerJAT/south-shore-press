/** Seagull silhouette used in the running-head between the page number and the
 *  masthead text — the publisher's supplied bird photo silhouette (2026-07-21),
 *  replacing the old two-stroke squiggle. Served as pre-flattened PNGs with NO
 *  alpha channel (transparency would force Ghostscript to rasterize every
 *  sheet in the press export): navy-on-white for light backgrounds (default)
 *  and white-on-navy for the classifieds rail. Aspect ratio 160:183. */
const ASPECT = 183 / 160;

export function Seagull({ width = 16, color = '#0b2a4a' }: { width?: number; color?: string }) {
  const light = color.trim().toLowerCase() === '#fff' || color.trim().toLowerCase() === '#ffffff';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={light ? '/seagull-header-navy.png' : '/seagull-header.png'}
      alt=""
      width={width}
      height={Math.round(width * ASPECT)}
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}
