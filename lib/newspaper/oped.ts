/**
 * Page 2 ("OpEd") template data — stored in np_pages.template_data. A Main OpEd
 * (Newsroom column), a Second Story, and a Bottom Ad. Pure helpers, safe on
 * server + client.
 */

export type OpEdMain = {
  author_photo_url?: string;
  /** The flagged column word shown large in the blue flag (default NEWSROOM). */
  column_name?: string;
  author?: string;
  title?: string;
  text?: string;
  photo_url?: string;
  photo_caption?: string;
  photo_credit?: string;
};

export type OpEdSecond = {
  headline?: string;
  author?: string;
  text?: string;
  photo_url?: string;
  extra_photo_url?: string;
  photo_caption?: string;
  photo_credit?: string;
};

export type OpEdAd = {
  ad_id?: string;
  storage_path?: string;
  file_name?: string;
} | null;

export type OpEdData = {
  v: 1;
  main: OpEdMain;
  second: OpEdSecond;
  bottom_ad: OpEdAd;
  /** Multiplier on the embedded photo heights (1 = default). Used by the
   *  "adjust to fit page" control to shrink/grow photos so the page fits. */
  photo_scale?: number;
  /** Multiplier on the vertical spacing between articles (1 = default; a floor
   *  keeps a minimum gap). The other "fit the page" lever, applied before
   *  shrinking photos. */
  space_scale?: number;
};

export function defaultOpEd(): OpEdData {
  return { v: 1, main: { column_name: 'NEWSROOM' }, second: {}, bottom_ad: null, photo_scale: 1, space_scale: 1 };
}

export function normalizeOpEd(raw: unknown): OpEdData {
  const base = defaultOpEd();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<OpEdData>;
  return {
    v: 1,
    main: { ...base.main, ...(r.main ?? {}) },
    second: { ...base.second, ...(r.second ?? {}) },
    bottom_ad: r.bottom_ad ?? null,
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

/** Fill the Main OpEd if empty, else the Second Story, from a dragged story. */
export function fillOpEdFromStory(data: OpEdData, story: StorySource): OpEdData {
  const title = (story.headline ?? '').trim();
  const author = (story.byline ?? '').trim() || undefined;
  const text = (story.body ?? '').trim() || undefined;
  const photo_url = (story.hero_photo_url ?? '').trim() || undefined;

  if (!data.main.title && !data.main.text) {
    return { ...data, main: { ...data.main, title, author, text, photo_url } };
  }
  if (!data.second.headline && !data.second.text) {
    return {
      ...data,
      second: { ...data.second, headline: title, author, text, photo_url },
    };
  }
  return data;
}

type AdSource = { id: string; copy_storage_path?: string | null; copy_file_name?: string | null };

/** Place an ad from the Ad Database into the Bottom Ad slot. */
export function fillOpEdAd(data: OpEdData, ad: AdSource): OpEdData {
  return {
    ...data,
    bottom_ad: {
      ad_id: ad.id,
      storage_path: ad.copy_storage_path ?? undefined,
      file_name: ad.copy_file_name ?? undefined,
    },
  };
}
