import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeRow } from "@/components/RecipeRow";
import { SearchAffordance } from "@/components/SearchAffordance";
import { Shell } from "@/components/Shell";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllTags, getTagRecipes } from "@/lib/cached";
import { getPublicTags } from "@/lib/queries";
import { tagHref } from "@/lib/tags";

type Params = { params: Promise<{ tag: string }> };

export async function generateStaticParams() {
  const tags = await getPublicTags();
  return tags.map((tag) => ({ tag }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tag } = await params;
  const current = decodeURIComponent(tag).toLowerCase();
  return {
    title: `#${current}`,
    description: `Recipes tagged ${current}.`,
    alternates: { canonical: `/tags/${encodeURIComponent(current)}` },
  };
}

export default async function TagPage({ params }: Params) {
  const { tag } = await params;
  const current = decodeURIComponent(tag).toLowerCase();

  const [recipes, allTags] = await Promise.all([
    getTagRecipes(current),
    getAllTags(),
  ]);
  if (recipes.length === 0) notFound();

  return (
    <Shell>
      <SiteHeader>
        <SearchAffordance />
      </SiteHeader>

      <main className="flex-1 px-5 pb-10 pt-5 md:px-14 md:pt-[30px]">
        <Link
          href="/"
          className="mb-3.5 inline-block text-caption tracking-[0.01em] text-muted no-underline"
        >
          ← All recipes
        </Link>

        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 text-label uppercase tracking-[0.1em] text-muted">
              Tagged
            </div>
            <h1 className="font-display text-[26px] font-bold tracking-[-0.01em] text-ink md:text-[34px]">
              <span className="text-accent">#</span>
              {current}
            </h1>
          </div>
          <span className="whitespace-nowrap text-caption text-muted">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          </span>
        </div>

        {/* Lateral tag nav — jump between tags; current is active. */}
        <div className="no-scrollbar my-[22px] flex gap-1.5 overflow-x-auto pb-1">
          {allTags.map((t) => {
            const on = t === current;
            return (
              <Link
                key={t}
                href={tagHref(t)}
                className={`flex-none whitespace-nowrap rounded-full px-[13px] py-1.5 text-[12.5px] capitalize tracking-[0.01em] transition ${
                  on
                    ? "bg-accent text-white"
                    : "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_var(--accent-line)]"
                }`}
              >
                {t}
              </Link>
            );
          })}
        </div>

        <ul className="list-none border-t border-line p-0">
          {recipes.map((r) => (
            <RecipeRow key={r.slug} recipe={r} activeTag={current} />
          ))}
        </ul>
      </main>

      <SiteFooter />
    </Shell>
  );
}
