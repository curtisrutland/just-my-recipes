import { RecipeBrowser } from "@/components/RecipeBrowser";
import { Shell } from "@/components/Shell";
import { SiteFooter } from "@/components/SiteFooter";
import { getAllTags, getIndexRecipes } from "@/lib/cached";

export default async function HomePage() {
  const [recipes, tags] = await Promise.all([getIndexRecipes(), getAllTags()]);
  return (
    <Shell>
      <RecipeBrowser recipes={recipes} tags={tags} />
      <SiteFooter />
    </Shell>
  );
}
