import { Wordmark } from "./Wordmark";

/** App bar: wordmark left, `children` (search + optional controls) right. */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 md:px-14 print:hidden">
      <Wordmark />
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
