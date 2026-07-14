'use client';

/**
 * ColophonRail — the South Shore Press standing "publication info" rail that
 * runs down the right side of the masthead page (page 5 in the reference issue):
 * imprint, mailing/contact info, staff list, subscription prices, copyright,
 * memberships, and the communities served. Mostly static week to week.
 *
 * The bottom three blocks (copyright, memberships, communities served) AUTO-FIT:
 * their font size grows from the base until the rail's copy reaches the bottom
 * of the page, so the rail never ends with a stub of empty space.
 *
 * Transcribed from the 2026-06-17 printed issue. Rendered at a fixed narrow
 * column width inside an interior flow page.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { Seagull } from './seagull';
import { PLAN_DISPLAY } from '@/lib/stripe/plans';

const SERIF = "var(--font-crimson), Georgia, 'Times New Roman', serif";

/** Default rail width + the gap to the story columns (px at print scale). */
export const COLOPHON_RAIL_W = 215;
export const COLOPHON_GAP = 16;

/** Auto-fit bounds for the bottom blocks' font size (px at print scale). */
const FIT_MIN_FS = 8.5;
const FIT_MAX_FS = 14;
/** The bottom blocks' font size, settable per-render via CSS variable. */
const FIT_FS = 'var(--colophon-fit-fs, 8.5px)';

export function ColophonRail({ width = 215 }: { width?: number }) {
  const ref = useRef<HTMLElement | null>(null);
  const [fitFs, setFitFs] = useState(FIT_MIN_FS);

  // Bisect the largest bottom-block font size whose full rail copy still fits
  // the VISIBLE page area — the copy then runs to the page bottom. The rail's
  // own flex box can stretch past the sheet when the story column overflows,
  // so the target is measured to the clipping page frame's bottom edge, not
  // the rail's box (converted back to layout px in case the page is scaled).
  useLayoutEffect(() => {
    function fit() {
      const aside = ref.current;
      const lastEl = aside?.lastElementChild as HTMLElement | null;
      if (!aside || !lastEl) return;
      const asideRect = aside.getBoundingClientRect();
      // Preview scaling factor (View File / editor previews render the page
      // inside a CSS transform; rects are screen px, layout math needs px).
      const scale = aside.offsetHeight > 0 ? asideRect.height / aside.offsetHeight : 1;
      if (scale <= 0) return;
      // Available height: from the rail's top to the PRINTABLE bottom of the
      // nearest overflow-clipping page frame (minus its padding — the sheet
      // margin). The aside's own box can't be used: as a stretched flex item
      // it can extend past the sheet when the story column overflows.
      let target = aside.clientHeight;
      for (let el = aside.parentElement; el; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.overflowY === 'hidden' || cs.overflowY === 'clip') {
          const clipRect = el.getBoundingClientRect();
          const padBottom = parseFloat(cs.paddingBottom) || 0;
          target = Math.min(target, (clipRect.bottom - asideRect.top) / scale - padBottom);
          break;
        }
      }
      if (target < 200) return; // unstyled/collapsed — don't fit against noise
      const apply = (f: number) => {
        aside.style.setProperty('--colophon-fit-fs', `${f}px`);
        void aside.getBoundingClientRect(); // force layout
      };
      // The rail's real copy height = the last block's bottom edge relative to
      // the rail top (scrollHeight would report the stretched flex box).
      const copyH = () =>
        (lastEl.getBoundingClientRect().bottom - aside.getBoundingClientRect().top) / scale;
      let lo = FIT_MIN_FS;
      let hi = FIT_MAX_FS;
      apply(hi);
      if (copyH() <= target + 1) {
        lo = hi;
      } else {
        for (let i = 0; i < 9; i++) {
          const mid = (lo + hi) / 2;
          apply(mid);
          if (copyH() <= target + 1) lo = mid;
          else hi = mid;
        }
      }
      apply(lo);
      setFitFs(lo);
    }
    fit();
    const t = setTimeout(fit, 500); // re-fit after webfonts settle
    return () => clearTimeout(t);
  }, []);

  return (
    <aside
      ref={ref}
      style={{
        width,
        fontFamily: SERIF,
        fontSize: 9.5,
        lineHeight: 1.3,
        color: '#111',
        borderLeft: '1px solid #000',
        paddingLeft: 10,
        overflow: 'hidden',
        ['--colophon-fit-fs' as never]: `${fitFs}px`,
      }}
    >
      {/* Imprint */}
      <div style={{ textAlign: 'center', borderTop: '2px solid #000', paddingTop: 6 }}>
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 12 }}>
          The South Shore Press Newspaper
        </div>
        <div style={{ fontStyle: 'italic', fontWeight: 700, marginTop: 3 }}>
          Established 1984 - Published Weekly
        </div>
        <div>An Official Paper of Suffolk County</div>
        <div>Address Service Requested</div>
        <div style={{ fontWeight: 700, marginTop: 3 }}>
          The South Shore Press Newspaper
          <br />
          (ISSN#1531-4391 or USPS# 019051)
          <br />
          published weekly By
        </div>
        <div style={{ margin: '4px 0' }}>
          <Seagull width={28} />
        </div>
        <div style={{ fontStyle: 'italic', fontWeight: 700 }}>The South Shore Press LLC</div>
        <div>377 Main Street, Center Moriches, NY 11934.</div>
      </div>

      <Rule />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 700 }}>
          Periodicals Postage Paid at Center Moriches, NY and at additional mailing offices.
        </p>
        <p style={{ fontWeight: 700, marginTop: 3 }}>POSTMASTER: Send address changes to:</p>
        <p style={{ fontStyle: 'italic' }}>Mailing Address</p>
        <p>P.O. Box 316, Shirley, New York 11967</p>
        <p style={{ fontWeight: 700, marginTop: 3 }}>
          Tel: (631) 878-0888 • Fax: (631) 784-3377
        </p>
        <p style={{ fontStyle: 'italic', marginTop: 3 }}>E-Mail</p>
        <p>
          <b>News:</b> news@southshorepress.com
          <br />
          <b>Legal Notices:</b> legals@southshorepress.com
          <br />
          <b>Sports:</b> sports@southshorepress.com
          <br />
          <b>Letters:</b> comments@southshorepress.com
          <br />
          <b>Advertising:</b> ads@southshorepress.com
        </p>
      </div>

      <Rule />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 700 }}>Managing Editor</p>
        <p>Stefan Mychajliw</p>
        <p style={{ fontWeight: 700, marginTop: 3 }}>Senior Reporter</p>
        <p>Robert Chartuk</p>
        <p style={{ fontWeight: 700, marginTop: 3 }}>Photographers &amp; Reporters</p>
        <p>
          Howard Roark, Tom Barton, Nancy Burner, Rich Acritelli, Tara D&apos;Amato, Donna Rolando,
          Karl Grossman, Kathryn Nocerino, Charles Clampet, George Santos, Neil W. McCabe, C.R.
          Mercer
        </p>
        <p style={{ fontWeight: 700, marginTop: 3 }}>Sales Manager</p>
        <p>Fred Towle</p>
        <p style={{ fontStyle: 'italic', marginTop: 4 }}>First Copy Free. Each Additional Copy is 75¢</p>
        <p style={{ fontWeight: 700, fontStyle: 'italic', marginTop: 3 }}>
          ${PLAN_DISPLAY.print_monthly.amount}.00 Monthly Subscription
        </p>
        <p style={{ fontWeight: 700, fontStyle: 'italic' }}>
          ${PLAN_DISPLAY.print_annual.amount}.00 One Year Subscription -
        </p>
        <p style={{ fontStyle: 'italic' }}>(Print, Digital &amp; Newsletter)</p>
        <p style={{ fontWeight: 700, fontStyle: 'italic', marginTop: 3 }}>
          ${PLAN_DISPLAY.all_access.amount}.00 One Year Premium Subscription -
        </p>
        <p style={{ fontStyle: 'italic' }}>(ALL ACCESS - Print, Digital, Exclusive Digital &amp; Newsletter)</p>
      </div>

      <Rule />
      <p style={{ fontSize: FIT_FS, lineHeight: 1.25, textAlign: 'justify' }}>
        Copyright© 2025 South Shore Press, LLC. All rights reserved. Material appearing herein may
        not be published, broadcast, rewritten or redistributed in any form. Copying part or all of
        the editorial or graphic arts in any machine-readable form, making multiple printouts
        thereof or other uses of the work product contained herein is expressly prohibited and is
        inconsistent with all applicable copyright laws. Advertisers purchase space and circulation
        only. All property rights to any advertisements produced for the advertisers by South Shore
        Press, Inc. using art work and/or typography furnished or arranged by South Shore Press,
        LLC. shall be the property of South Shore Press, LLC. No such ad or any part thereof may be
        reproduced or assigned without the express written consent of South Shore Press, LLC. South
        Shore Press, LLC. assumes no financial responsibility for errors beyond the cost of the
        actual space occupied by the error. Postmaster: Send address changes to P.O. Box 431,
        Shirley, N.Y. 11967.
      </p>

      <Rule />
      <p style={{ fontSize: FIT_FS, lineHeight: 1.25, textAlign: 'justify' }}>
        <i>South Shore Press, LLC.</i> is a proud member of the following community organizations:
        The Greater Mastic Beach Chamber of Commerce, The Rocky Point Sound Beach Chamber of
        Commerce, The Mastic/Shirley Chamber of Commerce, The Moriches Chamber of Commerce, The
        Bellport Chamber of Commerce, The Manorville Chamber of Commerce, The Medford Chamber of
        Commerce and The New York Press Association.
      </p>

      <Rule />
      <p style={{ fontStyle: 'italic', textAlign: 'center', fontSize: `calc(${FIT_FS} + 1px)` }}>
        Serving the Communities of
      </p>
      <p style={{ fontSize: FIT_FS, lineHeight: 1.25, textAlign: 'justify' }}>
        The Village of Bellport, Brookhaven, Center Moriches, Centereach, Coram, East Moriches, East
        Patchogue, Eastport, East Shoreham, Farmingville, Gordon Heights, Lake Ronkonkoma,
        Manorville, Medford, Mastic, The Village of Mastic Beach, Middle Island, Miller Place,
        Moriches, Mount Sinai, North Bellport, The Village of Patchogue, Port Jefferson Station, The
        Village of Port Jefferson, Ridge, Rocky Point, Ronkonkoma, Selden, Shirley, Shoreham, Smith
        Point, Sound Beach, Speonk, Terryville, Wading River, &amp; Yaphank.
      </p>
    </aside>
  );
}

function Rule() {
  return <div style={{ borderTop: '1px solid #000', margin: '6px 0' }} />;
}
