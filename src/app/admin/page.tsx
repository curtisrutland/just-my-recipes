import Link from "next/link";
import type { RecipeRow } from "@/lib/db/schema";
import { countRecipes, listRecipeRows, type Visibility } from "@/lib/queries";
import { DeleteDraftButton } from "./DeleteDraftButton";
import { publishRecipe, unpublishRecipe } from "./actions";

const fmtDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Rows per section before paging. Sections page independently via ?d / ?p. */
const ADMIN_PAGE_SIZE = 20;

type Search = { d?: string; p?: string };

// 4.1 — the dashboard. Two independently-paginated sections: Drafts (Edit /
// Publish / Delete) and Published (Edit / View / Unpublish). Paging is done
// server-side via search params (?d / ?p) — the page is already dynamic behind
// the owner gate + connection() in the layout, so plain navigation is simplest
// and needs no authenticated client fetch.
export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  // Counts first, so we can clamp an out-of-range page (e.g. after deletes).
  const [draftTotal, publishedTotal] = await Promise.all([
    countRecipes({ visibility: "draft", includeDrafts: true, limit: 0, offset: 0 }),
    countRecipes({ visibility: "public", includeDrafts: true, limit: 0, offset: 0 }),
  ]);
  const draftsPage = clampPage(sp.d, draftTotal);
  const publishedPage = clampPage(sp.p, publishedTotal);

  const [drafts, published] = await Promise.all([
    pageRows("draft", draftsPage),
    pageRows("public", publishedPage),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-display-sm text-ink">Recipes</h1>
        <Link
          href="/admin/new"
          className="rounded-md border border-accent-line bg-accent-soft px-3 py-1.5 text-caption font-medium text-accent no-underline hover:opacity-90"
        >
          + New recipe
        </Link>
      </div>

      <Section
        title="Drafts"
        total={draftTotal}
        empty="No drafts. New recipes and unpublished recipes land here."
      >
        {drafts.map((r) => (
          <Row key={r.slug} row={r} kind="draft" />
        ))}
        <Pager sp={sp} paramKey="d" page={draftsPage} total={draftTotal} />
      </Section>

      <Section
        title="Published"
        total={publishedTotal}
        empty="Nothing published yet."
      >
        {published.map((r) => (
          <Row key={r.slug} row={r} kind="public" />
        ))}
        <Pager sp={sp} paramKey="p" page={publishedPage} total={publishedTotal} />
      </Section>
    </div>
  );
}

function pageRows(visibility: Visibility, page: number): Promise<RecipeRow[]> {
  return listRecipeRows({
    visibility,
    includeDrafts: true,
    limit: ADMIN_PAGE_SIZE,
    offset: (page - 1) * ADMIN_PAGE_SIZE,
  });
}

/** Parse a 1-indexed page param and clamp it to [1, lastPage]. */
function clampPage(raw: string | undefined, total: number): number {
  const lastPage = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, lastPage);
}

function Section({
  title,
  total,
  empty,
  children,
}: {
  title: string;
  total: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 font-display text-heading text-ink">
        {title}
        <span className="text-caption font-normal text-muted">{total}</span>
      </h2>
      {total === 0 ? (
        <p className="text-caption text-muted">{empty}</p>
      ) : (
        <ul className="flex list-none flex-col gap-px overflow-hidden rounded-lg border border-line">
          {children}
        </ul>
      )}
    </section>
  );
}

// A dashboard row. On mobile it stacks (title/slug wrap in full width, actions
// below) so nothing is truncated off-screen; from `sm` up it's a single line
// with the title truncating and the actions pinned right.
function Row({ row, kind }: { row: RecipeRow; kind: "draft" | "public" }) {
  return (
    <li className="flex flex-col gap-2.5 bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-display text-[15.5px] font-semibold text-ink sm:truncate">
          {row.title}
        </div>
        <div className="mt-0.5 text-caption text-muted">
          <span className="break-all font-mono">{row.slug}</span>
          {" · "}updated {fmtDate.format(row.updatedAt)}
        </div>
      </div>
      <div className="flex flex-none flex-wrap items-center gap-2">
        <Link
          href={`/admin/${row.slug}/edit`}
          className="rounded-md border border-line px-2.5 py-1 text-caption text-muted no-underline transition-colors hover:border-accent-line hover:text-accent"
        >
          Edit
        </Link>
        {kind === "public" ? (
          <>
            <a
              href={`/recipes/${row.slug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-line px-2.5 py-1 text-caption text-muted no-underline transition-colors hover:border-accent-line hover:text-accent"
            >
              View ↗
            </a>
            <form action={unpublishRecipe.bind(null, row.slug)}>
              <button
                type="submit"
                className="rounded-md border border-line px-2.5 py-1 text-caption text-muted transition-colors hover:border-accent-line hover:text-accent"
              >
                Unpublish
              </button>
            </form>
          </>
        ) : (
          <>
            <form action={publishRecipe.bind(null, row.slug)}>
              <button
                type="submit"
                className="rounded-md border border-accent-line bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent transition-colors hover:opacity-90"
              >
                Publish
              </button>
            </form>
            <DeleteDraftButton slug={row.slug} />
          </>
        )}
      </div>
    </li>
  );
}

// Prev/Next pager for one section. Renders nothing when it all fits on a page.
// Links preserve the other section's page param so paging one leaves the other
// where it was.
function Pager({
  sp,
  paramKey,
  page,
  total,
}: {
  sp: Search;
  paramKey: "d" | "p";
  page: number;
  total: number;
}) {
  const lastPage = Math.ceil(total / ADMIN_PAGE_SIZE);
  if (lastPage <= 1) return null;
  const start = (page - 1) * ADMIN_PAGE_SIZE + 1;
  const end = Math.min(page * ADMIN_PAGE_SIZE, total);

  return (
    <li className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5 text-caption text-muted">
      <span>
        {start}–{end} of {total}
      </span>
      <div className="flex gap-2">
        <PagerLink href={hrefWith(sp, paramKey, page - 1)} disabled={page <= 1}>
          ← Prev
        </PagerLink>
        <PagerLink
          href={hrefWith(sp, paramKey, page + 1)}
          disabled={page >= lastPage}
        >
          Next →
        </PagerLink>
      </div>
    </li>
  );
}

function PagerLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base = "rounded-md border px-2.5 py-1 no-underline transition-colors";
  if (disabled) {
    return (
      <span className={`${base} border-line text-muted opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} border-line text-muted hover:border-accent-line hover:text-accent`}
    >
      {children}
    </Link>
  );
}

/** Build /admin?… preserving existing params, setting one section's page. */
function hrefWith(sp: Search, key: "d" | "p", value: number): string {
  const params = new URLSearchParams();
  if (sp.d) params.set("d", sp.d);
  if (sp.p) params.set("p", sp.p);
  params.set(key, String(value));
  return `/admin?${params.toString()}`;
}
