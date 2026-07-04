import Link from "next/link";
import type { RecipeRow } from "@/lib/db/schema";
import { listRecipeRows } from "@/lib/queries";
import { DeleteDraftButton } from "./DeleteDraftButton";
import { publishRecipe, unpublishRecipe } from "./actions";

const fmtDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// 4.1 — the dashboard. Two sections: Published (Edit / Unpublish) and Drafts
// (Edit / Publish / Delete). The owner gate + `connection()` live in the layout,
// so this renders inside that Suspense boundary and may read the DB directly.
export default async function AdminHome() {
  // No pagination yet (small collection); a high limit surfaces everything.
  const rows = await listRecipeRows({
    includeDrafts: true,
    limit: 500,
    offset: 0,
  });
  const published = rows.filter((r) => r.visibility === "public");
  const drafts = rows.filter((r) => r.visibility === "draft");

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
        count={drafts.length}
        empty="No drafts. New recipes and unpublished recipes land here."
      >
        {drafts.map((r) => (
          <Row key={r.slug} row={r} kind="draft" />
        ))}
      </Section>

      <Section
        title="Published"
        count={published.length}
        empty="Nothing published yet."
      >
        {published.map((r) => (
          <Row key={r.slug} row={r} kind="public" />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 font-display text-heading text-ink">
        {title}
        <span className="text-caption font-normal text-muted">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="text-caption text-muted">{empty}</p>
      ) : (
        <ul className="flex list-none flex-col gap-px overflow-hidden rounded-lg border border-line">
          {children}
        </ul>
      )}
    </section>
  );
}

function Row({ row, kind }: { row: RecipeRow; kind: "draft" | "public" }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[15.5px] font-semibold text-ink">
          {row.title}
        </div>
        <div className="mt-0.5 truncate text-caption text-muted">
          <span className="font-mono">{row.slug}</span>
          {" · "}updated {fmtDate.format(row.updatedAt)}
        </div>
      </div>
      <div className="flex flex-none items-center gap-2">
        <Link
          href={`/admin/${row.slug}/edit`}
          className="rounded-md border border-line px-2.5 py-1 text-caption text-muted no-underline transition-colors hover:border-accent-line hover:text-accent"
        >
          Edit
        </Link>
        {kind === "public" ? (
          <form action={unpublishRecipe.bind(null, row.slug)}>
            <button
              type="submit"
              className="rounded-md border border-line px-2.5 py-1 text-caption text-muted transition-colors hover:border-accent-line hover:text-accent"
            >
              Unpublish
            </button>
          </form>
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
