import type { Metadata } from 'next';

// Placeholder for the paid subscription flow. Future: tiered plans
// (digital-only, digital + print, etc) with Stripe checkout.

export const metadata: Metadata = {
  title: 'Subscribe',
  description:
    'Subscribe to The South Shore Press — digital and print options for the news your community runs on.',
};

export default function SubscribePage() {
  return (
    <section className="max-w-2xl mx-auto px-6 py-16 sm:py-24 text-center">
      <div className="text-xs uppercase tracking-widest text-brand-red font-bold">
        Subscribe
      </div>
      <h1 className="mt-3 font-headline text-3xl sm:text-4xl font-extrabold text-zinc-900">
        Support local journalism.
      </h1>
      <p className="mt-6 text-lg text-zinc-600 leading-relaxed">
        The South Shore Press is built and paid for here on Long Island.
        Paid subscriptions keep our reporters on the beat — covering town
        boards, school districts, courts, and the community news no one
        else does.
      </p>

      <div className="mt-10 inline-block bg-zinc-50 border border-zinc-200 rounded px-6 py-4">
        <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">
          Subscription plans coming soon
        </div>
        <div className="mt-1 text-sm text-zinc-700">
          We&apos;re wiring up the digital and print tiers. Check back shortly.
        </div>
      </div>
    </section>
  );
}
