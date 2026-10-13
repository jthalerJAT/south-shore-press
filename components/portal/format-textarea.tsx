'use client';

/**
 * FormatTextarea — a body textarea with an inline-formatting toolbar
 * (publisher direction 2026-10-19): B / U / I buttons plus a point-size
 * dropdown, applied to the highlighted text. Ctrl+B / Ctrl+U / Ctrl+I work
 * too. Formatting is stored as plain-text markers (see lib/inline-format):
 *
 *   **bold**   __underline__   *italic*   [size=20]…[/size]
 *
 * The markers stay visible in the textarea — the website and the printed
 * paper render them as real styling. Buttons TOGGLE: applying bold to a
 * selection already wrapped in ** unwraps it.
 *
 * Works controlled (value + onChange) or uncontrolled (defaultValue + name,
 * submitting through FormData) so it can replace any existing body textarea.
 */
import { useRef, useState } from 'react';
import { MIN_INLINE_SIZE, MAX_INLINE_SIZE } from '@/lib/inline-format';

const SIZE_CHOICES = [18, 20, 22, 24, 28] as const;

type Marker = { open: string; close: string };
const MARKERS: Record<'b' | 'u' | 'i', Marker> = {
  b: { open: '**', close: '**' },
  u: { open: '__', close: '__' },
  i: { open: '*', close: '*' },
};

export function FormatTextarea({
  value,
  defaultValue,
  onChange,
  name,
  id,
  rows = 16,
  disabled,
  className,
  placeholder,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  name?: string;
  id?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  // Uncontrolled mode keeps its own state so toolbar edits re-render while the
  // real textarea still submits via `name`.
  const [inner, setInner] = useState(defaultValue ?? '');
  const controlled = value !== undefined;
  const text = controlled ? value : inner;

  function setText(next: string, selStart: number, selEnd: number) {
    if (!controlled) setInner(next);
    onChange?.(next);
    // Restore the selection after React re-renders the textarea.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  /** Wrap the selection in markers — or unwrap when already wrapped. */
  function toggleWrap(open: string, close: string) {
    const el = ref.current;
    if (!el || disabled) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const before = text.slice(0, a);
    const sel = text.slice(a, b);
    const after = text.slice(b);

    // Unwrap: markers inside the selection (**word**) …
    if (sel.startsWith(open) && sel.endsWith(close) && sel.length >= open.length + close.length) {
      const un = sel.slice(open.length, sel.length - close.length);
      setText(before + un + after, a, a + un.length);
      return;
    }
    // … or hugging the selection (user selected just the word).
    if (before.endsWith(open) && after.startsWith(close)) {
      setText(before.slice(0, -open.length) + sel + after.slice(close.length), a - open.length, a - open.length + sel.length);
      return;
    }
    const next = before + open + sel + close + after;
    // Keep the TEXT selected (between the markers) so a follow-up toggle works.
    setText(next, a + open.length, a + open.length + sel.length);
  }

  /** Wrap the selection in [size=N]…[/size], replacing any size wrap that
   *  exactly hugs or encloses it. Choosing "Normal" just removes the wrap. */
  function applySize(n: number | null) {
    const el = ref.current;
    if (!el || disabled) return;
    const { selectionStart: a, selectionEnd: b } = el;
    let before = text.slice(0, a);
    let sel = text.slice(a, b);
    let after = text.slice(b);

    // Strip existing size markers from (or around) the selection first.
    const openRe = /\[size=\d{1,2}\]$/;
    const enclosedOpen = /^\[size=\d{1,2}\]/.exec(sel);
    if (enclosedOpen && sel.endsWith('[/size]')) {
      sel = sel.slice(enclosedOpen[0].length, sel.length - '[/size]'.length);
    } else {
      const hug = openRe.exec(before);
      if (hug && after.startsWith('[/size]')) {
        before = before.slice(0, before.length - hug[0].length);
        after = after.slice('[/size]'.length);
      }
    }
    sel = sel.replace(/\[size=\d{1,2}\]/g, '').replace(/\[\/size\]/g, '');

    const start = before.length;
    if (n === null) {
      setText(before + sel + after, start, start + sel.length);
      return;
    }
    const open = `[size=${n}]`;
    setText(before + open + sel + '[/size]' + after, start + open.length, start + open.length + sel.length);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'b' || k === 'u' || k === 'i') {
      e.preventDefault();
      const m = MARKERS[k as 'b' | 'u' | 'i'];
      toggleWrap(m.open, m.close);
    }
  }

  const btnCls =
    'inline-flex h-7 min-w-7 items-center justify-center rounded border border-zinc-300 bg-white px-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50';

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <button type="button" title="Bold (Ctrl+B)" disabled={disabled} onClick={() => toggleWrap('**', '**')} className={`${btnCls} font-bold`}>
          B
        </button>
        <button type="button" title="Underline (Ctrl+U)" disabled={disabled} onClick={() => toggleWrap('__', '__')} className={`${btnCls} underline`}>
          U
        </button>
        <button type="button" title="Italic (Ctrl+I)" disabled={disabled} onClick={() => toggleWrap('*', '*')} className={`${btnCls} italic`}>
          I
        </button>
        <select
          title="Point size for the highlighted text"
          disabled={disabled}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = '';
            if (v === '') return;
            applySize(v === 'normal' ? null : Math.min(MAX_INLINE_SIZE, Math.max(MIN_INLINE_SIZE, parseInt(v, 10))));
          }}
          className="h-7 rounded border border-zinc-300 bg-white px-1 text-xs text-zinc-700 disabled:opacity-50"
        >
          <option value="">Size…</option>
          <option value="normal">Normal</option>
          {SIZE_CHOICES.map((s) => (
            <option key={s} value={s}>
              {s} pt
            </option>
          ))}
        </select>
        <span className="text-[11px] text-zinc-400">
          Select text, then apply. Markers like **bold** show here and print styled.
        </span>
      </div>
      <textarea
        ref={ref}
        id={id}
        name={name}
        rows={rows}
        value={text}
        onChange={(e) => {
          if (!controlled) setInner(e.target.value);
          onChange?.(e.target.value);
        }}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}
