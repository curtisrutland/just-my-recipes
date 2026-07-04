import { config } from "dotenv";

// Load env BEFORE importing anything that touches the DB client.
config({ path: ".env.local" });

const samples = [
  {
    name: "Brown-Butter Weeknight White Beans",
    description:
      "Creamy, garlicky, one pan, thirty-five minutes. Canned beans, no apology.",
    recipeYield: "4 servings",
    prepTime: "PT10M",
    cookTime: "PT25M",
    totalTime: "PT35M",
    keywords: ["Weeknight", "Vegetarian", "One-Pan"],
    recipeIngredient: [
      "Two 15-oz cans cannellini beans",
      "3 tbsp unsalted butter",
      "4 cloves garlic, thinly sliced",
      "1/2 tsp red chili flakes",
      "1 tbsp tomato paste",
      "3/4 cup vegetable stock",
      "Juice of 1/2 lemon",
      "1/3 cup grated parmesan",
      "Small handful parsley, chopped",
      "Salt and black pepper",
    ],
    recipeInstructions: [
      "Drain and rinse the beans. Smash a third of them roughly with a fork — this is what makes the sauce creamy.",
      "Melt the butter in a wide skillet over medium heat. Keep cooking, swirling, until it smells nutty and turns golden-brown, about 3 minutes. Don’t walk away.",
      "Add the garlic and chili flakes. Cook 30 seconds until fragrant, then stir in the tomato paste and cook another minute.",
      "Add all the beans (smashed and whole) plus the stock. Simmer 12–15 minutes until thick and glossy, stirring now and then.",
      "Off the heat, stir in the lemon juice and most of the parmesan. Season aggressively with salt and pepper.",
      "Pile onto toast or into bowls. Top with the rest of the parmesan and the parsley.",
    ],
    notes:
      "Swap the stock for pasta water if you’re cooking pasta alongside. Leftovers thicken overnight — loosen with a splash of water when reheating.",
  },
  {
    name: "Sheet-Pan Harissa Chicken",
    description: "Everything on one tray. The harissa does all the work.",
    recipeYield: "4 servings",
    prepTime: "PT15M",
    cookTime: "PT30M",
    totalTime: "PT45M",
    keywords: ["Weeknight", "Chicken"],
    recipeIngredient: [
      "8 bone-in chicken thighs",
      "3 tbsp harissa paste",
      "2 tbsp olive oil",
      "1 lb baby potatoes, halved",
      "1 red onion, cut into wedges",
      "1 lemon, half juiced, half in wedges",
      "Salt and pepper",
      "Handful cilantro, to serve",
    ],
    recipeInstructions: [
      "Heat the oven to 425°F (220°C).",
      "Toss the chicken with harissa, olive oil, lemon juice, salt and pepper.",
      "Spread the potatoes and onion on a sheet pan, tuck in the lemon wedges, and nestle the chicken on top skin-side up.",
      "Roast 30–35 minutes until the chicken is 165°F and the skin is crisp.",
      "Scatter with cilantro and serve straight from the pan.",
    ],
  },
  {
    name: "Cacio e Pepe, Done Right",
    description:
      "Three ingredients, zero cream, one emulsion you actually have to earn.",
    recipeYield: "2 servings",
    prepTime: "PT5M",
    cookTime: "PT15M",
    totalTime: "PT20M",
    keywords: ["Quick", "Pasta", "Vegetarian"],
    recipeIngredient: [
      "6 oz tonnarelli or spaghetti",
      "1 cup finely grated pecorino romano",
      "2 tsp black peppercorns, coarsely cracked",
      "Salt for the pasta water",
    ],
    recipeInstructions: [
      "Boil the pasta in well-salted water until just shy of al dente. Save 1 cup of the starchy water.",
      "Toast the cracked pepper in a dry skillet 30 seconds, then add a ladle of pasta water.",
      "Whisk the pecorino with a few tablespoons of cooled pasta water into a smooth paste.",
      "Add the pasta to the skillet, then the cheese paste, tossing hard and adding water bit by bit until glossy.",
      "Serve immediately — it waits for no one.",
    ],
    notes: "The cheese paste must not hit boiling water or it will clump. Cool the water first.",
  },
  {
    name: "Herby Chickpea Salad",
    description: "No stove, ten minutes, lunch sorted for two days.",
    recipeYield: "2 servings",
    totalTime: "PT15M",
    keywords: ["Quick", "Vegetarian", "No-Cook"],
    recipeIngredient: [
      "1 15-oz can chickpeas, drained",
      "1/2 cucumber, diced",
      "1 cup cherry tomatoes, halved",
      "1/4 red onion, finely chopped",
      "Big handful parsley and dill, chopped",
      "3 tbsp olive oil",
      "1 tbsp red wine vinegar",
      "Salt and pepper",
      "Crumbled feta, optional",
    ],
    recipeInstructions: [
      "Combine the chickpeas, cucumber, tomatoes, onion and herbs in a bowl.",
      "Whisk the oil, vinegar, salt and pepper, pour over and toss.",
      "Top with feta if using. Better after 20 minutes in the fridge.",
    ],
  },
  {
    name: "Lemon Olive-Oil Cake",
    description: "A one-bowl cake that keeps for days and asks for nothing.",
    recipeYield: "8 servings",
    prepTime: "PT15M",
    cookTime: "PT40M",
    totalTime: "PT55M",
    keywords: ["Baking", "Dessert"],
    recipeIngredient: [
      "1 1/3 cups all-purpose flour",
      "1 cup sugar",
      "3/4 cup olive oil",
      "3 eggs",
      "Zest and juice of 2 lemons",
      "1/2 cup milk",
      "1 1/2 tsp baking powder",
      "1/2 tsp salt",
    ],
    recipeInstructions: [
      "Heat the oven to 350°F (175°C) and line a 9-inch cake pan.",
      "Whisk the eggs and sugar until pale, then whisk in the oil, lemon zest and juice, and milk.",
      "Fold in the flour, baking powder and salt until just combined.",
      "Pour into the pan and bake 38–42 minutes until golden and a skewer comes out clean.",
      "Cool in the pan 10 minutes, then turn out. Dust with sugar.",
    ],
  },
];

async function main() {
  const { db } = await import("./index");
  const { recipes } = await import("./schema");
  const { createRecipe } = await import("../queries");
  const { recipeJsonLdSchema } = await import("../recipe");

  // Repeatable seed: clear recipes, keep (or lazily create) the owner.
  await db.delete(recipes);

  for (const raw of samples) {
    const doc = recipeJsonLdSchema.parse(raw);
    const row = await createRecipe(doc, "public");
    console.log(`  seeded ${row.slug}`);
  }
  console.log(`Seeded ${samples.length} recipes.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
