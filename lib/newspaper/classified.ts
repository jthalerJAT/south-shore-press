/**
 * Classifieds template-page data — stored in np_pages.template_data for a
 * `classifieds` kind page. The page holds ONE uploaded classified file (from
 * the Classified Upload tile), rendered full-page. Pure helpers, server + client.
 */

export type ClassifiedPageData = {
  v: 1;
  /** Source classifieds row id (reference only). */
  classified_id?: string;
  /** Object key in the `classifieds` Storage bucket. */
  storage_path?: string;
  file_name?: string;
};

export function defaultClassifiedPage(): ClassifiedPageData {
  return { v: 1 };
}

export function normalizeClassifiedPage(raw: unknown): ClassifiedPageData {
  if (!raw || typeof raw !== 'object') return defaultClassifiedPage();
  const r = raw as Partial<ClassifiedPageData>;
  return {
    v: 1,
    classified_id: r.classified_id,
    storage_path: r.storage_path,
    file_name: r.file_name,
  };
}

/** True once a classified file has been assigned to the page. */
export function classifiedPageHasFile(data: ClassifiedPageData): boolean {
  return Boolean(data.storage_path);
}

type ClassifiedSource = { id: string; storage_path?: string | null; file_name?: string | null };

/** Assign an uploaded classified (from the Classified Upload library) to the page. */
export function fillClassifiedFromRecord(
  data: ClassifiedPageData,
  rec: ClassifiedSource
): ClassifiedPageData {
  return {
    ...data,
    classified_id: rec.id,
    storage_path: rec.storage_path ?? undefined,
    file_name: rec.file_name ?? undefined,
  };
}
