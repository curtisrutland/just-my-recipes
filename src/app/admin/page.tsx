import { getOwnerUserId } from "@/lib/admin/auth";

// 4.0 — the empty admin shell. The dashboard (Published / Drafts sections) lands
// in 4.1; for now this just proves the owner gate and chrome render. The layout
// already enforces `requireOwner()`; reading the id here is only to confirm the
// authenticated owner in the UI.
export default async function AdminHome() {
  const userId = await getOwnerUserId();

  return (
    <div>
      <h1 className="font-display text-display-sm text-ink">Admin</h1>
      <p className="mt-2 max-w-[52ch] text-[15px] leading-snug text-muted">
        Signed in as the owner. The drafts dashboard and authoring form arrive in
        the next steps.
      </p>
      <p className="mt-4 text-caption text-muted">
        <span className="font-mono">{userId}</span>
      </p>
    </div>
  );
}
