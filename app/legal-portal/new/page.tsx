import type { Metadata } from 'next';
import { requireCustomerRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NewLegalForm } from './new-legal-form';

export const metadata: Metadata = {
  title: 'New Legal · Legal Portal',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewCustomerLegalPage() {
  await requireCustomerRole('legal', '/legal-portal/new');

  // Reserve the L# now so the form can display it and the preview can print
  // it. Drawn from a Postgres sequence, so two customers loading this page at
  // the same moment get different numbers — abandoned forms simply leave a
  // gap, never a duplicate. (Collisions on save regenerate server-side too.)
  let lNumber = '';
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc('next_legal_number');
    lNumber = String(data ?? '');
  } catch (err) {
    console.error('[NewCustomerLegalPage] reserve L#', err);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="font-headline text-2xl font-bold text-zinc-900">New Legal</h1>
      <div className="mt-6">
        <NewLegalForm reservedLNumber={lNumber} />
      </div>
    </div>
  );
}
