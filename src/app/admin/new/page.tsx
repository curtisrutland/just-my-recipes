import Link from "next/link";
import { emptyFormValues } from "@/lib/admin/form-model";
import { createRecipeAction } from "../actions";
import { RecipeForm } from "../RecipeForm";

export default function NewRecipePage() {
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
          New recipe
        </h1>
      </div>
      <RecipeForm
        initial={emptyFormValues()}
        action={createRecipeAction}
        submitLabel="Create recipe"
      />
    </div>
  );
}
