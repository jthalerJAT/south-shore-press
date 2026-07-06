'use server';

import { requireRole } from '@/lib/auth';
import { listPaidSubscribers } from '@/lib/simplecirc/client';
import type { PaidSubscriberList } from '@/lib/simplecirc/types';

/**
 * Run the "Paid Subscribers" pull from SimpleCirc on demand (the Run Template
 * button). Editor-tier gated. Reproduces the SimpleCirc export template:
 * one row per subscription, most-recent order, amount paid ≠ 0.
 */
export async function runSubscriberTemplate(): Promise<PaidSubscriberList> {
  await requireRole(['editor', 'admin', 'master admin'], '/portal/all/subscribers');
  return listPaidSubscribers();
}
