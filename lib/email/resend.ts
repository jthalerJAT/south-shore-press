import 'server-only';
import { Resend } from 'resend';

/**
 * Transactional email via Resend — SERVER ONLY. Lazily initialized like the
 * Stripe helpers: if RESEND_API_KEY isn't set, getResend() returns null and
 * callers degrade gracefully (the request is still saved, the email is just
 * skipped). Sending requires a verified sender domain in Resend.
 */

let cached: Resend | null = null;

export function getResend(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** From address — must be on a domain verified in Resend. */
const FROM =
  process.env.LEGALS_FROM_EMAIL ??
  'The South Shore Press <legals@southshorepress.com>';

export type NotarizedRequest = {
  name: string;
  address: string | null;
  email: string;
  phone: string | null;
  legal_ad_requested: string | null;
  notes: string | null;
};

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Email a notarized-copy request to the given recipients. Returns ok:false
 *  (never throws) so the caller can still report success on the saved row. */
export async function sendNotarizedCopyRequestEmail(
  req: NotarizedRequest,
  recipients: string[]
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: 'email-not-configured' };
  if (recipients.length === 0) return { ok: false, error: 'no-recipients' };

  const rows: Array<[string, string | null]> = [
    ['Name', req.name],
    ['Email', req.email],
    ['Phone', req.phone],
    ['Address', req.address],
    ['Legal ad requested', req.legal_ad_requested],
    ['Notes', req.notes],
  ];
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#18181b">
      <h2 style="color:#c8102e;margin:0 0 12px">Notarized Copy Request</h2>
      <p style="margin:0 0 16px">A reader submitted a request for a notarized copy of a legal notice:</p>
      <table style="border-collapse:collapse">
        ${rows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top;white-space:nowrap">${esc(label)}</td>
            <td style="padding:4px 0;vertical-align:top">${esc(value) || '<span style="color:#a1a1aa">—</span>'}</td>
          </tr>`
          )
          .join('')}
      </table>
      <p style="margin:16px 0 0;color:#71717a;font-size:12px">Reply to this email to reach the requester directly.</p>
    </div>`;

  try {
    await resend.emails.send({
      from: FROM,
      to: recipients,
      replyTo: req.email,
      subject: `Notarized Copy Request — ${req.name}`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('[resend] notarized-copy email failed', err);
    return { ok: false, error: 'send-failed' };
  }
}
