import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        AlphaStrat
      </h1>
      <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400">
        Personal finance dashboard
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/portfolio"
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Portfolio
        </Link>
      </div>
    </div>
  );
}
