import type { Metadata } from 'next';
import { SectionFeed } from '@/components/story/section-feed';
import { getSiteOrigin } from '@/lib/site-url';

// ISR — same 60s window as the other sections. Publishing or pin changes
// trigger an explicit revalidatePath('/national') from their actions.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Nation · The South Shore Press',
  description: 'National news and coverage from The South Shore Press.',
  alternates: { canonical: `${getSiteOrigin()}/national` },
  openGraph: { title: 'Nation', type: 'website', url: `${getSiteOrigin()}/national` },
};

export default function NationalPage() {
  return <SectionFeed slug="national" label="Nation" />;
}
