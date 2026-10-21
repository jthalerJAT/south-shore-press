import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAllCustomerLegals } from '@/lib/queries/customer';
import { getAllLegalNotices } from '@/lib/queries/legal-notices';
import { legalFooterLine, parseLegalPrint } from '@/lib/legal-dates';
import { quoteLegal, wordCount } from '@/lib/legal-rates';
import { LegalDatabaseList, type LegalRow } from './legal-database-list';

export const metadata: Metadata = {
  title: 'Legal Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Pull the L# out of a library notice's print text — the footer line puts
 *  it last ("… L40001 8/5/26, 8/12/26"), so take the LAST match. */
function parseLNumber(body: string): string | null {
  const matches = body.match(/\bL\d{5,}\b/g);
  return matches?.length ? matches[matches.length - 1] : null;
}

export default async function LegalDatabasePage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/legal-database'
  );
  const [legals, notices] = await Promise.all([getAllCustomerLegals(), getAllLegalNotices()]);

  // One merged list: filed legals (customer_legals) plus the Legal Notices
  // library the newspaper creator places from. Library rows that are just
  // mirrors of a filed legal (same L# or same print text) are hidden so each
  // legal appears once, as its richer editable record.
  const filedLNumbers = new Set(legals.map((l) => l.l_number));
  const filedPrintBodies = new Set(
    legals.map((l) => `${l.body}\n${legalFooterLine(l.l_number, l.run_dates ?? [])}`.trim())
  );

  // A legal that ran several weeks was saved into the library once per issue
  // — same L#, several rows. The database shows ONE file per L#: the newest
  // library copy wins. Notices without a detectable L# dedupe on their text.
  const libraryByKey = new Map<string, (typeof notices)[number]>();
  for (const n of notices) {
    const ln = parseLNumber(n.body);
    if (ln && filedLNumbers.has(ln)) continue;
    if (!ln && filedPrintBodies.has(n.body.trim())) continue;
    const key = ln ?? `body:${n.body.trim()}`;
    const kept = libraryByKey.get(key);
    if (!kept || n.created_at > kept.created_at) libraryByKey.set(key, n);
  }

  // Rate-card reference quote (adopted 10/21/2026) for every legal, historic
  // included — computed from each legal's own words and run count, so no
  // backfill is needed. Rows missing a run count show no quote.
  const rows: LegalRow[] = [
    ...legals.map((l) => ({
      kind: 'legal' as const,
      id: l.id,
      href: `/portal/all/legal-database/${l.id}`,
      created_at: l.created_at,
      customer: l.customer_name,
      body: l.body,
      l_number: l.l_number as string | null,
      notary: l.notary_required as boolean | null,
      quote: quoteLegal({
        words: wordCount(l.body),
        weeks: l.run_dates?.length || null,
        header: l.header,
        body: l.body,
        customer: l.customer_name,
      }),
    })),
    ...[...libraryByKey.values()].map((n) => {
      const parsed = parseLegalPrint(n.body);
      return {
        kind: 'notice' as const,
        id: n.id,
        href: `/portal/all/legal-database/notice/${n.id}`,
        created_at: n.created_at,
        customer: null,
        body: n.body,
        l_number: parseLNumber(n.body),
        notary: null,
        quote: quoteLegal({
          words: wordCount(parsed.copy),
          weeks: parsed.runCount || null,
          header: n.header,
          body: parsed.copy,
          customer: null,
        }),
      };
    }),
  ];

  // Sorted by L# (highest first); entries without one sink to the bottom,
  // newest first.
  rows.sort((a, b) => {
    const an = a.l_number ? parseInt(a.l_number.slice(1), 10) : -1;
    const bn = b.l_number ? parseInt(b.l_number.slice(1), 10) : -1;
    if (an !== bn) return bn - an;
    return a.created_at < b.created_at ? 1 : -1;
  });

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Legal Database"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <LegalDatabaseList rows={rows} />
    </PortalShell>
  );
}
