'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorStoryRow } from '@/lib/queries/editor-stories';
import type { NpPage } from '@/lib/queries/newspaper';
import { templateFor } from '@/lib/newspaper-templates';
import { addStoryToPage, addPage } from './actions';

function displayTitle(page: NpPage, ordinal: number): string {
  return page.kind === 'generic' ? `Page ${ordinal}` : page.title;
}

const STATUS_BADGE: Record<NpPage['status'], string> = {
  tbd: 'bg-zinc-100 text-zinc-500',
  draft: 'bg-amber-100 text-amber-800',
  locked: 'bg-emerald-100 text-emerald-800',
};

export function NewspaperBoard({
  pages,
  counts,
  stories,
}: {
  pages: NpPage[];
  counts: Record<string, number>;
  stories: EditorStoryRow[];
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const visibleStories = useMemo(() => {
    const needle = searchQ.trim().toLowerCase();
    let result = stories;
    if (needle) {
      result = result.filter((s) =>
        [s.headline, s.subline ?? '', s.byline ?? '', (s.categories ?? []).join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      );
    }
    return result;
  }, [stories, searchQ]);

  const dragStory = dragId
    ? stories.find((s) => `story-${s.id}` === dragId) ?? null
    : null;

  function handleDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
    setError(null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragId(null);
    const { active, over } = e;
    if (!over) return;
    const storyId = String(active.id).replace(/^story-/, '');
    const overId = String(over.id);
    if (!overId.startsWith('page-')) return;
    const pageId = overId.slice('page-'.length);

    startTransition(async () => {
      const res = await addStoryToPage(pageId, storyId);
      if (!res.ok) setError(res.error ?? 'Could not add the story.');
      else router.refresh();
    });
  }

  function handleAddPage() {
    setError(null);
    startTransition(async () => {
      const res = await addPage();
      if (!res.ok) setError(res.error ?? 'Could not add a page.');
      else router.refresh();
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <p className="text-sm text-zinc-600">
        Drag a website story onto a page to add it (as an independent print
        copy), then click <strong>Edit Page</strong> to lay out and edit its
        content.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT — website stories */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 lg:self-start lg:max-h-[80vh] lg:overflow-y-auto">
          <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">
            Website Stories
          </h3>
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search stories…"
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
          <ul className="mt-2 border border-zinc-200 rounded divide-y divide-zinc-100 bg-white">
            {visibleStories.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-zinc-400">
                No stories found.
              </li>
            ) : (
              visibleStories.map((s) => <StoryChipDraggable key={s.id} story={s} />)
            )}
          </ul>
        </div>

        {/* RIGHT — pages */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-500">
              Pages
            </h3>
            <button
              type="button"
              onClick={handleAddPage}
              disabled={isPending}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-brand-red border border-brand-red/40 hover:bg-red-50 disabled:opacity-60 rounded transition-colors"
            >
              + Add New Page
            </button>
          </div>

          <div className="overflow-hidden rounded border border-zinc-200">
            <div className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 px-3 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
              <div>Pg #</div>
              <div>Page Title</div>
              <div>Status</div>
              <div className="text-right">Edit</div>
            </div>
            <ul className="divide-y divide-zinc-100">
              {pages.map((page, i) => (
                <PageRow
                  key={page.id}
                  page={page}
                  ordinal={i + 1}
                  count={counts[page.id] ?? 0}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>

      <DragOverlay>
        {dragStory ? <StoryChipPresentation story={dragStory} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function PageRow({
  page,
  ordinal,
  count,
}: {
  page: NpPage;
  ordinal: number;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `page-${page.id}` });
  const tmpl = templateFor(page.kind);
  const slotInfo =
    tmpl.slots === 'open'
      ? `${count} ${count === 1 ? 'item' : 'items'}`
      : `${count}/${tmpl.slots.length} tiles`;

  return (
    <li
      ref={setNodeRef}
      className={cn(
        'grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 px-3 py-3 transition-colors',
        isOver ? 'bg-brand-red/5 ring-1 ring-inset ring-brand-red' : 'bg-white'
      )}
    >
      <div className="text-sm font-bold text-zinc-400">{ordinal}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-zinc-900 truncate">
          {displayTitle(page, ordinal)}
        </div>
        <div className="text-[11px] text-zinc-500">{slotInfo}</div>
      </div>
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold',
          STATUS_BADGE[page.status]
        )}
      >
        {page.status === 'tbd' ? 'TBD' : page.status}
      </span>
      <Link
        href={`/portal/all/newspaper-creator/${page.id}`}
        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
      >
        Edit Page
      </Link>
    </li>
  );
}

function StoryChipDraggable({ story }: { story: EditorStoryRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `story-${story.id}`,
    data: { story },
  });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'px-3 py-2 cursor-grab active:cursor-grabbing flex items-start gap-2 hover:bg-zinc-50 transition-colors',
        isDragging && 'opacity-30'
      )}
    >
      <GripVertical className="w-4 h-4 text-zinc-300 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-zinc-900 line-clamp-2 leading-snug">
          {story.headline}
        </div>
        <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
          {(story.categories ?? []).join(', ') || '—'}
          {story.byline ? ` · ${story.byline}` : ''}
        </div>
      </div>
    </li>
  );
}

function StoryChipPresentation({
  story,
  dragging,
}: {
  story: EditorStoryRow;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        'px-3 py-2 flex items-start gap-2 bg-white border border-brand-red rounded shadow-lg w-72',
        dragging && 'cursor-grabbing'
      )}
    >
      <GripVertical className="w-4 h-4 text-zinc-300 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-zinc-900 line-clamp-2 leading-snug">
          {story.headline}
        </div>
        <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
          {(story.categories ?? []).join(', ') || '—'}
        </div>
      </div>
    </div>
  );
}
