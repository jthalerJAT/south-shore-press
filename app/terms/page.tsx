import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern use of The South Shore Press website, subscriptions, and submitted content.',
};

const UPDATED = 'November 8, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-headline text-xl font-bold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="border-b-2 border-brand-red pb-3 mb-8">
        <h1 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: {UPDATED}</p>
      </header>

      <div className="space-y-8 text-[17px] leading-relaxed text-zinc-700">
        <p>
          These terms govern your use of southshorepress.com. By using the site, you
          agree to them.
        </p>

        <Section title="Our content">
          <p>
            The articles, photographs, graphics, and design on this site belong to The
            South Shore Press or to the writers and photographers who license their work
            to us. You are welcome to read, share links, and quote briefly with
            attribution. Republishing our work in full, whether in print or online,
            requires our written permission.
          </p>
        </Section>

        <Section title="Subscriptions and billing">
          <p>
            Paid subscriptions renew automatically at the price shown when you subscribe,
            until you cancel. You can cancel at any time from your{' '}
            <Link href="/account" className="text-brand-red underline">
              account page
            </Link>
            ; the subscription runs to the end of the period you have already paid for.
            Print delivery depends on your address being within our carrier area.
          </p>
        </Section>

        <Section title="What you submit">
          <p>
            Letters to the editor, legal notices, classified copy, and advertising
            material you send us may be published in the paper and on this site. Send
            only material you have the right to share, and expect that we may edit it for
            length, clarity, and house style. We can decline anything.
          </p>
        </Section>

        <Section title="Legal notices and advertising">
          <p>
            Advertisers and legal-notice filers are responsible for the accuracy of their
            copy, including publication dates and statutory requirements. Our liability
            for an error in a published notice or advertisement is limited to the amount
            paid for it.
          </p>
        </Section>

        <Section title="Using the site">
          <p>
            Do not attempt to break into the site, scrape it in bulk, interfere with its
            operation, or use it to break the law. Accounts exist for one reader; sharing
            subscriber credentials is not permitted.
          </p>
        </Section>

        <Section title="Accuracy and corrections">
          <p>
            We work to get it right and we correct what we get wrong. If you spot an
            error, tell us through our{' '}
            <Link href="/contact" className="text-brand-red underline">
              contact page
            </Link>
            . The site is provided as is; we do not warrant that it will always be
            available or error-free.
          </p>
        </Section>

        <Section title="Links to other sites">
          <p>
            We link to other sites and carry third-party advertising. We are not
            responsible for the content or privacy practices of those sites.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of the State of New York, and disputes
            belong in the state or federal courts serving Suffolk County.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms; the date above shows when they last changed.
            Continuing to use the site means you accept the current version. See also our{' '}
            <Link href="/privacy" className="text-brand-red underline">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>
      </div>
    </article>
  );
}
