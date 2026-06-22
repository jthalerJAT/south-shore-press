import type { Metadata } from 'next';
import { Playfair_Display, Source_Sans_3, Crimson_Text, Montserrat, Anton, Oswald } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { GlobalJsonLd } from '@/components/seo/global-jsonld';

// v1 typography ported via next/font — self-hosted, no external Google
// Fonts request on render, no FOUT/FOIT. The CSS variables are wired
// into tailwind.config.ts so `font-serif`, `font-sans`, `font-headline`
// resolve to the right family without inline style props.
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
  variable: '--font-playfair',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
});

// Crimson Text — the editorial serif used by the printed paper (matches the
// PDF's body + headline text). Used by the Newspaper Creator renderers.
const crimson = Crimson_Text({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-crimson',
  display: 'swap',
});

// Montserrat — the geometric sans the PRINTED paper uses for headlines
// (Proxima Nova Bold in the source PDF; Montserrat is its standard free
// substitute). Used ONLY by the Newspaper Creator renderers, NOT the website,
// whose headlines stay Playfair (--font-playfair / font-headline).
const newsHeadline = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-news-headline',
  display: 'swap',
});

// Front-page DISPLAY headline. The printed paper's hero headline is Impact;
// Anton is the standard free match (tall, heavy condensed). Newspaper only.
const newsDisplay = Anton({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-news-display',
  display: 'swap',
});

// Oswald — the paper's condensed bold for sub-headlines, section tabs, and
// front-page tile headlines (exact match to the PDF). Newspaper only.
const newsCondensed = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-news-condensed',
  display: 'swap',
});

// Default metadata applies to every page; individual pages can override
// any field via their own exported `metadata` object.
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
    <html
      lang="en"
      className={`${playfair.variable} ${sourceSans.variable} ${crimson.variable} ${newsHeadline.variable} ${newsDisplay.variable} ${newsCondensed.variable}`}
    >
      <body className="min-h-screen antialiased flex flex-col bg-white text-zinc-900 font-sans">
        <GlobalJsonLd />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
