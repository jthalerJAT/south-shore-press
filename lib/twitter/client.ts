import 'server-only';
import { TwitterApi } from 'twitter-api-v2';

/**
 * Server-only X/Twitter client for posting as the South Shore Press account.
 *
 * Posting a tweet needs OAuth 1.0a *user context* (an app-only bearer token
 * can only read), so we use the four-key user credentials. Set these in Vercel
 * (and .env.local for dev) from the SSP X Developer app, with the app's user
 * auth permissions set to **Read and Write**:
 *
 *   TWITTER_API_KEY         (a.k.a. consumer key)
 *   TWITTER_API_SECRET      (a.k.a. consumer secret)
 *   TWITTER_ACCESS_TOKEN    (access token for @southshorepress)
 *   TWITTER_ACCESS_SECRET   (access token secret)
 *
 * When any are missing the helpers return null / false so the Social Media
 * tile degrades gracefully (same pattern as the Stripe/Resend helpers).
 */
function creds() {
  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;
  if (!appKey || !appSecret || !accessToken || !accessSecret) return null;
  return { appKey, appSecret, accessToken, accessSecret };
}

export function isTwitterEnabled(): boolean {
  return creds() !== null;
}

export function getTwitterClient(): TwitterApi | null {
  const c = creds();
  return c ? new TwitterApi(c) : null;
}
