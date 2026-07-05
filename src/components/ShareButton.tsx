"use client";

import { useState } from "react";
import { ShareIcon } from "./icons";

/**
 * Share the recipe. Where the native share sheet exists (mainly mobile) it's
 * used; otherwise (typical desktop, where the sheet is absent) the canonical
 * link is copied to the clipboard with a transient "Copied!" confirmation.
 * Feature-detected up front so dismissing the native sheet is a no-op rather
 * than surprise-copying. Sits beside Print in the footer.
 */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // sheet dismissed or share failed — leave it, don't fall back to copy
      }
      return;
    }
    // No native share (typical desktop): copy the link instead.
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked (non-secure context, permissions) — nothing to do
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share this recipe"
      className="text-muted underline-offset-2 hover:underline"
    >
      <ShareIcon className="mr-1 inline align-[-0.15em]" />
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
