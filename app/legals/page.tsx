import type { Metadata } from 'next';
import { getLegalsList, legalPublicUrl, formatLegalDate } from '@/lib/queries/legals';
import { LegalsViewer } from './legals-viewer';

export const metadata: Metadata = {
  title: 'Legals',
  description:
    'Legal notices and public records published in The South Shore Press, covering all of Suffolk County.',
};

// Reflect newly uploaded/removed legals promptly; the portal actions also
// call revalidatePath('/legals').
export const revalidate = 60;

export type LegalViewItem = {
  id: string;
  iso: string;
  dateLabel: string;
  url: string;
  fileName: string;
};

export default async function LegalsPage() {
  const legals = await getLegalsList();
  const items: LegalViewItem[] = legals.map((l) => ({
    id: l.id,
    iso: l.legal_date,
    dateLabel: formatLegalDate(l.legal_date),
    url: legalPublicUrl(l.storage_path),
    fileName: l.file_name || `legal-${l.legal_date}.pdf`,
  }));

  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="border-b-2 border-brand-red pb-3 mb-8">
        <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
          Public Notices
        </div>
        <h1 className="mt-1 font-headline text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          Legals
        </h1>
      </header>

      <LegalsViewer legals={items} />
    </div>
  );
}
