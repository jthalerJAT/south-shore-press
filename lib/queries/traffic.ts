import { createAdminClient } from '@/lib/supabase/admin';
import { getStoriesByIds } from '@/lib/queries/stories';
import { buildStoryPath } from '@/lib/slugify';

/**
 * Traffic Stats queries (portal tile, 2026-10-09).
 *
 * Site totals come from site_views (one row per UTC day; migration 051 —
 * seeded from the article-view history, full-site from 2026-10-09 on).
 * Top content comes from story_views (per story per UTC day; migration 033).
 * Growth is null when the comparison window has no recorded traffic, so the
 * UI shows "—" instead of a fake 0% / ∞%.
 */

export type TrafficStat = {
  key: 'today' | 'week' | 'month' | 'ytd';
  label: string;
  /** e.g. "Oct 3 – Oct 9" */
  rangeLabel: string;
  views: number;
  /** vs the immediately preceding period of equal length. */
  seqGrowth: number | null;
  /** vs the same period one year earlier. */
  yoyGrowth: number | null;
};

export type TopContentFrame = {
  key: 'today' | 'week' | 'month' | 'ytd' | 'all';
  label: string;
  rows: Array<{ id: string; headline: string; path: string; views: number }>;
};

/** UTC day arithmetic — buckets in both tables are UTC dates. */
function dayUTC(offsetDays = 0, from?: Date): Date {
  const base = from ?? new Date();
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function yearAgo(d: Date): Date {
  const y = new Date(d);
  y.setUTCFullYear(y.getUTCFullYear() - 1);
  return y;
}
function fmtRange(from: Date, to: Date): string {
  const f = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return iso(from) === iso(to) ? f(to) : `${f(from)} – ${f(to)}`;
}
function growth(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return (cur - prev) / prev;
}

export async function getTrafficSummary(): Promise<TrafficStat[]> {
  const admin = createAdminClient();
  // Everything any window can need: from Jan 1 of LAST year forward.
  const today = dayUTC();
  const floor = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1));
  const { data, error } = await admin
    .from('site_views')
    .select('day, views')
    .gte('day', iso(floor));
  if (error) {
    console.error('[getTrafficSummary]', error);
    return [];
  }
  const byDay = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ day: string; views: number }>) {
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.views);
  }
  const sum = (from: Date, to: Date): number => {
    let total = 0;
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      total += byDay.get(iso(d)) ?? 0;
    }
    return total;
  };

  function stat(
    key: TrafficStat['key'],
    label: string,
    from: Date,
    to: Date,
    seqFrom: Date,
    seqTo: Date
  ): TrafficStat {
    const views = sum(from, to);
    return {
      key,
      label,
      rangeLabel: fmtRange(from, to),
      views,
      seqGrowth: growth(views, sum(seqFrom, seqTo)),
      yoyGrowth: growth(views, sum(yearAgo(from), yearAgo(to))),
    };
  }

  const jan1 = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const ytdDays = Math.round((today.getTime() - jan1.getTime()) / 86400000) + 1;

  return [
    stat('today', 'Today', today, today, dayUTC(-1), dayUTC(-1)),
    stat('week', 'Trailing Week', dayUTC(-6), today, dayUTC(-13), dayUTC(-7)),
    stat('month', 'Trailing Month', dayUTC(-29), today, dayUTC(-59), dayUTC(-30)),
    // YTD sequential = the equal-length window ending Dec 31 of last year.
    stat('ytd', 'Year to Date', jan1, today, dayUTC(-ytdDays, jan1), dayUTC(-1, jan1)),
  ];
}

const TOP_LIMIT = 15;

export async function getTopContent(): Promise<TopContentFrame[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('story_views').select('story_id, day, views');
  if (error) {
    console.error('[getTopContent]', error);
    return [];
  }

  const today = dayUTC();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const jan1 = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const frames: Array<{ key: TopContentFrame['key']; label: string; from: string | null }> = [
    { key: 'today', label: 'Today', from: iso(today) },
    { key: 'week', label: 'Trailing Week', from: iso(dayUTC(-6)) },
    { key: 'month', label: 'This Month', from: iso(monthStart) },
    { key: 'ytd', label: 'Year to Date', from: iso(jan1) },
    { key: 'all', label: 'All Time', from: null },
  ];

  const totals = new Map<TopContentFrame['key'], Map<string, number>>(
    frames.map((f) => [f.key, new Map()])
  );
  for (const r of (data ?? []) as Array<{ story_id: string; day: string; views: number }>) {
    for (const f of frames) {
      if (f.from === null || r.day >= f.from) {
        const m = totals.get(f.key)!;
        m.set(r.story_id, (m.get(r.story_id) ?? 0) + r.views);
      }
    }
  }

  // One story lookup covering every frame's top list.
  const wanted = new Set<string>();
  const ranked = new Map<TopContentFrame['key'], Array<[string, number]>>();
  for (const f of frames) {
    const list = [...totals.get(f.key)!.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_LIMIT);
    ranked.set(f.key, list);
    for (const [id] of list) wanted.add(id);
  }
  const stories = new Map((await getStoriesByIds([...wanted])).map((s) => [s.id, s]));

  return frames.map((f) => ({
    key: f.key,
    label: f.label,
    rows: ranked
      .get(f.key)!
      .flatMap(([id, views]) => {
        const s = stories.get(id);
        if (!s) return []; // unpublished / deleted since
        return [{ id, headline: s.headline, path: buildStoryPath(s), views }];
      }),
  }));
}
