'use client';

/**
 * The Story Draft Engine workbench for one candidate:
 *   - sources (links) + summary
 *   - fact menu: include/exclude each fact + a per-fact angle box
 *   - "+ Add Fact" rows for editor-typed facts
 *   - byline picker
 *   - Create Article / Delete Article
 *   - once generated: the article, with Move to Draft Status / Edit Again
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import type { CandidateFact, StoryCandidate } from '@/lib/queries/draft-engine';
import { generateArticle, moveToDraft, deleteCandidate, type FactChoice } from '../actions';

type FactRow = FactChoice & { source_label: string | null };

export function CandidateWorkbench({
  candidate,
  facts,
  writers,
}: {
  candidate: StoryCandidate;
  facts: CandidateFact[];
  writers: Array<{ name: string; desk: string | null }>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<FactRow[]>(
    facts.map((f) => ({
      id: f.id,
      fact: f.fact,
      include: true,
      angle: '',
      source_label: f.source_label,
    }))
  );
  const [byline, setByline] = useState(
    candidate.byline ?? candidate.suggested_byline ?? writers[0]?.name ?? ''
  );
  const [editAgainOpen, setEditAgainOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function patchRow(i: number, patch: Partial<FactRow>) {
    setRows((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addFactRow() {
    setRows((list) => [...list, { id: null, fact: '', include: true, angle: '', source_label: 'editor' }]);
  }

  async function runGenerate(extraInstructions?: string) {
    setError(null);
    setBusy('generate');
    const res = await generateArticle(candidate.id, {
      facts: rows.filter((r) => r.fact.trim()).map(({ source_label: _s, ...f }) => f),
      byline,
      extraInstructions,
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? 'Could not generate.');
      return;
    }
    setEditAgainOpen(false);
    setRevisionNotes('');
    router.refresh();
  }

  function runMoveToDraft() {
    setError(null);
    setBusy('draft');
    startTransition(async () => {
      const res = await moveToDraft(candidate.id);
      setBusy(null);
      if (!res.ok) {
        setError(res.error ?? 'Could not move to drafts.');
        return;
      }
      router.push('/portal/all/story-draft-engine');
      router.refresh();
    });
  }

  function runDelete() {
    setConfirmDelete(false);
    setBusy('delete');
    startTransition(async () => {
      const res = await deleteCandidate(candidate.id);
      setBusy(null);
      if (!res.ok) {
        setError(res.error ?? 'Could not delete.');
        return;
      }
      router.push('/portal/all/story-draft-engine');
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* ── Left: facts + angle ─────────────────────────────── */}
      <div className="space-y-5">
        {candidate.summary ? (
          <p className="text-sm text-zinc-600">{candidate.summary}</p>
        ) : null}

        {candidate.sources.length > 0 ? (
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-1">
              Sources
            </div>
            <ul className="text-sm space-y-0.5">
              {candidate.sources.map((s, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-red hover:underline truncate"
                    >
                      {s.outlet ?? s.url}
                      {s.title ? ` — ${s.title}` : ''}
                    </a>
                  ) : (
                    <span className="text-zinc-700">{s.outlet}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">
            Facts — include, exclude, and add your angle
          </div>
          <ul className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.id ?? `new-${i}`} className="rounded border border-zinc-200 bg-white p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => patchRow(i, { include: e.target.checked })}
                    className="mt-1"
                    aria-label="Include this fact"
                  />
                  <div className="flex-1 min-w-0">
                    {r.id ? (
                      <p className={`text-sm ${r.include ? 'text-zinc-900' : 'text-zinc-400 line-through'}`}>
                        {r.fact}
                      </p>
                    ) : (
                      <input
                        value={r.fact}
                        onChange={(e) => patchRow(i, { fact: e.target.value })}
                        placeholder="Type a fact to include…"
                        className="block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none"
                      />
                    )}
                    {r.source_label && r.source_label !== 'editor' ? (
                      <p className="mt-0.5 text-[11px] text-zinc-400">{r.source_label}</p>
                    ) : null}
                    {r.include ? (
                      <input
                        value={r.angle ?? ''}
                        onChange={(e) => patchRow(i, { angle: e.target.value })}
                        placeholder="Angle / language to incorporate (optional)…"
                        className="mt-2 block w-full rounded border border-dashed border-zinc-300 px-2 py-1.5 text-sm text-zinc-700 focus:border-brand-red focus:outline-none"
                      />
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addFactRow}
            className="mt-2 text-sm font-medium text-brand-red hover:underline"
          >
            + Add Fact
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Byline</label>
          <select
            value={byline}
            onChange={(e) => setByline(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
          >
            {writers.map((w) => (
              <option key={w.name} value={w.name}>
                {w.name}
                {w.desk ? ` — ${w.desk}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-zinc-200">
          <button
            type="button"
            onClick={() => runGenerate()}
            disabled={busy !== null}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            {busy === 'generate' ? 'Writing…' : candidate.article_body ? 'Regenerate Article' : 'Create Article'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy !== null}
            className="inline-flex items-center px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 text-sm font-medium rounded transition-colors"
          >
            Delete Article
          </button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </div>

      {/* ── Right: the generated article ────────────────────── */}
      <div>
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">
          Article
        </div>
        {candidate.article_body ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="font-headline text-2xl font-bold text-zinc-900">
              {candidate.article_headline}
            </h2>
            {candidate.article_subline ? (
              <p className="mt-1 text-sm text-zinc-600 italic">{candidate.article_subline}</p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-500">
              By {candidate.byline}
              {(() => {
                const words = (candidate.article_body.trim().match(/\S+/g) ?? []).length;
                const inRange = words >= 500 && words <= 700;
                return (
                  <span className={`ml-3 ${inRange ? 'text-zinc-500' : 'text-amber-700 font-semibold'}`}>
                    · {words} words{inRange ? '' : ' (target 500–700)'}
                  </span>
                );
              })()}
            </p>
            <div className="mt-4 space-y-3 text-sm text-zinc-800 leading-relaxed max-h-[55vh] overflow-y-auto ssp-scroll">
              {candidate.article_body.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-zinc-200 pt-4">
              <button
                type="button"
                onClick={runMoveToDraft}
                disabled={busy !== null}
                className="inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold rounded transition-colors"
              >
                {busy === 'draft' ? 'Moving…' : 'Move to Draft Status'}
              </button>
              <button
                type="button"
                onClick={() => setEditAgainOpen((o) => !o)}
                disabled={busy !== null}
                className="inline-flex items-center px-4 py-2 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 text-sm font-medium text-zinc-700 rounded transition-colors"
              >
                Edit Again
              </button>
            </div>
            {editAgainOpen ? (
              <div className="mt-3">
                <textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  rows={3}
                  placeholder="Instructions for the revision — e.g. shorten the lede, lead with the vote count, quote the supervisor higher…"
                  className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
                <button
                  type="button"
                  onClick={() => runGenerate(revisionNotes)}
                  disabled={busy !== null || !revisionNotes.trim()}
                  className="mt-2 inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold rounded transition-colors"
                >
                  {busy === 'generate' ? 'Rewriting…' : 'Apply Revision'}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center text-sm text-zinc-400">
            Choose your facts and angle, then Create Article — the draft will appear here.
          </div>
        )}
      </div>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-sm font-bold text-zinc-900">Delete this candidate?</h3>
            <p className="mt-1 text-sm text-zinc-600">
              &ldquo;{candidate.headline}&rdquo; will be removed from the Story Draft Engine.
            </p>
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-zinc-500 hover:text-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
