import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';

// Default metadata applies to every page; individual pages can override
// any field via their own exported `metadata` object. This is what powers
// SEO and social link previews on the public-facing pages.
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://south-shore-press.vercel.app'
  ),
  title: {
    default: 'The South Shore Press',
    template: '%s | The South Shore Press',
  },
  description: "Long Island's South Shore — daily news, sports, and culture.",
  applicationName: 'The South Shore Press',
  authors: [{ name: 'The South Shore Press' }],
  openGraph: {
    title: 'The South Shore Press',
    description: "Long Island's South Shore — daily news, sports, and culture.",
    type: 'website',
    locale: 'en_US',
    siteName: 'The South Shore Press',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The South Shore Press',
    description: "Long Island's South Shore — daily news, sports, and culture.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased flex flex-col bg-white text-zinc-900">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
