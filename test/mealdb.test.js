'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const M = require('../mealdb.js');

const meal = {
  idMeal: '53200', strMeal: 'Prawn stir-fry', strCategory: 'Seafood', strArea: 'Thai', strTags: 'Spicy,Quick',
  strInstructions: 'step 1\r\nPut the prawns in a bowl with the garlic.\r\n\r\nstep 2\r\nHeat the oil and fry for 2 mins.\r\n3.\r\nServe with lime.',
  strMealThumb: 'https://www.themealdb.com/images/media/meals/x.jpg', strYoutube: 'https://www.youtube.com/watch?v=abc', strSource: 'https://example.com/prawns',
  strIngredient1: 'Raw tiger prawns', strMeasure1: '200g', strIngredient2: 'Garlic', strMeasure2: '3 Cloves Crushed', strIngredient3: 'Lime', strMeasure3: 'Juice of 1',
  strIngredient4: 'Ginger', strMeasure4: '3cm piece', strIngredient5: 'Salt', strMeasure5: 'To taste', strIngredient6: 'Fish Sauce', strMeasure6: '1 tblsp ',
  strIngredient7: '', strMeasure7: ' ', strIngredient8: null, strMeasure8: null,
};

test('measures + ingredients become parseable lines', () => {
  const lines = M.mealIngredients(meal);
  assert.deepEqual(lines, ['200 g raw tiger prawns', '3 cloves garlic, crushed', '1 lime, juiced', '1 piece ginger (3 cm)', 'salt, to taste', '1 tblsp fish sauce']);
  const p = lines.map(C.parseIngredient);
  assert.equal(p[0].qty, 200); assert.equal(p[0].unit, 'g');
  assert.equal(p[1].unit, 'clove'); assert.equal(p[1].note, 'crushed');
  assert.equal(p[5].unit, 'tbsp'); assert.equal(p[4].toTaste, true);
  assert.equal(M.ingredientLine('Pinch', 'Cumin'), '1 pinch cumin');
  assert.equal(M.ingredientLine('75g/3oz', 'Butter'), '75 g butter');
  assert.equal(M.ingredientLine('Zest and juice of 1', 'Lemon'), '1 lemon, zested and juiced');
  assert.equal(M.ingredientLine('', 'Rice'), 'rice');
});

test('instructions split into clean steps', () => {
  assert.deepEqual(M.splitInstructions(meal.strInstructions), ['Put the prawns in a bowl with the garlic.', 'Heat the oil and fry for 2 mins.', 'Serve with lime.']);
  const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} explains what to do next in some detail.`).join(' ');
  const parts = M.splitInstructions(long);
  assert.ok(parts.length >= 2 && parts.every((s) => s.length <= 320));
  assert.deepEqual(M.splitInstructions('1. Boil water.\n2. Add pasta.'), ['Boil water.', 'Add pasta.']);
});

test('mealToRecipe produces a normal recipe with credit, tags and links', () => {
  const r = M.mealToRecipe(meal);
  assert.equal(r.id, 'mealdb-53200'); assert.equal(r.extId, 'mealdb:53200'); assert.equal(r.title, 'Prawn stir-fry');
  assert.deepEqual(r.tags, ['seafood', 'thailand', 'spicy', 'quick']);
  assert.equal(r.source, 'https://example.com/prawns'); assert.equal(r.photo, meal.strMealThumb);
  assert.match(r.notes, /TheMealDB/); assert.match(r.notes, /youtube/);
  assert.equal(r.steps.length, 3); assert.equal(r.ingredients.length, 6);
  assert.deepEqual(C.normalizeRecipe(r).extId, 'mealdb:53200', 'extId survives normalize (backup/restore)');
  // works with the rest of the app: timers, scaling, grocery merge
  assert.equal(C.detectTimers(r.steps[1])[0].seconds, 120);
  const g = C.mergeGrocery(r.ingredients.map((ingredient) => ({ ingredient, factor: 2, source: r.title })), { system: 'metric' });
  assert.ok(g.some((i) => /prawn/.test(i.name) && /400 g/.test(i.amount)));
  const noSrc = M.mealToRecipe(Object.assign({}, meal, { strSource: '', strYoutube: 'javascript:alert(1)' }));
  assert.equal(noSrc.source, 'https://www.themealdb.com/meal/53200'); assert.doesNotMatch(noSrc.notes, /javascript/);
  assert.equal(M.mealToRecipe(null), null);
});

test('duplicate detection and result merging', () => {
  const saved = [M.mealToRecipe(meal)];
  assert.ok(M.findSaved(saved, { idMeal: '53200' }));
  assert.ok(M.findSaved([{ id: 'x', source: 'https://example.com/prawns' }], meal));
  assert.equal(M.findSaved(saved, { idMeal: '1' }), null);
  assert.deepEqual(M.mergeResults([{ idMeal: '1' }, { idMeal: '2' }], [{ idMeal: '2' }, { idMeal: '3' }], null).map((m) => m.idMeal), ['1', '2', '3']);
  assert.equal(M.areaLabel('Thai'), 'Thailand'); assert.equal(M.areaLabel('Unknownian'), 'Unknownian');
  assert.ok(M.url.byIngredient('chicken breast').endsWith('filter.php?i=chicken_breast'));
});
