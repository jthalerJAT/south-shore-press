import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAllCustomerLegals } from '@/lib/queries/customer';
import { getLegalNotices } from '@/lib/queries/legal-notices';
import { legalFooterLine } from '@/lib/legal-dates';
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
  const [legals, notices] = await Promise.all([getAllCustomerLegals(), getLegalNotices()]);

  // One merged list: filed legals (customer_legals) plus the Legal Notices
  // library the newspaper creator places from. Library rows that are just
  // mirrors of a filed legal (same L# or same print text) are hidden so each
  // legal appears once, as its richer editable record.
  const filedLNumbers = new Set(legals.map((l) => l.l_number));
  const filedPrintBodies = new Set(
    legals.map((l) => `${l.body}\n${legalFooterLine(l.l_number, l.run_dates ?? [])}`.trim())
  );

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
    })),
    ...notices
      .filter((n) => {
        const ln = parseLNumber(n.body);
        if (ln && filedLNumbers.has(ln)) return false;
        return !filedPrintBodies.has(n.body.trim());
      })
      .map((n) => ({
        kind: 'notice' as const,
        id: n.id,
        href: `/portal/all/legal-database/notice/${n.id}`,
        created_at: n.created_at,
        customer: null,
        body: n.body,
        l_number: parseLNumber(n.body),
        notary: null,
      })),
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
