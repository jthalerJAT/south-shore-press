'use client';

/**
 * HeadlineField — a headline/title input that allows a MANUAL line break:
 * Shift+Enter inserts a newline so the editor controls where the text wraps;
 * plain Enter is ignored so the form isn't accidentally broken. The newline is
 * honored at render time via white-space: pre-line. Shared by the cover, OpEd,
 * and flow-story editors.
 */
export function HeadlineField({
  label,
  value,
  onChange,
  placeholder,
  hint = 'Shift+Enter to force a line break.',
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      {label ? <label className="block text-sm font-medium text-zinc-700">{label}</label> : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
        }}
        placeholder={placeholder}
        rows={2}
        className={`${label ? 'mt-1 ' : ''}block w-full resize-y rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red`}
      />
      {hint ? <p className="mt-1 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}
