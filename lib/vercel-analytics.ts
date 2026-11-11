import 'server-only';

/**
 * Vercel Web Analytics reader for the portal's Traffic Stats tile
 * (2026-10-09). Pulls unique-visitor counts (and Vercel's own pageview
 * counts) from the Web Analytics query API:
 *
 *   GET https://api.vercel.com/v1/query/web-analytics/visits/count
 *   GET https://api.vercel.com/v1/query/web-analytics/visits/aggregate
 *
 * Auth: VERCEL_ANALYTICS_TOKEN env var — a Vercel account token scoped to the
 * JAT Capital team (Account Settings → Tokens). When it isn't set, every
 * reader returns null and the tile simply omits the visitor figures.
 *
 * Collection started 2026-10-09 (Web Analytics enabled + script deployed), so
 * growth comparisons stay "—" until the windows have history. `until` is
 * EXCLUSIVE. Windows are sent as exact instants at midnight EASTERN so the
 * visitor stats roll over with the page-view counters (migration 054,
 * publisher direction 2026-10-21).
 */

const API = 'https://api.vercel.com/v1/query/web-analytics';
const PROJECT_ID = 'prj_S56YOc24p4cd2xx4Oif8lvOXpl7Y';
const TEAM_ID = 'team_zkVISI9OeLigC59WKHJgpV6Y';

/** The day Web Analytics was enabled — visitor data simply doesn't exist
 *  before this, so windows starting earlier are flagged partial. */
export const VERCEL_COLLECTION_START = '2026-10-09';

export type VisitorStat = {
  key: 'today' | 'week' | 'month' | 'ytd';
  visitors: number;
  seqGrowth: number | null;
  yoyGrowth: number | null;
  /** True when the window starts before collection began — the count only
   *  covers the days since VERCEL_COLLECTION_START. */
  partial: boolean;
};

export type ReferrerRow = { hostname: string; visitors: number };
export type SourceRow = { source: string; visitors: number };

export function isVercelAnalyticsConfigured(): boolean {
  return Boolean(process.env.VERCEL_ANALYTICS_TOKEN);
}

/** Today's calendar date in the Eastern time zone, as YYYY-MM-DD. */
function ymdTodayET(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}
function ymdShift(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function ymdYearAgo(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y - 1, m - 1, d)).toISOString().slice(0, 10);
}
/** Midnight Eastern on the given date, as the actual instant (DST-aware):
 *  00:00 ET is 05:00 UTC under EST and 04:00 UTC under EDT. */
function etMidnight(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 5)); // 00:00 EST or 01:00 EDT
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(probe);
  return hour === '01' ? new Date(Date.UTC(y, m - 1, d, 4)) : probe;
}
function growth(cur: number, prev: number | null): number | null {
  if (prev === null || prev <= 0) return null;
  return (cur - prev) / prev;
}

async function api(path: string, params: Record<string, string>): Promise<unknown | null> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  if (!token) return null;
  const qs = new URLSearchParams({ projectId: PROJECT_ID, teamId: TEAM_ID, ...params });
  try {
    const res = await fetch(`${API}/${path}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      // The tile tolerates 5-minute-old numbers; don't hammer the API.
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error('[vercel-analytics]', path, res.status, (await res.text()).slice(0, 200));
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('[vercel-analytics]', path, e);
    return null;
  }
}

/** Unique visitors in [from, toExclusive). Null on any failure. */
async function countVisitors(from: Date, toExclusive: Date): Promise<number | null> {
  const json = (await api('visits/count', {
    since: from.toISOString(),
    until: toExclusive.toISOString(),
  })) as { data?: { visitors?: number } } | null;
  const v = json?.data?.visitors;
  return typeof v === 'number' ? v : null;
}

/** Unique visitors for the tile's four windows, with sequential + YoY growth.
 *  Null when the token isn't configured (the tile omits the rows). */
export async function getVisitorStats(): Promise<VisitorStat[] | null> {
  if (!isVercelAnalyticsConfigured()) return null;

  const today = ymdTodayET();
  const tomorrow = ymdShift(today, 1);
  const jan1 = `${today.slice(0, 4)}-01-01`;
  const ytdDays = Math.round((Date.parse(today) - Date.parse(jan1)) / 86400000) + 1;

  // [from, toExclusive) triplets (ET calendar days): current, sequential-
  // previous, year-ago.
  const windows: Array<{ key: VisitorStat['key']; spans: Array<[string, string]> }> = [
    {
      key: 'today',
      spans: [
        [today, tomorrow],
        [ymdShift(today, -1), today],
        [ymdYearAgo(today), ymdYearAgo(tomorrow)],
      ],
    },
    {
      key: 'week',
      spans: [
        [ymdShift(today, -6), tomorrow],
        [ymdShift(today, -13), ymdShift(today, -6)],
        [ymdYearAgo(ymdShift(today, -6)), ymdYearAgo(tomorrow)],
      ],
    },
    {
      key: 'month',
      spans: [
        [ymdShift(today, -29), tomorrow],
        [ymdShift(today, -59), ymdShift(today, -29)],
        [ymdYearAgo(ymdShift(today, -29)), ymdYearAgo(tomorrow)],
      ],
    },
    {
      key: 'ytd',
      spans: [
        [jan1, tomorrow],
        [ymdShift(jan1, -ytdDays), jan1],
        [ymdYearAgo(jan1), ymdYearAgo(tomorrow)],
      ],
    },
  ];

  const stats = await Promise.all(
    windows.map(async (w) => {
      const [cur, seq, yoy] = await Promise.all(
        w.spans.map(([f, t]) => countVisitors(etMidnight(f), etMidnight(t)))
      );
      if (cur === null) return null;
      return {
        key: w.key,
        visitors: cur,
        seqGrowth: growth(cur, seq),
        yoyGrowth: growth(cur, yoy),
        partial: w.spans[0][0] < VERCEL_COLLECTION_START,
      } satisfies VisitorStat;
    })
  );

  // If every window failed (bad token, API down), hide the rows entirely.
  if (stats.every((s) => s === null)) return null;
  return stats.flatMap((s) => (s ? [s] : []));
}

/** Top utm_source tags by unique visitors, trailing 30 days. Referrers miss
 *  most social traffic (the X app sends no referrer header, so those visits
 *  look direct) - links we post carry ?utm_source=... instead, which the
 *  analytics script records regardless of referrer. Untagged visits are
 *  excluded; this table only ranks traffic from links we tagged. */
export async function getTopSources(): Promise<SourceRow[] | null> {
  if (!isVercelAnalyticsConfigured()) return null;
  const today = ymdTodayET();
  const json = (await api('visits/aggregate', {
    by: 'utmSource',
    since: etMidnight(ymdShift(today, -29)).toISOString(),
    until: etMidnight(ymdShift(today, 1)).toISOString(),
    limit: '10',
  })) as { data?: Array<Record<string, unknown>> } | null;
  if (!json?.data) return null;
  return json.data
    .map((r) => ({
      source: String(r.utmSource ?? '').trim(),
      visitors: typeof r.visitors === 'number' ? r.visitors : 0,
    }))
    .filter((r) => r.source && r.visitors > 0)
    .sort((a, b) => b.visitors - a.visitors);
}

/** Top referrer hostnames by unique visitors, trailing 30 days. */
export async function getTopReferrers(): Promise<ReferrerRow[] | null> {
  if (!isVercelAnalyticsConfigured()) return null;
  const today = ymdTodayET();
  const json = (await api('visits/aggregate', {
    by: 'referrerHostname',
    since: etMidnight(ymdShift(today, -29)).toISOString(),
    until: etMidnight(ymdShift(today, 1)).toISOString(),
    limit: '10',
  })) as { data?: Array<Record<string, unknown>> } | null;
  if (!json?.data) return null;
  return json.data
    .map((r) => ({
      hostname: String(r.referrerHostname ?? r.referrer ?? '').trim() || '(direct / none)',
      visitors: typeof r.visitors === 'number' ? r.visitors : 0,
    }))
    .filter((r) => r.visitors > 0)
    .sort((a, b) => b.visitors - a.visitors);
}
