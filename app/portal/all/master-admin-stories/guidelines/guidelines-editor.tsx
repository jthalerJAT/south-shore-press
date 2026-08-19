'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveHouseStyle } from '../actions';

export function GuidelinesEditor({ initial }: { initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();
  const dirty = text !== initial;

  function save() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await saveHouseStyle(text);
      if (!res.ok) {
        setError(res.error ?? 'Could not save.');
        return;
      }
      setNotice('Saved. Every AI writer picks this up on its next run.');
      router.refresh();
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
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
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={28}
        spellCheck={false}
        className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm leading-relaxed font-mono focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty || !text.trim()}
          className="px-5 py-2.5 text-sm font-semibold uppercase tracking-wide bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded transition-colors"
        >
          {saving ? 'Saving…' : 'Save Guidelines'}
        </button>
        {dirty ? <span className="text-xs text-zinc-500">Unsaved changes</span> : null}
      </div>
    </div>
  );
}
