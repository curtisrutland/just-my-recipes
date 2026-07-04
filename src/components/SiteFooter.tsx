/** Footer echoing the wordmark. `children` is an optional slot (e.g. Print). */
export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="border-t border-line px-5 py-4 text-caption text-muted md:px-14 print:hidden">
      justmy.recipes · No stories.
      {children ? <> {children}</> : null}
    </footer>
  );
}
