import type { Metadata } from 'next';
import Link from 'next/link';
import { RequestForm } from './request-form';

export const metadata: Metadata = {
  title: 'Request a Notarized Copy',
  robots: { index: false, follow: false },
};

export default function RequestNotarizedCopyPage({
  searchParams,
}: {
  searchParams: { legalId?: string; date?: string };
}) {
  const legalId = searchParams.legalId ?? '';
  const date = searchParams.date ?? '';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/legals" className="text-sm font-medium text-brand-red hover:underline">
        ← Back to Legals
      </Link>
      <h1 className="mt-3 font-headline text-3xl sm:text-4xl font-bold text-zinc-900">
        Request a Notarized Copy
      </h1>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Need a notarized copy of a legal notice? Fill out the form below and our
        team will follow up with the details.
      </p>

      <div className="mt-8">
        <RequestForm
          legalId={legalId}
          defaultLegalAd={date ? `Legal notice dated ${date}` : ''}
        />
      </div>
    </div>
  );
}
