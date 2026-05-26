import { requireUser } from '@/lib/auth';

/**
 * /account/* layout — gates the entire account section behind an
 * authenticated session. Anonymous visitors are sent to /signin with
 * a ?next pointing back here.
 *
 * The actual page chrome (tab nav, sign-out) is rendered per-page via
 * <AccountShell>, NOT here, because the active-tab marker depends on
 * the route.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser('/account');
  return <>{children}</>;
}
