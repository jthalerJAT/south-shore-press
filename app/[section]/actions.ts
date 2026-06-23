'use server';

import { getPublishedStoriesBySectionRange, type StoryListItem } from '@/lib/queries/stories';
import { SITE_SECTIONS } from '@/lib/site-config';

const VALID_SECTIONS = new Set(SITE_SECTIONS.map((s) => s.slug));

/** "Load More" on a section page — return the next page of published stories.
 *  Public (these are all published, reader-visible). The section is validated
 *  against the known list so arbitrary tags can't be enumerated. */
export async function loadMoreSection(
  section: string,
  offset: number,
  limit: number
): Promise<StoryListItem[]> {
  if (!VALID_SECTIONS.has(section)) return [];
  const safeOffset = Math.max(0, Math.floor(offset) || 0);
  const safeLimit = Math.min(48, Math.max(1, Math.floor(limit) || 24));
  return getPublishedStoriesBySectionRange(section, safeOffset, safeLimit);
}
