import type { Metadata } from 'next';
import { requireCustomerRole } from '@/lib/auth';
import {
  getCustomerProfile,
  getLinkedAdClientId,
  getCustomerAds,
} from '@/lib/queries/customer';
import { CustomerProfileEditor } from '@/components/customer/customer-profile-editor';
import { AdPortalClient } from './ad-portal-client';

export const metadata: Metadata = {
  title: 'Ad Portal · The South Shore Press',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdPortalPage() {
  const user = await requireCustomerRole('advertiser', '/ad-portal');
  const [profile, clientId] = await Promise.all([
    getCustomerProfile(user.id),
    getLinkedAdClientId(user.id),
  ]);
  const ads = clientId ? await getCustomerAds(clientId) : [];
  const name =
    [profile.contact_name].filter(Boolean).join(' ') ||
    user.displayName ||
    user.email;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="font-headline text-3xl font-bold text-zinc-900">Hello {name}</h1>
      <div className="mt-2">
        <CustomerProfileEditor profile={profile} />
      </div>

      {clientId ? (
        <AdPortalClient ads={ads} />
      ) : (
        <div className="mt-8 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your account isn&rsquo;t linked to an advertiser file yet — please contact the paper so an
          admin can link it in the Credentials portal.
        </div>
      )}
    </div>
  );
}
