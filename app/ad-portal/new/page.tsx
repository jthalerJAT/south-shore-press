import type { Metadata } from 'next';
import { requireCustomerRole } from '@/lib/auth';
import { NewAdForm } from './new-ad-form';

export const metadata: Metadata = {
  title: 'New Ad · Ad Portal',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewCustomerAdPage() {
  await requireCustomerRole('advertiser', '/ad-portal/new');
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-headline text-2xl font-bold text-zinc-900">New Ad</h1>
      <div className="mt-6">
        <NewAdForm />
      </div>
    </div>
  );
}
