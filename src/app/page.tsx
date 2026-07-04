import { RecipeBrowser } from "@/components/RecipeBrowser";
import { Shell } from "@/components/Shell";
import { SiteFooter } from "@/components/SiteFooter";
import { getAllTags, getInitialIndex } from "@/lib/cached";

export default async function HomePage() {
  const [{ items, total }, tags] = await Promise.all([
    getInitialIndex(),
    getAllTags(),
  ]);
  return (
    <Shell>
      <RecipeBrowser initialItems={items} total={total} tags={tags} />
      <SiteFooter />
    </Shell>
  );
}
