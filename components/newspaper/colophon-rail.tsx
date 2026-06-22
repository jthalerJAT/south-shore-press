/**
 * ColophonRail — the South Shore Press standing "publication info" rail that
 * runs down the right side of the masthead page (page 5 in the reference issue):
 * imprint, mailing/contact info, staff list, subscription prices, copyright,
 * memberships, and the communities served. Mostly static week to week.
 *
 * Transcribed from the 2026-06-17 printed issue. Presentational; rendered at a
 * fixed narrow column width inside an interior flow page.
 */
import { Seagull } from './seagull';
import { PLAN_DISPLAY } from '@/lib/stripe/plans';

const SERIF = "var(--font-crimson), Georgia, 'Times New Roman', serif";

/** Default rail width + the gap to the story columns (px at print scale). */
export const COLOPHON_RAIL_W = 215;
export const COLOPHON_GAP = 16;

export function ColophonRail({ width = 215 }: { width?: number }) {
  return (
    <aside
      style={{
        width,
        fontFamily: SERIF,
        fontSize: 9.5,
        lineHeight: 1.3,
        color: '#111',
        borderLeft: '1px solid #000',
        paddingLeft: 10,
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
      <p style={{ fontSize: 8.5, lineHeight: 1.25, textAlign: 'justify' }}>
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
      <p style={{ fontSize: 8.5, lineHeight: 1.25, textAlign: 'justify' }}>
        <i>South Shore Press, LLC.</i> is a proud member of the following community organizations:
        The Greater Mastic Beach Chamber of Commerce, The Rocky Point Sound Beach Chamber of
        Commerce, The Mastic/Shirley Chamber of Commerce, The Moriches Chamber of Commerce, The
        Bellport Chamber of Commerce, The Manorville Chamber of Commerce, The Medford Chamber of
        Commerce and The New York Press Association.
      </p>

      <Rule />
      <p style={{ fontStyle: 'italic', textAlign: 'center' }}>Serving the Communities of</p>
      <p style={{ fontSize: 8.5, lineHeight: 1.25, textAlign: 'justify' }}>
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
