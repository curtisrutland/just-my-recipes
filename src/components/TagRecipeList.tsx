"use client";

import { useRef, useState } from "react";
import type { RecipeListItem } from "@/lib/cached";
import { formatDuration } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/pagination";
import { RecipeRow } from "./RecipeRow";

/**
 * A tag view's recipe list: an instant static first page (server-provided), then
 * "Load more" pages appended from the public API (`/api/recipes?tag=&limit=&offset=`).
 * Unlike the home `RecipeBrowser`, there is no search or tag-switch here — the tag
 * is fixed by the route, so this is pure pagination.
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

export function TagRecipeList({
  tag,
  initialItems,
  total,
}: {
  tag: string;
  initialItems: RecipeListItem[];
  total: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [loadingMore, setLoadingMore] = useState(false);
  const busy = useRef(false);

  async function loadMore() {
    if (busy.current) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("tag", tag);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(items.length));
      const res = await fetch(`/api/recipes?${params.toString()}`);
      const data = await res.json();
      const mapped = (data.recipes as ApiRecipe[]).map(toListItem);
      setItems((prev) => [...prev, ...mapped]);
    } catch {
      // network hiccup — leave the current list in place
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }

  const hasMore = items.length < total;

  return (
    <>
      <ul className="list-none border-t border-line p-0">
        {items.map((r) => (
          <RecipeRow key={r.slug} recipe={r} activeTag={tag} />
        ))}
      </ul>
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-md border border-line bg-surface px-4 py-2 text-caption text-muted transition-colors hover:border-accent-line hover:text-accent disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : `Load more (${total - items.length} more)`}
          </button>
        </div>
      )}
    </>
  );
}
