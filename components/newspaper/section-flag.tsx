/**
 * Section flag shown at the top-left of an interior content page (OP-ED, LOCAL,
 * SPORTS, HISTORY LESSONS, …): a slanted navy parallelogram with white uppercase
 * text + the paper's "//" double-slash accent. Driven by a page's Section Name.
 * Presentational; reused by the per-page proof, View File, and the press route.
 */
const NAVY = '#1e3a8a';

export function SectionFlag({ label }: { label?: string | null }) {
  const text = (label ?? '').trim();
  if (!text) return null;
  return (
    <div className="flex items-center gap-1.5 mb-4">
      <span
        style={{
          background: NAVY,
          transform: 'skewX(-12deg)',
          display: 'inline-block',
          padding: '4px 18px',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            transform: 'skewX(12deg)',
            color: '#fff',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 800,
            textTransform: 'uppercase',
            fontSize: 18,
            lineHeight: 1.1,
            letterSpacing: '0.02em',
          }}
        >
          {text}
        </span>
      </span>
      {/* "//" accent — two skewed bars */}
      <span aria-hidden style={{ display: 'inline-flex', gap: 4 }}>
        <span style={{ width: 7, height: 28, background: NAVY, transform: 'skewX(-12deg)', display: 'inline-block' }} />
        <span style={{ width: 7, height: 28, background: NAVY, transform: 'skewX(-12deg)', display: 'inline-block' }} />
      </span>
    </div>
  );
}
