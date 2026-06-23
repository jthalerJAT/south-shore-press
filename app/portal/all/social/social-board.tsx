'use client';

/**
 * Social Media tool. Left: the reverse-chron story list (draggable, searchable).
 * Right: X / YouTube / Instagram tabs. The X tab composes a tweet — type the
 * copy, drag a story into the "Create New Tweet" box to attach its link (which
 * X unfurls into the article card), then Publish Tweet posts to the SSP account.
 * YouTube + Instagram are placeholders for now.
 */
import { useMemo, useState } from 'react';
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
import { GripVertical, X as XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorStoryRow } from '@/lib/queries/editor-stories';
import { publishTweet } from './actions';

type Tab = 'x' | 'youtube' | 'instagram';
const TWEET_MAX = 280;
const URL_WEIGHT = 23; // X counts any link as 23 chars (t.co), + a blank line.

export function SocialBoard({
  stories,
  twitterEnabled,
}: {
  stories: EditorStoryRow[];
  twitterEnabled: boolean;
}) {
  const [tab, setTab] = useState<Tab>('x');
  const [searchQ, setSearchQ] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [attached, setAttached] = useState<EditorStoryRow | null>(null);
  const [text, setText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string; url?: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  const dragStory = dragId ? stories.find((s) => `story-${s.id}` === dragId) ?? null : null;

  function handleDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }
  function handleDragEnd(e: DragEndEvent) {
    setDragId(null);
    const { active, over } = e;
    if (!over || over.id !== 'tweet-dropzone') return;
    const id = String(active.id);
    if (!id.startsWith('story-')) return;
    const story = stories.find((s) => `story-${s.id}` === id);
    if (story) {
      setAttached(story);
      setResult(null);
    }
  }

  const used = text.length + (attached ? URL_WEIGHT + 2 : 0);
  const remaining = TWEET_MAX - used;
  const canPublish = !publishing && (text.trim().length > 0 || attached) && remaining >= 0;

  async function handlePublish() {
    setPublishing(true);
    setResult(null);
    const res = await publishTweet(text, attached?.id);
    setPublishing(false);
    setResult(res);
    if (res.ok) {
      setText('');
      setAttached(null);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT — story list */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 lg:self-start lg:max-h-[80vh] lg:overflow-y-auto">
          <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Stories</h3>
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search stories…"
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
          <ul className="mt-2 border border-zinc-200 rounded divide-y divide-zinc-100 bg-white">
            {visibleStories.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-zinc-400">No stories found.</li>
            ) : (
              visibleStories.map((s) => <StoryChip key={s.id} story={s} />)
            )}
          </ul>
        </div>

        {/* RIGHT — channel tabs */}
        <div className="lg:col-span-7">
          <div className="flex border-b border-zinc-200 mb-4">
            {(['x', 'youtube', 'instagram'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
                  tab === t
                    ? 'border-brand-red text-brand-red'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                )}
              >
                {t === 'x' ? 'X' : t === 'youtube' ? 'YouTube' : 'Instagram'}
              </button>
            ))}
          </div>

          {tab === 'x' ? (
            <div className="space-y-4 max-w-xl">
              {!twitterEnabled ? (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  X isn’t connected yet. Publishing will work once the SSP X API keys are added in Vercel
                  (you can still compose here).
                </div>
              ) : null}

              <div>
                <label htmlFor="tweet-text" className="block text-sm font-medium text-zinc-700 mb-1">
                  Tweet text
                </label>
                <textarea
                  id="tweet-text"
                  rows={4}
                  value={text}
                  onChange={(e) => { setText(e.target.value); setResult(null); }}
                  placeholder="Write the post… the attached story's link is added automatically."
                  className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
                <div className={cn('mt-1 text-right text-xs', remaining < 0 ? 'text-red-600' : 'text-zinc-400')}>
                  {remaining} characters left
                </div>
              </div>

              <TweetDropzone attached={attached} onClear={() => setAttached(null)} />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={!canPublish}
                  className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
                >
                  {publishing ? 'Publishing…' : 'Publish Tweet'}
                </button>
                {result?.ok ? (
                  <span className="text-sm text-emerald-700">
                    Posted.{' '}
                    {result.url ? (
                      <a href={result.url} target="_blank" rel="noopener noreferrer" className="underline">
                        View on X
                      </a>
                    ) : null}
                  </span>
                ) : null}
              </div>
              {result && !result.ok ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {result.error}
                </div>
              ) : null}
            </div>
          ) : (
            <ComingSoon channel={tab === 'youtube' ? 'YouTube' : 'Instagram'} />
          )}
        </div>
      </div>

      <DragOverlay>{dragStory ? <StoryChipPresentation story={dragStory} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function TweetDropzone({ attached, onClear }: { attached: EditorStoryRow | null; onClear: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'tweet-dropzone' });
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">Create New Tweet</label>
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-lg border-2 border-dashed px-4 py-6 transition-colors',
          isOver ? 'border-brand-red bg-brand-red/5' : 'border-zinc-300 bg-white'
        )}
      >
        {attached ? (
          <div className="flex items-start gap-3">
            {attached.hero_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attached.hero_photo_url} alt="" className="w-20 h-20 object-cover rounded bg-zinc-100 shrink-0" />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-zinc-900">{attached.headline}</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">Article link + card will be attached.</div>
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label="Remove attached story"
              className="text-zinc-400 hover:text-red-600 shrink-0"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-zinc-400">Drag a story here to attach it to the tweet.</p>
        )}
      </div>
    </div>
  );
}

function ComingSoon({ channel }: { channel: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
      <div className="text-lg font-semibold text-zinc-700">{channel}</div>
      <div className="mt-1 text-sm text-zinc-400">Coming Soon</div>
    </div>
  );
}

function StoryChip({ story }: { story: EditorStoryRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `story-${story.id}` });
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
        <div className="text-[13px] font-medium text-zinc-900 line-clamp-2 leading-snug">{story.headline}</div>
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
        <div className="text-[13px] font-medium text-zinc-900 line-clamp-2 leading-snug">{story.headline}</div>
      </div>
    </div>
  );
}
