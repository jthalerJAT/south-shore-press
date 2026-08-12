import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editorial Mission',
  description:
    'The stated mission of the South Shore Press: offering the broadest scope of political, community, and economic information available to the public we serve.',
};

export default function EditorialMissionPage() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="border-b-2 border-brand-red pb-3 mb-8">
        <h1 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          Editorial Mission
        </h1>
      </header>

      <div className="space-y-6 text-[17px] leading-relaxed text-zinc-700">
        <p>
          It is the stated mission of the South Shore Press to offer the
          broadest scope of political, community, and economic information
          available to the public we serve. We will expose hypocrisy and corruption, and provide analysis
          uninhibited by political constraint.
        </p>

        <p>
          We intend to do this by employing staff reporters, engaging freelancers
          across a wide spectrum of subjects and geographies, and allowing
          individuals to publish under our banner using pseudonyms. In doing so,
          we believe we can most effectively accomplish the mission of the South
          Shore Press while living within the confines of a budget appropriate
          for a local newspaper. It is our stated intention to reinvest all
          revenue into the editorial process, thereby creating a flywheel of
          growing distribution and deeper, broader coverage, leading to further
          distribution, and so on&hellip;
        </p>

        <h2 className="font-headline text-2xl font-bold text-zinc-900 pt-2">
          On the subject of pseudonyms
        </h2>

        <p>
          Readers will notice that we publish under three pseudonyms: Howard
          Roark, Gail Wynand, and Henry Cameron. All of these are characters from
          Ayn Rand&rsquo;s classic novel <em>The Fountainhead</em>, which we
          believe exemplifies, in many respects, the ideals we hold dear at the
          South Shore Press.
        </p>

        <p>
          It is our view that anonymity, particularly in our modern society, is
          &ldquo;a shield from the tyranny of the majority.&rdquo; It protects
          unpopular opinions from retaliation &mdash; and ideas from suppression
          &mdash; at the hand of an intolerant society. Providing the cover of
          anonymity offers the South Shore Press access to certain individuals,
          particularly in the fields of politics and finance, who might not
          otherwise be willing to share their views publicly.
        </p>

        <p>
          There is vast precedent for the use of pseudonyms in American history,
          from Mark Twain to Alexander Hamilton, and the courts have also weighed
          in on the important place this practice holds. Most recently:
        </p>

        <blockquote className="border-l-4 border-brand-red pl-5 py-1 italic text-zinc-800">
          <p>
            &ldquo;The right to remain anonymous may be abused when it shields
            fraudulent conduct. But political speech by its nature will sometimes
            have unpalatable consequences, and, in general, our society accords
            greater weight to the value of free speech than to the dangers of its
            misuse.&rdquo;
          </p>
          <footer className="mt-2 not-italic text-sm text-zinc-500">
            &mdash; Supreme Court Justice John Paul Stevens, writing for the
            majority in <em>McIntyre v. Ohio Elections Commission</em> (1995)
          </footer>
        </blockquote>

        <p>
          This practice is often criticized, most typically by the same
          mainstream &ldquo;media&rdquo; and political establishment that stifles
          free speech through concocted narratives without any allowance for
          dissent, but we believe in the critical importance of anonymity and its
          role in countering these very people.
        </p>

        <p>
          The South Shore Press will work diligently to accomplish our editorial
          objective by engaging the best sources available to us, and present the
          world to our audience in a form that emphasizes truth above all else.
        </p>
      </div>
    </article>
  );
}
