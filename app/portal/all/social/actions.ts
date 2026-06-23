'use server';

import { requireRole } from '@/lib/auth';
import { getStoryForEdit } from '@/lib/queries/editor-stories';
import { buildStoryPath } from '@/lib/slugify';
import { getSiteOrigin } from '@/lib/site-url';
import { getTwitterClient } from '@/lib/twitter/client';

const EDITOR_ROLES = ['editor', 'admin', 'master admin'] as const;
const BASE = '/portal/all/social';

type TweetResult = { ok: boolean; error?: string; url?: string };

/**
 * Publish a tweet to the South Shore Press X account. `text` is the editor's
 * copy; if `storyId` is given, the article's canonical URL is appended so X
 * unfurls the story's card (hero photo + title).
 */
export async function publishTweet(text: string, storyId?: string): Promise<TweetResult> {
  await requireRole([...EDITOR_ROLES], BASE);

  const client = getTwitterClient();
  if (!client) {
    return {
      ok: false,
      error:
        'X isn’t connected yet. Add the TWITTER_API_KEY / _SECRET / _ACCESS_TOKEN / _ACCESS_SECRET env vars in Vercel (app permissions: Read and Write), then redeploy.',
    };
  }

  let body = (text ?? '').trim();
  if (storyId) {
    const story = await getStoryForEdit(storyId);
    if (story) {
      const url = `${getSiteOrigin()}${buildStoryPath({
        id: story.id,
        headline: story.headline,
        categories: story.categories,
      })}`;
      body = body ? `${body}\n\n${url}` : url;
    }
  }

  if (!body) {
    return { ok: false, error: 'Nothing to post — enter tweet text or drop a story in the box.' };
  }

  try {
    const res = await client.v2.tweet(body);
    const id = res.data?.id;
    return { ok: true, url: id ? `https://x.com/i/web/status/${id}` : undefined };
  } catch (e) {
    console.error('[publishTweet]', e);
    return {
      ok: false,
      error:
        'X rejected the post. Confirm the API keys are valid and the app has Read + Write permission (and the tweet is ≤ 280 characters).',
    };
  }
}
