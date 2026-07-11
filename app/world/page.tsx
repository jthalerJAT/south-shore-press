import type { Metadata } from 'next';
import { SectionFeed } from '@/components/story/section-feed';
import { getSiteOrigin } from '@/lib/site-url';

// ISR — same 60s window as the other sections. Publishing or pin changes
// trigger an explicit revalidatePath('/world') from their actions.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'World · The South Shore Press',
  description: 'World news and coverage from The South Shore Press.',
  alternates: { canonical: `${getSiteOrigin()}/world` },
  openGraph: { title: 'World', type: 'website', url: `${getSiteOrigin()}/world` },
};

export default function WorldPage() {
  return <SectionFeed slug="world" label="World" />;
}
