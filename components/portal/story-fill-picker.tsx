'use client';

import { useState } from 'react';
import { SITE_SECTIONS } from '@/lib/site-config';

/**
 * StoryFillPicker — the "Fill from story" control used across the newspaper
 * editors. Adds a "Fill From Section" dropdown above it: choose a section (or
 * "All Sections", the default) and the story dropdown below is filtered to
 * stories tagged with that section.
 */
export type FillStoryOption = { id: string; headline: string; categories?: string[] | null };

export function StoryFillPicker({
  stories,
  onPick,
  compact = false,
}: {
  stories: FillStoryOption[];
  onPick: (storyId: string) => void;
  /** Tighter spacing for cramped spots (e.g. cover tiles). */
  compact?: boolean;
}) {
  const [section, setSection] = useState('');
  const filtered = section
    ? stories.filter((s) => (s.categories ?? []).includes(section))
    : stories;
  const sel =
    'block w-full rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 focus:border-brand-red focus:outline-none';

  return (
    <div className={compact ? '' : 'mb-1'}>
      <select
        value={section}
        onChange={(e) => setSection(e.target.value)}
        className={`${sel} mb-1`}
        aria-label="Fill from section"
      >
        <option value="">All Sections</option>
        {SITE_SECTIONS.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
          e.target.value = '';
        }}
        className={sel}
        aria-label="Fill from story"
      >
        <option value="">{filtered.length ? 'Fill from story…' : 'No stories in this section'}</option>
        {filtered.map((s) => (
          <option key={s.id} value={s.id}>
            {s.headline.length > 60 ? s.headline.slice(0, 57) + '…' : s.headline}
          </option>
        ))}
      </select>
    </div>
  );
}
