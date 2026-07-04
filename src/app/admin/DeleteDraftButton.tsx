"use client";

import { useState, useTransition } from "react";
import { deleteDraftRecipe } from "./actions";

/**
 * Two-click delete for a draft row. First click arms ("Confirm?"), second click
 * fires the server action; clicking away / a 4s timeout disarms. This is the
 * single explicit confirm step — hard delete is already gated behind
 * unpublish-first, so a heavier type-the-slug challenge isn't warranted.
 */
export function DeleteDraftButton({ slug }: { slug: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    startTransition(async () => {
      await deleteDraftRecipe(slug);
      // Row disappears on re-render; no need to reset local state.
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={armed ? `Confirm delete ${slug}` : `Delete ${slug}`}
      className={
        armed
          ? "rounded-md border border-red-500/60 bg-red-500/10 px-2.5 py-1 text-caption font-medium text-red-500 transition-colors disabled:opacity-50"
          : "rounded-md border border-line px-2.5 py-1 text-caption text-muted transition-colors hover:border-red-500/50 hover:text-red-500 disabled:opacity-50"
      }
    >
      {pending ? "Deleting…" : armed ? "Confirm delete?" : "Delete"}
    </button>
  );
}
