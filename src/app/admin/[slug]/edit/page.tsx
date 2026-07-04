import Link from "next/link";
import { notFound } from "next/navigation";
import { rowToFormValues } from "@/lib/admin/form-model";
import { getRecipeRow } from "@/lib/queries";
import { updateRecipeAction } from "../../actions";
import { RecipeForm } from "../../RecipeForm";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await getRecipeRow(slug);
  if (!row) notFound();

  const initial = rowToFormValues(row.data, row.visibility);
  const action = updateRecipeAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin"
          className="text-caption text-muted no-underline hover:text-ink"
        >
          ← Recipes
        </Link>
        <h1 className="mt-2 font-display text-display-sm text-ink">
          Edit recipe
        </h1>
      </div>
      <RecipeForm
        initial={initial}
        action={action}
        submitLabel="Save changes"
        slug={slug}
      />
    </div>
  );
}
