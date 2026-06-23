/**
 * Page 4 ("Op-Ed Page") template data — stored in np_pages.template_data. The
 * layout is a full-width TOP article (blue section flag + headline + top byline
 * + photo), then a bottom row split into a QUARTER-PAGE AD (lower-left) and a
 * 2-column BOTTOM article (lower-right) whose dividing line aligns with the top
 * of the ad. Pure helpers, safe on server + client.
 */

/** Section labels the blue flag can be set to (free text also allowed). */
export const PAGE_FLAG_OPTIONS = ['OP-ED', 'LOCAL', 'NATION'] as const;

/** Column defaults matching the 2026-06-17 printed page 4. */
export const PAGE_FOUR_TOP_COLUMNS = 3;
export const PAGE_FOUR_BOTTOM_COLUMNS = 2;

export type PageFourArticle = {
  /** Blue section flag word (OP-ED / LOCAL / NATION, or blank for none). */
  flag_label?: string;
  headline?: string;
  author?: string;
  text?: string;
  photo_url?: string;
  photo_caption?: string;
  photo_credit?: string;
  /** Body column count. */
  columns?: number;
};

export type PageFourAd = {
  /** Source Ad Database row id (reference only). */
  ad_id?: string;
  /** Creative in the newspaper-ads bucket. */
  storage_path?: string;
  file_name?: string;
} | null;

export type PageFourData = {
  v: 1;
  top: PageFourArticle;
  ad: PageFourAd;
  bottom: PageFourArticle;
  /** Multiplier on embedded photo heights (1 = default) — "adjust to fit". */
  photo_scale?: number;
  /** Multiplier on vertical spacing between blocks (1 = default; floored). */
  space_scale?: number;
};

export function defaultPageFour(): PageFourData {
  return {
    v: 1,
    top: { flag_label: 'OP-ED', columns: PAGE_FOUR_TOP_COLUMNS },
    ad: null,
    bottom: { flag_label: 'OP-ED', columns: PAGE_FOUR_BOTTOM_COLUMNS },
    photo_scale: 1,
    space_scale: 1,
  };
}

function normArticle(raw: Partial<PageFourArticle> | undefined, defCols: number, defFlag: string): PageFourArticle {
  const r = raw ?? {};
  return {
    flag_label: r.flag_label ?? defFlag,
    headline: r.headline,
    author: r.author,
    text: r.text,
    photo_url: r.photo_url,
    photo_caption: r.photo_caption,
    photo_credit: r.photo_credit,
    columns: typeof r.columns === 'number' ? r.columns : defCols,
  };
}

export function normalizePageFour(raw: unknown): PageFourData {
  if (!raw || typeof raw !== 'object') return defaultPageFour();
  const r = raw as Partial<PageFourData>;
  return {
    v: 1,
    top: normArticle(r.top, PAGE_FOUR_TOP_COLUMNS, 'OP-ED'),
    ad: r.ad ?? null,
    bottom: normArticle(r.bottom, PAGE_FOUR_BOTTOM_COLUMNS, 'OP-ED'),
    photo_scale: typeof r.photo_scale === 'number' && r.photo_scale > 0 ? r.photo_scale : 1,
    space_scale: typeof r.space_scale === 'number' && r.space_scale > 0 ? r.space_scale : 1,
  };
}

type StorySource = {
  headline?: string | null;
  byline?: string | null;
  body?: string | null;
  hero_photo_url?: string | null;
};

function articleFromStory(article: PageFourArticle, story: StorySource): PageFourArticle {
  return {
    ...article,
    headline: (story.headline ?? '').trim() || article.headline,
    author: (story.byline ?? '').trim() || article.author,
    text: (story.body ?? '').trim() || article.text,
    photo_url: (story.hero_photo_url ?? '').trim() || article.photo_url,
  };
}

/** Fill the Top article if empty, else the Bottom article, from a story. */
export function fillPageFourFromStory(data: PageFourData, story: StorySource): PageFourData {
  if (!data.top.headline && !data.top.text) {
    return { ...data, top: articleFromStory(data.top, story) };
  }
  if (!data.bottom.headline && !data.bottom.text) {
    return { ...data, bottom: articleFromStory(data.bottom, story) };
  }
  return data;
}

type AdSource = { id: string; copy_storage_path?: string | null; copy_file_name?: string | null };

/** Place an ad from the Ad Database into the lower-left quarter-page slot. */
export function fillPageFourAd(data: PageFourData, ad: AdSource): PageFourData {
  return {
    ...data,
    ad: {
      ad_id: ad.id,
      storage_path: ad.copy_storage_path ?? undefined,
      file_name: ad.copy_file_name ?? undefined,
    },
  };
}
