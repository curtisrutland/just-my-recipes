import Image from "next/image";
import Link from "next/link";
import type { RecipeListItem } from "@/lib/cached";
import { hashtag } from "@/lib/tags";

/**
 * A single list row (shared by the index and tag views). When `activeTag` is
 * set, that tag is emphasized in the hashtag list and the others are muted.
 */
export function RecipeRow({
  recipe,
  activeTag,
}: {
  recipe: RecipeListItem;
  activeTag?: string;
}) {
  const scoped = activeTag != null;
  return (
    <li>
      <Link
        href={`/recipes/${recipe.slug}`}
        className="flex items-center gap-3.5 border-b border-line px-0.5 py-3 text-inherit no-underline md:gap-4 md:py-[15px]"
      >
        {recipe.image && (
          <Image
            src={recipe.image}
            alt=""
            width={62}
            height={62}
            className="h-[52px] w-[52px] flex-none rounded-lg border border-line object-cover md:h-[62px] md:w-[62px]"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16.5px] font-semibold leading-tight text-ink md:text-[18px]">
            {recipe.title}
          </span>
          {recipe.tags.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {recipe.tags.map((t) => {
                const on = scoped && t.toLowerCase() === activeTag.toLowerCase();
                return (
                  <span
                    key={t}
                    className={`text-[11.5px] ${
                      on
                        ? "font-semibold text-accent"
                        : scoped
                          ? "text-muted"
                          : "text-accent"
                    }`}
                  >
                    {hashtag(t)}
                  </span>
                );
              })}
            </span>
          )}
        </span>
        {recipe.totalTime && (
          <span className="flex-none whitespace-nowrap text-right text-caption text-muted">
            {recipe.totalTime}
          </span>
        )}
      </Link>
    </li>
  );
}
