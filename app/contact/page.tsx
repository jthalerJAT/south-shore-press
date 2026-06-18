import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with The South Shore Press — news tips, sports, advertising, and more.',
};

export default function ContactPage() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="border-b-2 border-brand-red pb-3 mb-8">
        <h1 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          Contact the South Shore Press
        </h1>
      </header>

      <div className="space-y-7 text-[17px] leading-relaxed text-zinc-700">
        <ContactSection title="Questions or Comments?">
          <p>
            You can reach us at{' '}
            <a href="mailto:news@southshorepress.com" className="text-brand-red hover:underline font-medium">
              news@southshorepress.com
            </a>
            , or at{' '}
            <a href="tel:+16312137901" className="text-brand-red hover:underline font-medium">
              (631) 213-7901
            </a>
            .
          </p>
        </ContactSection>

        <ContactSection title="Social Media">
          <p>Breaking news will always be posted on our website and multiple social media platforms.</p>
          <p>
            Visit us on Twitter: <span className="font-medium text-zinc-900">@SSPNewsroom</span>
          </p>
          <p>
            Stories are also shared on our Facebook page:{' '}
            <span className="font-medium text-zinc-900">@TheSouthShorePress</span>
          </p>
        </ContactSection>

        <ContactSection title="News">
          <p>
            If you have a press release or news story idea to send us, please contact us at{' '}
            <a href="mailto:news@SouthShorePress.com" className="text-brand-red hover:underline font-medium">
              news@SouthShorePress.com
            </a>
            .
          </p>
        </ContactSection>

        <ContactSection title="Sports">
          <p>
            Sports coverage, especially local and high school sports, is really important to you. That makes it
            important to us. Please feel free to send sports scores or sports stories you want us to cover at{' '}
            <a href="mailto:sports@SouthShorePress.com" className="text-brand-red hover:underline font-medium">
              sports@SouthShorePress.com
            </a>
          </p>
        </ContactSection>

        <ContactSection title="Advertising">
          <p>
            We offer multiple platforms for you to partner with the South Shore Press and get your message heard.
            Our packages include ad placement on our news website, social media platforms, podcasts, and the
            newspaper itself that is distributed to thousands of people across Long Island. To advertise please
            email us at:{' '}
            <a href="mailto:ads@SouthShorePress.com" className="text-brand-red hover:underline font-medium">
              ads@SouthShorePress.com
            </a>
          </p>
        </ContactSection>

        <ContactSection title="Make Some Cash">
          <p>
            If you’re a highly motivated self-starter with sales experience, and want to be a part of our growing
            multi-media company, please touch base and send us an email:{' '}
            <a href="mailto:sales@SouthShorePress.com" className="text-brand-red hover:underline font-medium">
              sales@SouthShorePress.com
            </a>
          </p>
        </ContactSection>
      </div>
    </article>
  );
}

function ContactSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-headline text-lg font-bold uppercase tracking-wide text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}
