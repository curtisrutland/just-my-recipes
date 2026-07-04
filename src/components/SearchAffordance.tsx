import Link from "next/link";
import { SearchIcon } from "./icons";

/**
 * Non-interactive search pill for detail/tag pages. Live search lives on the
 * index, so this routes there (the query is a visual affordance only).
 */
export function SearchAffordance() {
  return (
    <Link
      href="/"
      aria-label="Search recipes"
      className="flex min-w-[120px] items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[13px] text-muted no-underline"
    >
      <SearchIcon className="flex-none" />
      <span className="opacity-75">Search</span>
    </Link>
  );
}
