import Link from "next/link";
import Image from "next/image";

function GlowOrb({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-[100px] ${className}`}
    />
  );
}

function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div
      className="group relative rounded-xl border border-border-primary bg-surface-secondary/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-accent/30 hover:bg-surface-secondary"
      style={{ animationDelay: delay }}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
        {icon}
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-text-primary">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-text-tertiary">{description}</p>
    </div>
  );
}

function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums text-text-primary">
        {value}
      </div>
      <div className="mt-1 text-xs text-text-tertiary">{label}</div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* ── Background effects ── */}
      <GlowOrb className="left-1/4 top-0 h-[500px] w-[500px] -translate-x-1/2 bg-accent/[0.07]" />
      <GlowOrb className="right-1/4 top-[200px] h-[400px] w-[400px] translate-x-1/2 bg-indigo-500/[0.05]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(var(--border-primary) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 30%, black 20%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 30%, black 20%, transparent 70%)",
        }}
      />

      {/* ── Hero ── */}
      <section className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 pt-20 pb-16 text-center md:pt-28 md:pb-20">
        <div className="landing-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-border-primary bg-surface-secondary/80 px-4 py-1.5 text-xs font-medium text-text-secondary backdrop-blur-sm">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Live market data
        </div>

        <h1 className="landing-fade-in text-4xl font-bold tracking-tight text-text-primary sm:text-5xl md:text-6xl [animation-delay:100ms]">
          Research smarter.
          <br />
          <span className="bg-gradient-to-r from-accent to-indigo-400 bg-clip-text text-transparent">
            Invest with conviction.
          </span>
        </h1>

        <p className="landing-fade-in mx-auto mt-6 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg [animation-delay:200ms]">
          AI-powered equity research, options analytics, and portfolio tracking
          — everything you need to make informed decisions, in one place.
        </p>

        <div className="landing-fade-in mt-10 flex flex-col items-center gap-4 sm:flex-row [animation-delay:300ms]">
          <Link
            href="/signup"
            className="group relative inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent/90 hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98]"
          >
            Get started
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg border border-border-primary px-6 py-3 text-sm font-medium text-text-secondary transition-all hover:border-border-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            Sign in
          </Link>
        </div>

        <div className="landing-fade-in mt-14 flex items-center gap-8 sm:gap-12 [animation-delay:400ms]">
          <StatBadge value="6" label="Research tabs" />
          <div className="h-8 w-px bg-border-primary" />
          <StatBadge value="3" label="AI models" />
          <div className="h-8 w-px bg-border-primary" />
          <StatBadge value="24/7" label="Market data" />
        </div>
      </section>

      {/* ── Hero screenshot ── */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="landing-fade-in relative overflow-hidden rounded-xl border border-border-primary shadow-2xl shadow-black/20 [animation-delay:500ms]">
          <Image
            src="/images/watchlist.png"
            alt="AlphaStrat watchlist showing real-time quotes, analyst ratings, and price targets"
            width={1600}
            height={1000}
            className="w-full"
            priority
          />
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Everything you need to research a stock
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-text-tertiary">
            Six research tabs per ticker, from fundamentals to options flow —
            powered by real-time data and three AI models.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            delay="0ms"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            }
            title="Real-time Quotes"
            description="Live prices, daily change, and market status from Yahoo Finance across US and international exchanges."
          />
          <FeatureCard
            delay="50ms"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5" />
              </svg>
            }
            title="AI Investment Thesis"
            description="Fundamentals-driven buy/sell rating with bull, bear, and base cases generated by Gemini Flash Lite."
          />
          <FeatureCard
            delay="100ms"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
              </svg>
            }
            title="Options Analytics"
            description="Expected move, IV surface, term structure, Greeks, and unusual activity detection via Black-Scholes."
          />
          <FeatureCard
            delay="150ms"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            }
            title="Social Sentiment"
            description="Reddit and Twitter/X buzz, engagement metrics, and AI-explained trending context via Adanos."
          />
          <FeatureCard
            delay="200ms"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="Earnings Tracking"
            description="Upcoming earnings calendar, EPS beat/miss history, and revenue trend charts across your watchlist."
          />
          <FeatureCard
            delay="250ms"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            }
            title="Macro Dashboard"
            description="Cross-market news, AI-synthesized outlook, and sector sentiment across Fed, geopolitics, and commodities."
          />
        </div>
      </section>

      {/* ── Showcase: Thesis + Options ── */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
              AI-Powered Analysis
            </div>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-text-primary">
              Investment thesis in seconds
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-text-secondary">
              Get a fundamentals-driven buy/sell rating backed by key metrics,
              with detailed bull and bear cases. Each thesis is grounded in
              real financial data — trailing P/E, revenue growth, margins, and
              debt ratios — not generic summaries.
            </p>
            <ul className="space-y-3 text-sm text-text-secondary">
              {[
                "Rating gauge from Strong Sell to Strong Buy",
                "Six key financial metrics with context",
                "Expandable bull, bear, and base case analysis",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-xl border border-border-primary shadow-lg">
            <Image
              src="/images/thesis-tab.png"
              alt="AI investment thesis with buy rating, key metrics, and bull/bear cases for NVDA"
              width={800}
              height={600}
              className="w-full"
            />
          </div>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="order-2 overflow-hidden rounded-xl border border-border-primary shadow-lg md:order-1">
            <Image
              src="/images/options-charts.png"
              alt="Options analytics with IV surface, term structure, and expected move gauge"
              width={800}
              height={600}
              className="w-full"
            />
          </div>
          <div className="order-1 flex flex-col justify-center md:order-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
              Options Intelligence
            </div>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-text-primary">
              Read the options market like a pro
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-text-secondary">
              See what institutional traders are pricing in. Expected move
              gauge, IV surface by moneyness, term structure, positioning by
              strike, and Greeks — all computed from live options chains using
              Black-Scholes.
            </p>
            <ul className="space-y-3 text-sm text-text-secondary">
              {[
                "Expected move with max pain overlay",
                "IV surface and term structure visualization",
                "Unusual activity detection (volume/OI > 2x)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Showcase: Sentiment + Macro ── */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-border-primary shadow-lg">
            <Image
              src="/images/sentiment-tab.png"
              alt="Social sentiment with Reddit and Twitter buzz, analyst recommendations"
              width={800}
              height={600}
              className="w-full"
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-border-primary shadow-lg">
            <Image
              src="/images/macro.png"
              alt="Macro dashboard with market mood, sector sentiment, and AI outlook"
              width={800}
              height={600}
              className="w-full"
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-text-primary">
              Social Sentiment
            </h3>
            <p className="mt-1 text-xs text-text-tertiary">
              Reddit + Twitter/X buzz, engagement, and AI trend explanation
            </p>
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-text-primary">
              Macro Dashboard
            </h3>
            <p className="mt-1 text-xs text-text-tertiary">
              Cross-market news with AI outlook, sector sentiment, and driver
              chips
            </p>
          </div>
        </div>
      </section>

      {/* ── Portfolio showcase ── */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Track your portfolio performance
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-text-tertiary">
            Positions, P&L, risk metrics, and benchmark comparison — all
            updated in real time.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border-primary shadow-2xl shadow-black/20">
          <Image
            src="/images/portfolio.png"
            alt="Portfolio dashboard with performance chart, positions table, and P&L tracking"
            width={1600}
            height={1000}
            className="w-full"
          />
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-border-primary bg-surface-secondary/50 px-6 py-16 text-center backdrop-blur-sm">
          <GlowOrb className="left-1/2 top-0 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 bg-accent/[0.08]" />
          <h2 className="relative text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Start researching today
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-tertiary">
            Join with an access code and get instant access to every feature —
            real-time data, AI analysis, and portfolio tracking.
          </p>
          <div className="relative mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent/90 hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98]"
            >
              Create account
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg border border-border-primary px-6 py-3 text-sm font-medium text-text-secondary transition-all hover:border-border-secondary hover:bg-surface-secondary hover:text-text-primary"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border-primary py-8 text-center text-xs text-text-tertiary">
        <p>
          Built with Next.js, Supabase, and AI.
          Data from Yahoo Finance and Adanos.
        </p>
      </footer>
    </div>
  );
}
