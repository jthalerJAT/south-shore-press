import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyProfile } from '@/lib/queries/reader-profile';
import { AccountShell } from '@/components/account/account-shell';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = {
  title: 'My account',
  robots: { index: false, follow: false },
};

export default async function AccountProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin?next=/account');

  const profile = await getMyProfile(user.id);
  if (!profile) {
    return (
      <AccountShell
        user={{ email: user.email, firstName: null, lastName: null }}
        activeTab="profile"
      >
        <p className="text-sm text-zinc-600">
          We couldn&apos;t load your profile. Try signing out and back in.
        </p>
      </AccountShell>
    );
  }

  return (
    <AccountShell
      user={{
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
      }}
      activeTab="profile"
    >
      <ProfileForm profile={profile} />
    </AccountShell>
  );
}
