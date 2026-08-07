import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCustomerRole } from '@/lib/auth';
import { getCustomerProfile, getCustomerLegals } from '@/lib/queries/customer';
import { CustomerProfileEditor } from '@/components/customer/customer-profile-editor';

export const metadata: Metadata = {
  title: 'Legal Portal · The South Shore Press',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function firstWords(s: string, n = 10): string {
  const words = s.trim().split(/\s+/);
  return words.slice(0, n).join(' ') + (words.length > n ? '…' : '');
}

export default async function LegalPortalPage() {
  const user = await requireCustomerRole('legal', '/legal-portal');
  const [profile, legals] = await Promise.all([
    getCustomerProfile(user.id),
    getCustomerLegals(user.id),
  ]);
  const name = profile.contact_name || user.displayName || user.email;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="font-headline text-3xl font-bold text-zinc-900">Hello {name}</h1>
      <div className="mt-2">
        <CustomerProfileEditor profile={profile} />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest font-bold text-zinc-500">Your Legals</h2>
          <Link
            href="/legal-portal/new"
            className="inline-flex items-center px-3 py-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold rounded transition-colors"
          >
            + Insert New Legal
          </Link>
        </div>

        <div className="overflow-hidden rounded border border-zinc-200 bg-white">
          <div className="grid grid-cols-[8rem_1fr_7rem] items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
            <div>Date</div>
            <div>Copy</div>
            <div>L#</div>
          </div>
          {legals.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">
              No legals yet — use &ldquo;+ Insert New Legal&rdquo; to submit your first one.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {legals.map((l) => (
                <li
                  key={l.id}
                  className="grid grid-cols-[8rem_1fr_7rem] items-center gap-3 px-4 py-3"
                >
                  <div className="text-sm text-zinc-500">{fmtDate(l.created_at)}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">{l.header}</div>
                    <div className="text-xs text-zinc-500 truncate">{firstWords(l.body)}</div>
                  </div>
                  <div className="text-sm font-mono text-zinc-700">{l.l_number}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
