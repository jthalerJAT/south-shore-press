'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorStoryRow } from '@/lib/queries/editor-stories';
import type { NpPage, NpItemSummary } from '@/lib/queries/newspaper';
import type { Ad } from '@/lib/queries/ads';
import { isMaster, ADDABLE_TEMPLATE_KINDS, ASSIGNABLE_KINDS, pageHeading, templateFor, type NpKind } from '@/lib/newspaper-templates';
import {
  addStoryToPage,
  addAdToPage,
  addClassifiedToPage,
  addPage,
  addStandardPage,
  reorderPages,
  deletePage,
  addLegalPageAfter,
  resetIssueContent,
  reseedPages,
  setPageIncluded,
  setPageKind,
} from './actions';

/** Pre-resolved legal record for the Legals tab (server builds url + date so
 *  the client doesn't import the server-only legals query module). */
export type LegalChip = { id: string; dateLabel: string; url: string; fileName: string | null };

/** Pre-resolved classified record for the Classifieds tab (draggable). */
export type ClassifiedChip = { id: string; dateLabel: string; url: string; fileName: string | null };

type LeftTab = 'stories' | 'ads' | 'legals' | 'classifieds';

function displayTitle(page: NpPage, ordinal: number): string {
  return pageHeading(page.title, ordinal);
}

const STATUS_BADGE: Record<NpPage['status'], string> = {
  tbd: 'bg-zinc-100 text-zinc-500',
  draft: 'bg-amber-100 text-amber-800',
  locked: 'bg-emerald-100 text-emerald-800',
};

const EMPTY_DESCRIPTOR: Partial<Record<NpPage['kind'], string>> = {
  legals: 'Legal Page',
  classifieds: 'Classifieds (drop a classified)',
  fun_times: 'Fun Times Page',
  fantasy_baseball: 'Fantasy Baseball Page',
  betting_barton: 'Betting With Barton Page',
  sports: 'Sports Page',
  front: 'Front Page (template)',
  sports_cover: 'Sports Cover (template)',
  page2: 'Page 2 — OpEd (template)',
  oped_page: 'Op-Ed Page (template)',
};

export function NewspaperBoard({
  pages,
  summaries,
  stories,
  ads,
  legals,
  classifieds,
}: {
  pages: NpPage[];
  summaries: Record<string, NpItemSummary[]>;
  stories: EditorStoryRow[];
  ads: Ad[];
  legals: LegalChip[];
  classifieds: ClassifiedChip[];
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [tab, setTab] = useState<LeftTab>('stories');
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Local page order for optimistic reordering; resynced when props change.
  const [order, setOrder] = useState<NpPage[]>(pages);
  useEffect(() => setOrder(pages), [pages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const visibleStories = useMemo(() => {
    const needle = searchQ.trim().toLowerCase();
    if (!needle) return stories;
    return stories.filter((s) =>
      [s.headline, s.subline ?? '', s.byline ?? '', (s.categories ?? []).join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [stories, searchQ]);

  const visibleAds = useMemo(() => {
    const needle = searchQ.trim().toLowerCase();
    if (!needle) return ads;
    return ads.filter((a) =>
      [a.business_name, a.contact_name ?? '', a.copy_file_name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [ads, searchQ]);

  const visibleLegals = useMemo(() => {
    const needle = searchQ.trim().toLowerCase();
    if (!needle) return legals;
    return legals.filter((l) =>
      [l.dateLabel, l.fileName ?? ''].join(' ').toLowerCase().includes(needle)
    );
  }, [legals, searchQ]);

  const visibleClassifieds = useMemo(() => {
    const needle = searchQ.trim().toLowerCase();
    if (!needle) return classifieds;
    return classifieds.filter((c) =>
      [c.dateLabel, c.fileName ?? ''].join(' ').toLowerCase().includes(needle)
    );
  }, [classifieds, searchQ]);

  const dragStory = dragId?.startsWith('story-')
    ? stories.find((s) => `story-${s.id}` === dragId) ?? null
    : null;
  const dragAd = dragId?.startsWith('ad-')
    ? ads.find((a) => `ad-${a.id}` === dragId) ?? null
    : null;
  const dragClassified = dragId?.startsWith('classified-')
    ? classifieds.find((c) => `classified-${c.id}` === dragId) ?? null
    : null;

  function handleDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
    setError(null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragId(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Story chip → page (flow append or cover slot fill).
    if (activeId.startsWith('story-')) {
      const storyId = activeId.slice('story-'.length);
      const pageId = order.some((p) => p.id === overId) ? overId : null;
      if (!pageId) return;
      startTransition(async () => {
        const res = await addStoryToPage(pageId, storyId);
        if (!res.ok) setError(res.error ?? 'Could not add the story.');
        else router.refresh();
      });
      return;
    }

    // Ad chip → page (adds an ad block from the Ad Database).
    if (activeId.startsWith('ad-')) {
      const adId = activeId.slice('ad-'.length);
      const pageId = order.some((p) => p.id === overId) ? overId : null;
      if (!pageId) return;
      startTransition(async () => {
        const res = await addAdToPage(pageId, adId);
        if (!res.ok) setError(res.error ?? 'Could not add the ad.');
        else router.refresh();
      });
      return;
    }

    // Classified chip → classifieds page (assigns the uploaded file).
    if (activeId.startsWith('classified-')) {
      const classifiedId = activeId.slice('classified-'.length);
      const pageId = order.some((p) => p.id === overId) ? overId : null;
      if (!pageId) return;
      startTransition(async () => {
        const res = await addClassifiedToPage(pageId, classifiedId);
        if (!res.ok) setError(res.error ?? 'Could not add the classified.');
        else router.refresh();
      });
      return;
    }

    // Page row reorder.
    const oldIndex = order.findIndex((p) => p.id === activeId);
    const newIndex = order.findIndex((p) => p.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    startTransition(async () => {
      const res = await reorderPages(next.map((p) => p.id));
      if (!res.ok) setError(res.error ?? 'Could not reorder pages.');
      else router.refresh();
    });
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'Something went wrong.');
      else router.refresh();
    });
  }

  // Legals pages are master (protected) — but EXTRA legals pages added for
  // heavy weeks are deletable as long as the standard two remain.
  const legalsCount = useMemo(() => order.filter((p) => p.kind === 'legals').length, [order]);

  function canDeletePage(page: NpPage): boolean {
    if (!isMaster(page.kind)) return true;
    return page.kind === 'legals' && legalsCount > 2;
  }

  function handleDelete(page: NpPage, ordinal: number) {
    if (!canDeletePage(page)) return;
    if (!confirm(`Delete "${displayTitle(page, ordinal)}" and its content? This can't be undone.`)) return;
    run(() => deletePage(page.id));
  }

  function handleAddLegalPage(page: NpPage) {
    run(() => addLegalPageAfter(page.id));
  }

  function handleSetKind(page: NpPage, ordinal: number, kind: NpKind) {
    if (kind === page.kind) return;
    const label = templateFor(kind).label;
    if (
      !confirm(
        `Change "${displayTitle(page, ordinal)}" to the ${label} template? Any content already on this page may no longer appear (it isn't deleted — switch back to restore it).`
      )
    )
      return;
    run(() => setPageKind(page.id, kind));
  }

  function toggleInclude(pageId: string, included: boolean) {
    // Optimistic: update local state immediately, then persist.
    setOrder((prev) => prev.map((p) => (p.id === pageId ? { ...p, include_in_paper: included } : p)));
    startTransition(async () => {
      const res = await setPageIncluded(pageId, included);
      if (!res.ok) {
        setError(res.error ?? 'Could not update the page.');
        router.refresh();
      }
    });
  }

  function handleReset() {
    if (
      !confirm(
        'Reset content for the whole issue? This clears every page back to its blank wireframe (the page list and order are kept).'
      )
    )
      return;
    run(() => resetIssueContent());
  }

  // Rebuild is the issue's most destructive action — a native confirm() is
  // too easy to click through, so it gets a full danger modal instead.
  const [rebuildConfirmOpen, setRebuildConfirmOpen] = useState(false);

  function handleReseed() {
    setRebuildConfirmOpen(true);
  }

  function confirmReseed() {
    setRebuildConfirmOpen(false);
    run(() => reseedPages());
  }

  const pageIds = useMemo(() => order.map((p) => p.id), [order]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <p className="text-sm text-zinc-600">
        Drag a website story onto a page to add it. Use the grip handle to reorder pages. Master
        pages (e.g. the Front Page) can&apos;t be deleted.
      </p>

      {error ? (
        <div role="alert" className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT — content tabs (Stories / Ads / Legals / Classifieds) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 lg:self-start lg:max-h-[80vh] lg:overflow-y-auto">
          <div className="flex border-b border-zinc-200 mb-2">
            {(['stories', 'ads', 'legals', 'classifieds'] as LeftTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1.5 text-sm font-semibold capitalize border-b-2 -mb-px transition-colors',
                  tab === t
                    ? 'border-brand-red text-brand-red'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />

          {tab === 'stories' ? (
            <ul className="mt-2 border border-zinc-200 rounded divide-y divide-zinc-100 bg-white">
              {visibleStories.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-zinc-400">No stories found.</li>
              ) : (
                visibleStories.map((s) => <StoryChipDraggable key={s.id} story={s} />)
              )}
            </ul>
          ) : null}

          {tab === 'ads' ? (
            <ul className="mt-2 border border-zinc-200 rounded divide-y divide-zinc-100 bg-white">
              {visibleAds.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-zinc-400">
                  No ads found. Add them in the Ad Database.
                </li>
              ) : (
                visibleAds.map((a) => <AdChipDraggable key={a.id} ad={a} />)
              )}
            </ul>
          ) : null}

          {tab === 'legals' ? (
            <>
              <ul className="mt-2 border border-zinc-200 rounded divide-y divide-zinc-100 bg-white">
                {visibleLegals.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-zinc-400">
                    No legals uploaded yet.
                  </li>
                ) : (
                  visibleLegals.map((l) => <LegalRow key={l.id} legal={l} />)
                )}
              </ul>
              <p className="mt-1 text-[11px] text-zinc-400">
                Legals come from <strong>Legals Upload</strong> (reference list — click to view).
              </p>
            </>
          ) : null}

          {tab === 'classifieds' ? (
            <>
              <ul className="mt-2 border border-zinc-200 rounded divide-y divide-zinc-100 bg-white">
                {visibleClassifieds.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-zinc-400">
                    No classifieds uploaded yet.
                  </li>
                ) : (
                  visibleClassifieds.map((c) => <ClassifiedChipDraggable key={c.id} classified={c} />)
                )}
              </ul>
              <p className="mt-1 text-[11px] text-zinc-400">
                Classifieds come from <strong>Classified Upload</strong>. Drag one onto a classifieds page.
              </p>
            </>
          ) : null}
        </div>

        {/* RIGHT — pages */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-500">Pages</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAddOpen((v) => !v)}
                  disabled={isPending}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-brand-red border border-brand-red/40 hover:bg-red-50 disabled:opacity-60 rounded transition-colors"
                >
                  + Add Page ▾
                </button>
                {addOpen ? (
                  <div className="absolute right-0 z-10 mt-1 w-48 rounded border border-zinc-200 bg-white shadow-lg py-1 text-sm">
                    <button
                      type="button"
                      onClick={() => { setAddOpen(false); run(() => addPage()); }}
                      className="block w-full text-left px-3 py-1.5 hover:bg-zinc-50"
                    >
                      Blank page
                    </button>
                    {ADDABLE_TEMPLATE_KINDS.map((t) => (
                      <button
                        key={t.kind}
                        type="button"
                        onClick={() => { setAddOpen(false); run(() => addStandardPage(t.kind as NpKind)); }}
                        className="block w-full text-left px-3 py-1.5 hover:bg-zinc-50"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 rounded transition-colors"
              >
                Reset Content
              </button>
              <button
                type="button"
                onClick={handleReseed}
                disabled={isPending}
                title="Delete all pages and rebuild the standard 40-page issue skeleton"
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 rounded transition-colors"
              >
                Rebuild Pages
              </button>
              <Link
                href="/portal/all/newspaper-creator/view"
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
              >
                View File
              </Link>
              <a
                href="https://github.com/jthalerJAT/south-shore-press/actions/workflows/export-issue.yml"
                target="_blank"
                rel="noopener noreferrer"
                title="Generate the press-ready PDF/X-1a (GitHub Actions → Run workflow → download the artifact)"
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-brand-red hover:bg-red-700 rounded transition-colors"
              >
                Export Press PDF ↗
              </a>
            </div>
          </div>

          <div className="overflow-hidden rounded border border-zinc-200">
            <div className="grid grid-cols-[1.5rem_2rem_2.5rem_1fr_auto_auto_auto] items-center gap-3 px-3 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
              <div />
              <div title="Include in paper">In</div>
              <div>Pg</div>
              <div>Page Title</div>
              <div>Status</div>
              <div className="text-right">Edit</div>
              <div className="text-right">Del</div>
            </div>
            <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-zinc-100">
                {order.map((page, i) => (
                  <SortablePageRow
                    key={page.id}
                    page={page}
                    ordinal={i + 1}
                    subtitles={summaries[page.id] ?? []}
                    canDelete={canDeletePage(page)}
                    onDelete={() => handleDelete(page, i + 1)}
                    onToggleInclude={(v) => toggleInclude(page.id, v)}
                    onSetKind={(k) => handleSetKind(page, i + 1, k)}
                    onAddLegal={page.kind === 'legals' ? () => handleAddLegalPage(page) : undefined}
                  />
                ))}
              </ul>
            </SortableContext>
          </div>
        </div>
      </div>

      <DragOverlay>
        {dragStory ? <StoryChipPresentation story={dragStory} dragging /> : null}
        {dragAd ? <AdChipPresentation ad={dragAd} dragging /> : null}
        {dragClassified ? <ClassifiedChipPresentation classified={dragClassified} dragging /> : null}
      </DragOverlay>

      {rebuildConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rebuild-confirm-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200">
              <h2
                id="rebuild-confirm-title"
                className="font-headline text-xl font-bold text-red-700"
              >
                ⚠ Rebuild Pages — this deletes the whole issue
              </h2>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm text-zinc-700">
              <p className="font-semibold text-zinc-900">
                The entire page structure will be deleted — every page and everything on it:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>All placed stories, ads, legals, classifieds, and pulled Fun Stuff pages</li>
                <li>The Front Page / cover fields, section headers, and page statuses</li>
                <li>Any pages you added, renamed, reordered, or converted</li>
              </ul>
              <p>
                A fresh standard 40-page skeleton is created in their place.{' '}
                <span className="font-semibold text-red-700">This cannot be undone.</span>
              </p>
              <p className="text-zinc-500">
                If you only want to empty the pages for a new issue but keep the current page
                structure, use <span className="font-medium">Reset Content</span> instead.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRebuildConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReseed}
                className="px-4 py-2 text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Yes — delete everything and rebuild
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DndContext>
  );
}

function SortablePageRow({
  page,
  ordinal,
  subtitles,
  canDelete,
  onDelete,
  onToggleInclude,
  onSetKind,
  onAddLegal,
}: {
  page: NpPage;
  ordinal: number;
  subtitles: NpItemSummary[];
  canDelete: boolean;
  onDelete: () => void;
  onToggleInclude: (included: boolean) => void;
  onSetKind: (kind: NpKind) => void;
  /** Present on Legal Notices rows: insert another legals page after this one. */
  onAddLegal?: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging, isOver } =
    useSortable({ id: page.id });
  const included = page.include_in_paper !== false;

  // Full-ad and Fun Stuff pages keep their content in template_data, not
  // np_items, so the item-summary list is always empty for them — show what's
  // actually placed instead of the misleading "No content yet".
  const td = (page.template_data ?? {}) as {
    business_name?: string;
    file_name?: string;
    storage_path?: string;
    snapshot_path?: string;
    html?: string;
    source_label?: string;
    pulled_at?: string;
  };
  const placedAdLabel =
    page.kind === 'full_page_ad' && td.storage_path
      ? `Ad: ${td.business_name || td.file_name || 'placed'}`
      : page.kind.startsWith('fun_') && (td.snapshot_path || td.html)
        ? `Pulled from ${td.source_label ?? 'app'}${td.pulled_at ? ` — ${new Date(td.pulled_at).toLocaleDateString()}` : ''}`
        : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'grid grid-cols-[1.5rem_2rem_2.5rem_1fr_auto_auto_auto] items-start gap-3 px-3 py-3 bg-white transition-colors',
        isOver && 'bg-brand-red/5 ring-1 ring-inset ring-brand-red',
        isDragging && 'opacity-60',
        !included && 'opacity-50'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing pt-0.5"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="pt-0.5">
        <input
          type="checkbox"
          checked={included}
          onChange={(e) => onToggleInclude(e.target.checked)}
          aria-label="Include in paper"
          title="Include in paper"
          className="h-4 w-4 accent-brand-red cursor-pointer"
        />
      </div>
      <div className="text-sm font-bold text-zinc-400 pt-0.5">{ordinal}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-zinc-900 truncate">
          {displayTitle(page, ordinal)}
        </div>
        {subtitles.length > 0 ? (
          <ul className="mt-0.5">
            {subtitles.map((s, i) => (
              <li key={i} className={cn('text-[11px] text-zinc-500 truncate', s.type === 'ad' && 'italic')}>
                {s.title}
              </li>
            ))}
          </ul>
        ) : placedAdLabel ? (
          <div className="text-[11px] italic text-zinc-500 truncate">{placedAdLabel}</div>
        ) : (
          <div className="text-[11px] italic text-zinc-400">
            {EMPTY_DESCRIPTOR[page.kind] ?? 'No content yet'}
          </div>
        )}
        <PageTypeSelect kind={page.kind} onChange={onSetKind} />
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
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? 'Delete page' : 'Master page — can’t be deleted'}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded border transition-colors',
            !canDelete
              ? 'border-zinc-200 text-zinc-300 cursor-not-allowed'
              : 'border-zinc-300 text-red-600 hover:bg-red-50'
          )}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {onAddLegal ? (
          <button
            type="button"
            onClick={onAddLegal}
            title="Add another Legal Notices page after this one (for weeks with more notices than two pages fit)"
            className="inline-flex items-center justify-center w-8 h-8 rounded border border-zinc-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** Per-row page-type selector — converts a page to another template/layout
 *  kind. Shows the current kind even when it isn't an assignable option (e.g.
 *  the seeded covers). */
function PageTypeSelect({ kind, onChange }: { kind: NpKind; onChange: (k: NpKind) => void }) {
  const inList = ASSIGNABLE_KINDS.some((o) => o.kind === kind);
  return (
    <select
      value={kind}
      onChange={(e) => onChange(e.target.value as NpKind)}
      title="Page type / template"
      className="mt-1 text-[11px] text-zinc-500 bg-transparent border border-zinc-200 rounded px-1 py-0.5 max-w-full focus:border-brand-red focus:outline-none"
    >
      {!inList ? <option value={kind}>{templateFor(kind).label}</option> : null}
      {ASSIGNABLE_KINDS.map((o) => (
        <option key={o.kind} value={o.kind}>
          {o.label}
        </option>
      ))}
    </select>
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

function StoryChipPresentation({ story, dragging }: { story: EditorStoryRow; dragging?: boolean }) {
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

function AdChipDraggable({ ad }: { ad: Ad }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ad-${ad.id}`,
    data: { ad },
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
        <div className="text-[13px] font-medium text-zinc-900 truncate">{ad.business_name}</div>
        <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
          {ad.copy_file_name || (ad.copy_storage_path ? 'Copy on file' : 'No copy')}
        </div>
      </div>
    </li>
  );
}

function AdChipPresentation({ ad, dragging }: { ad: Ad; dragging?: boolean }) {
  return (
    <div
      className={cn(
        'px-3 py-2 flex items-start gap-2 bg-white border border-brand-red rounded shadow-lg w-72',
        dragging && 'cursor-grabbing'
      )}
    >
      <GripVertical className="w-4 h-4 text-zinc-300 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-zinc-900 truncate">{ad.business_name}</div>
        <div className="mt-0.5 text-[11px] text-zinc-500 truncate">{ad.copy_file_name || 'Ad'}</div>
      </div>
    </div>
  );
}

function ClassifiedChipDraggable({ classified }: { classified: ClassifiedChip }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `classified-${classified.id}`,
    data: { classified },
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
        <div className="text-[13px] font-medium text-zinc-900 truncate">{classified.dateLabel}</div>
        <div className="mt-0.5 text-[11px] text-zinc-500 truncate">{classified.fileName || 'Classified PDF'}</div>
      </div>
    </li>
  );
}

function ClassifiedChipPresentation({ classified, dragging }: { classified: ClassifiedChip; dragging?: boolean }) {
  return (
    <div
      className={cn(
        'px-3 py-2 flex items-start gap-2 bg-white border border-brand-red rounded shadow-lg w-72',
        dragging && 'cursor-grabbing'
      )}
    >
      <GripVertical className="w-4 h-4 text-zinc-300 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-zinc-900 truncate">{classified.dateLabel}</div>
        <div className="mt-0.5 text-[11px] text-zinc-500 truncate">{classified.fileName || 'Classified PDF'}</div>
      </div>
    </div>
  );
}

function LegalRow({ legal }: { legal: LegalChip }) {
  return (
    <li className="px-3 py-2 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-zinc-900 truncate">{legal.dateLabel}</div>
        {legal.fileName ? (
          <div className="text-[11px] text-zinc-500 truncate">{legal.fileName}</div>
        ) : null}
      </div>
      <a
        href={legal.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-brand-red hover:underline shrink-0"
      >
        View
      </a>
    </li>
  );
}
