/** Seagull silhouette used in the running-head between the page number and the
 *  masthead text. Created as an inline SVG (the .indd source is binary). */
export function Seagull({ width = 26, color = '#0b2a4a' }: { width?: number; color?: string }) {
  return (
    <svg
      width={width}
      height={(width * 16) / 32}
      viewBox="0 0 32 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path
        d="M1 12 C6 4 11 4 16 9 C21 4 26 4 31 12"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
