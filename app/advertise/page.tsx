import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Advertise',
  description:
    'Advertise with The South Shore Press — reach thousands of readers across Long Island in print, online, and on social media.',
};

export default function AdvertisePage() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="border-b-2 border-brand-red pb-3 mb-8">
        <h1 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          Advertise with the South Shore Press
        </h1>
      </header>

      <div className="space-y-6 text-[17px] leading-relaxed text-zinc-700">
        <p>
          If you would like to run an ad in the South Shore Press, please email us at{' '}
          <a href="mailto:ads@southshorepress.com" className="text-brand-red hover:underline font-medium">
            ads@southshorepress.com
          </a>{' '}
          and we will contact you immediately.
        </p>

        <p>
          If you are looking to run a legal spot or have questions about that process, please email us at{' '}
          <a href="mailto:legals@southshorepress.com" className="text-brand-red hover:underline font-medium">
            legals@southshorepress.com
          </a>{' '}
          and someone will get right back to you.
        </p>
      </div>
    </article>
  );
}
