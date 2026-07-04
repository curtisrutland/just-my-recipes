"use client";

import { useEffect, useMemo, useState } from "react";
import type { RecipeListItem } from "@/lib/cached";
import { RecipeRow } from "./RecipeRow";
import { SiteHeader } from "./SiteHeader";
import { SearchIcon } from "./icons";

/**
 * The index: live client-side search + tag filtering over the already-rendered
 * list (no fetch — the page stays static). Search matches name OR any tag,
 * combines with the active tag chip, and is prefilled from `?q=` if present.
 */
export function RecipeBrowser({
  recipes,
  tags,
}: {
  recipes: RecipeListItem[];
  tags: string[];
}) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("All");

  // Prefill from ?q= after mount (keeps the page statically prerendered; a
  // deliberate post-hydration update rather than reading params during render).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q) setQuery(q);
  }, []);

  const q = query.trim().toLowerCase();
  const hasQuery = q.length > 0;

  const filtered = useMemo(() => {
    let list =
      activeTag === "All"
        ? recipes
        : recipes.filter((r) => r.tags.includes(activeTag.toLowerCase()));
    if (hasQuery) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [recipes, activeTag, q, hasQuery]);

  const heading = activeTag === "All" ? "All recipes" : activeTag;
  const n = filtered.length;
  const noun = hasQuery
    ? n === 1
      ? "result"
      : "results"
    : n === 1
      ? "recipe"
      : "recipes";
  const chips = ["All", ...tags];

  return (
    <>
      <SiteHeader>
        <div className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5">
          <SearchIcon className="flex-none text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes"
            aria-label="Search recipes"
            className="w-[98px] min-w-0 border-0 bg-transparent p-0 text-[13px] text-ink outline-none placeholder:text-muted md:w-[210px]"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="flex-none text-[16px] leading-none text-muted"
            >
              ×
            </button>
          )}
        </div>
      </SiteHeader>

      <main className="flex-1 px-5 pb-10 pt-5 md:px-14 md:pt-[30px]">
        <div className="mb-3.5 flex items-baseline justify-between gap-3">
          <h1 className="font-display text-[24px] font-bold capitalize tracking-[-0.01em] text-ink md:text-[30px]">
            {heading}
          </h1>
          <span className="whitespace-nowrap text-caption text-muted">
            {n} {noun}
          </span>
        </div>

        <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {chips.map((label) => {
            const on = activeTag === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTag(label)}
                className={`flex-none whitespace-nowrap rounded-full px-[13px] py-1.5 text-[12.5px] tracking-[0.01em] transition ${
                  label === "All" ? "" : "capitalize"
                } ${
                  on
                    ? "bg-accent text-white"
                    : "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_var(--accent-line)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {n === 0 ? (
          <div className="border-t border-line px-1 py-12 text-center">
            <div className="font-display text-[18px] font-bold text-ink">
              Nothing matches that.
            </div>
            <div className="mt-1.5 text-[13px] leading-normal text-muted">
              No recipe here — and, true to form, no story either. Try fewer
              words.
            </div>
          </div>
        ) : (
          <ul className="list-none border-t border-line p-0">
            {filtered.map((r) => (
              <RecipeRow key={r.slug} recipe={r} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
