"use client";

import { useEffect, useRef, useState } from "react";
import type { RecipeListItem } from "@/lib/cached";
import { formatDuration } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/pagination";
import { RecipeRow } from "./RecipeRow";
import { SiteHeader } from "./SiteHeader";
import { SearchIcon } from "./icons";

/**
 * The index: an instant static first page (server-provided), then server-backed
 * search + tag filter + "Load more" via the public API (`/api/recipes`). The
 * default view (no query, "All") uses the server first page with no fetch; typing
 * or picking a tag fetches results, and "Load more" appends the next page. This
 * scales past the point where shipping the whole list client-side would.
 */
type ApiRecipe = {
  slug: string;
  name: string;
  tags?: string[];
  totalTime?: string;
  image?: string;
};

function toListItem(r: ApiRecipe): RecipeListItem {
  return {
    slug: r.slug,
    title: r.name,
    tags: r.tags ?? [],
    totalTime: formatDuration(r.totalTime),
    image: r.image,
  };
}

export function RecipeBrowser({
  initialItems,
  total: initialTotal,
  tags,
}: {
  initialItems: RecipeListItem[];
  total: number;
  tags: string[];
}) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("All");
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false); // replacing the list
  const [loadingMore, setLoadingMore] = useState(false);

  const reqId = useRef(0);
  const mounted = useRef(false);
  const firstRun = useRef(true);

  const qTrim = query.trim();

  async function fetchPage(reset: boolean, offset: number) {
    const id = ++reqId.current;
    const params = new URLSearchParams();
    if (qTrim) params.set("q", qTrim);
    if (activeTag !== "All") params.set("tag", activeTag.toLowerCase());
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/recipes?${params.toString()}`);
      const data = await res.json();
      if (id !== reqId.current) return; // a newer request superseded this one
      const mapped = (data.recipes as ApiRecipe[]).map(toListItem);
      setItems((prev) => (reset ? mapped : [...prev, ...mapped]));
      setTotal(typeof data.count === "number" ? data.count : mapped.length);
    } catch {
      // network hiccup — leave the current list in place
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  // Prefill ?q= once, post-hydration (keeps the page statically prerendered).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q) setQuery(q);
    mounted.current = true;
  }, []);

  // Re-fetch when the (debounced) query or the tag changes. The initial mount
  // shows the server-provided first page as-is (no fetch); every later change —
  // including clearing back to the default view — fetches a fresh first page.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => fetchPage(true, 0), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qTrim, activeTag]);

  // Reflect the search term in the URL (shareable/bookmarkable), after mount.
  useEffect(() => {
    if (!mounted.current) return;
    const url = new URL(window.location.href);
    if (qTrim) url.searchParams.set("q", qTrim);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }, [qTrim]);

  const heading = activeTag === "All" ? "All recipes" : activeTag;
  const noun = qTrim
    ? total === 1
      ? "result"
      : "results"
    : total === 1
      ? "recipe"
      : "recipes";
  const chips = ["All", ...tags];
  const hasMore = items.length < total;

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
          {qTrim && (
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
            {loading ? "Searching…" : `${total} ${noun}`}
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

        {!loading && items.length === 0 ? (
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
          <>
            <ul
              className={`list-none border-t border-line p-0 ${loading ? "opacity-60" : ""}`}
              aria-busy={loading}
            >
              {items.map((r) => (
                <RecipeRow key={r.slug} recipe={r} />
              ))}
            </ul>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchPage(false, items.length)}
                  disabled={loadingMore}
                  className="rounded-md border border-line bg-surface px-4 py-2 text-caption text-muted transition-colors hover:border-accent-line hover:text-accent disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : `Load more (${total - items.length} more)`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
