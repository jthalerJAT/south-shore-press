import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { DIGITAL_PAPERS_BUCKET } from '@/lib/queries/digital-papers';

/**
 * Shared write path for the Digital Paper archive — used by the portal's
 * "+ Add Issue" server action and the press-export workflow's publish step.
 * One row per issue date; writing an existing date replaces its file.
 */
export async function upsertDigitalPaper(input: {
  issue_date: string; // YYYY-MM-DD
  storage_path: string;
  file_name: string | null;
  page_count?: number | null;
  file_size_bytes?: number | null;
  created_by?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('digital_papers')
    .select('id, storage_path')
    .eq('issue_date', input.issue_date)
    .maybeSingle();

  if (existing) {
    if (existing.storage_path && existing.storage_path !== input.storage_path) {
      const { error: rmErr } = await admin.storage
        .from(DIGITAL_PAPERS_BUCKET)
        .remove([existing.storage_path as string]);
      if (rmErr) console.error('[upsertDigitalPaper] old object remove', rmErr);
    }
    const { error } = await admin
      .from('digital_papers')
      .update({
        storage_path: input.storage_path,
        file_name: input.file_name,
        page_count: input.page_count ?? null,
        file_size_bytes: input.file_size_bytes ?? null,
        created_by: input.created_by ?? null,
      })
      .eq('id', existing.id);
    if (error) {
      console.error('[upsertDigitalPaper] update', error);
      return { ok: false, error: 'Could not replace the issue.' };
    }
    return { ok: true };
  }

  const { error } = await admin.from('digital_papers').insert({
    issue_date: input.issue_date,
    storage_path: input.storage_path,
    file_name: input.file_name,
    page_count: input.page_count ?? null,
    file_size_bytes: input.file_size_bytes ?? null,
    created_by: input.created_by ?? null,
  });
  if (error) {
    console.error('[upsertDigitalPaper] insert', error);
    const missing = error.code === '42P01' || error.code === 'PGRST205';
    return {
      ok: false,
      error: missing
        ? 'The digital_papers table does not exist yet — run migration 047 in Supabase.'
        : 'Could not save the issue.',
    };
  }
  return { ok: true };
}
