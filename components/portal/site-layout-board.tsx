'use client';

import { useMemo, useState, useTransition } from 'react';
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
import { Search, X, GripVertical } from 'lucide-react';
import { SITE_SECTIONS, SPORTS_SUBCATEGORIES } from '@/lib/site-config';
import { cn } from '@/lib/utils';
import type { EditorStoryRow } from '@/lib/queries/editor-stories';
import type { Pin } from '@/lib/queries/site-layout';
import { setPinAction, clearPinAction } from '@/app/portal/all/site-layout/actions';

/**
 * Site Layout drag-drop board.
 *
 * Layout:
 *   [ Stories list (left, ~5 cols) ] [ Slot board (right, ~7 cols) ]
 *
 * Interactions:
 *   - Drag a story chip from the left list onto a slot card → pins
 *   - Click X on a filled slot → clears the pin
 *   - Search box filters the left list; section dropdown narrows further
 *
 * Slots without pins show the next-up recency-based story as a faded
 * preview ("default: Foo") so editors can see what'll appear when
 * they don't pin.
 *
 * The slot keys + counts mirror lib/queries/site-layout.ts conventions.
 */

type SlotGroup = {
  key: string; // e.g. 'home.hero'
  title: string;
  description?: string;
  count: number;
};

const HOMEPAGE_GROUPS: ReadonlyArray<SlotGroup> = [
  {
    key: 'home.hero',
    title: 'Hero Carousel',
    description: '5 rotating stories at the top of the homepage',
    count: 5,
  },
  {
    key: 'home.top-stories',
    title: 'Top Stories Rail',
    description: '10 headlines in the right-side rail next to the hero',
    count: 10,
  },
  {
    key: 'home.video-vault',
    title: 'Video Vault Rail',
    description: '4 cards — first section under the hero',
    count: 4,
  },
  { key: 'home.local', title: 'Local Rail', count: 4 },
  { key: 'home.sports', title: 'Sports Rail', count: 4 },
  { key: 'home.opinion', title: 'Opinion Rail', count: 4 },
  { key: 'home.national', title: 'Nation Rail', count: 4 },
];

// /sports has a custom layout (recent rail + 3 sub-section blocks), so
// its slot groups don't match the generic "Top 3 stories" pattern. We
// suppress the auto-generated section.sports group and replace it with
// four explicit groups below.
const SPORTS_PAGE_GROUPS: ReadonlyArray<SlotGroup> = [
  {
    key: 'section.sports.recent',
    title: 'Sports Page — Recent Stories Rail',
    description: '10 headlines in the right-side rail on /sports',
    count: 10,
  },
  ...SPORTS_SUBCATEGORIES.map((sub) => ({
    key: `section.sports.${sub.slug}`,
    title: `Sports Page — ${sub.label} Block`,
    description: `4 stories shown 2x2 in the ${sub.label} block on /sports`,
    count: 4,
  })),
];

const SECTION_GROUPS: ReadonlyArray<SlotGroup> = [
  ...SITE_SECTIONS.filter((s) => s.slug !== 'sports').map((s) => ({
    key: `section.${s.slug}`,
    title: `${s.label} Page`,
    description: `Top 3 stories on /${s.slug}`,
    count: 3,
  })),
  ...SPORTS_PAGE_GROUPS,
];

export function SiteLayoutBoard({
  publishedStories,
  initialPins,
}: {
  publishedStories: EditorStoryRow[];
  initialPins: Pin[];
}) {
  // Local pin map indexed by `${slotKey}__${position}` for O(1) lookups.
  // We keep this in client state for optimistic UI; server actions sync
  // the DB in the background and we revert on error.
  const [pins, setPins] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const p of initialPins) {
      m[`${p.slot_key}__${p.position}`] = p.story_id;
    }
    return m;
  });

  const [dragId, setDragId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Pointer sensor with a small activation distance so plain clicks
  // (like clicking the X button on a slot) don't accidentally start a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Story-id → story lookup (used by both the list and the slots to
  // render filled tiles).
  const storyById = useMemo(() => {
    const m = new Map<string, EditorStoryRow>();
    for (const s of publishedStories) m.set(s.id, s);
    return m;
  }, [publishedStories]);

  // Filter + sort the left-side stories list.
  const visibleStories = useMemo(() => {
    let result = publishedStories;
    const needle = searchQ.trim().toLowerCase();
    if (needle) {
      result = result.filter((s) =>
        [s.headline, s.subline ?? '', s.byline ?? '', s.author?.display_name ?? '']
          .join(' ')
          .toLowerCase()
          .includes(needle)
      );
    }
    if (sectionFilter !== 'all') {
      result = result.filter((s) => s.categories?.includes(sectionFilter));
    }
    // Default reverse chronological (newest first) by publish/created time.
    return [...result].sort((a, b) => {
      const aT = new Date(a.published_at ?? a.created_at).getTime();
      const bT = new Date(b.published_at ?? b.created_at).getTime();
      return bT - aT;
    });
  }, [publishedStories, searchQ, sectionFilter]);

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
    if (!overId.startsWith('slot-')) return;
    // Format: "slot-<slotKey>-<position>"; slotKey itself can contain
    // dots, so split off the position from the right.
    const tail = overId.slice('slot-'.length);
    const lastDash = tail.lastIndexOf('-');
    if (lastDash < 0) return;
    const slotKey = tail.slice(0, lastDash);
    const position = Number(tail.slice(lastDash + 1));
    if (!Number.isFinite(position) || position < 1) return;

    const slotMapKey = `${slotKey}__${position}`;
    const prev = pins[slotMapKey];
    if (prev === storyId) return; // already there

    // Optimistic: update local state immediately, then call server.
    setPins((p) => ({ ...p, [slotMapKey]: storyId }));
    startTransition(async () => {
      const res = await setPinAction(slotKey, position, storyId);
      if (res.error) {
        setError(res.error);
        // Revert
        setPins((p) => {
          const next = { ...p };
          if (prev) next[slotMapKey] = prev;
          else delete next[slotMapKey];
          return next;
        });
      }
    });
  }

  function clearSlot(slotKey: string, position: number) {
    const slotMapKey = `${slotKey}__${position}`;
    const prev = pins[slotMapKey];
    if (!prev) return;
    setPins((p) => {
      const next = { ...p };
      delete next[slotMapKey];
      return next;
    });
    startTransition(async () => {
      const res = await clearPinAction(slotKey, position);
      if (res.error) {
        setError(res.error);
        setPins((p) => ({ ...p, [slotMapKey]: prev }));
      }
    });
  }

  const dragStory = dragId
    ? storyById.get(dragId.replace(/^story-/, ''))
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Stories list */}
        <div className="lg:col-span-5 lg:sticky lg:top-[12rem] lg:self-start lg:max-h-[80vh] lg:overflow-y-auto ssp-scroll">
          <div className="bg-white border border-zinc-200 rounded-lg">
            <div className="p-3 border-b border-zinc-200 flex flex-col gap-2 sticky top-0 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="search"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search published stories…"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="text-sm border border-zinc-300 rounded px-3 py-2 bg-white focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              >
                <option value="all">All sections</option>
                {SITE_SECTIONS.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-zinc-500">
                {visibleStories.length} published — drag any story onto a slot
              </div>
            </div>
            <ul className="divide-y divide-zinc-100">
              {visibleStories.map((s) => (
                <StoryChipDraggable key={s.id} story={s} />
              ))}
              {visibleStories.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-zinc-500">
                  No published stories match.
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {/* RIGHT: Slot board */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <SlotsSection title="Homepage" groups={HOMEPAGE_GROUPS}>
            {(group) => (
              <SlotGrid
                key={group.key}
                group={group}
                pins={pins}
                storyById={storyById}
                onClear={clearSlot}
              />
            )}
          </SlotsSection>
          <SlotsSection title="Section Pages" groups={SECTION_GROUPS}>
            {(group) => (
              <SlotGrid
                key={group.key}
                group={group}
                pins={pins}
                storyById={storyById}
                onClear={clearSlot}
              />
            )}
          </SlotsSection>
        </div>
      </div>

      {/* Drag overlay — the floating "ghost" chip that follows the cursor */}
      <DragOverlay>
        {dragStory ? <StoryChipPresentation story={dragStory} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function SlotsSection({
  title,
  groups,
  children,
}: {
  title: string;
  groups: ReadonlyArray<SlotGroup>;
  children: (group: SlotGroup) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-headline text-xl font-extrabold text-zinc-900 pb-2 mb-3 border-b border-zinc-200">
        {title}
      </h2>
      <div className="flex flex-col gap-5">{groups.map((g) => children(g))}</div>
    </section>
  );
}

function SlotGrid({
  group,
  pins,
  storyById,
  onClear,
}: {
  group: SlotGroup;
  pins: Record<string, string>;
  storyById: Map<string, EditorStoryRow>;
  onClear: (slotKey: string, position: number) => void;
}) {
  const positions = Array.from({ length: group.count }, (_, i) => i + 1);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-sm font-bold text-zinc-900">{group.title}</span>
          {group.description ? (
            <span className="ml-2 text-xs text-zinc-500">{group.description}</span>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
        {positions.map((position) => {
          const storyId = pins[`${group.key}__${position}`];
          const story = storyId ? storyById.get(storyId) : null;
          return (
            <SlotDropTarget
              key={position}
              slotKey={group.key}
              position={position}
              story={story ?? null}
              onClear={() => onClear(group.key, position)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SlotDropTarget({
  slotKey,
  position,
  story,
  onClear,
}: {
  slotKey: string;
  position: number;
  story: EditorStoryRow | null;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotKey}-${position}`,
    data: { slotKey, position },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative min-h-[78px] rounded border-2 border-dashed px-2.5 py-2 transition-colors',
        isOver
          ? 'border-brand-red bg-brand-red/5'
          : story
            ? 'border-solid border-zinc-200 bg-white'
            : 'border-zinc-200 bg-zinc-50'
      )}
    >
      <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">
        #{position}
      </div>
      {story ? (
        <>
          <div className="mt-1 text-[12px] font-medium text-zinc-900 leading-snug line-clamp-2">
            {story.headline}
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 line-clamp-1">
            {(story.categories ?? []).join(', ') || '—'}
            {story.byline ? ` · ${story.byline}` : ''}
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear slot ${position}`}
            className="absolute top-1 right-1 p-0.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <div className="mt-3 text-[11px] italic text-zinc-400">
          Drop story here
        </div>
      )}
    </div>
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

/** Visual-only chip used inside the DragOverlay (decoupled from dnd-kit
 *  hooks so it doesn't try to re-register as draggable). */
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
        'px-3 py-2 flex items-start gap-2 bg-white border border-zinc-300 rounded shadow-md max-w-sm',
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
          {story.byline ? ` · ${story.byline}` : ''}
        </div>
      </div>
    </div>
  );
}
