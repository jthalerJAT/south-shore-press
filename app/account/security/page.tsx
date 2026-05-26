import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyProfile } from '@/lib/queries/reader-profile';
import { AccountShell } from '@/components/account/account-shell';
import { ChangePasswordForm } from './change-password-form';

export const metadata: Metadata = {
  title: 'Security · My account',
  robots: { index: false, follow: false },
};

export default async function AccountSecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin?next=/account/security');

  const profile = await getMyProfile(user.id);

  return (
    <AccountShell
      user={{
        email: profile?.email ?? user.email,
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
      }}
      activeTab="security"
    >
      <h2 className="font-headline text-xl font-bold text-zinc-900">
        Change password
      </h2>
      <p className="mt-1 text-sm text-zinc-600 max-w-md">
        Enter your current password followed by a new one.
      </p>

      <div className="mt-6">
        <ChangePasswordForm />
      </div>
    </AccountShell>
  );
}
