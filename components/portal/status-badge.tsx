import { cn } from '@/lib/utils';

type Status = 'draft' | 'submitted' | 'published' | 'unpublished';

const STYLES: Record<Status, string> = {
  draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  submitted: 'bg-amber-50 text-amber-800 border-amber-200',
  published: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  unpublished: 'bg-red-50 text-red-800 border-red-200',
};

const LABELS: Record<Status, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  published: 'Published',
  unpublished: 'Unpublished',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        'inline-block text-[10px] uppercase tracking-widest font-semibold border rounded px-1.5 py-0.5',
        STYLES[status]
      )}
    >
      {LABELS[status]}
    </span>
  );
}
