import type { Metadata } from 'next';
import { SectionFeed } from '@/components/story/section-feed';
import { getSiteOrigin } from '@/lib/site-url';

// ISR — same 60s window as the other sections. Publishing or pin changes
// trigger an explicit revalidatePath('/state') from their actions.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'State · The South Shore Press',
  description: 'New York State news and coverage from The South Shore Press.',
  alternates: { canonical: `${getSiteOrigin()}/state` },
  openGraph: { title: 'State', type: 'website', url: `${getSiteOrigin()}/state` },
};

export default function StatePage() {
  return <SectionFeed slug="state" label="State" />;
}
