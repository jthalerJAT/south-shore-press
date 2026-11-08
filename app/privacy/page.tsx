import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How The South Shore Press collects, uses, and protects reader information, including cookies and third-party advertising.',
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

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="border-b-2 border-brand-red pb-3 mb-8">
        <h1 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: {UPDATED}</p>
      </header>

      <div className="space-y-8 text-[17px] leading-relaxed text-zinc-700">
        <p>
          The South Shore Press publishes this website for readers in Suffolk County and
          beyond. This policy explains what we collect when you visit, why we collect it,
          and the choices you have.
        </p>

        <Section title="Information you give us">
          <p>
            If you create an account, subscribe, or sign up for our email briefings, we
            collect the details you enter — your name, email address, mailing address,
            and phone number where you provide it. Subscribers also give us delivery
            information so the printed paper reaches the right door.
          </p>
          <p>
            Payments are handled by Stripe. Card numbers are entered on Stripe&apos;s
            systems and are never stored on ours; we keep only the record of what you
            subscribed to and when.
          </p>
        </Section>

        <Section title="Information collected automatically">
          <p>
            Like most websites, we record basic technical information when you read a
            page: the pages viewed, the site that referred you, and general device and
            browser details. We use this to understand which coverage readers value and
            to keep the site working.
          </p>
        </Section>

        <Section title="Cookies and advertising">
          <p>
            We use cookies to keep you signed in, remember your preferences, and measure
            readership.
          </p>
          <p>
            This site is supported by advertising. We use Google AdSense to display ads.
            Third-party vendors, including Google, use cookies to serve ads based on your
            prior visits to this and other websites.
          </p>
          <p>
            Google&apos;s use of advertising cookies enables it and its partners to serve
            ads to you based on your visits to our site and other sites on the internet.
            You may opt out of personalized advertising by visiting{' '}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-red underline"
            >
              Google Ads Settings
            </a>
            . You can also opt out of third-party vendors&apos; use of cookies for
            personalized advertising at{' '}
            <a
              href="https://www.aboutads.info/choices/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-red underline"
            >
              aboutads.info/choices
            </a>
            . More detail on how Google handles data is available at{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-red underline"
            >
              policies.google.com/technologies/partner-sites
            </a>
            .
          </p>
          <p>
            Most browsers let you block or delete cookies. Blocking them may stop you
            staying signed in or reading subscriber content.
          </p>
        </Section>

        <Section title="How we use your information">
          <p>
            We use what we collect to deliver the paper and our email briefings, to
            manage subscriptions and billing, to respond when you contact us, to measure
            readership, and to show advertising that supports our reporting.
          </p>
          <p>
            <strong>We do not sell our reader list.</strong> We share information only
            with the services that run this paper — payment processing, email delivery,
            website hosting, and advertising — and only as needed for them to do that
            work, or where the law requires it.
          </p>
        </Section>

        <Section title="Email">
          <p>
            Every briefing and marketing email includes an unsubscribe link, and we honor
            it. Subscribers still receive service messages about billing and delivery.
          </p>
        </Section>

        <Section title="Children">
          <p>
            This site is intended for a general audience and is not directed to children
            under 13. We do not knowingly collect personal information from them.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can review and update your account details at any time from your{' '}
            <Link href="/account" className="text-brand-red underline">
              account page
            </Link>
            , or ask us to correct or delete your information by writing to the address
            below. We keep subscription and billing records for as long as the law
            requires.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We will post any changes on this page and update the date above. Material
            changes will be noted in the paper or by email where appropriate.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            Questions about this policy? Write to us at{' '}
            <a href="mailto:info@southshorepress.com" className="text-brand-red underline">
              info@southshorepress.com
            </a>{' '}
            or use our{' '}
            <Link href="/contact" className="text-brand-red underline">
              contact page
            </Link>
            .
          </p>
        </Section>
      </div>
    </article>
  );
}
