/// <reference lib="webworker" />

/**
 * Account-import parser, off the main thread.
 *
 * Reading a full Master Distribution List (tens of thousands of rows) takes
 * many seconds of solid CPU; on the page's own thread that freezes the tab and
 * Chrome offers to kill it ("Page Unresponsive", publisher report 2026-10-13).
 * The dialog hands the file's bytes here instead and stays interactive.
 */
import * as XLSX from 'xlsx';
import { parseAccountsWorkbook } from '@/lib/accounts/import-parse';

export type WorkerIn = { buf: ArrayBuffer };
export type WorkerOut =
  | { type: 'progress'; rowsDone: number }
  | { type: 'done'; result: ReturnType<typeof parseAccountsWorkbook> };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<WorkerIn>) => {
  try {
    const result = parseAccountsWorkbook(XLSX, e.data.buf, (rowsDone) =>
      ctx.postMessage({ type: 'progress', rowsDone } satisfies WorkerOut)
    );
    ctx.postMessage({ type: 'done', result } satisfies WorkerOut);
  } catch (err) {
    console.error('[import worker]', err);
    ctx.postMessage({
      type: 'done',
      result: { ok: false, error: 'Could not read that file. Use an .xlsx, .xls, or .csv export.' },
    } satisfies WorkerOut);
  }
};
