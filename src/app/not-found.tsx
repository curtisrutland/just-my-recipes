import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col">
      <header className="flex items-center border-b border-line px-5 py-3.5 md:px-14">
        <Wordmark />
      </header>
      <div className="flex flex-1 items-center px-5 py-12 md:px-14 md:py-16">
        <div className="max-w-[30ch]">
          <div className="font-display text-[76px] font-bold leading-[0.9] tracking-[-0.02em] text-accent md:text-[104px]">
            404
          </div>
          <p className="mt-5 text-balance text-[17px] leading-snug text-ink md:text-[20px]">
            Nothing here — and, mercifully, no story about the summer I first
            discovered it.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block border-b-2 border-accent pb-0.5 font-display text-[15px] font-semibold text-accent no-underline"
          >
            Take me to the recipes →
          </Link>
        </div>
      </div>
    </div>
  );
}
