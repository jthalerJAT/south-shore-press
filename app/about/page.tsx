import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'For 30 years, The South Shore Press has been a trusted voice in Suffolk County — covering the news, sports, and politics that shape life across our communities.',
};

export default function AboutPage() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="border-b-2 border-brand-red pb-3 mb-8">
        <h1 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          About the South Shore Press
        </h1>
      </header>

      <div className="space-y-6 text-[17px] leading-relaxed text-zinc-700">
        <p>
          For 30 years, the South Shore Press has been a trusted voice in
          Suffolk County — covering the news, sports, and politics that shape
          life across our communities. From local government to the Friday night
          games, we’ve told the stories that matter to the people who live here.
        </p>

        <p>
          In 2023, new ownership took the helm and brought with it a significant
          investment in the future of this publication. Rooted in Brookhaven and
          deeply involved in the life of the community we serve, our ownership
          understands that a newspaper is only as strong as its connection to the
          people who read it. That local commitment now reaches farther than
          ever, as the South Shore Press has expanded its coverage to bring our
          readers global news alongside the hometown reporting they’ve always
          counted on.
        </p>

        <p>
          We believe in the essential role of a free and independent press.
          Democracy depends on an informed electorate — voters who have the facts
          they need to decide who will lead them. That responsibility guides
          everything we do.
        </p>

        <p>
          The conventional wisdom says traditional media is a dying business.
          Across the country, local newspapers have closed their doors or cut
          their newsrooms to the point where they can no longer cover the
          communities that depend on them. We reject that fate. The South Shore
          Press is committed to investing in real journalism — in reporters, in
          resources, and in the hard work of covering our region with the depth
          it deserves — so that the communities we serve are never left in the
          dark.
        </p>

        <p className="text-xl font-medium text-zinc-900">
          This is more than a newspaper. It’s a promise to keep showing up, keep
          asking questions, and keep telling the truth.
        </p>

        <p>
          None of this is possible without our subscribers. When you subscribe to
          the South Shore Press, you’re not just buying a paper — you’re
          investing in independent journalism and helping sustain the mission
          that keeps our communities informed. We are sincerely grateful to every
          reader who stands with us. Thank you for making this work possible.
        </p>
      </div>

      <div className="mt-10 pt-8 border-t border-zinc-200">
        <Link
          href="/subscribe"
          className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
        >
          Subscribe to the South Shore Press
        </Link>
      </div>
    </article>
  );
}
