import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight text-text-primary">
        AlphaStrat
      </h1>
      <p className="mt-3 text-lg text-text-secondary">
        Personal finance dashboard
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/watchlist"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent/90 active:scale-[0.98]"
        >
          Watchlist
        </Link>
      </div>
    </div>
  );
}
