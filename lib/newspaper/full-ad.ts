/**
 * Full-page-ad template data — stored in np_pages.template_data for a
 * `full_page_ad` kind page (e.g. Page 3). The whole page is a single ad with no
 * running head or footer. Holds an INDEPENDENT snapshot of the ad's fields
 * (like story snapshots elsewhere) plus a reference back to the Ad Database row.
 * Pure helpers, safe on server + client.
 */

export type FullAdData = {
  v: 1;
  /** Source Ad Database row id (reference only; fields below are a snapshot). */
  ad_id?: string;
  business_name?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  /** The creative in the newspaper-ads bucket. */
  storage_path?: string;
  file_name?: string;
  /** Echoed from the ad's Copy Size (a full-page page is 'full' by intent). */
  copy_size?: string;
};

export function defaultFullAd(): FullAdData {
  return { v: 1 };
}

export function normalizeFullAd(raw: unknown): FullAdData {
  if (!raw || typeof raw !== 'object') return defaultFullAd();
  const r = raw as Partial<FullAdData>;
  return {
    v: 1,
    ad_id: r.ad_id,
    business_name: r.business_name,
    contact_name: r.contact_name,
    contact_phone: r.contact_phone,
    contact_email: r.contact_email,
    storage_path: r.storage_path,
    file_name: r.file_name,
    copy_size: r.copy_size,
  };
}

/** True once a creative has actually been designated for the page. */
export function fullAdHasCreative(data: FullAdData): boolean {
  return Boolean(data.storage_path);
}

type AdSource = {
  id: string;
  business_name?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  copy_storage_path?: string | null;
  copy_file_name?: string | null;
  copy_size?: string | null;
};

/** Populate the full-page ad from an Ad Database row (drag-drop or picker). */
export function fillFullAdFromAd(data: FullAdData, ad: AdSource): FullAdData {
  return {
    ...data,
    ad_id: ad.id,
    business_name: ad.business_name ?? undefined,
    contact_name: ad.contact_name ?? undefined,
    contact_phone: ad.contact_phone ?? undefined,
    contact_email: ad.contact_email ?? undefined,
    storage_path: ad.copy_storage_path ?? undefined,
    file_name: ad.copy_file_name ?? undefined,
    copy_size: ad.copy_size ?? undefined,
  };
}
