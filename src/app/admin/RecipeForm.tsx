"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import {
  formValuesToPayload,
  NUTRITION_FIELDS,
  type FormValues,
  type SaveState,
} from "@/lib/admin/form-model";

type Action = (prev: SaveState, payload: unknown) => Promise<SaveState>;

const inputCls =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-muted/70 focus:border-accent-line focus:outline-none";
const labelCls = "mb-1 block text-caption font-medium text-muted";

export function RecipeForm({
  initial,
  action,
  submitLabel,
  slug,
}: {
  initial: FormValues;
  action: Action;
  submitLabel: string;
  slug?: string;
}) {
  const [values, setValues] = useState<FormValues>(initial);
  const [state, submit, pending] = useActionState<SaveState, unknown>(action, {
    ok: true,
  });

  const set = <K extends keyof FormValues>(key: K, v: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const setNutrition = (key: string, v: string) =>
    setValues((prev) => ({
      ...prev,
      nutrition: { ...prev.nutrition, [key]: v },
    }));

  const updateStep = (i: number, field: "name" | "text", v: string) =>
    setValues((prev) => {
      const instructions = prev.instructions.slice();
      instructions[i] = { ...instructions[i], [field]: v };
      return { ...prev, instructions };
    });
  const addStep = () =>
    setValues((prev) => ({
      ...prev,
      instructions: [...prev.instructions, { name: "", text: "" }],
    }));
  const removeStep = (i: number) =>
    setValues((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, j) => j !== i),
    }));

  const errFor = (path: string) =>
    state.errors?.find((e) => e.path === path)?.message;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // useActionState's dispatch must run inside a transition, or `pending`
    // (the "Saving…" state) won't track and React warns.
    startTransition(() => submit(formValuesToPayload(values)));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7">
      {state.errors && state.errors.length > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-3 text-caption text-red-500">
          <p className="mb-1 font-medium">Please fix:</p>
          <ul className="list-disc pl-4">
            {state.errors.map((e, i) => (
              <li key={i}>
                {e.path ? <span className="font-mono">{e.path}</span> : null}
                {e.path ? " — " : ""}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Basics */}
      <section className="flex flex-col gap-4">
        <div>
          <label className={labelCls} htmlFor="name">
            Name<span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            className={inputCls}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Chili con Carne"
          />
          <FieldError message={errFor("name")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className={inputCls}
            rows={2}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="image">
              Image URL
            </label>
            <input
              id="image"
              className={inputCls}
              value={values.image}
              onChange={(e) => set("image", e.target.value)}
              placeholder="https://…"
            />
            <FieldError message={errFor("image")} />
          </div>
          <div>
            <label className={labelCls} htmlFor="recipeYield">
              Yield
            </label>
            <input
              id="recipeYield"
              className={inputCls}
              value={values.recipeYield}
              onChange={(e) => set("recipeYield", e.target.value)}
              placeholder="e.g. 4 servings"
            />
          </div>
        </div>
      </section>

      {/* Times */}
      <section>
        <h2 className="mb-3 font-display text-heading text-ink">Times</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Duration
            label="Prep"
            h={values.prepH}
            m={values.prepM}
            onH={(v) => set("prepH", v)}
            onM={(v) => set("prepM", v)}
          />
          <Duration
            label="Cook"
            h={values.cookH}
            m={values.cookM}
            onH={(v) => set("cookH", v)}
            onM={(v) => set("cookM", v)}
          />
          <Duration
            label="Total"
            h={values.totalH}
            m={values.totalM}
            onH={(v) => set("totalH", v)}
            onM={(v) => set("totalM", v)}
          />
        </div>
      </section>

      {/* Ingredients */}
      <section>
        <label className={labelCls} htmlFor="ingredients">
          Ingredients<span className="text-red-500">*</span>{" "}
          <span className="font-normal normal-case">— one per line</span>
        </label>
        <textarea
          id="ingredients"
          className={`${inputCls} font-mono text-[13.5px]`}
          rows={8}
          value={values.ingredients}
          onChange={(e) => set("ingredients", e.target.value)}
          placeholder={"2 tbsp olive oil\n1 onion, diced\n…"}
        />
        <FieldError message={errFor("recipeIngredient")} />
      </section>

      {/* Method */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-heading text-ink">Method</h2>
          <button
            type="button"
            onClick={addStep}
            className="rounded-md border border-line px-2.5 py-1 text-caption text-muted hover:border-accent-line hover:text-accent"
          >
            + Add step
          </button>
        </div>
        <FieldError message={errFor("recipeInstructions")} />
        <ol className="flex list-none flex-col gap-3 p-0">
          {values.instructions.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-2 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-step-bg font-display text-[14px] font-semibold text-step-ink">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 flex-col gap-2">
                <input
                  className={`${inputCls} mb-2`}
                  value={step.name}
                  onChange={(e) => updateStep(i, "name", e.target.value)}
                  placeholder="Optional heading"
                />
                <textarea
                  className={inputCls}
                  rows={2}
                  value={step.text}
                  onChange={(e) => updateStep(i, "text", e.target.value)}
                  placeholder="Step instructions…"
                />
                <FieldError message={errFor(`recipeInstructions.${i}.text`)} />
              </div>
              <button
                type="button"
                onClick={() => removeStep(i)}
                aria-label={`Remove step ${i + 1}`}
                className="mt-2 rounded-md border border-line px-2 py-1 text-caption text-muted hover:border-red-500/50 hover:text-red-500"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
        {values.instructions.length === 0 && (
          <p className="text-caption text-muted">
            No steps yet — add one, or leave empty.
          </p>
        )}
      </section>

      {/* Tags */}
      <section className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="recipeCategory">
            Category
          </label>
          <input
            id="recipeCategory"
            className={inputCls}
            value={values.recipeCategory}
            onChange={(e) => set("recipeCategory", e.target.value)}
            placeholder="comma, separated"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="recipeCuisine">
            Cuisine
          </label>
          <input
            id="recipeCuisine"
            className={inputCls}
            value={values.recipeCuisine}
            onChange={(e) => set("recipeCuisine", e.target.value)}
            placeholder="comma, separated"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="keywords">
            Keywords
          </label>
          <input
            id="keywords"
            className={inputCls}
            value={values.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            placeholder="comma, separated"
          />
        </div>
      </section>

      {/* Notes */}
      <section>
        <label className={labelCls} htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          className={inputCls}
          rows={3}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </section>

      {/* Nutrition */}
      <section>
        <h2 className="mb-1 font-display text-heading text-ink">Nutrition</h2>
        <p className="mb-3 text-caption text-muted">
          Per serving, numbers only. Leave blank to omit.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NUTRITION_FIELDS.map((f) => (
            <div key={f.key}>
              <label className={labelCls} htmlFor={f.key}>
                {f.label}{" "}
                <span className="font-normal normal-case">({f.unit})</span>
              </label>
              <input
                id={f.key}
                type="number"
                min="0"
                step="any"
                className={inputCls}
                value={values.nutrition[f.key]}
                onChange={(e) => setNutrition(f.key, e.target.value)}
              />
              <FieldError message={errFor(`nutrition.${f.key}`)} />
            </div>
          ))}
        </div>
      </section>

      {/* Visibility + submit */}
      <section className="flex flex-col gap-4 border-t border-line pt-6">
        <div>
          <span className={labelCls}>Visibility</span>
          <div className="flex gap-4">
            {(["draft", "public"] as const).map((vis) => (
              <label
                key={vis}
                className="flex items-center gap-2 text-[15px] text-ink"
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={values.visibility === vis}
                  onChange={() => set("visibility", vis)}
                />
                <span className="capitalize">{vis}</span>
              </label>
            ))}
          </div>
        </div>

        {slug && (
          <p className="text-caption text-muted">
            Slug <span className="font-mono">{slug}</span> (immutable)
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-accent-line bg-accent-soft px-4 py-2 text-[15px] font-medium text-accent hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
          <Link
            href="/admin"
            className="text-caption text-muted no-underline hover:text-ink"
          >
            Cancel
          </Link>
        </div>
      </section>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-caption text-red-500">{message}</p>;
}

function Duration({
  label,
  h,
  m,
  onH,
  onM,
}: {
  label: string;
  h: string;
  m: string;
  onH: (v: string) => void;
  onM: (v: string) => void;
}) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          className={inputCls}
          value={h}
          onChange={(e) => onH(e.target.value)}
          aria-label={`${label} hours`}
        />
        <span className="text-caption text-muted">h</span>
        <input
          type="number"
          min="0"
          className={inputCls}
          value={m}
          onChange={(e) => onM(e.target.value)}
          aria-label={`${label} minutes`}
        />
        <span className="text-caption text-muted">m</span>
      </div>
    </div>
  );
}
