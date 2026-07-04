import { GitHubIcon } from "./icons";

/** Footer echoing the wordmark. `children` is an optional slot (e.g. Print). */
export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="flex items-center justify-between gap-4 border-t border-line px-5 py-4 text-caption text-muted md:px-14 print:hidden">
      <span>
        justmy.recipes · No stories.
        {children ? <> {children}</> : null}
      </span>
      <span className="inline-flex items-center gap-2.5">
        <a
          href="/admin"
          className="text-muted underline-offset-2 hover:underline"
        >
          Admin
        </a>
        <a
          href="/openapi.json"
          className="text-muted underline-offset-2 hover:underline"
        >
          API
        </a>
        <a
          href="https://github.com/curtisrutland/just-my-recipes"
          aria-label="GitHub repository"
          className="inline-flex text-muted transition-colors hover:text-accent"
        >
          <GitHubIcon />
        </a>
      </span>
    </footer>
  );
}
