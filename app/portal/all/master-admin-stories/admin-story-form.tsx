'use client';

/**
 * Master Admin story editor — the same fields as the Story Editor form
 * (headline / subline / byline / sections / print-only / sports sub-cats /
 * hero media / caption / credit / body / additional photos), plus:
 *   - an AI revision box under the body that applies the publisher's typed
 *     instruction to the article (nothing is saved until Save / Push)
 *   - "Save to Admin Draft" (stays in this tile) and "Push To Story Editor
 *     Draft" (creates a normal Story Editor draft)
 * Controlled state throughout so the AI revision can update the fields in
 * place.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, X, Sparkles, ExternalLink, Send, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SITE_SECTIONS, SPORTS_SUBCATEGORIES, PRINT_ONLY_SLUG, PRINT_ONLY_LABEL } from '@/lib/site-config';
import { PhotoUrlField } from '@/app/portal/all/newspaper-creator/photo-url-field';
import type { AdminStory, AiTurn } from '@/lib/queries/admin-stories';
import { saveAdminStory, pushToStoryEditor, deleteAdminStory, askAi, type AdminStoryInput } from './actions';

const inputCls =
  'block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red disabled:bg-zinc-50 disabled:text-zinc-500';

export function AdminStoryForm({
  story,
  defaultByline = '',
  flash,
}: {
  story: AdminStory | null;
  defaultByline?: string;
  flash?: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isPushed = story?.status === 'pushed';

  const [headline, setHeadline] = useState(story?.headline ?? '');
  const [subline, setSubline] = useState(story?.subline ?? '');
  const [byline, setByline] = useState(story?.byline ?? defaultByline);
  const [categories, setCategories] = useState<string[]>(story?.categories ?? []);
  const [heroUrl, setHeroUrl] = useState(story?.hero_photo_url ?? '');
  const [caption, setCaption] = useState(story?.photo_caption ?? '');
  const [credit, setCredit] = useState(story?.photo_credit ?? '');
  const [body, setBody] = useState(story?.body ?? '');
  const [extra, setExtra] = useState<string[]>(
    story?.extra_photo_urls && story.extra_photo_urls.length > 0 ? story.extra_photo_urls : ['']
  );

  // AI conversation: saved with the admin draft, disposed of on push.
  const [thread, setThread] = useState<AiTurn[]>(story?.ai_thread ?? []);
  const [message, setMessage] = useState('');
  const [webLookup, setWebLookup] = useState(false);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<'save' | 'push' | 'ai' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(flash ?? null);

  const disabled = busy !== null || isPushed;
  const wordCount = (body.trim().match(/\S+/g) ?? []).length;

  function payload(): AdminStoryInput {
    return {
      headline,
      subline,
      byline,
      body,
      categories,
      hero_photo_url: heroUrl,
      photo_caption: caption,
      photo_credit: credit,
      extra_photo_urls: extra,
    };
  }

  function toggleCategory(slug: string) {
    setCategories((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));
  }

  function runSave() {
    setError(null);
    setNotice(null);
    setBusy('save');
    startTransition(async () => {
      const res = await saveAdminStory(story?.id ?? null, payload(), thread);
      setBusy(null);
      if (!res.ok) {
        setError(res.error ?? 'Could not save.');
        return;
      }
      if (!story) {
        router.push(`/portal/all/master-admin-stories/${res.id}?saved=1`);
      } else {
        setNotice('Saved to Admin Drafts.');
        router.refresh();
      }
    });
  }

  function runPush() {
    setError(null);
    setNotice(null);
    if (!confirm('Push this story to the Story Editor as a draft? It will appear in Edit Stories for the editors.')) return;
    setBusy('push');
    startTransition(async () => {
      const res = await pushToStoryEditor(story?.id ?? null, payload());
      setBusy(null);
      if (!res.ok) {
        setError(res.error ?? 'Could not push.');
        return;
      }
      // Stay in Master Admin Stories — the Story Editor is a deliberate click
      // away (the "Open in Story Editor" link on the pushed banner).
      setThread([]);
      if (!story) {
        router.push(`/portal/all/master-admin-stories/${res.adminId ?? ''}?pushed=1`);
      } else {
        setNotice('Pushed to the Story Editor as a draft. You are still in Master Admin Stories.');
        router.refresh();
      }
    });
  }

  function runDelete() {
    if (!story) return;
    if (!confirm(`Delete "${story.headline}" from Master Admin Stories? This can't be undone.`)) return;
    setBusy('delete');
    startTransition(async () => {
      const res = await deleteAdminStory(story.id);
      setBusy(null);
      if (!res.ok) {
        setError(res.error ?? 'Could not delete.');
        return;
      }
      router.push('/portal/all/master-admin-stories');
      router.refresh();
    });
  }

  async function runAsk() {
    const text = message.trim();
    if (!text) return;
    setError(null);
    setNotice(null);
    setBusy('ai');
    const userTurn: AiTurn = {
      role: 'user',
      text: webLookup ? `${text}\n[web lookup on]` : text,
      at: new Date().toISOString(),
    };
    const history = thread;
    setThread((t) => [...t, userTurn]);
    setMessage('');
    const res = await askAi({ headline, subline, byline, body, message: text, history, webLookup });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      setThread((t) => [...t, { role: 'assistant', text: `(error) ${res.error}`, at: new Date().toISOString() }]);
      return;
    }
    if (res.edit) {
      setHeadline(res.edit.headline);
      setSubline(res.edit.subline);
      setBody(res.edit.body);
    }
    setLastModel(res.model);
    setThread((t) => [
      ...t,
      {
        role: 'assistant',
        text: res.reply,
        at: new Date().toISOString(),
        ...(res.edit ? { applied: true } : {}),
        ...(res.citations.length ? { citations: res.citations.slice(0, 12) } : {}),
      },
    ]);
  }

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [thread.length]);

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <div role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      ) : null}
      {story ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>
            {story.source === 'ai' ? 'AI draft' : 'Admin-written'} · created{' '}
            {new Date(story.created_at).toLocaleString()}
          </span>
          {isPushed ? (
            <span className="inline-flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-800">
              Pushed to the Story Editor{story.pushed_at ? ` ${new Date(story.pushed_at).toLocaleString()}` : ''} — it is read-only here.
              {story.pushed_story_id ? (
                <Link href={`/portal/edit/${story.pushed_story_id}`} className="inline-flex items-center gap-1 font-semibold underline">
                  Open in Story Editor <ExternalLink className="w-3 h-3" />
                </Link>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}

      <Field label="Headline" htmlFor="headline" required>
        <input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={200} disabled={disabled} className={inputCls} />
      </Field>

      <Field label="Subline / Deck" htmlFor="subline" hint="Optional. One sentence under the headline.">
        <input id="subline" value={subline} onChange={(e) => setSubline(e.target.value)} maxLength={300} disabled={disabled} className={inputCls} />
      </Field>

      <Field label="Byline" htmlFor="byline" hint="Howard Roark · Gail Wynand · Henry Cameron, or your own name.">
        <input id="byline" value={byline} onChange={(e) => setByline(e.target.value)} maxLength={120} disabled={disabled} className={inputCls} />
      </Field>

      <Field label="Sections" hint="Pick one or more. The first checked is the canonical section.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SITE_SECTIONS.map((section) => {
            const checked = categories.includes(section.slug);
            return (
              <label
                key={section.slug}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm',
                  checked ? 'border-brand-red bg-red-50 text-brand-red font-medium' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50',
                  disabled && 'opacity-60 cursor-not-allowed'
                )}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleCategory(section.slug)} disabled={disabled} className="accent-brand-red" />
                {section.label}
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="Print edition" hint="Keeps the story OUT of the website, but available in the Newspaper Creator.">
        <label
          className={cn(
            'inline-flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm',
            categories.includes(PRINT_ONLY_SLUG) ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
        >
          <input type="checkbox" checked={categories.includes(PRINT_ONLY_SLUG)} onChange={() => toggleCategory(PRINT_ONLY_SLUG)} disabled={disabled} className="accent-blue-600" />
          {PRINT_ONLY_LABEL}
        </label>
      </Field>

      <Field label="Sports sub-category" hint="Picking any of these automatically tags the story as Sports too.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SPORTS_SUBCATEGORIES.map((sub) => {
            const checked = categories.includes(sub.slug);
            return (
              <label
                key={sub.slug}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 border rounded cursor-pointer text-sm',
                  checked ? 'border-brand-red bg-red-50 text-brand-red font-medium' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50',
                  disabled && 'opacity-60 cursor-not-allowed'
                )}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleCategory(sub.slug)} disabled={disabled} className="accent-brand-red" />
                {sub.label}
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="Hero media URL" htmlFor="hero_photo_url" hint="Paste an image URL or a YouTube link (watch / shorts / youtu.be all work).">
        <PhotoUrlField name="hero_photo_url" value={heroUrl} onChange={setHeroUrl} disabled={disabled} placeholder="Paste an image or YouTube URL, or upload →" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field label="Photo caption" htmlFor="photo_caption" hint="Optional. Shown under the hero photo.">
          <input id="photo_caption" value={caption} onChange={(e) => setCaption(e.target.value)} disabled={disabled} className={inputCls} />
        </Field>
        <Field label="Photo credit" htmlFor="photo_credit" hint="Optional. e.g. the photographer or source.">
          <input id="photo_credit" value={credit} onChange={(e) => setCredit(e.target.value)} disabled={disabled} className={inputCls} />
        </Field>
      </div>

      <Field label="Body" htmlFor="body" hint={`Plain text. Blank lines separate paragraphs. ${wordCount} words.`}>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={disabled}
          rows={18}
          className={cn(inputCls, 'font-serif')}
        />
      </Field>

      {/* ── AI conversation ───────────────────────────────────────────────── */}
      {!isPushed ? (
        <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
              <Sparkles className="w-4 h-4 text-brand-red" />
              Talk to the AI about this article
            </div>
            {thread.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Clear this conversation? (It is not saved until you Save to Admin Draft.)')) setThread([]);
                }}
                disabled={busy !== null}
                className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
              >
                Clear conversation
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Ask a question (&ldquo;is this quote dual-sourced?&rdquo;, &ldquo;is the lede too long?&rdquo;) and you get an
            answer — the article is left alone. Give an instruction (&ldquo;tighten the lede,&rdquo; &ldquo;cut to 500
            words&rdquo;) and the edit is applied to the fields above <em>and</em> explained here. Nothing is saved
            until you Save or Push; Save keeps this conversation with the draft, Push discards it. By default the AI
            sees only the article and this thread — turn on <strong>Web lookup</strong> for a message when you want
            it to go check the web / X (is this quote public? who reported it? do the numbers hold up?).
          </p>

          {thread.length > 0 ? (
            <div className="mt-3 max-h-[28rem] overflow-y-auto rounded border border-zinc-200 bg-white p-3 space-y-3 ssp-scroll">
              {thread.map((t, i) => (
                <div key={i} className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed',
                      t.role === 'user'
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-900 border border-zinc-200'
                    )}
                  >
                    {t.role === 'assistant' && t.applied ? (
                      <div className="mb-1 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                        Edit applied to the article
                      </div>
                    ) : null}
                    <div>{t.text}</div>
                    {t.role === 'assistant' && t.citations && t.citations.length > 0 ? (
                      <div className="mt-2 border-t border-zinc-200 pt-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Sources consulted</div>
                        <ul className="mt-0.5 space-y-0.5">
                          {t.citations.map((u, j) => (
                            <li key={j} className="truncate">
                              <a href={u} target="_blank" rel="noreferrer" className="text-xs text-brand-red hover:underline">
                                {u.replace(/^https?:\/\/(www\.)?/, '')}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className={cn('mt-1 text-[10px]', t.role === 'user' ? 'text-zinc-300' : 'text-zinc-400')}>
                      {new Date(t.at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {busy === 'ai' ? (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-sm text-zinc-500 italic">
                    Thinking…
                  </div>
                </div>
              ) : null}
              <div ref={threadEndRef} />
            </div>
          ) : null}

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void runAsk();
              }
            }}
            rows={3}
            disabled={busy !== null}
            placeholder="Ask a question or give an instruction… (Ctrl+Enter to send)"
            className={cn(inputCls, 'mt-3 bg-white')}
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void runAsk()}
              disabled={busy !== null || !message.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-black disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
            >
              <Send className="w-4 h-4" />
              {busy === 'ai' ? (webLookup ? 'Searching…' : 'Sending…') : 'Send'}
            </button>
            <label
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium cursor-pointer select-none',
                webLookup ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
              )}
              title="Let the AI search the live web and X to answer this message. Off = answers from the article text only."
            >
              <input type="checkbox" className="accent-blue-600" checked={webLookup} onChange={(e) => setWebLookup(e.target.checked)} disabled={busy !== null} />
              <Globe className="w-3.5 h-3.5" />
              Web lookup {webLookup ? 'on' : 'off'}
            </label>
            {lastModel ? <span className="text-xs text-zinc-500">Model: {lastModel}</span> : null}
            {thread.length > 0 ? (
              <span className="text-xs text-zinc-500">
                {thread.length} message{thread.length === 1 ? '' : 's'} · saved with Save to Admin Draft
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <Field label="Additional photos" hint="Optional. Click + Add another photo to add more URLs.">
        <div className="flex flex-col gap-2">
          {extra.map((url, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1">
                <PhotoUrlField name="extra_photo_url" value={url} onChange={(v) => setExtra((rows) => rows.map((r, i) => (i === idx ? v : r)))} disabled={disabled} />
              </div>
              {extra.length > 1 || url ? (
                <button
                  type="button"
                  onClick={() => setExtra((rows) => rows.filter((_, i) => i !== idx))}
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
              onClick={() => setExtra((rows) => [...rows, ''])}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-red hover:underline disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add another photo
            </button>
          </div>
        </div>
      </Field>

      {/* ── Workflow buttons ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-200">
        {!isPushed ? (
          <>
            <button
              type="button"
              onClick={runSave}
              disabled={busy !== null || !headline.trim()}
              className="px-5 py-2.5 text-sm font-semibold uppercase tracking-wide border border-zinc-800 text-zinc-900 bg-white hover:bg-zinc-50 disabled:opacity-50 rounded transition-colors"
            >
              {busy === 'save' ? 'Saving…' : 'Save to Admin Draft'}
            </button>
            <button
              type="button"
              onClick={runPush}
              disabled={busy !== null || !headline.trim()}
              className="px-5 py-2.5 text-sm font-semibold uppercase tracking-wide bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded transition-colors"
            >
              {busy === 'push' ? 'Pushing…' : 'Push To Story Editor Draft'}
            </button>
          </>
        ) : null}
        {story ? (
          <button
            type="button"
            onClick={runDelete}
            disabled={busy !== null}
            className="ml-auto px-4 py-2 text-sm font-medium uppercase tracking-wide border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 rounded transition-colors"
          >
            {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
        ) : null}
      </div>
    </div>
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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-800">
        {label}
        {required ? <span className="text-brand-red"> *</span> : null}
      </label>
      {hint ? <p className="mt-0.5 mb-1.5 text-xs text-zinc-500">{hint}</p> : <div className="mb-1.5" />}
      {children}
    </div>
  );
}
