import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (PPR + `use cache`) — powers static generation of the
  // recipe pages plus on-demand `revalidateTag` on writes. See src/lib/cached.ts.
  cacheComponents: true,
  images: {
    // Recipe `image` URLs come from arbitrary recipe data; they are modest,
    // optional thumbnails. Allow any https host.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
