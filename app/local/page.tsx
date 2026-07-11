import type { Metadata } from 'next';
import { SectionFeed } from '@/components/story/section-feed';
import { getSiteOrigin } from '@/lib/site-url';

// ISR — same 60s window as the homepage / other sections. Publishing or pin
// changes trigger an explicit revalidatePath('/local').
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Local · The South Shore Press',
  description: 'Local news from across the South Shore and Suffolk County.',
  alternates: { canonical: `${getSiteOrigin()}/local` },
  openGraph: { title: 'Local', type: 'website', url: `${getSiteOrigin()}/local` },
};

export default function LocalPage() {
  return <SectionFeed slug="local" label="Local" />;
}
