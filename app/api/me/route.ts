import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// User-specific session lookup — never cache. Read by the AuthChip
// client component to hydrate the masthead's top-right corner without
// poisoning the ISR cache on public pages.
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(
    { user },
    {
      headers: {
        // Belt and suspenders — never cached anywhere.
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
