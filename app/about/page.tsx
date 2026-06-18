import type { Metadata } from 'next';
import type { ReactNode } from 'react';
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

      <div className="mt-12 pt-8 border-t border-zinc-200 space-y-7 text-[17px] leading-relaxed text-zinc-700">
        <ContactSection title="Questions or Comments?">
          <p>
            You can reach us at{' '}
            <a href="mailto:news@southshorepress.com" className="text-brand-red hover:underline font-medium">
              news@southshorepress.com
            </a>
            , or at{' '}
            <a href="tel:+16312137901" className="text-brand-red hover:underline font-medium">
              (631) 213-7901
            </a>
            .
          </p>
        </ContactSection>

        <ContactSection title="Social Media">
          <p>Breaking news will always be posted on our website and multiple social media platforms.</p>
          <p>
            Visit us on Twitter: <span className="font-medium text-zinc-900">@SSPNewsroom</span>
          </p>
          <p>
            Stories are also shared on our Facebook page:{' '}
            <span className="font-medium text-zinc-900">@TheSouthShorePress</span>
          </p>
        </ContactSection>

        <ContactSection title="News">
          <p>
            If you have a press release or news story idea to send us, please contact us at{' '}
            <a href="mailto:news@SouthShorePress.com" className="text-brand-red hover:underline font-medium">
              news@SouthShorePress.com
            </a>
            .
          </p>
        </ContactSection>

        <ContactSection title="Sports">
          <p>
            Sports coverage, especially local and high school sports, is really important to you. That makes it
            important to us. Please feel free to send sports scores or sports stories you want us to cover at{' '}
            <a href="mailto:sports@SouthShorePress.com" className="text-brand-red hover:underline font-medium">
              sports@SouthShorePress.com
            </a>
          </p>
        </ContactSection>

        <ContactSection title="Advertising">
          <p>
            We offer multiple platforms for you to partner with the South Shore Press and get your message heard.
            Our packages include ad placement on our news website, social media platforms, podcasts, and the
            newspaper itself that is distributed to thousands of people across Long Island. To advertise please
            email us at:{' '}
            <a href="mailto:ads@SouthShorePress.com" className="text-brand-red hover:underline font-medium">
              ads@SouthShorePress.com
            </a>
          </p>
        </ContactSection>

        <ContactSection title="Make Some Cash">
          <p>
            If you’re a highly motivated self-starter with sales experience, and want to be a part of our growing
            multi-media company, please touch base and send us an email:{' '}
            <a href="mailto:sales@SouthShorePress.com" className="text-brand-red hover:underline font-medium">
              sales@SouthShorePress.com
            </a>
          </p>
        </ContactSection>
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

function ContactSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-headline text-lg font-bold uppercase tracking-wide text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}
