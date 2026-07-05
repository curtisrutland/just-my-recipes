"use client";

import { useState } from "react";
import { TAG_CLOUD_COLLAPSED } from "@/lib/tags";

/**
 * A wrapping cloud of tag chips. Chips flow onto multiple rows instead of the
 * old single horizontal-scrolling strip (which hid most tags off the right
 * edge, especially on mobile). When there are comfortably more chips than
 * `collapsedCount`, the tail collapses behind a "Show all (N more) / Show less"
 * toggle — phrased to match the site's "Load more (N more)" pattern.
 *
 * Chips are opaque, pre-keyed nodes so both the home filter buttons and the
 * tag-page links reuse this. `defaultExpanded` lets a caller start open when an
 * important chip (e.g. the current tag) would otherwise sit in the hidden tail.
 */
export function TagCloud({
  chips,
  collapsedCount = TAG_CLOUD_COLLAPSED,
  defaultExpanded = false,
  className = "",
}: {
  chips: React.ReactNode[];
  collapsedCount?: number;
  defaultExpanded?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Only bother collapsing when it hides a meaningful number of chips —
  // otherwise a "Show all (1 more)" toggle is more noise than help.
  const canCollapse = chips.length - collapsedCount >= 3;
  const visible = expanded || !canCollapse ? chips : chips.slice(0, collapsedCount);
  const hidden = chips.length - visible.length;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {visible}
      {canCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex-none rounded-full px-3 py-1.5 text-[12.5px] tracking-[0.01em] text-muted transition hover:text-accent"
        >
          {expanded ? "Show less ▴" : `Show all (${hidden} more) ▾`}
        </button>
      )}
    </div>
  );
}
