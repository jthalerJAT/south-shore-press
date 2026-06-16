'use client';

/**
 * StoryBand — one band on the layout canvas: the shared BandRenderer plus, when
 * selected, the interactive photo overlay and an overflow badge. Selection +
 * column controls live in the right-hand inspector (LayoutEditor).
 */
import { cn } from '@/lib/utils';
import { BandRenderer } from '@/components/newspaper/band-renderer';
import type { ComputedBand } from '@/lib/newspaper/use-bands';
import { PhotoOverlay, type PhotoCommit } from './photo-overlay';
import type { EditorBand } from './layout-editor';

export function StoryBand({
  band,
  computed,
  selected,
  zoom,
  onSelect,
  onPhotoCommit,
  adPublicUrl,
}: {
  band: EditorBand;
  computed: ComputedBand;
  selected: boolean;
  zoom: number;
  onSelect: () => void;
  onPhotoCommit: (c: PhotoCommit) => void;
  adPublicUrl: (p: string) => string;
}) {
  const overflowing = computed.layoutResult ? !computed.layoutResult.fits : false;
  const hasPhoto = band.type === 'story' && !!computed.geometry.photo && !!band.data.hero_photo_url;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative cursor-pointer',
        selected ? 'outline outline-2 outline-brand-red outline-offset-2' : 'hover:outline hover:outline-1 hover:outline-zinc-300 hover:outline-offset-2'
      )}
    >
      <BandRenderer
        type={band.type}
        data={band.data}
        geometry={computed.geometry}
        layoutResult={computed.layoutResult}
        adHeightPx={computed.adHeightPx}
        adPublicUrl={adPublicUrl}
      >
        {selected && hasPhoto ? (
          <PhotoOverlay
            photo={computed.geometry.photo!}
            bodyHeightPx={computed.geometry.bodyHeightPx}
            contentWidthPx={computed.geometry.contentWidthPx}
            columns={computed.geometry.columns}
            zoom={zoom}
            onCommit={onPhotoCommit}
          />
        ) : null}
      </BandRenderer>

      {overflowing ? (
        <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5">
          Overflows page
        </div>
      ) : null}
    </div>
  );
}
