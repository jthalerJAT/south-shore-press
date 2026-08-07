'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, type AuthenticatedUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AD_FILES_BUCKET } from '@/lib/ad-files';

/**
 * Ad Portal server actions — customer-facing. Every action re-verifies the
 * advertiser credential and the account's linked Ad Database client file, then
 * uses the service-role client (customers have no direct RLS grants).
 */

const VALID_SIZES = ['full', 'half', 'third', 'quarter'] as const;
const MAX_NOTES_WORDS = 500;

type Result = { ok: boolean; error?: string };

async function requireAdvertiser(): Promise<
  { user: AuthenticatedUser; clientId: string } | { error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not signed in.' };
  if (!user.customerRoles.includes('advertiser')) {
    return { error: 'Your account does not have the Advertiser credential.' };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('ad_client_id')
    .eq('id', user.id)
    .maybeSingle();
  const clientId = (data as { ad_client_id?: string | null } | null)?.ad_client_id ?? null;
  if (!clientId) {
    return { error: 'Your account is not linked to an advertiser file yet — contact the paper.' };
  }
  return { user, clientId };
}

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

/** Signed upload URL for customer ad copy → newspaper-ads/copy (same folder
 *  layout as the editor-side uploads). */
export async function requestCustomerAdUploadUrl(
  fileName: string
): Promise<{ ok: boolean; error?: string; path?: string; token?: string }> {
  const ctx = await requireAdvertiser();
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
  if (ext === '.heic' || ext === '.heif') {
    return {
      ok: false,
      error: 'HEIC/HEIF (iPhone photo format) can’t be displayed by web browsers — export the ad as JPG, PNG, or PDF and upload that instead.',
    };
  }
  const admin = createAdminClient();
  const path = `copy/${randomUUID()}${ext}`;
  const { data, error } = await admin.storage.from(AD_FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[requestCustomerAdUploadUrl]', error);
    return { ok: false, error: 'Could not start the upload.' };
  }
  return { ok: true, path, token: data.token };
}

/** Save an uploaded ad into the customer's linked client file. */
export async function saveCustomerAd(input: {
  storage_path: string;
  file_name: string;
  copy_size: string;
  notes?: string;
}): Promise<Result> {
  const ctx = await requireAdvertiser();
  if ('error' in ctx) return { ok: false, error: ctx.error };

  if (!input.storage_path) return { ok: false, error: 'Upload the ad copy first.' };
  const size = (input.copy_size ?? '').toLowerCase();
  if (!(VALID_SIZES as readonly string[]).includes(size)) {
    return { ok: false, error: 'Select a page size.' };
  }
  const notes = (input.notes ?? '').trim();
  if (wordCount(notes) > MAX_NOTES_WORDS) {
    return { ok: false, error: `Other Notes is limited to ${MAX_NOTES_WORDS} words.` };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('ad_files').insert({
    client_id: ctx.clientId,
    kind: 'copy',
    storage_path: input.storage_path,
    file_name: input.file_name || null,
    copy_size: size,
    notes: notes || null,
    created_by: ctx.user.id,
  });
  if (error) {
    console.error('[saveCustomerAd]', error);
    return { ok: false, error: 'Could not save the ad.' };
  }
  revalidatePath('/ad-portal');
  revalidatePath('/portal/all/ads');
  return { ok: true };
}

/** Delete one of the customer's OWN ads (scoped to their linked client). */
export async function deleteCustomerAd(fileId: string): Promise<Result> {
  const ctx = await requireAdvertiser();
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const admin = createAdminClient();
  const { data: file } = await admin
    .from('ad_files')
    .select('id, client_id, kind, storage_path')
    .eq('id', fileId)
    .maybeSingle();
  const f = file as { client_id?: string; kind?: string; storage_path?: string } | null;
  if (!f || f.client_id !== ctx.clientId || f.kind !== 'copy') {
    return { ok: false, error: 'Ad not found.' };
  }
  if (f.storage_path) {
    const { error: rmErr } = await admin.storage.from(AD_FILES_BUCKET).remove([f.storage_path]);
    if (rmErr) console.error('[deleteCustomerAd] storage', rmErr);
  }
  const { error } = await admin.from('ad_files').delete().eq('id', fileId);
  if (error) {
    console.error('[deleteCustomerAd]', error);
    return { ok: false, error: 'Could not delete the ad.' };
  }
  revalidatePath('/ad-portal');
  revalidatePath('/portal/all/ads');
  return { ok: true };
}
