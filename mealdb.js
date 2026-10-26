/* TheMealDB (https://www.themealdb.com) helpers: convert the free API's meals into RecipeBox recipes.
   Pure functions, shared by the browser (self.RBMeal) and the Node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.RBMeal = factory(root.RBCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const API = 'https://www.themealdb.com/api/json/v1/1/';
  // Cuisines that actually have dishes (the API's own area list includes many empty ones).
  // Snapshot of TheMealDB on 2026-10-26: 790 dishes, 600 tagged with a cuisine.
  const AREAS = [
    ['Algerian', 'Algeria'], ['Argentina', 'Argentina'], ['Australian', 'Australia'], ['British', 'United Kingdom'], ['Canadian', 'Canada'], ['Chinese', 'China'],
    ['Croatian', 'Croatia'], ['Egyptian', 'Egypt'], ['Filipino', 'Philippines'], ['France', 'France'], ['Greek', 'Greece'], ['India', 'India'], ['Irish', 'Ireland'],
    ['Italian', 'Italy'], ['Jamaican', 'Jamaica'], ['Japanese', 'Japan'], ['Kenyan', 'Kenya'], ['Malaysian', 'Malaysia'], ['Mexican', 'Mexico'], ['Moroccan', 'Morocco'],
    ['Netherlands', 'Netherlands'], ['Norway', 'Norway'], ['Polish', 'Poland'], ['Portuguese', 'Portugal'], ['Russian', 'Russia'], ['Saudi Arabian', 'Saudi Arabia'],
    ['Slovakia', 'Slovakia'], ['Spanish', 'Spain'], ['Syrian', 'Syria'], ['Thai', 'Thailand'], ['Tunisian', 'Tunisia'], ['Turkish', 'Turkey'], ['Ukrainian', 'Ukraine'],
    ['United States', 'United States'], ['Uruguayan', 'Uruguay'], ['Venezuela', 'Venezuela'], ['Vietnamese', 'Vietnam'],
  ].map(([value, label]) => ({ value, label }));
  const CATEGORIES = ['Beef', 'Breakfast', 'Chicken', 'Dessert', 'Goat', 'Lamb', 'Miscellaneous', 'Pasta', 'Pork', 'Seafood', 'Side', 'Starter', 'Vegan', 'Vegetarian'];
  const LIBRARY_SIZE = 790;
  const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.value.toLowerCase(), a.label]));
  const areaLabel = (a) => (a ? AREA_LABEL[String(a).toLowerCase()] || String(a) : '');

  const url = {
    search: (q) => API + 'search.php?s=' + encodeURIComponent(q),
    letter: (l) => API + 'search.php?f=' + encodeURIComponent(String(l).slice(0, 1)),
    lookup: (id) => API + 'lookup.php?i=' + encodeURIComponent(id),
    random: () => API + 'random.php',
    byArea: (a) => API + 'filter.php?a=' + encodeURIComponent(a),
    byCategory: (c) => API + 'filter.php?c=' + encodeURIComponent(c),
    byIngredient: (i) => API + 'filter.php?i=' + encodeURIComponent(String(i).trim().replace(/\s+/g, '_')),
    ingredients: () => API + 'list.php?i=list',
  };

  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const LEAD_NUM = /^((?:\d+\s+)?(?:\d+\/\d+|\d+(?:[.,]\d+)?)?\s*[½¼¾⅓⅔⅛⅜⅝⅞]?)(?:\s*(?:-|–|to)\s*(\d+(?:[.,/]\d+)?))?/;
  const WORD_UNITS = /^(pinch|dash|knob|bunch|handful|sprig|sprigs|splash|drizzle|few|small bunch|large bunch|clove|slice|piece|head|stick|can|tin|jar|packet|bag|cup|pot)$/i;
  // Lower-case names that TheMealDB writes in Title Case ("Soy Sauce"), keeping obvious proper nouns.
  function niceName(s) {
    s = clean(s);
    if (!s) return '';
    return s.split(' ').map((w, i) => (/^(Parmesan|Parmigiano|Worcestershire|Dijon|Greek|Italian|Thai|Chinese|Mexican|Cajun|Tabasco|Sriracha|Gruyère|Gruyere|Cheddar|Mozzarella|Bramley|Maris|Piper|Jersey|Madras|Bisto|Oxo|Marmite|Tahini|Christmas|Pecorino|Camembert|Brie|Emmental|Italian)$/.test(w) || /[A-Z].*[A-Z]/.test(w) ? w : w.toLowerCase())).join(' ');
  }
  // One measure + ingredient pair into a line the ingredient parser understands.
  function ingredientLine(measure, ingredient) {
    const ing = niceName(ingredient); let m = clean(measure);
    if (!ing) return '';
    if (!m) return ing;
    m = m.replace(/(\d)\s*\/\s*(\d)/g, '$1/$2').replace(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|oz|lb|lbs|cm|mm|tsp|tbsp|tbs)\b(\s*\/\s*\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|oz|lb|lbs|cups?|fl ?oz))?/i, (x, n, u) => n + ' ' + u);
    m = m.replace(/\bof\s*$/i, '').trim();
    if (/^(to taste|as required|as needed|to serve|for serving|for frying|for greasing|for brushing|garnish|to garnish|for garnish|dusting|for dusting|sprinkling|sprinking|top|topping|optional)$/i.test(m)) return `${ing}, ${m.toLowerCase().replace('sprinking', 'sprinkling')}`;
    const jz = m.match(/^(juice|zest|juice\s*\/\s*zest|zest\s*\/\s*juice|zest and juice|juice and zest)\s+of\s+(\S+)$/i);
    if (jz) { const how = /zest/i.test(jz[1]) && /juice/i.test(jz[1]) ? 'zested and juiced' : /zest/i.test(jz[1]) ? 'zested' : 'juiced'; const n = /^(one|a|an)$/i.test(jz[2]) ? '1' : jz[2]; return `${n} ${ing}, ${how}`; }
    if (/^(juice|zest)\b/i.test(m)) return `${ing}, ${m.toLowerCase()}`;
    const piece = m.match(/^(\d+(?:[.,]\d+)?)\s*(cm|mm|inch|inches|in)\b\.?\s*(piece|chunk|knob)?s?$/i);
    if (piece) return `1 ${(piece[3] || 'piece').toLowerCase()} ${ing} (${piece[1]} ${piece[2].toLowerCase().replace(/^in(ches)?$/, 'inch')})`;
    if (WORD_UNITS.test(m)) return `1 ${m.toLowerCase()} ${ing}`;
    const num = m.match(LEAD_NUM);
    if (num && num[0].trim()) {
      const qty = clean(num[0]);
      let rest = clean(m.slice(num[0].length));
      let unit = '';
      const u = rest && C.readUnit(rest);
      if (u) { unit = rest.slice(0, rest.length - u.rest.length).trim().toLowerCase(); rest = u.rest; }
      else if (/^(large|medium|small|big|whole|heaped|level|rounded)\b/i.test(rest)) { const w = rest.match(/^\S+/)[0]; unit = w.toLowerCase(); rest = clean(rest.slice(w.length)); }
      rest = rest.replace(/^(of)\b\s*/i, '');
      const note = rest ? rest.toLowerCase() : '';
      return clean(`${qty} ${unit} ${ing}`) + (note ? ', ' + note : '');
    }
    return `${ing}, ${m.toLowerCase()}`;
  }
  function mealIngredients(meal) {
    const out = [];
    for (let i = 1; i <= 20; i++) {
      const line = ingredientLine(meal['strMeasure' + i], meal['strIngredient' + i]);
      if (line) out.push(line);
    }
    return out;
  }
  // Split TheMealDB's free-form instructions into steps, dropping "STEP 1" / "1." markers.
  function splitInstructions(text) {
    const t = String(text || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
    let parts = t.split(/\n+/).map((s) => clean(s)).filter(Boolean)
      .map((s) => s.replace(/^(?:step\s*\d+[.:)\-–]?|\d+[.):\-–]|▢|•|-)\s*/i, '').trim())
      .filter((s) => s && !/^(step\s*)?\d+\.?$/i.test(s) && !/^(method|instructions|directions|preparation)\s*:?$/i.test(s));
    // One big paragraph: split into sentences and group them into readable steps.
    const out = [];
    for (const p of parts) {
      if (p.length <= 420) { out.push(p); continue; }
      const sent = p.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [p];
      let cur = '';
      for (const s of sent.map(clean).filter(Boolean)) { if (cur && (cur + ' ' + s).length > 300) { out.push(cur); cur = s; } else cur = cur ? cur + ' ' + s : s; }
      if (cur) out.push(cur);
    }
    return out;
  }
  const mealUrl = (id) => 'https://www.themealdb.com/meal/' + encodeURIComponent(id);
  const safeHttp = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
  function mealToRecipe(meal) {
    if (!meal || !meal.idMeal) return null;
    const area = areaLabel(meal.strArea || meal.strCountry);
    const tags = [meal.strCategory, area].concat(String(meal.strTags || '').split(',')).map((x) => clean(x).toLowerCase()).filter(Boolean);
    const src = safeHttp(meal.strSource);
    const yt = safeHttp(meal.strYoutube);
    const notes = [`From TheMealDB (${mealUrl(meal.idMeal)}).`, src ? `Original recipe: ${src}` : '', yt ? `Video: ${yt}` : ''].filter(Boolean).join('\n');
    const r = C.normalizeRecipe({
      id: 'mealdb-' + meal.idMeal, title: clean(meal.strMeal) || 'Untitled recipe',
      description: [meal.strCategory, area && area + ' cuisine'].filter(Boolean).join(' · '),
      ingredients: mealIngredients(meal), steps: splitInstructions(meal.strInstructions), notes, tags,
      photo: safeHttp(meal.strMealThumb), source: src || mealUrl(meal.idMeal),
    });
    r.extId = 'mealdb:' + meal.idMeal;
    return r;
  }
  // Is this meal already in the user's box? Matches by id, external id or source link.
  function findSaved(recipes, meal) {
    const id = 'mealdb-' + meal.idMeal, ext = 'mealdb:' + meal.idMeal, src = safeHttp(meal.strSource), page = mealUrl(meal.idMeal);
    return (recipes || []).find((r) => r.id === id || r.extId === ext || (r.source && (r.source === page || (src && r.source === src)))) || null;
  }
  // Merge several result lists (search + ingredient filter) without duplicates.
  function mergeResults(...lists) {
    const seen = new Set(), out = [];
    for (const l of lists) for (const m of l || []) if (m && m.idMeal && !seen.has(m.idMeal)) { seen.add(m.idMeal); out.push(m); }
    return out;
  }
  return { API, AREAS, CATEGORIES, LIBRARY_SIZE, areaLabel, url, niceName, ingredientLine, mealIngredients, splitInstructions, mealToRecipe, mealUrl, findSaved, mergeResults };
});
