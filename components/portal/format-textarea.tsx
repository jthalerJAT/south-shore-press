'use client';

/**
 * FormatTextarea - WYSIWYG body editor (publisher direction 2026-10-19, v2:
 * "the text inside the box should just be bolded/underlined, not asterisks").
 *
 * The box is a contentEditable surface showing real bold / underline /
 * italic / sizes. STORAGE IS UNCHANGED: the value handed to forms is still
 * plain text with the lib/inline-format markers (**b**, __u__, *i*,
 * [size=N]…[/size]), which the website and the print engine already render.
 * The component converts markers → styled DOM on load and styled DOM →
 * markers on every edit, so markers never appear on screen and nothing
 * downstream changes.
 *
 * Toolbar B / U / I (and native Ctrl+B / Ctrl+U / Ctrl+I) format the
 * highlighted text; the Size dropdown applies a point size. Pasting inserts
 * PLAIN TEXT on purpose - Word/Docs formatting must not smuggle arbitrary
 * styling into the paper.
 *
 * Works controlled (value + onChange) or uncontrolled (defaultValue + name:
 * a hidden input carries the marker text through FormData submits).
 */
import { useEffect, useRef, useState } from 'react';
import {
  appendInlineTo,
  initialInlineState,
  MIN_INLINE_SIZE,
  MAX_INLINE_SIZE,
} from '@/lib/inline-format';

const SIZE_CHOICES = [18, 20, 22, 24, 28] as const;

/** Render marker text into the editable surface: one <div> per paragraph
 *  (blank-line separated), styled spans for markers, state carried across
 *  paragraphs - the exact model the site and print renderers use. */
function renderMarkersInto(root: HTMLElement, text: string): void {
  root.textContent = '';
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length === 0) {
    const div = document.createElement('div');
    div.appendChild(document.createElement('br'));
    root.appendChild(div);
    return;
  }
  let st = initialInlineState();
  paras.forEach((p, i) => {
    if (i > 0) {
      // Blank line between paragraphs, as the plain-text format has.
      const gap = document.createElement('div');
      gap.appendChild(document.createElement('br'));
      root.appendChild(gap);
    }
    const div = document.createElement('div');
    st = appendInlineTo(div, p, st);
    if (!div.firstChild) div.appendChild(document.createElement('br'));
    root.appendChild(div);
  });
}

type Fmt = { b: boolean; u: boolean; i: boolean; size: number | null };

function elementFmt(el: HTMLElement, inh: Fmt): Fmt {
  const tag = el.tagName;
  const style = el.style;
  let { b, u, i, size } = inh;
  if (tag === 'B' || tag === 'STRONG') b = true;
  if (tag === 'U') u = true;
  if (tag === 'I' || tag === 'EM') i = true;
  const fw = style.fontWeight;
  if (fw === 'bold' || parseInt(fw, 10) >= 600) b = true;
  if (style.textDecoration.includes('underline') || style.textDecorationLine.includes('underline')) u = true;
  if (style.fontStyle === 'italic') i = true;
  if (style.fontSize) {
    const m = /^([\d.]+)px$/.exec(style.fontSize);
    if (m) {
      const n = Math.round(parseFloat(m[1]));
      size = n >= MIN_INLINE_SIZE && n <= MAX_INLINE_SIZE && n !== 16 ? n : null;
    }
  }
  return { b, u, i, size };
}

/** Serialize the editable surface back to marker text. Each top-level block
 *  (div/p - one per line in contentEditable) becomes a paragraph; blocks with
 *  no visible text are blank lines and emit nothing. Marker-toggle state is
 *  threaded across paragraphs, matching how the renderers consume it. */
function serializeToMarkers(root: HTMLElement): string {
  const plainFmt: Fmt = { b: false, u: false, i: false, size: null };
  // Marker-toggle state as emitted so far (shared across all paragraphs).
  let cur: Fmt = { ...plainFmt };

  /** Append the toggle markers that move `cur` to `t`, into `buf`. */
  const emit = (buf: { s: string }, t: Fmt) => {
    if (cur.size !== t.size) {
      if (cur.size !== null) buf.s += '[/size]';
      if (t.size !== null) buf.s += `[size=${t.size}]`;
    }
    if (cur.b !== t.b) buf.s += '**';
    if (cur.u !== t.u) buf.s += '__';
    if (cur.i !== t.i) buf.s += '*';
    cur = { ...t };
  };

  const walkInline = (buf: { s: string }, node: Node, inh: Fmt) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Strip characters that ARE markers from typed text, so a literal
      // asterisk can't silently toggle styling on publish.
      const t = (node.nodeValue ?? '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/\[(\/?)size(=\d{1,2})?\]/g, '');
      if (!t) return;
      emit(buf, inh);
      buf.s += t;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === 'BR') {
      // Mid-paragraph line break (Shift+Enter) - our model has none; a space
      // keeps the words apart. A placeholder <br> in a blank line adds
      // nothing visible and gets trimmed below.
      buf.s += ' ';
      return;
    }
    const fmt = elementFmt(el, inh);
    el.childNodes.forEach((c) => walkInline(buf, c, fmt));
  };

  const paras: string[] = [];
  root.childNodes.forEach((block) => {
    const snapshot = { ...cur };
    const buf = { s: '' };
    walkInline(buf, block, plainFmt);
    const text = buf.s.replace(/\s+/g, ' ').trim();
    if (text) {
      paras.push(text);
    } else {
      // Blank line - nothing emitted; undo any marker toggles whitespace-only
      // content may have produced so state stays consistent.
      cur = snapshot;
    }
  });

  let out = paras.join('\n\n');
  // Close anything still open so the stored text is self-contained.
  const closer = { s: '' };
  emit(closer, plainFmt);
  out += closer.s;
  return out.trim();
}

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
  const boxRef = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef<string>(value ?? defaultValue ?? '');
  const [serialized, setSerialized] = useState(value ?? defaultValue ?? '');

  // Initial render + external changes (e.g. the AI revise flow replacing the
  // body). While the user types, the DOM is the source of truth - only
  // re-render when the incoming value is something we didn't just emit.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const incoming = value ?? lastEmitted.current;
    if (incoming === lastEmitted.current && el.childNodes.length > 0) return;
    renderMarkersInto(el, incoming);
    lastEmitted.current = incoming;
    setSerialized(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emitChange() {
    const el = boxRef.current;
    if (!el) return;
    const text = serializeToMarkers(el);
    lastEmitted.current = text;
    setSerialized(text);
    onChange?.(text);
  }

  function exec(command: 'bold' | 'underline' | 'italic') {
    if (disabled) return;
    boxRef.current?.focus();
    document.execCommand(command);
    emitChange();
  }

  /** Size via the classic fontSize-7 trick: execCommand marks the selection
   *  with <font size="7">, which we immediately rewrite to a clean px span
   *  (or unwrap entirely for "Normal"). */
  function applySize(n: number | null) {
    const el = boxRef.current;
    if (!el || disabled) return;
    el.focus();
    document.execCommand('fontSize', false, '7');
    el.querySelectorAll('font[size="7"]').forEach((f) => {
      if (n === null) {
        const parent = f.parentNode;
        while (f.firstChild) parent?.insertBefore(f.firstChild, f);
        f.remove();
        return;
      }
      const span = document.createElement('span');
      span.style.fontSize = `${n}px`;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });
    emitChange();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // EVERY Enter starts a new paragraph, whatever is held down with it.
    //
    // Ctrl/Cmd+Enter inserts nothing in a browser editable by default.
    // Shift+Enter is worse: the browser inserts a <br>, which LOOKS like a
    // break in the box but our stored format has no mid-paragraph break, so
    // it serializes to a space and the break silently disappears on save
    // (publisher report 2026-10-19). Paragraphs are the only break the paper
    // has, so give the publisher one either way.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.preventDefault();
      document.execCommand('insertParagraph');
      emitChange();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    // Plain text only - outside formatting must not ride into the paper.
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    // Every line break in the pasted copy becomes a PARAGRAPH. Pasting it as
    // one string lets the browser insert <br>s, which serialize to spaces -
    // a story pasted from Word would arrive as a single wall of text.
    const paras = text.split(/\r?\n+/).map((p) => p.trim()).filter(Boolean);
    paras.forEach((p, i) => {
      if (i > 0) document.execCommand('insertParagraph');
      document.execCommand('insertText', false, p);
    });
    emitChange();
  }

  const btnCls =
    'inline-flex h-7 min-w-7 items-center justify-center rounded border border-zinc-300 bg-white px-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50';

  const empty = serialized.trim() === '';

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <button type="button" title="Bold (Ctrl+B)" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} className={`${btnCls} font-bold`}>
          B
        </button>
        <button type="button" title="Underline (Ctrl+U)" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} className={`${btnCls} underline`}>
          U
        </button>
        <button type="button" title="Italic (Ctrl+I)" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} className={`${btnCls} italic`}>
          I
        </button>
        <select
          title="Point size for the highlighted text"
          disabled={disabled}
          value=""
          onMouseDown={(e) => e.stopPropagation()}
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
          Highlight text, then apply - it formats right here and publishes the same way.
        </span>
      </div>
      <div className="relative">
        {empty && placeholder ? (
          <div aria-hidden className="pointer-events-none absolute left-3 top-2 text-zinc-400">
            {placeholder}
          </div>
        ) : null}
        <div
          ref={boxRef}
          id={id}
          role="textbox"
          aria-multiline="true"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className={className}
          style={{
            minHeight: `${Math.max(4, rows) * 1.55}em`,
            whiteSpace: 'pre-wrap',
            overflowY: 'auto',
            outline: 'none',
          }}
        />
      </div>
      {name ? <input type="hidden" name={name} value={serialized} readOnly /> : null}
    </div>
  );
}
