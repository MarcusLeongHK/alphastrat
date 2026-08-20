import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Options Analysis Guide — AlphaStrat",
  description:
    "What every metric, chart, and signal in the Options tab actually means.",
};

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-12">
      <h2 className="mb-4 border-b border-border-primary pb-2.5 text-xl font-bold tracking-tight text-text-primary">
        {number}. {title}
      </h2>
      {children}
    </section>
  );
}

function Callout({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "info" | "warning";
}) {
  return (
    <div
      className={`my-5 rounded-r-md border-l-[3px] px-4 py-3.5 text-sm leading-relaxed ${
        variant === "warning"
          ? "border-warning bg-warning/10 text-warning"
          : "border-accent bg-accent/10 text-accent"
      }`}
    >
      {children}
    </div>
  );
}

function Chip({
  color,
  children,
}: {
  color: "green" | "red" | "amber" | "violet";
  children: React.ReactNode;
}) {
  const styles = {
    green: "bg-success/10 text-success",
    red: "bg-danger/10 text-danger",
    amber: "bg-warning/10 text-warning",
    violet: "bg-accent/10 text-accent",
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${styles[color]}`}
    >
      {children}
    </span>
  );
}

export default function OptionsGuidePage() {
  return (
    <div className="mx-auto max-w-[740px] px-4 py-12 md:px-6">
      {/* Header */}
      <header className="mb-12 border-b border-border-primary pb-8">
        <span className="mb-3 inline-block rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
          AlphaStrat Reference
        </span>
        <h1 className="mb-2 text-[28px] font-bold leading-tight tracking-tight text-text-primary">
          Reading the Options Market
        </h1>
        <p className="text-[15px] leading-relaxed text-text-secondary">
          What every metric, chart, and signal in the Options tab actually means
          — explained for someone who understands stocks but hasn&rsquo;t traded
          options.
        </p>
      </header>

      {/* TOC */}
      <nav className="mb-10 rounded-lg border border-border-primary bg-surface-secondary p-5">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
          Contents
        </div>
        <ol className="list-none space-y-1.5">
          {[
            ["basics", "Options in 60 seconds"],
            ["expected-move", "Expected Move gauge"],
            ["metrics", "The three key metrics"],
            ["iv-surface", "IV Surface chart"],
            ["term-structure", "IV Term Structure chart"],
            ["positioning", "Positioning by Strike chart"],
            ["greeks", "Greeks at ATM"],
            ["unusual", "Unusual Activity"],
            ["analysis", "AI Analysis sections"],
            ["truth", "What's real vs. what's interpretation"],
          ].map(([id, label], i) => (
            <li key={id} className="flex items-baseline gap-2">
              <span className="text-[13px] tabular-nums text-text-tertiary">
                {i + 1}.
              </span>
              <a
                href={`#${id}`}
                className="text-sm text-text-primary transition-colors hover:text-accent"
              >
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* 1. Basics */}
      <Section id="basics" number={1} title="Options in 60 seconds">
        <p className="mb-3.5 text-text-primary">
          An <strong>option</strong> is a contract that gives you the right (not
          obligation) to buy or sell a stock at a specific price by a specific
          date. A <strong>call</strong> is a bet the price goes up. A{" "}
          <strong>put</strong> is a bet the price goes down.
        </p>
        <p className="mb-3.5 text-text-primary">
          You don&rsquo;t need to trade options to benefit from this tab. The
          options market is valuable because it tells you{" "}
          <em>what other traders are pricing in</em> about a stock&rsquo;s
          future. It&rsquo;s a forward-looking sentiment indicator — while the
          stock price tells you where the market is, options tell you where the
          market <em>expects</em> it to go.
        </p>
        <p className="mb-3.5 text-text-primary">
          Every metric on this tab answers one of three questions:
        </p>
        <ul className="mb-3.5 list-disc space-y-1.5 pl-6 text-text-primary">
          <li>
            <strong>How much movement does the market expect?</strong> (Expected
            Move, ATM IV)
          </li>
          <li>
            <strong>In which direction?</strong> (Put/Call Ratio, IV Skew,
            Positioning)
          </li>
          <li>
            <strong>When?</strong> (Term Structure, Unusual Activity)
          </li>
        </ul>
      </Section>

      {/* 2. Expected Move */}
      <Section id="expected-move" number={2} title="Expected Move gauge">
        <p className="mb-3.5 text-text-primary">
          The horizontal gauge at the top of the Options tab shows you the{" "}
          <strong>price range the market expects</strong> the stock to trade in
          by the nearest options expiry (usually the coming Friday).
        </p>
        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          How it&rsquo;s calculated
        </h3>
        <p className="mb-3.5 text-text-primary">
          We find the <strong>at-the-money (ATM) straddle</strong> — the call
          and put with strike prices closest to the current stock price. Adding
          their mid-prices together gives the straddle price, which represents
          the market&rsquo;s expected move.
        </p>
        <div className="my-4 overflow-x-auto rounded-lg border border-border-primary bg-surface-secondary px-5 py-4 font-mono text-sm leading-loose">
          <span className="mb-2 block font-sans text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Formula
          </span>
          Expected Move = ATM Call Mid + ATM Put Mid
          <br />
          Upper Bound = Current Price + Expected Move
          <br />
          Lower Bound = Current Price - Expected Move
        </div>
        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          Reading the gauge
        </h3>
        <ul className="mb-3.5 list-disc space-y-1.5 pl-6 text-text-primary">
          <li>
            The <strong>solid vertical line</strong> is the current stock price.
          </li>
          <li>
            The <strong>blue shaded band</strong> is the expected range — a
            wider band means the market expects more volatility.
          </li>
          <li>
            The <strong>dashed amber line</strong> is <strong>max pain</strong>.
          </li>
        </ul>
        <Callout>
          The expected move is <em>not</em> a prediction. It&rsquo;s what
          options traders are paying for. About 68% of the time, the stock stays
          within this range by expiry (it corresponds roughly to one standard
          deviation).
        </Callout>
        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          Max Pain
        </h3>
        <p className="mb-3.5 text-text-primary">
          Max pain is the stock price at which the{" "}
          <em>maximum number of options expire worthless</em> — the price where
          option sellers (market makers, institutions) lose the least money.
          It&rsquo;s calculated by testing every strike price and summing the
          total payout option sellers would owe at each one. The strike with the
          lowest total payout is max pain.
        </p>
        <p className="mb-3.5 text-text-primary">
          There&rsquo;s a common theory that stocks gravitate toward max pain
          near expiry because market makers delta-hedge in ways that push the
          price there. The evidence is mixed — treat it as context, not a target.
        </p>
      </Section>

      {/* 3. Key Metrics */}
      <Section id="metrics" number={3} title="The three key metrics">
        <div className="my-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Put/Call Ratio", "P/C", "Put volume divided by call volume for the nearest expiry. Tells you the directional lean of today's trading."],
            ["ATM IV", "IV%", "Implied volatility of the at-the-money call. The market's forecast of annualized volatility."],
            ["IV Skew", "Skew", "Whether OTM puts or OTM calls are more expensive (higher IV). Shows the direction traders are hedging."],
          ].map(([label, value, desc]) => (
            <div
              key={label}
              className="rounded-lg border border-border-primary bg-surface-secondary p-4"
            >
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                {label}
              </div>
              <div className="mb-1 text-lg font-bold tabular-nums text-text-primary">
                {value}
              </div>
              <div className="text-[13px] leading-snug text-text-secondary">
                {desc}
              </div>
            </div>
          ))}
        </div>

        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          Put/Call Ratio — what the numbers mean
        </h3>
        <div className="my-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-primary text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                <th className="px-3 py-2">Range</th>
                <th className="px-3 py-2">Reading</th>
                <th className="px-3 py-2">What it means</th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              <tr className="border-b border-border-primary">
                <td className="px-3 py-2.5"><Chip color="green">&lt; 0.7</Chip></td>
                <td className="px-3 py-2.5">Bullish</td>
                <td className="px-3 py-2.5 text-text-secondary">Significantly more call volume than put volume. Traders are positioning for upside.</td>
              </tr>
              <tr className="border-b border-border-primary">
                <td className="px-3 py-2.5">0.7 – 1.0</td>
                <td className="px-3 py-2.5">Neutral</td>
                <td className="px-3 py-2.5 text-text-secondary">Balanced flow. This is the normal range for most stocks.</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5"><Chip color="red">&gt; 1.0</Chip></td>
                <td className="px-3 py-2.5">Bearish</td>
                <td className="px-3 py-2.5 text-text-secondary">More put volume than calls. Traders are buying downside protection or speculating on a decline.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          ATM Implied Volatility
        </h3>
        <p className="mb-3.5 text-text-primary">
          IV is the market&rsquo;s estimate of how much the stock will move,
          expressed as an annualized percentage. A 30% IV means the market
          expects roughly a &plusmn;30% range over the next year.
        </p>
        <p className="mb-3.5 text-text-primary">
          We compare IV to <strong>historical volatility (HV)</strong> — the
          actual realized volatility over the past 30 trading days, annualized.
        </p>
        <div className="my-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-primary text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                <th className="px-3 py-2">Relationship</th>
                <th className="px-3 py-2">Spread</th>
                <th className="px-3 py-2">Interpretation</th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              <tr className="border-b border-border-primary">
                <td className="px-3 py-2.5">IV &gt; HV</td>
                <td className="px-3 py-2.5"><Chip color="amber">&gt; 5pp</Chip></td>
                <td className="px-3 py-2.5 text-text-secondary">Options are pricing in more volatility than recent history. Common ahead of events. Options are &ldquo;expensive.&rdquo;</td>
              </tr>
              <tr className="border-b border-border-primary">
                <td className="px-3 py-2.5">IV &asymp; HV</td>
                <td className="px-3 py-2.5">&lt; 5pp</td>
                <td className="px-3 py-2.5 text-text-secondary">Options are roughly fairly priced relative to recent movement.</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5">IV &lt; HV</td>
                <td className="px-3 py-2.5"><Chip color="violet">&gt; 5pp</Chip></td>
                <td className="px-3 py-2.5 text-text-secondary">Options are pricing in less movement than recent history. Options are &ldquo;cheap.&rdquo;</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          IV Skew
        </h3>
        <p className="mb-3.5 text-text-primary">
          Skew compares the implied volatility of OTM puts (strikes 5-15% below)
          against OTM calls (strikes 5-15% above).
        </p>
        <dl className="my-4 space-y-3.5">
          <div>
            <dt className="mb-1 text-sm font-semibold text-text-primary"><Chip color="red">Put-heavy</Chip></dt>
            <dd className="text-sm leading-relaxed text-text-secondary">OTM puts have higher IV than OTM calls. Traders are paying more for downside protection. This is the normal state for most equities.</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-semibold text-text-primary"><Chip color="green">Call-heavy</Chip></dt>
            <dd className="text-sm leading-relaxed text-text-secondary">OTM calls have higher IV. Unusual. Means traders are paying up for upside exposure — often seen in meme stocks or biotech ahead of catalysts.</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-semibold text-text-primary">Neutral</dt>
            <dd className="text-sm leading-relaxed text-text-secondary">IV difference &lt; 2%. Balanced demand for both sides.</dd>
          </div>
        </dl>
      </Section>

      {/* 4. IV Surface */}
      <Section id="iv-surface" number={4} title="IV Surface chart">
        <p className="mb-3.5 text-text-primary">
          This chart plots implied volatility (Y-axis) against{" "}
          <strong>moneyness</strong> (X-axis) for each available expiry date.
          Each colored line is a different expiry.
        </p>
        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          Understanding moneyness
        </h3>
        <p className="mb-3.5 text-text-primary">
          Moneyness is how far a strike price is from the current stock price, as
          a percentage. 0% is at-the-money. -10% means the strike is 10% below
          (OTM put territory). +10% means 10% above (OTM call territory).
        </p>
        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          What shapes to look for
        </h3>
        <dl className="my-4 space-y-3.5">
          <div>
            <dt className="mb-1 text-sm font-semibold text-text-primary">Symmetric smile (U-shape)</dt>
            <dd className="text-sm leading-relaxed text-text-secondary">IV is higher for both deep OTM puts and calls. The market prices large moves in either direction as more likely.</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-semibold text-text-primary">Skewed left (higher on the left)</dt>
            <dd className="text-sm leading-relaxed text-text-secondary">OTM puts are more expensive — the &ldquo;volatility smirk.&rdquo; The most common real-world shape, reflecting that crashes are historically more common than equivalent rallies.</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-semibold text-text-primary">Flat</dt>
            <dd className="text-sm leading-relaxed text-text-secondary">All strikes have roughly the same IV. No particular directional risk. Unusual for individual stocks.</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-semibold text-text-primary">Steep kink at a specific strike</dt>
            <dd className="text-sm leading-relaxed text-text-secondary">May indicate a large position or hedging demand at that strike. Check the Positioning chart for unusual volume there.</dd>
          </div>
        </dl>
        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          Comparing across expiries
        </h3>
        <p className="mb-3.5 text-text-primary">
          If the near-term line is significantly above longer-term lines, the
          market expects a near-term event to cause more volatility than usual.
          If below, calm now and volatility later.
        </p>
      </Section>

      {/* 5. Term Structure */}
      <Section id="term-structure" number={5} title="IV Term Structure chart">
        <p className="mb-3.5 text-text-primary">
          This chart shows ATM implied volatility across different expiry dates.
          It answers: <em>when</em> does the market expect volatility?
        </p>
        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          The three shapes
        </h3>
        <dl className="my-4 space-y-3.5">
          <div>
            <dt className="mb-1 text-sm font-semibold text-text-primary">Rising (contango) — normal</dt>
            <dd className="text-sm leading-relaxed text-text-secondary">Longer-dated options have higher IV. The default state — more uncertainty further out.</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-semibold text-text-primary">Falling (backwardation) — event signal</dt>
            <dd className="text-sm leading-relaxed text-text-secondary">Near-term IV is higher. The market expects a near-term event (earnings, FOMC) to cause a big move. After the event, IV drops (&ldquo;IV crush&rdquo;).</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-semibold text-text-primary">Kinked at a specific date</dt>
            <dd className="text-sm leading-relaxed text-text-secondary">One expiry has notably higher IV than neighbors. That expiry probably brackets a known catalyst — check the earnings calendar.</dd>
          </div>
        </dl>
        <Callout>
          <strong>IV Crush:</strong> After a known event (e.g., earnings),
          implied volatility often drops sharply because the uncertainty is
          resolved. Options lose value even if the stock moves, because the
          volatility premium evaporates.
        </Callout>
      </Section>

      {/* 6. Positioning */}
      <Section id="positioning" number={6} title="Positioning by Strike chart">
        <p className="mb-3.5 text-text-primary">
          A bar chart showing trading volume by strike price for the nearest
          expiry. Green bars are call volume, red bars are put volume.
        </p>
        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          What to look for
        </h3>
        <ul className="mb-3.5 list-disc space-y-1.5 pl-6 text-text-primary">
          <li><strong>Tall green bars far above the current price:</strong> Bullish bets on a large upward move.</li>
          <li><strong>Tall red bars far below:</strong> Bearish bets or portfolio hedging.</li>
          <li><strong>Concentration at round numbers:</strong> Psychological levels where traders cluster.</li>
          <li><strong>The dashed max pain line:</strong> Where the most options expire worthless.</li>
        </ul>
        <h3 className="mb-2.5 mt-7 text-base font-semibold text-text-primary">
          Volume vs. what it means
        </h3>
        <p className="mb-3.5 text-text-primary">
          High volume at a strike means lots of trading <em>today</em>, but
          doesn&rsquo;t tell you the direction. A large call volume could be
          someone buying calls (bullish) or selling calls (bearish/income).
          Without order-level data, we can only see the <em>activity</em>, not
          the <em>intent</em>.
        </p>
      </Section>

      {/* 7. Greeks */}
      <Section id="greeks" number={7} title="Greeks at ATM">
        <p className="mb-3.5 text-text-primary">
          The Greeks are sensitivity measurements for the ATM call option,
          calculated using the <strong>Black-Scholes model</strong>.
        </p>
        <div className="my-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-primary text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                <th className="px-3 py-2">Greek</th>
                <th className="px-3 py-2">Measures</th>
                <th className="px-3 py-2">Plain English</th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              <tr className="border-b border-border-primary">
                <td className="px-3 py-2.5 font-semibold">Delta</td>
                <td className="px-3 py-2.5">Price sensitivity</td>
                <td className="px-3 py-2.5 text-text-secondary">Delta 0.52 = the option gains ~$0.52 for each $1 the stock rises. ATM options have delta near 0.5.</td>
              </tr>
              <tr className="border-b border-border-primary">
                <td className="px-3 py-2.5 font-semibold">Gamma</td>
                <td className="px-3 py-2.5">How fast delta changes</td>
                <td className="px-3 py-2.5 text-text-secondary">High gamma = delta is unstable. Peaks at ATM and near expiry.</td>
              </tr>
              <tr className="border-b border-border-primary">
                <td className="px-3 py-2.5 font-semibold">Theta</td>
                <td className="px-3 py-2.5">Time decay ($/day)</td>
                <td className="px-3 py-2.5 text-text-secondary">How much value the option loses each day. Theta of -$0.15 = loses $0.15/day from time passing.</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-semibold">Vega</td>
                <td className="px-3 py-2.5">IV sensitivity ($/1%)</td>
                <td className="px-3 py-2.5 text-text-secondary">Vega $0.35 = if IV rises 1pp, the option gains ~$0.35. Why options gain value before earnings and lose it after.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout>
          AlphaStrat computes these using the textbook Black-Scholes formula with
          the 13-week Treasury bill yield (^IRX) as the risk-free rate. The model
          assumes constant volatility and no dividends — approximate, but the
          same starting point every professional desk uses.
        </Callout>
      </Section>

      {/* 8. Unusual Activity */}
      <Section id="unusual" number={8} title="Unusual Activity">
        <p className="mb-3.5 text-text-primary">
          We flag any contract where today&rsquo;s{" "}
          <strong>volume exceeds 2x open interest</strong>. When volume dwarfs
          OI, new positions are being opened at a scale much larger than the
          existing base.
        </p>
        <div className="my-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-primary text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                <th className="px-3 py-2">Volume/OI Ratio</th>
                <th className="px-3 py-2">Significance</th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              <tr className="border-b border-border-primary">
                <td className="px-3 py-2.5">2x – 5x</td>
                <td className="px-3 py-2.5 text-text-secondary">Elevated. Worth noting but not unusual on liquid names.</td>
              </tr>
              <tr className="border-b border-border-primary">
                <td className="px-3 py-2.5">5x – 10x</td>
                <td className="px-3 py-2.5 text-text-secondary">Noteworthy. Likely a significant new position being established.</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5"><Chip color="amber">&gt; 10x</Chip></td>
                <td className="px-3 py-2.5 text-text-secondary">Highly unusual. Someone is making a large directional bet. The strongest signal on the page.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mb-3.5 text-text-primary">
          We show the top 5 entries by ratio. If none exceed 2x, the section
          reports &ldquo;No unusual activity&rdquo; — which is itself
          information.
        </p>
      </Section>

      {/* 9. AI Analysis */}
      <Section id="analysis" number={9} title="AI Analysis sections">
        <p className="mb-3.5 text-text-primary">
          The six collapsible sections (Market Positioning, Expected Move,
          Volatility, Notable Flow, Risks &amp; Catalysts, Takeaway) are
          generated by Gemini Flash Lite from the pre-computed signals.
        </p>
        <p className="mb-3.5 text-text-primary">
          The AI receives the <em>exact same numbers</em> you see on the page
          and writes a narrative summary. It does <strong>not</strong> have
          access to news, social media, or any information beyond what&rsquo;s
          shown on your screen.
        </p>
        <p className="mb-3.5 text-text-primary">
          Treat the AI text as a <em>reading aid</em> — it saves you from
          interpreting every number yourself — not as research. The charts and
          numbers are the ground truth.
        </p>
      </Section>

      {/* 10. Truth vs. Interpretation */}
      <Section id="truth" number={10} title="What's real vs. what's interpretation">
        <div className="my-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-primary text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                <th className="px-3 py-2">Component</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Reliability</th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              {[
                ["Strike prices, bids, asks, volume, OI", "Yahoo Finance v7", "green", "Fact"],
                ["Expected Move, P/C Ratio, Max Pain, IV Skew", "Deterministic math", "green", "Deterministic"],
                ["Historical Volatility", "30-day log-return std dev", "green", "Deterministic"],
                ["Greeks (Delta, Gamma, Theta, Vega)", "Black-Scholes model", "amber", "Model-dependent"],
                ["Implied Volatility", "Newton-Raphson solver", "amber", "Model-dependent"],
                ["Unusual Activity flags", "Volume/OI > 2x", "green", "Deterministic"],
                ["AI narrative sections", "Gemini Flash Lite", "violet", "Interpretation"],
              ].map(([component, source, color, label]) => (
                <tr key={component} className="border-b border-border-primary last:border-b-0">
                  <td className="px-3 py-2.5">{component}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{source}</td>
                  <td className="px-3 py-2.5">
                    <Chip color={color as "green" | "red" | "amber" | "violet"}>{label}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout variant="warning">
          <strong>Key limitation:</strong> Options volume tells you{" "}
          <em>that</em> trading happened, not <em>who</em> traded or{" "}
          <em>why</em>. A large call purchase could be a bullish bet, a hedge
          against a short position, or a leg of a complex spread. Without
          order-level data, all directional interpretations — including the
          AI&rsquo;s — are educated guesses.
        </Callout>
      </Section>
    </div>
  );
}
