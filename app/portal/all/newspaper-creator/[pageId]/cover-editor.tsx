'use client';

/**
 * CoverEditor — the bespoke field form for a section-cover template page
 * (Front Page, Sports cover). Left: fields (issue header for the news variant,
 * hero, 0–3 tiles, banner) each with a "Fill from story…" picker. Right: a live
 * to-scale SectionCover preview. Save persists template_data + locks the page.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { SectionCover } from '@/components/newspaper/section-cover';
import type { SectionCoverData, CoverTile, CoverHero } from '@/lib/newspaper/section-cover';
import type { EditorStoryRow } from '@/lib/queries/editor-stories';
import { StoryFillPicker } from '@/components/portal/story-fill-picker';
import { PhotoUrlField } from '../photo-url-field';
import { HeadlineField } from '../headline-field';
import { saveCover } from '../actions';

const PREVIEW_SCALE = 0.4;

export function CoverEditor({
  pageId,
  variant,
  mastheadWord,
  initialData,
  stories,
}: {
  pageId: string;
  variant: 'news' | 'sports';
  mastheadWord?: string;
  initialData: SectionCoverData;
  stories: EditorStoryRow[];
}) {
  const router = useRouter();
  const [data, setData] = useState<SectionCoverData>(initialData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function touch() {
    setSaved(false);
  }
  function setField<K extends keyof SectionCoverData>(k: K, v: SectionCoverData[K]) {
    touch();
    setData((d) => ({ ...d, [k]: v }));
  }
  function setHero(partial: Partial<CoverHero>) {
    touch();
    setData((d) => ({ ...d, hero: { ...d.hero, ...partial } }));
  }
  function setTile(i: number, partial: Partial<CoverTile>) {
    touch();
    setData((d) => ({ ...d, tiles: d.tiles.map((t, j) => (j === i ? { ...t, ...partial } : t)) }));
  }
  function fromStory(storyId: string): Partial<CoverHero> & { section_label?: string } | null {
    const s = stories.find((x) => x.id === storyId);
    if (!s) return null;
    return {
      headline: s.headline ?? '',
      photo_url: s.hero_photo_url ?? '',
      credit: s.byline ?? '',
      section_label: (s.categories?.[0] ?? '').toUpperCase() || undefined,
    };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await saveCover(pageId, data as unknown as Record<string, unknown>);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const tiles = data.tiles.slice(0, data.tile_count);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
      {/* ── Fields ─────────────────────────────────────────── */}
      <div className="max-w-xl space-y-6">
        {variant === 'news' ? (
          <Section title="Issue header">
            <BulletField label="Year / Issue" value={data.year_issue ?? ''} onChange={(v) => setField('year_issue', v)} placeholder="42ND YEAR • ISSUE 24" />
            <TextField label="Tagline" value={data.tagline ?? ''} onChange={(v) => setField('tagline', v)} />
            <TextField label="Issue date" value={data.issue_date ?? ''} onChange={(v) => setField('issue_date', v)} placeholder="JUNE 17, 2026" />
          </Section>
        ) : (
          <Section title="Header">
            <TextField label="Issue date" value={data.issue_date ?? ''} onChange={(v) => setField('issue_date', v)} placeholder="JUNE 17, 2026" />
          </Section>
        )}

        <Section title="Hero">
          <StoryPicker stories={stories} onPick={(id) => { const f = fromStory(id); if (f) setHero({ headline: f.headline, photo_url: f.photo_url, credit: f.credit }); }} />
          <HeadlineField label="Headline" value={data.hero.headline ?? ''} onChange={(v) => setHero({ headline: v })} />
          <HeadlineField label="Sub-headline" value={data.hero.subhead ?? ''} onChange={(v) => setHero({ subhead: v })} />
          <PhotoUrlField label="Photo URL" value={data.hero.photo_url} onChange={(v) => setHero({ photo_url: v })} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Photo credit" value={data.hero.credit ?? ''} onChange={(v) => setHero({ credit: v })} />
            <TextField label="Story on page" value={data.hero.page_ref ?? ''} onChange={(v) => setHero({ page_ref: v })} placeholder="5" />
          </div>
        </Section>

        <Section title="Bottom tiles">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Number of tiles</label>
            <select
              value={data.tile_count}
              onChange={(e) => setField('tile_count', Number(e.target.value) as 0 | 1 | 2 | 3)}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none"
            >
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {tiles.map((t, i) => (
            <div key={i} className="rounded border border-zinc-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Tile {i + 1}</span>
                <StoryPicker
                  stories={stories}
                  compact
                  onPick={(id) => { const f = fromStory(id); if (f) setTile(i, { headline: f.headline, photo_url: f.photo_url, credit: f.credit, section_label: f.section_label ?? t.section_label }); }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Section label" value={t.section_label ?? ''} onChange={(v) => setTile(i, { section_label: v })} placeholder="LOCAL" />
                <TextField label="Story on page" value={t.page_ref ?? ''} onChange={(v) => setTile(i, { page_ref: v })} />
              </div>
              <HeadlineField label="Headline" value={t.headline ?? ''} onChange={(v) => setTile(i, { headline: v })} />
              <PhotoUrlField label="Photo URL" value={t.photo_url} onChange={(v) => setTile(i, { photo_url: v })} />
              <TextField label="Credit" value={t.credit ?? ''} onChange={(v) => setTile(i, { credit: v })} />
            </div>
          ))}
        </Section>

        <Section title="Bottom banner">
          <TextField label="Banner text" value={data.banner_text ?? ''} onChange={(v) => setField('banner_text', v)} />
        </Section>

        <div className="flex items-center gap-3 pt-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            {saving ? 'Saving…' : 'Save Page'}
          </button>
          <Link
            href={`/portal/all/newspaper-creator/${pageId}/print`}
            target="_blank"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
          >
            View / Print PDF
          </Link>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
          {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
        </div>
      </div>

      {/* ── Live preview ───────────────────────────────────── */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Preview</div>
        <div
          className="border border-zinc-300 shadow-sm overflow-hidden bg-white"
          style={{ width: CONTENT_W_PX * PREVIEW_SCALE, height: CONTENT_H_PX * PREVIEW_SCALE }}
        >
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
            <SectionCover data={data} variant={variant} mastheadWord={mastheadWord} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}

/** A text field with an "Insert •" button — the bullet that separates Year and
 *  Issue ("42ND YEAR • ISSUE 24") isn't on the keyboard, so this drops one in at
 *  the cursor. (Keyboard fallback: Windows Alt+0149, Mac Option+8.) */
function BulletField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  function insertBullet() {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)} • ${value.slice(end)}`;
    onChange(next);
    const pos = start + 3; // after " • "
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
        <button
          type="button"
          onClick={insertBullet}
          title="Insert a bullet (•) at the cursor"
          className="shrink-0 inline-flex items-center px-3 py-2 border border-zinc-300 hover:bg-zinc-50 text-sm font-medium text-zinc-700 rounded transition-colors"
        >
          Insert •
        </button>
      </div>
    </div>
  );
}

function StoryPicker({
  stories,
  onPick,
  compact,
}: {
  stories: EditorStoryRow[];
  onPick: (storyId: string) => void;
  compact?: boolean;
}) {
  return <StoryFillPicker stories={stories} onPick={onPick} compact={compact} />;
}
