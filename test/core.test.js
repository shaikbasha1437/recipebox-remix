'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const P = C.parseIngredient;
const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));
const K = ['qty', 'qtyMax', 'unit', 'name', 'note'];

test('ingredient parser: quantities, fractions, units, notes', () => {
  const cases = [
    ['1 1/2 cups all-purpose flour, sifted', { qty: 1.5, qtyMax: null, unit: 'cup', name: 'all-purpose flour', note: 'sifted' }],
    ['½ tsp salt', { qty: 0.5, qtyMax: null, unit: 'tsp', name: 'salt', note: '' }],
    ['1½ cups (190g) bread flour', { qty: 1.5, qtyMax: null, unit: 'cup', name: 'bread flour', note: '190g' }],
    ['2-3 cloves garlic, minced', { qty: 2, qtyMax: 3, unit: 'clove', name: 'garlic', note: 'minced' }],
    ['2 to 3 tbsp olive oil', { qty: 2, qtyMax: 3, unit: 'tbsp', name: 'olive oil', note: '' }],
    ['1–2 Tbsp. honey', { qty: 1, qtyMax: 2, unit: 'tbsp', name: 'honey', note: '' }],
    ['1 (14 oz) can diced tomatoes', { qty: 1, qtyMax: null, unit: 'can', name: 'diced tomatoes', note: '14 oz' }],
    ['3 T butter, melted', { qty: 3, qtyMax: null, unit: 'tbsp', name: 'butter', note: 'melted' }],
    ['2 t vanilla extract', { qty: 2, qtyMax: null, unit: 'tsp', name: 'vanilla extract', note: '' }],
    ['1 c. sugar', { qty: 1, qtyMax: null, unit: 'cup', name: 'sugar', note: '' }],
    ['400g spaghetti', { qty: 400, qtyMax: null, unit: 'g', name: 'spaghetti', note: '' }],
    ['1,5 kg potatoes', { qty: 1.5, qtyMax: null, unit: 'kg', name: 'potatoes', note: '' }],
    ['0.75 l whole milk', { qty: 0.75, qtyMax: null, unit: 'l', name: 'whole milk', note: '' }],
    ['250 mL water', { qty: 250, qtyMax: null, unit: 'ml', name: 'water', note: '' }],
    ['12 oz. dark chocolate, chopped', { qty: 12, qtyMax: null, unit: 'oz', name: 'dark chocolate', note: 'chopped' }],
    ['2 lbs ground beef', { qty: 2, qtyMax: null, unit: 'lb', name: 'ground beef', note: '' }],
    ['8 fl oz heavy cream', { qty: 8, qtyMax: null, unit: 'floz', name: 'heavy cream', note: '' }],
    ['2 large eggs', { qty: 2, qtyMax: null, unit: null, name: 'large eggs', note: '' }],
    ['1 large clove garlic', { qty: 1, qtyMax: null, unit: 'clove', name: 'garlic', note: 'large' }],
    ['a pinch of nutmeg', { qty: 1, qtyMax: null, unit: 'pinch', name: 'nutmeg', note: '' }],
    ['one onion (yellow or white), diced', { qty: 1, qtyMax: null, unit: null, name: 'onion', note: 'yellow or white, diced' }],
    ['half a lemon', { qty: 0.5, qtyMax: null, unit: null, name: 'lemon', note: '' }],
    ['2 1/4 teaspoons active dry yeast', { qty: 2.25, qtyMax: null, unit: 'tsp', name: 'active dry yeast', note: '' }],
    ['1 stick unsalted butter, softened', { qty: 1, qtyMax: null, unit: 'stick', name: 'unsalted butter', note: 'softened' }],
    ['- 3 medium carrots, peeled and diced', { qty: 3, qtyMax: null, unit: null, name: 'medium carrots', note: 'peeled and diced' }],
    ['• 1/3 cup maple syrup', { qty: 1 / 3, qtyMax: null, unit: 'cup', name: 'maple syrup', note: '' }],
    ['Juice of 1 lemon', { qty: null, qtyMax: null, unit: null, name: 'Juice of 1 lemon', note: '' }],
    ['1 9-inch pie crust', { qty: 1, qtyMax: null, unit: null, name: '9-inch pie crust', note: '' }],
    ['2 sprigs fresh thyme', { qty: 2, qtyMax: null, unit: 'sprig', name: 'fresh thyme', note: '' }],
    ['1 1/2-2 cups broth', { qty: 1.5, qtyMax: 2, unit: 'cup', name: 'broth', note: '' }],
  ];
  for (const [line, exp] of cases) assert.deepEqual(pick(P(line), K), exp, line);
});
test('ingredient parser: to taste, optional, sections, blanks', () => {
  const a = P('Salt and pepper, to taste');
  assert.equal(a.toTaste, true); assert.equal(a.qty, null); assert.equal(a.name, 'Salt and pepper');
  const b = P('2 tbsp chopped parsley (optional)');
  assert.equal(b.optional, true); assert.equal(b.name, 'chopped parsley'); assert.equal(b.qty, 2);
  assert.equal(P('Fresh basil, for garnish').toTaste, true);
  assert.equal(P('For the sauce:').section, 'For the sauce');
  assert.equal(P('# Dressing').section, 'Dressing');
  assert.equal(P('').name, '');
  assert.equal(P('350°F oven').qty, null, 'temperatures are not quantities');
});
test('numbers and kitchen fraction formatting', () => {
  assert.equal(C.parseNumber('1 1/2'), 1.5); assert.equal(C.parseNumber('¾'), 0.75); assert.equal(C.parseNumber('2⅓'), 2 + 1 / 3);
  assert.equal(C.parseNumber('1-1/2'), 1.5); assert.equal(C.parseNumber('1,25'), 1.25); assert.equal(C.parseNumber('three'), 3); assert.equal(C.parseNumber('x'), null);
  const F = (n) => C.formatFraction(n, { ascii: true });
  assert.equal(F(1.5), '1 1/2'); assert.equal(F(0.333), '1/3'); assert.equal(F(0.66), '2/3'); assert.equal(F(0.25), '1/4'); assert.equal(F(0.125), '1/8');
  assert.equal(F(2.98), '3'); assert.equal(F(0.02), '1/8', 'tiny amounts never vanish'); assert.equal(F(12.4), '12 1/2'); assert.equal(F(37.2), '37'); assert.equal(F(4), '4');
  assert.equal(C.formatFraction(1.75), '1¾'); assert.equal(C.formatFraction(0.5), '½');
  assert.equal(C.roundMetric(123.4), '125'); assert.equal(C.roundMetric(7.3), '7.5'); assert.equal(C.roundMetric(42.6), '43');
});
test('scaling servings with unit tidying', () => {
  const T = (l, f, s) => C.presentIngredient(P(l), f, s || 'original').text;
  assert.equal(C.scaleFactor(4, 6), 1.5); assert.equal(C.scaleFactor(0, 6), 1); assert.equal(C.scaleFactor(4, 'x'), 1);
  assert.equal(T('1 tbsp butter', 4), '¼ cup butter');
  assert.equal(T('1/2 cup sugar', 0.25), '2 tbsp sugar');
  assert.equal(T('1 tsp salt', 3), '1 tbsp salt');
  assert.equal(T('2-3 cloves garlic, minced', 2), '4–6 cloves garlic, minced');
  assert.equal(T('3 eggs', 0.5), '1½ eggs');
  assert.equal(T('1 1/2 cups flour', 1 / 3), '½ cup flour');
  assert.equal(T('2 cups milk', 1.5), '3 cups milk');
  assert.equal(T('1 egg', 2.5), '2½ eggs');
  assert.equal(T('2 large onions', 0.5), '1 large onion');
  assert.equal(T('1 tomato', 3), '3 tomatoes');
  assert.equal(T('600 g potatoes', 2), '1.2 kg potatoes');
  assert.equal(T('Salt, to taste', 3), 'Salt, to taste');
  assert.equal(T('1 can coconut milk', 3), '3 cans coconut milk');
});
test('unit conversion: US <-> metric with ingredient densities', () => {
  const T = (l, s) => C.presentIngredient(P(l), 1, s).text;
  assert.equal(T('1 cup all-purpose flour', 'metric'), '125 g all-purpose flour');
  assert.equal(T('1 cup granulated sugar', 'metric'), '200 g granulated sugar');
  assert.equal(T('1/2 cup packed brown sugar', 'metric'), '105 g packed brown sugar');
  assert.equal(T('1 cup butter', 'metric'), '225 g butter');
  assert.equal(T('1 stick butter', 'metric'), '115 g butter');
  assert.equal(T('1 cup milk', 'metric'), '235 ml milk', 'liquids stay volumetric');
  assert.equal(T('2 tbsp olive oil', 'metric'), '30 ml olive oil');
  assert.equal(T('8 oz cream cheese', 'metric'), '225 g cream cheese');
  assert.equal(T('2 lb chicken thighs', 'metric'), '905 g chicken thighs');
  assert.equal(T('4 cups chicken broth', 'metric'), '945 ml chicken broth');
  assert.equal(T('250 g flour', 'us'), '2 cups flour');
  assert.equal(T('100 g butter', 'us'), '½ cup butter');
  assert.equal(T('500 ml milk', 'us'), '2⅛ cups milk');
  assert.equal(T('500 g chicken breast', 'us'), '1⅛ lb chicken breast');
  assert.equal(T('200 g mystery spice blend', 'us'), '7 oz mystery spice blend');
  assert.equal(T('2 cloves garlic', 'metric'), '2 cloves garlic');
  assert.equal(C.densityFor('almond flour'), 96); assert.equal(C.densityFor('all-purpose flour'), 125); assert.equal(C.densityFor('unicorn'), null);
  assert.equal(C.convertTextUnits('Bake at 350°F in a 9x13-inch pan.', 'metric'), 'Bake at 175°C in a 23×33 cm pan.');
  assert.equal(C.convertTextUnits('Roast at 425 degrees F', 'metric'), 'Roast at 220°C');
  assert.equal(C.convertTextUnits('Heat oven to 180°C, 20 cm tin', 'us'), 'Heat oven to 350°F, 8-inch tin');
  assert.equal(C.convertTextUnits('Bake at 200 C', 'us'), 'Bake at 400°F');
});
test('grocery merging across recipes with unit normalization and pantry', () => {
  const items = C.mergeGrocery([
    { ingredient: '2 cups all-purpose flour', source: 'Bread' }, { ingredient: '100 g flour', source: 'Cake' },
    { ingredient: '1 tbsp butter', factor: 2, source: 'Bread' }, { ingredient: '1/2 cup unsalted butter, melted', source: 'Cake' },
    { ingredient: '2 cloves garlic, minced', source: 'Bread' }, { ingredient: '3 garlic cloves', source: 'Soup' },
    { ingredient: '2 large eggs', source: 'Bread' }, { ingredient: '1 egg', source: 'Cake' },
    { ingredient: 'Salt, to taste', source: 'Soup' }, { ingredient: '1 tsp kosher salt', source: 'Bread' },
    { ingredient: '1 cup milk', source: 'Cake' }, { ingredient: '250 ml milk', source: 'Soup' },
    { ingredient: '2 tomatoes, diced', source: 'Soup' }, { ingredient: '1 (14 oz) can diced tomatoes', source: 'Soup' },
    { ingredient: 'For the topping:', source: 'Cake' },
  ], { pantry: ['salt'] });
  const by = Object.fromEntries(items.map((i) => [i.key, i]));
  assert.equal(by.flour.amount, '2¾ cups'); assert.deepEqual(by.flour.sources, ['Bread', 'Cake']);
  assert.equal(by.butter.amount, '⅔ cup');
  assert.equal(by.garlic.amount, '5 cloves');
  assert.equal(by.egg.amount, '3'); assert.equal(by.egg.category, 'Dairy & Eggs');
  assert.equal(by.milk.amount, '2 cups');
  assert.equal(by.salt.have, true);
  assert.equal(by.tomato.amount, '2'); assert.equal(by['can:diced tomatoe'].amount, '1 can'); assert.equal(by['can:diced tomatoe'].category, 'Canned & Jarred');
  assert.equal(items.length, 8);
  const order = items.map((i) => C.AISLE_ORDER.indexOf(i.category));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'grouped by aisle order');
  const metric = C.mergeGrocery([{ ingredient: '2 cups all-purpose flour' }, { ingredient: '100 g flour' }], { system: 'metric' });
  assert.equal(metric[0].amount, '350 g');
  const txt = C.groceryText(items, { flour: true });
  assert.match(txt, /PANTRY & BAKING\n\[x\] 2¾ cups all-purpose flour/); assert.doesNotMatch(txt, /salt/i, 'pantry items left out of the shared list');
  assert.equal(C.aisleFor('baby spinach'), 'Produce'); assert.equal(C.aisleFor('chili powder'), 'Spices & Seasonings'); assert.equal(C.aisleFor('vegetable broth'), 'Canned & Jarred'); assert.equal(C.aisleFor('garlic powder'), 'Spices & Seasonings'); assert.equal(C.aisleFor('peanut butter'), 'Canned & Jarred');
  assert.equal(C.nameKey('Large Eggs'), 'egg'); assert.equal(C.nameKey('fresh cilantro leaves, chopped'), 'cilantro');
});
test('timer detection in steps', () => {
  const D = (t) => C.detectTimers(t).map((x) => [x.seconds, x.maxSeconds]);
  assert.deepEqual(D('Bake 25 minutes.'), [[1500, 1500]]);
  assert.deepEqual(D('Simmer for 1 hour 15 minutes.'), [[4500, 4500]]);
  assert.deepEqual(D('Bake 1 hour and 30 minutes'), [[5400, 5400]]);
  assert.deepEqual(D('Cook 10-12 mins until golden'), [[600, 720]]);
  assert.deepEqual(D('Rest for an hour'), [[3600, 3600]]);
  assert.deepEqual(D('Rise 1½ hours'), [[5400, 5400]]);
  assert.deepEqual(D('Mix for half an hour'), [[1800, 1800]]);
  assert.deepEqual(D('Boil 30 seconds'), [[30, 30]]);
  assert.deepEqual(D('Sear 2 to 3 minutes per side, then roast 5 more minutes'), [[120, 180], [300, 300]]);
  assert.deepEqual(D('Bake at 350°F in a 9-inch pan'), []);
  assert.deepEqual(D('Add 2 m of string'), []);
  assert.equal(C.detectTimers('Bake 25 minutes')[0].label, '25 minutes');
  assert.equal(C.formatDuration(1500), '25:00'); assert.equal(C.formatDuration(3725), '1:02:05');
  assert.equal(C.humanMinutes(75), '1 hr 15 min');
  const ings = ['2 cups all-purpose flour', '3 large eggs', '1 cup whole milk', '2 tbsp unsalted butter', 'Salt, to taste'].map(P);
  assert.deepEqual(C.ingredientsInStep('Whisk the eggs with the milk.', ings), [1, 2]);
  assert.deepEqual(C.ingredientsInStep('Fold in the flour and melted butter, season with salt.', ings), [0, 3, 4]);
});
test('JSON-LD extraction: @graph, @type arrays, HowToSection, entities, durations', () => {
  const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Site"},
  {"@type":["Recipe","NewsArticle"],"name":"Smoky Bean Chili &amp; Cornbread","description":"<p>Cozy.</p>","image":[{"@type":"ImageObject","url":"https://ex.com/c.jpg"}],
  "recipeYield":["6","6 bowls"],"prepTime":"PT15M","cookTime":"PT1H","totalTime":"PT1H15M","keywords":"chili, beans","recipeCategory":"Dinner","recipeCuisine":["American"],
  "recipeIngredient":["2 tbsp olive oil","1 onion, diced","1 &frac12; tsp smoked paprika"],
  "recipeInstructions":[{"@type":"HowToSection","name":"Chili","itemListElement":[{"@type":"HowToStep","text":"Saut&eacute; the onion for 5 minutes."},{"@type":"HowToStep","text":"Simmer 45 minutes."}]},
  {"@type":"HowToSection","name":"To serve","itemListElement":[{"@type":"HowToStep","text":"Ladle into bowls."}]}]}]}</script></head><body></body></html>`;
  const { recipe: r, via } = C.importAny(html, 'https://ex.com/chili');
  assert.equal(via, 'json-ld');
  assert.equal(r.title, 'Smoky Bean Chili & Cornbread'); assert.equal(r.description, 'Cozy.');
  assert.equal(r.servings, 6); assert.equal(r.yieldText, '6 bowls'); assert.equal(r.prepMin, 15); assert.equal(r.cookMin, 60); assert.equal(r.totalMin, 75);
  assert.deepEqual(r.ingredients, ['2 tbsp olive oil', '1 onion, diced', '1 ½ tsp smoked paprika']);
  assert.deepEqual(r.steps, ['# Chili', 'Sauté the onion for 5 minutes.', 'Simmer 45 minutes.', '# To serve', 'Ladle into bowls.']);
  assert.deepEqual(r.tags, ['dinner', 'american', 'chili', 'beans']);
  assert.equal(r.photo, 'https://ex.com/c.jpg'); assert.equal(r.source, 'https://ex.com/chili');
  // bare JSON-LD, string instructions, mainEntity nesting, number yield
  const j = { '@context': 'https://schema.org', '@type': 'WebPage', mainEntity: { '@type': 'Recipe', name: 'Rice', recipeYield: 4, recipeIngredient: ['1 cup rice'], recipeInstructions: 'Rinse the rice.\nCook 18 minutes.', image: 'https://ex.com/r.jpg' } };
  const r2 = C.importAny(JSON.stringify(j)).recipe;
  assert.equal(r2.title, 'Rice'); assert.equal(r2.servings, 4); assert.deepEqual(r2.steps, ['Rinse the rice.', 'Cook 18 minutes.']); assert.equal(r2.photo, 'https://ex.com/r.jpg');
  // array of strings + HowToStep with name only + loose JSON with raw newline and trailing comma
  const loose = '<script type="application/ld+json">[{"@type":"Recipe","name":"Toast","recipeIngredient":["1 slice bread",],"recipeInstructions":[{"@type":"HowToStep","name":"Toast it\n well."}]}]</script>';
  const r3 = C.importAny(loose).recipe;
  assert.equal(r3.title, 'Toast'); assert.deepEqual(r3.steps, ['Toast it well.']);
  assert.equal(C.isoMinutes('PT2H30M'), 150); assert.equal(C.isoMinutes('P0DT0H20M'), 20); assert.equal(C.isoMinutes('PT90S'), 2); assert.equal(C.isoMinutes('45 mins'), 45);
  // microdata and plain HTML fallbacks
  const md = '<h1>Mom&#39;s Soup</h1><ul><li itemprop="recipeIngredient">2 carrots</li><li itemprop="recipeIngredient">1 l stock</li></ul><ol><li itemprop="recipeInstructions">Chop.</li></ol>';
  const m = C.importAny(md); assert.equal(m.via, 'microdata'); assert.equal(m.recipe.title, "Mom's Soup"); assert.deepEqual(m.recipe.ingredients, ['2 carrots', '1 l stock']);
  const plain = C.importAny('<html><body><h1>Tea</h1><h2>Ingredients</h2><ul><li>1 tea bag</li><li>1 cup water</li></ul><h2>Directions</h2><ol><li>Boil the water.</li><li>Steep 4 minutes.</li></ol></body></html>');
  assert.equal(plain.via, 'text'); assert.equal(plain.recipe.title, 'Tea'); assert.deepEqual(plain.recipe.ingredients, ['1 tea bag', '1 cup water']); assert.deepEqual(plain.recipe.steps, ['Boil the water.', 'Steep 4 minutes.']);
  assert.match(C.importAny('{"app":"recipebox-remix","recipes":[]}').error, /backup/);
  assert.match(C.importAny('{"foo":1}').error, /No schema.org Recipe/);
});
test('plain text recipe parser: headings, meta, numbered and wrapped steps', () => {
  const r = C.parseRecipeText(`Weeknight Lemon Garlic Pasta
A bright, fast pasta.
Serves: 4
Prep time: 10 minutes
Cook time: 15 mins

INGREDIENTS
- 12 oz spaghetti
- 3 tbsp butter
- 4 cloves garlic, thinly sliced
For the topping:
- ½ cup grated parmesan
- Salt and pepper, to taste

## Instructions
1. Boil the spaghetti for 9-10 minutes.
2. Melt the butter and cook the garlic
for 2 minutes until fragrant.
3) Toss everything together.

Notes
Add chili flakes for heat.`);
  assert.equal(r.title, 'Weeknight Lemon Garlic Pasta'); assert.equal(r.description, 'A bright, fast pasta.');
  assert.equal(r.servings, 4); assert.equal(r.prepMin, 10); assert.equal(r.cookMin, 15); assert.equal(r.totalMin, 25);
  assert.deepEqual(r.ingredients, ['12 oz spaghetti', '3 tbsp butter', '4 cloves garlic, thinly sliced', '# For the topping', '½ cup grated parmesan', 'Salt and pepper, to taste']);
  assert.deepEqual(r.steps, ['Boil the spaghetti for 9-10 minutes.', 'Melt the butter and cook the garlic for 2 minutes until fragrant.', 'Toss everything together.']);
  assert.equal(r.notes, 'Add chili flakes for heat.');
  // no headings: infer ingredients then steps
  const r2 = C.parseRecipeText(`Simple Pancakes
1 1/2 cups flour
2 tbsp sugar
1 egg
Whisk the dry ingredients together in a large bowl until combined.
Add the egg and stir until just smooth, then rest the batter for 5 minutes.`);
  assert.deepEqual(r2.ingredients, ['1 1/2 cups flour', '2 tbsp sugar', '1 egg']); assert.equal(r2.steps.length, 2);
  // single paragraph method is split into sentences
  const r3 = C.parseRecipeText('Toast\nIngredients\n2 slices bread\nMethod\nToast the bread. Butter it while hot. Eat right away.');
  assert.deepEqual(r3.steps, ['Toast the bread.', 'Butter it while hot.', 'Eat right away.']);
  assert.equal(C.parseRecipeText('').title, 'Untitled recipe');
});
test('bookmarklet handoff: payload encoding round-trip and source', () => {
  const p = { v: 1, url: 'https://ex.com/r', title: 'Crème brûlée – best', recipe: { '@type': 'Recipe', name: 'Crème brûlée', recipeIngredient: ['2 cups cream'], recipeInstructions: [{ '@type': 'HowToStep', text: 'Bake 40 minutes.' }] } };
  const hash = '#import=' + C.b64urlEncode(JSON.stringify(p));
  assert.match(hash, /^#import=[A-Za-z0-9_-]+$/);
  const back = C.decodeHashPayload(hash);
  assert.deepEqual(back, p);
  const r = C.recipeFromPayload(back);
  assert.equal(r.recipe.title, 'Crème brûlée'); assert.equal(r.recipe.source, 'https://ex.com/r'); assert.deepEqual(r.recipe.steps, ['Bake 40 minutes.']);
  const t = C.recipeFromPayload({ v: 1, url: 'https://ex.com/t', title: 'Tea', text: 'Ingredients\n1 tea bag\nDirections\nSteep 4 minutes.' });
  assert.equal(t.recipe.title, 'Tea'); assert.deepEqual(t.recipe.ingredients, ['1 tea bag']);
  assert.equal(C.decodeHashPayload('#/recipes'), null);
  assert.ok(C.decodeHashPayload('#import=!!!') === null || C.decodeHashPayload('#import=@@@') === null);
  assert.ok(C.decodeHashPayload('#import=abc').error);
  const src = C.bookmarkletSource('https://user.github.io/recipebox-remix/');
  assert.match(src, /^javascript:/);
  const code = decodeURIComponent(src.slice('javascript:'.length));
  assert.doesNotThrow(() => new Function(code), 'bookmarklet is valid JavaScript');
  assert.match(code, /https:\/\/user\.github\.io\/recipebox-remix\//);
});
test('backup round-trip, merge, and markdown export', () => {
  const r1 = C.parseRecipeText('Toast\nIngredients\n2 slices bread\n1 tbsp butter\nMethod\nToast the bread for 3 minutes.');
  r1.tags = ['breakfast']; r1.rating = 4; r1.favorite = true;
  const state = { recipes: [r1], plan: { '2026-10-26': [{ id: 'e1', recipeId: r1.id, servings: 2 }] }, grocery: { recipes: [{ recipeId: r1.id, servings: 4 }], manual: ['paper towels'], checked: { bread: true } }, pantry: ['butter'], settings: { units: 'metric' } };
  const json = JSON.stringify(C.makeBackup(state));
  const back = C.readBackup(json);
  assert.deepEqual(back.recipes, state.recipes); assert.deepEqual(back.plan, state.plan); assert.deepEqual(back.grocery, state.grocery); assert.deepEqual(back.pantry, state.pantry); assert.equal(back.settings.units, 'metric');
  assert.throws(() => C.readBackup('{"hello":1}'), /not a RecipeBox Remix backup/);
  const r2 = C.normalizeRecipe({ title: 'Soup', ingredients: ['1 l stock'], steps: ['Heat.'] });
  const merged = C.readBackup(json, { recipes: [r2], plan: {}, grocery: { recipes: [], manual: [], checked: {} }, pantry: ['salt'], settings: { units: 'us' } }, 'merge');
  assert.equal(merged.recipes.length, 2); assert.deepEqual(merged.pantry.sort(), ['butter', 'salt']); assert.equal(merged.settings.units, 'us');
  const md = C.toMarkdown(Object.assign({}, r1, { servings: 2 }), 2, 'original');
  assert.match(md, /^# Toast\n/); assert.match(md, /Serves 4/); assert.match(md, /- 4 slices bread/); assert.match(md, /- 2 tbsp butter/); assert.match(md, /1\. Toast the bread for 3 minutes\./); assert.match(md, /#breakfast/);
  const days = C.weekDays(new Date(2026, 9, 28));
  assert.equal(days[0], '2026-10-26'); assert.equal(days[6], '2026-11-01');
  const entries = C.groceryEntries(C.planEntries(state.plan, days), { [r1.id]: Object.assign({}, r1, { servings: 1 }) });
  assert.equal(entries.length, 2); assert.equal(entries[0].factor, 2);
});

test('step ingredient highlighting prefers the exact ingredient', () => {
  const C = require('../core.js');
  const ing = ['1 large onion, diced', 'Sliced green onions', '2 tbsp olive oil'].map(C.parseIngredient);
  assert.deepStrictEqual(C.ingredientsInStep('Add the onion and oil', ing), [0, 2]);
  assert.deepStrictEqual(C.ingredientsInStep('Top with green onions', ing), [1]);
});
