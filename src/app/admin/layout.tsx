import { ClerkProvider, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOwner } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Admin segment layout. `ClerkProvider` is scoped HERE (not the root layout) so
 * the public site renders with zero Clerk in its tree — a Clerk problem can
 * degrade /admin but never the public pages.
 *
 * The layout is intentionally synchronous: the static chrome (header) is the
 * prerendered shell, and the request-time owner check lives in `<OwnerGate>`
 * under `<Suspense>`. Under Cache Components, request APIs (Clerk's `auth()`)
 * must sit below a Suspense boundary or they block the whole route's prerender.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <div className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 md:px-14">
          <Link
            href="/admin"
            className="font-display text-[19px] font-bold tracking-[-0.01em] text-ink no-underline"
          >
            justmy<span className="text-accent">.</span>recipes
            <span className="ml-2 align-middle text-label uppercase tracking-[0.04em] text-muted">
              admin
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-caption text-muted no-underline hover:text-ink"
            >
              View site ↗
            </Link>
            <UserButton />
          </div>
        </header>
        <main className="flex-1 px-5 py-6 md:px-14 md:py-8">
          <Suspense fallback={<AdminLoading />}>
            <OwnerGate>{children}</OwnerGate>
          </Suspense>
        </main>
      </div>
    </ClerkProvider>
  );
}

/**
 * The authorization boundary. `proxy.ts` only guarantees *some* signed-in Clerk
 * user reached this route; this asserts it's the owner (allowlist) or 404s.
 */
async function OwnerGate({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return <>{children}</>;
}

function AdminLoading() {
  return <div className="text-caption text-muted">Loading…</div>;
}
