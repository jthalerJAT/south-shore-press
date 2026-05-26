'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { createStoryAction, updateStoryAction, deleteStoryAction } from '@/app/portal/actions';
import { SITE_SECTIONS } from '@/lib/site-config';
import { StatusBadge } from './status-badge';
import { cn } from '@/lib/utils';

type StoryDefaults = {
  id?: string;
  headline?: string | null;
  subline?: string | null;
  byline?: string | null;
  body?: string | null;
  hero_photo_url?: string | null;
  extra_photo_urls?: string[] | null;
  categories?: string[] | null;
  status?: 'draft' | 'submitted' | 'published' | 'unpublished';
};

type Props = {
  mode: 'create' | 'edit';
  role: import('@/lib/auth').UserRole;
  defaults?: StoryDefaults;
  /** Read-only banner content shown above the form, e.g. saved confirmation. */
  flash?: string | null;
  /** Author id (for journalists looking at someone else's story this is
   *  the original author; pass user.id for create mode). */
  authorId?: string;
  /** True iff the current user can act on this story (editor/admin OR
   *  journalist who owns it). When false, form is disabled. */
  canEdit: boolean;
};

/**
 * Shared create + edit form. Renders all story fields plus a row of
 * workflow buttons that vary by role and current status.
 *
 * Workflow rules (matches v1, per the role matrix surfaced during Phase 5
 * planning):
 *   Journalist on own story:
 *     draft     → Save, Submit, Delete
 *     submitted → Save, Delete       (no re-submit; editor will publish)
 *     published → read-only          (can't edit after publish)
 *     unpublished → read-only        (editor must downgrade first)
 *   Editor / Admin on any story:
 *     draft     → Save, Publish, Delete
 *     submitted → Save, Publish, Downgrade, Delete
 *     published → Save, Unpublish, Downgrade, Delete
 *     unpublished → Save, Publish, Downgrade, Delete
 */
export function StoryForm({ mode, role, defaults, flash, canEdit }: Props) {
  const action = mode === 'create' ? createStoryAction : updateStoryAction;
  const [state, formAction] = useFormState(action, { error: null });

  const status = defaults?.status ?? 'draft';
  // 'master admin' is treated as an editor-tier role too — see
  // canManageAllStories in lib/auth.ts. Anyone NOT in that set is a
  // journalist (or an unknown role, which we treat as journalist).
  const isEditor =
    role === 'editor' || role === 'admin' || role === 'master admin';
  const isJournalist = !isEditor;

  // Read-only states: journalist looking at their own published/unpublished
  // story (editor must downgrade first), OR journalist looking at someone
  // else's story (server action would reject the write anyway, but we
  // disable the UI for clarity).
  const disabled = !canEdit ||
    (isJournalist && (status === 'published' || status === 'unpublished'));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Hidden fields */}
      {mode === 'edit' && defaults?.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      {flash ? (
        <div
          role="status"
          className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2"
        >
          {flash}
        </div>
      ) : null}

      {state.error ? (
        <div
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {state.error}
        </div>
      ) : null}

      {disabled && status !== 'draft' ? (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-center gap-3">
          <StatusBadge status={status} />
          <span>
            {isJournalist && (status === 'published' || status === 'unpublished')
              ? 'Read-only: an editor needs to downgrade this story to draft before you can edit it.'
              : 'Read-only.'}
          </span>
        </div>
      ) : null}

      {/* Headline */}
      <Field label="Headline" htmlFor="headline" required>
        <input
          id="headline"
          name="headline"
          type="text"
          defaultValue={defaults?.headline ?? ''}
          required
          disabled={disabled}
          maxLength={200}
          className="block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </Field>

      {/* Subline */}
      <Field label="Subline / Deck" htmlFor="subline" hint="Optional. One sentence under the headline.">
        <input
          id="subline"
          name="subline"
          type="text"
          defaultValue={defaults?.subline ?? ''}
          disabled={disabled}
          maxLength={300}
          className="block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </Field>

      {/* Byline */}
      <Field label="Byline" htmlFor="byline" hint="Defaults to your display name on first save.">
        <input
          id="byline"
          name="byline"
          type="text"
          defaultValue={defaults?.byline ?? ''}
          disabled={disabled}
          maxLength={120}
          className="block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </Field>

      {/* Categories */}
      <Field label="Sections" hint="Pick one or more. The first checked is the canonical section.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SITE_SECTIONS.map((section) => {
            const checked = defaults?.categories?.includes(section.slug) ?? false;
            return (
              <label
                key={section.slug}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm',
                  checked
                    ? 'border-brand-red bg-red-50 text-brand-red font-medium'
                    : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50',
                  disabled && 'opacity-60 cursor-not-allowed'
                )}
              >
                <input
                  type="checkbox"
                  name="categories"
                  value={section.slug}
                  defaultChecked={checked}
                  disabled={disabled}
                  className="accent-brand-red"
                />
                {section.label}
              </label>
            );
          })}
        </div>
      </Field>

      {/* Hero media */}
      <Field
        label="Hero media URL"
        htmlFor="hero_photo_url"
        hint="Paste an image URL or a YouTube link (watch / shorts / youtu.be all work)."
      >
        <input
          id="hero_photo_url"
          name="hero_photo_url"
          type="url"
          defaultValue={defaults?.hero_photo_url ?? ''}
          disabled={disabled}
          className="block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </Field>

      {/* Body */}
      <Field label="Body" htmlFor="body" hint="Plain text. Blank lines separate paragraphs.">
        <textarea
          id="body"
          name="body"
          defaultValue={defaults?.body ?? ''}
          disabled={disabled}
          rows={16}
          className="block w-full rounded border border-zinc-300 px-3 py-2 text-base font-serif focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </Field>

      {/* Extra photos — dynamic list of URL inputs. Optional, unlimited. */}
      <Field
        label="Additional photos"
        hint="Optional. Click + Add another photo to add more URLs."
      >
        <ExtraPhotosField
          defaultUrls={defaults?.extra_photo_urls ?? []}
          disabled={disabled}
        />
      </Field>

      {/* Workflow buttons */}
      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-zinc-200">
          <SubmitBtn intent="save" variant="primary">
            {status === 'draft' || mode === 'create' ? 'Save Draft' : 'Save Changes'}
          </SubmitBtn>

          {/* Journalist: Submit (draft → submitted). Label per v1 spec. */}
          {isJournalist && status === 'draft' ? (
            <SubmitBtn intent="submit" variant="secondary">
              Submit Story
            </SubmitBtn>
          ) : null}

          {/* Editor/admin: Publish (covers first-publish AND re-publish
              of an unpublished story). v1 spec uses "Publish Story"
              consistently for both. */}
          {isEditor && status !== 'published' ? (
            <SubmitBtn intent="publish" variant="secondary">
              Publish Story
            </SubmitBtn>
          ) : null}

          {/* Editor/admin: Unpublish */}
          {isEditor && status === 'published' ? (
            <SubmitBtn intent="unpublish" variant="warning">
              Unpublish
            </SubmitBtn>
          ) : null}

          {/* Editor/admin: Downgrade to Draft */}
          {isEditor && status !== 'draft' ? (
            <SubmitBtn intent="downgrade" variant="ghost">
              Downgrade to Draft
            </SubmitBtn>
          ) : null}

          {/* Delete on edit mode only. Uses `formAction` to override the
              parent form's action with the delete server action — keeps
              the markup as a single form (no invalid nesting). */}
          {mode === 'edit' && defaults?.id ? (
            <div className="ml-auto">
              <DeleteButton headline={defaults.headline ?? '(untitled)'} />
            </div>
          ) : null}

          <Link
            href="/portal"
            className="text-sm text-zinc-500 hover:text-zinc-700 px-3 py-1.5"
          >
            Cancel
          </Link>
        </div>
      ) : (
        <div className="pt-4 border-t border-zinc-200">
          <Link
            href="/portal"
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            ← Back to portal
          </Link>
        </div>
      )}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-zinc-800"
      >
        {label}
        {required ? <span className="text-brand-red ml-0.5">*</span> : null}
      </label>
      {hint ? (
        <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>
      ) : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const BTN_VARIANTS = {
  primary:
    'bg-brand-red hover:bg-brand-red-dark text-white border-brand-red',
  secondary:
    'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-900',
  warning:
    'bg-amber-600 hover:bg-amber-700 text-white border-amber-600',
  ghost:
    'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-300',
} as const;

function SubmitBtn({
  intent,
  variant,
  children,
}: {
  intent: 'save' | 'submit' | 'publish' | 'unpublish' | 'downgrade';
  variant: keyof typeof BTN_VARIANTS;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      className={cn(
        'px-4 py-2 text-sm font-medium uppercase tracking-wide border rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        BTN_VARIANTS[variant]
      )}
    >
      {pending ? 'Working…' : children}
    </button>
  );
}

/** Confirm-before-delete button. Sits inside the same <form> as the
 *  workflow buttons but uses `formAction` to dispatch to the delete
 *  server action instead of the parent's save action. The hidden id
 *  field comes from the parent form. */
function DeleteButton({ headline }: { headline: string }) {
  return (
    <button
      type="submit"
      formAction={deleteStoryAction}
      onClick={(e) => {
        if (!confirm(`Delete "${headline}"? This can't be undone.`)) {
          e.preventDefault();
        }
      }}
      className="px-4 py-2 text-sm font-medium uppercase tracking-wide border border-red-300 text-red-700 bg-white hover:bg-red-50 rounded transition-colors"
    >
      Delete
    </button>
  );
}

/**
 * Dynamic list of "additional photo URL" inputs. Each row is a single
 * `<input name="extra_photo_url">` element so the server-side
 * FormData.getAll('extra_photo_url') captures every value in submit
 * order. The "+ Add another photo" button is always rendered at the
 * bottom so editors can keep adding as many photos as they want.
 *
 * Pre-fills from `defaultUrls`. Empty rows are filtered out server-
 * side, so it's safe to start the list with one empty row even on
 * a brand-new story (gives users a visible target to paste into).
 */
function ExtraPhotosField({
  defaultUrls,
  disabled,
}: {
  defaultUrls: string[];
  disabled: boolean;
}) {
  // Start with the pre-filled URLs, or a single empty row if none.
  // Empty rows are valid — they get dropped on submit.
  const [rows, setRows] = useState<string[]>(
    defaultUrls.length > 0 ? defaultUrls : ['']
  );

  function addRow() {
    setRows((prev) => [...prev, '']);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateRow(idx: number, value: string) {
    setRows((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((url, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="url"
            name="extra_photo_url"
            value={url}
            onChange={(e) => updateRow(idx, e.target.value)}
            disabled={disabled}
            placeholder="https://…"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red disabled:bg-zinc-50 disabled:text-zinc-500"
          />
          {/* Only show Remove if there's more than one row OR the row has
              content; otherwise the lone empty row stays as a paste target. */}
          {rows.length > 1 || url ? (
            <button
              type="button"
              onClick={() => removeRow(idx)}
              disabled={disabled}
              aria-label={`Remove photo ${idx + 1}`}
              className="p-2 text-zinc-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="w-8" aria-hidden="true" />
          )}
        </div>
      ))}
      <div>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-red border border-brand-red hover:bg-brand-red hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
        >
          <Plus className="w-3 h-3" /> Add another photo
        </button>
      </div>
    </div>
  );
}
