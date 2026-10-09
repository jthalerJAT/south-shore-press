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
 * EXCLUSIVE and the API buckets by UTC day.
 */

const API = 'https://api.vercel.com/v1/query/web-analytics';
const PROJECT_ID = 'prj_S56YOc24p4cd2xx4Oif8lvOXpl7Y';
const TEAM_ID = 'team_zkVISI9OeLigC59WKHJgpV6Y';

export type VisitorStat = {
  key: 'today' | 'week' | 'month' | 'ytd';
  visitors: number;
  seqGrowth: number | null;
  yoyGrowth: number | null;
};

export type ReferrerRow = { hostname: string; visitors: number };

export function isVercelAnalyticsConfigured(): boolean {
  return Boolean(process.env.VERCEL_ANALYTICS_TOKEN);
}

function dayUTC(offsetDays = 0, from?: Date): Date {
  const base = from ?? new Date();
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}
function yearAgo(d: Date): Date {
  const y = new Date(d);
  y.setUTCFullYear(y.getUTCFullYear() - 1);
  return y;
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

  const today = dayUTC();
  const tomorrow = dayUTC(1);
  const jan1 = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const ytdDays = Math.round((today.getTime() - jan1.getTime()) / 86400000) + 1;

  // [from, toExclusive) triplets: current, sequential-previous, year-ago.
  const windows: Array<{ key: VisitorStat['key']; spans: Array<[Date, Date]> }> = [
    {
      key: 'today',
      spans: [
        [today, tomorrow],
        [dayUTC(-1), today],
        [yearAgo(today), yearAgo(tomorrow)],
      ],
    },
    {
      key: 'week',
      spans: [
        [dayUTC(-6), tomorrow],
        [dayUTC(-13), dayUTC(-6)],
        [yearAgo(dayUTC(-6)), yearAgo(tomorrow)],
      ],
    },
    {
      key: 'month',
      spans: [
        [dayUTC(-29), tomorrow],
        [dayUTC(-59), dayUTC(-29)],
        [yearAgo(dayUTC(-29)), yearAgo(tomorrow)],
      ],
    },
    {
      key: 'ytd',
      spans: [
        [jan1, tomorrow],
        [dayUTC(-ytdDays, jan1), jan1],
        [yearAgo(jan1), yearAgo(tomorrow)],
      ],
    },
  ];

  const stats = await Promise.all(
    windows.map(async (w) => {
      const [cur, seq, yoy] = await Promise.all(w.spans.map(([f, t]) => countVisitors(f, t)));
      if (cur === null) return null;
      return {
        key: w.key,
        visitors: cur,
        seqGrowth: growth(cur, seq),
        yoyGrowth: growth(cur, yoy),
      } satisfies VisitorStat;
    })
  );

  // If every window failed (bad token, API down), hide the rows entirely.
  if (stats.every((s) => s === null)) return null;
  return stats.flatMap((s) => (s ? [s] : []));
}

/** Top referrer hostnames by unique visitors, trailing 30 days. */
export async function getTopReferrers(): Promise<ReferrerRow[] | null> {
  if (!isVercelAnalyticsConfigured()) return null;
  const json = (await api('visits/aggregate', {
    by: 'referrerHostname',
    since: dayUTC(-29).toISOString(),
    until: dayUTC(1).toISOString(),
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
