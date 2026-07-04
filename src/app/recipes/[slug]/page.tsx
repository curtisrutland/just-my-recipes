import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ingredients } from "@/components/Ingredients";
import { JsonLd } from "@/components/JsonLd";
import { PrintButton } from "@/components/PrintButton";
import { SearchAffordance } from "@/components/SearchAffordance";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WakeBarButton, WakeCard, WakeLockProvider } from "@/components/WakeLock";
import { getPublicRecipe } from "@/lib/cached";
import { formatDuration } from "@/lib/format";
import { getPublicSlugs } from "@/lib/queries";
import { toJsonLd } from "@/lib/recipe";
import { SITE_URL } from "@/lib/site";
import { displayTags, tagHref } from "@/lib/tags";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await getPublicSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getPublicRecipe(slug);
  if (!recipe) return {};
  const { data } = recipe;
  return {
    title: data.name,
    description: data.description,
    alternates: { canonical: `/recipes/${slug}` },
    openGraph: {
      title: data.name,
      description: data.description,
      type: "article",
      url: `/recipes/${slug}`,
      images: data.image ? [data.image] : undefined,
    },
  };
}

export default async function RecipePage({ params }: Params) {
  const { slug } = await params;
  const recipe = await getPublicRecipe(slug);
  if (!recipe) notFound();
  const { data } = recipe;

  const meta = [
    data.recipeYield && { label: "Yield", value: data.recipeYield },
    formatDuration(data.prepTime) && {
      label: "Prep",
      value: formatDuration(data.prepTime),
    },
    formatDuration(data.cookTime) && {
      label: "Cook",
      value: formatDuration(data.cookTime),
    },
    formatDuration(data.totalTime) && {
      label: "Total",
      value: formatDuration(data.totalTime),
    },
  ].filter((m): m is { label: string; value: string } => Boolean(m));

  const pills = displayTags(data);

  return (
    <WakeLockProvider>
      <div className="recipe-detail mx-auto flex w-full max-w-[1040px] flex-1 flex-col">
        <SiteHeader>
          <SearchAffordance />
          <WakeBarButton />
        </SiteHeader>

        <article className="flex-1 px-5 pb-10 pt-5 md:px-14 md:pt-[34px]">
          <Link
            href="/"
            className="mb-3.5 inline-block text-caption tracking-[0.01em] text-muted no-underline print:hidden"
          >
            ← All recipes
          </Link>

          {/* Title block: text left, modest thumbnail right (never a hero). */}
          <div className="flex items-start gap-3.5 md:gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-balance font-display text-display-sm text-ink md:text-display-lg print:text-[23pt]">
                {data.name}
              </h1>
              {data.description && (
                <p className="mt-2 max-w-[52ch] text-[15px] leading-snug text-muted md:text-[17px] print:text-[11pt]">
                  {data.description}
                </p>
              )}
            </div>
            {data.image && (
              <Image
                src={data.image}
                alt=""
                width={168}
                height={168}
                className="h-[88px] w-[88px] flex-none rounded-xl border border-line object-cover md:h-[168px] md:w-[168px] print:hidden"
              />
            )}
          </div>

          {/* Meta strip — only cells that have data. */}
          {meta.length > 0 && (
            <div className="mt-4 flex flex-wrap overflow-hidden rounded-lg border border-line bg-surface">
              {meta.map((m) => (
                <div
                  key={m.label}
                  className="min-w-[88px] flex-1 border-r border-line px-3.5 py-[9px] last:border-r-0"
                >
                  <div className="text-label uppercase text-muted opacity-85">
                    {m.label}
                  </div>
                  <div className="mt-0.5 font-display text-meta text-ink">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <WakeCard />

          {pills.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-[7px]">
              {pills.map((tag) => (
                <Link
                  key={tag}
                  href={tagHref(tag)}
                  className="rounded-full border border-accent-line bg-accent-soft px-2.5 py-[3px] text-tag tracking-[0.01em] text-accent no-underline"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-[22px] h-px bg-line" />

          {/* Two columns: ingredients | method (stacked, ingredients first, on mobile). */}
          <div className="recipe-cols mt-[22px] flex flex-col gap-6 md:mt-[26px] md:grid md:grid-cols-[minmax(230px,300px)_1fr] md:items-start md:gap-12">
            <Ingredients
              slug={slug}
              items={data.recipeIngredient}
              yieldLabel={data.recipeYield}
            />

            <section className="min-w-0">
              <h2 className="mb-3 font-display text-heading text-ink">Method</h2>
              {data.recipeInstructions.length > 0 && (
                <ol className="flex list-none flex-col gap-4 p-0">
                  {data.recipeInstructions.map((step, i) => (
                    <li key={i} className="flex items-start gap-3.5">
                      <span className="mt-px flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-step-bg font-display text-[14px] font-semibold text-step-ink">
                        {i + 1}
                      </span>
                      <p className="text-body-lg leading-normal text-ink print:text-[12pt]">
                        {step.text}
                      </p>
                    </li>
                  ))}
                </ol>
              )}

              {data.notes && (
                <div className="mt-[26px] rounded-lg border border-dashed border-line bg-surface-sunken px-4 py-[15px]">
                  <h3 className="font-display text-[14px] font-semibold uppercase tracking-[0.02em] text-muted">
                    Notes
                  </h3>
                  <p className="mt-1.5 text-[14.5px] leading-normal text-ink print:text-[11pt]">
                    {data.notes}
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Print-only source line for a loose sheet. */}
          <div className="mt-[22px] hidden border-t border-line pt-2 text-[9pt] tracking-[0.02em] text-muted print:block">
            {data.name} · justmy.recipes
          </div>
        </article>

        <SiteFooter>
          <PrintButton />
        </SiteFooter>
      </div>

      <JsonLd data={toJsonLd(data, `${SITE_URL}/recipes/${slug}`)} />
    </WakeLockProvider>
  );
}
