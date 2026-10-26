/* RecipeBox Remix core: pure functions shared by the app and the Node tests.
   Parsing, fractions, scaling, unit conversion, grocery merging, timers, JSON-LD import, backups. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RBCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- numbers & fractions ----------
  const UNI = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8', '⅐': '1/7', '⅑': '1/9', '⅒': '1/10' };
  const UNI_RE = /(\d)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞⅐⅑⅒])/g;
  function normalizeFractions(s) {
    return String(s).replace(/⁄/g, '/').replace(UNI_RE, (m, d, f) => (d ? d + ' ' : ' ') + UNI[f]).replace(/^\s+/, (m) => (m.length && /^\s/.test(String(s)) ? m : ''));
  }
  const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, half: 0.5, dozen: 12, couple: 2, few: 3 };
  // Parse "1 1/2", "1/2", "1.5", "1,5", "1-1/2", "½", "one". Returns number or null.
  function parseNumber(str) {
    if (str == null) return null;
    let s = normalizeFractions(String(str)).trim().toLowerCase();
    if (!s) return null;
    if (WORDNUM[s] != null) return WORDNUM[s];
    s = s.replace(/^(\d+)-(\d+\/\d+)$/, '$1 $2');
    let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (m) return +m[3] ? +m[1] + +m[2] / +m[3] : null;
    m = s.match(/^(\d+)\/(\d+)$/);
    if (m) return +m[2] ? +m[1] / +m[2] : null;
    m = s.match(/^(\d+),(\d{1,2})$/);
    if (m) return parseFloat(m[1] + '.' + m[2]);
    m = s.match(/^\d*\.?\d+$/);
    if (m) return parseFloat(s);
    return null;
  }
  const FRACS = [[0, ''], [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4'], [1, '']];
  const GLYPH = { '1/8': '⅛', '1/4': '¼', '1/3': '⅓', '1/2': '½', '2/3': '⅔', '3/4': '¾' };
  // Kitchen-friendly fraction text: 1.5 -> "1 1/2" (ascii) or "1½" (unicode).
  function formatFraction(n, opts) {
    opts = opts || {};
    if (n == null || !isFinite(n)) return '';
    if (n < 0) return '-' + formatFraction(-n, opts);
    if (n === 0) return '0';
    if (n >= 20) return String(Math.round(n));
    let whole = Math.floor(n), frac = n - whole;
    let fr = FRACS;
    if (n >= 10) fr = [[0, ''], [1 / 2, '1/2'], [1, '']];
    let best = fr[0], err = Infinity;
    for (const f of fr) { const e = Math.abs(frac - f[0]); if (e < err - 1e-9) { err = e; best = f; } }
    if (best[0] === 1) { whole += 1; best = [0, '']; }
    if (whole === 0 && !best[1]) best = [1 / 8, '1/8']; // never round a real amount down to nothing
    const f = best[1];
    if (!f) return String(whole);
    if (opts.ascii) return whole ? whole + ' ' + f : f;
    return (whole ? String(whole) : '') + GLYPH[f];
  }
  function roundMetric(n) {
    if (n == null || !isFinite(n)) return '';
    let v;
    if (n < 1) v = Math.round(n * 100) / 100;
    else if (n < 10) v = Math.round(n * 2) / 2;
    else if (n < 100) v = Math.round(n);
    else if (n < 1000) v = Math.round(n / 5) * 5;
    else v = Math.round(n / 10) * 10;
    return String(v);
  }
  function trimDec(n, d) { return String(Math.round(n * Math.pow(10, d)) / Math.pow(10, d)); }

  // ---------- units ----------
  // kind: v = volume (ml), w = weight (g), c = count-ish
  const UNITS = {
    tsp: { kind: 'v', f: 4.92892, label: ['tsp', 'tsp'], al: ['teaspoons', 'teaspoon', 'tsps', 'tsp', 'tspn', 't'] },
    tbsp: { kind: 'v', f: 14.7868, label: ['tbsp', 'tbsp'], al: ['tablespoons', 'tablespoon', 'tblsps', 'tblsp', 'tbsps', 'tbsp', 'tbls', 'tbl', 'tbs', 'T'] },
    floz: { kind: 'v', f: 29.5735, label: ['fl oz', 'fl oz'], al: ['fluid ounces', 'fluid ounce', 'fl. oz', 'fl oz', 'floz'] },
    cup: { kind: 'v', f: 236.588, label: ['cup', 'cups'], al: ['cups', 'cup', 'c'] },
    pint: { kind: 'v', f: 473.176, label: ['pint', 'pints'], al: ['pints', 'pint', 'pts', 'pt'] },
    quart: { kind: 'v', f: 946.353, label: ['quart', 'quarts'], al: ['quarts', 'quart', 'qts', 'qt'] },
    gallon: { kind: 'v', f: 3785.41, label: ['gallon', 'gallons'], al: ['gallons', 'gallon', 'gal'] },
    ml: { kind: 'v', f: 1, label: ['ml', 'ml'], al: ['milliliters', 'milliliter', 'millilitres', 'millilitre', 'mls', 'ml', 'cc'] },
    cl: { kind: 'v', f: 10, label: ['cl', 'cl'], al: ['centiliters', 'centilitres', 'cl'] },
    dl: { kind: 'v', f: 100, label: ['dl', 'dl'], al: ['deciliters', 'decilitres', 'dl'] },
    l: { kind: 'v', f: 1000, label: ['l', 'l'], al: ['liters', 'liter', 'litres', 'litre', 'ltr', 'l'] },
    mg: { kind: 'w', f: 0.001, label: ['mg', 'mg'], al: ['milligrams', 'milligram', 'mg'] },
    g: { kind: 'w', f: 1, label: ['g', 'g'], al: ['grams', 'gram', 'grammes', 'gr', 'gms', 'g'] },
    kg: { kind: 'w', f: 1000, label: ['kg', 'kg'], al: ['kilograms', 'kilogram', 'kilos', 'kilo', 'kgs', 'kg'] },
    oz: { kind: 'w', f: 28.3495, label: ['oz', 'oz'], al: ['ounces', 'ounce', 'oz'] },
    lb: { kind: 'w', f: 453.592, label: ['lb', 'lb'], al: ['pounds', 'pound', 'lbs', 'lb'] },
    pinch: { kind: 'c', label: ['pinch', 'pinches'], al: ['pinches', 'pinch'] },
    dash: { kind: 'c', label: ['dash', 'dashes'], al: ['dashes', 'dash'] },
    drop: { kind: 'c', label: ['drop', 'drops'], al: ['drops', 'drop'] },
    clove: { kind: 'c', label: ['clove', 'cloves'], al: ['cloves', 'clove'] },
    can: { kind: 'c', label: ['can', 'cans'], al: ['cans', 'can', 'tins', 'tin'] },
    jar: { kind: 'c', label: ['jar', 'jars'], al: ['jars', 'jar'] },
    bottle: { kind: 'c', label: ['bottle', 'bottles'], al: ['bottles', 'bottle'] },
    stick: { kind: 'c', label: ['stick', 'sticks'], al: ['sticks', 'stick'] },
    slice: { kind: 'c', label: ['slice', 'slices'], al: ['slices', 'slice'] },
    piece: { kind: 'c', label: ['piece', 'pieces'], al: ['pieces', 'piece', 'pcs', 'pc'] },
    bunch: { kind: 'c', label: ['bunch', 'bunches'], al: ['bunches', 'bunch'] },
    sprig: { kind: 'c', label: ['sprig', 'sprigs'], al: ['sprigs', 'sprig'] },
    head: { kind: 'c', label: ['head', 'heads'], al: ['heads', 'head'] },
    stalk: { kind: 'c', label: ['stalk', 'stalks'], al: ['stalks', 'stalk', 'ribs', 'rib'] },
    package: { kind: 'c', label: ['package', 'packages'], al: ['packages', 'package', 'packets', 'packet', 'pkgs', 'pkg', 'packs', 'pack', 'envelopes', 'envelope', 'bags', 'bag', 'boxes', 'box'] },
    handful: { kind: 'c', label: ['handful', 'handfuls'], al: ['handfuls', 'handful'] },
    sheet: { kind: 'c', label: ['sheet', 'sheets'], al: ['sheets', 'sheet'] },
    scoop: { kind: 'c', label: ['scoop', 'scoops'], al: ['scoops', 'scoop'] },
  };
  const ALIASES = [];
  for (const k of Object.keys(UNITS)) for (const a of UNITS[k].al) ALIASES.push([a, k]);
  ALIASES.sort((a, b) => b[0].length - a[0].length);
  function unitLabel(u, qty) {
    if (!u || !UNITS[u]) return u || '';
    const L = UNITS[u].label;
    return qty != null && qty > 1 + 1e-9 ? L[1] : L[0];
  }
  // Try to read a unit at the start of s. Returns {unit, rest} or null.
  function readUnit(s) {
    for (const [a, k] of ALIASES) {
      const head = s.slice(0, a.length);
      let hit;
      if (a.length === 1) hit = a === 'c' || a === 'l' ? head.toLowerCase() === a : head === a;
      else hit = head.toLowerCase() === a.toLowerCase();
      if (!hit) continue;
      const after = s.slice(a.length);
      if (!/^\.?(?=\s|$|,|\)|;|\/)/.test(after)) continue;
      return { unit: k, rest: after.replace(/^\./, '').replace(/^\s+/, '') };
    }
    return null;
  }

  // ---------- ingredient line parser ----------
  const NUM = '(?:\\d+\\s+\\d+\\/\\d+|\\d+-\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?|\\.\\d+)';
  const QTY_RE = new RegExp('^(' + NUM + ')(?:\\s*(?:-|–|—|to|or)\\s*(' + NUM + '))?(?![\\d/])\\s*');
  const WORD_QTY_RE = /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|a couple of|a few|a dozen)\b\s*/i;
  const BULLET_RE = /^\s*(?:[-*•·▪▫◦‣⁃–—+✓✔☐☑□▢■●○]+|\[\s?[xX]?\s?\])\s*/;
  const TASTE_RE = /,?\s*\(?\b(to taste|as needed|as required|if needed|for serving|for garnish|for dusting|for greasing|to serve|to garnish)\b\)?/i;
  const OPT_RE = /,?\s*\(?\b(optional)\b\)?/i;

  function cleanLine(line) {
    return normalizeFractions(String(line || '')).replace(/\u00a0/g, ' ').replace(BULLET_RE, '').replace(/\s+/g, ' ').trim();
  }
  // Parse one ingredient line into {raw, qty, qtyMax, unit, name, note, optional, toTaste, section}
  function parseIngredient(line) {
    const raw = String(line == null ? '' : line).trim();
    let s = cleanLine(raw);
    const out = { raw, qty: null, qtyMax: null, unit: null, name: '', note: '', optional: false, toTaste: false, section: null };
    if (!s) return out;
    const sec = s.match(/^#+\s*(.+)$/) || (s.length < 60 && !/\d/.test(s.slice(0, 2)) && /:$/.test(s) ? [null, s] : null);
    if (sec) { out.section = sec[1].replace(/:\s*$/, '').trim(); return out; }
    const notes = [];
    if (TASTE_RE.test(s)) { out.toTaste = true; notes.push(s.match(TASTE_RE)[1].toLowerCase()); s = s.replace(TASTE_RE, '').trim(); }
    if (OPT_RE.test(s)) { out.optional = true; s = s.replace(OPT_RE, '').trim(); }
    let m = s.match(QTY_RE);
    if (m && !/^\d+\s*(?:%|°|degrees?\b|-inch|inch|in\b|x\s*\d|"|cm\b|mm\b)/i.test(s)) {
      out.qty = parseNumber(m[1]);
      if (m[2]) { out.qtyMax = parseNumber(m[2]); if (out.qtyMax != null && out.qtyMax < out.qty) out.qtyMax = null; }
      s = s.slice(m[0].length);
    } else if ((m = s.match(WORD_QTY_RE))) {
      const w = m[1].toLowerCase();
      const v = w === 'a couple of' ? 2 : w === 'a few' ? 3 : w === 'a dozen' ? 12 : WORDNUM[w];
      const rest = s.slice(m[0].length);
      // only treat "a"/"an" as a quantity when a unit follows ("a pinch of salt"), not "an onion"? both fine: an onion = 1
      if (!((w === 'a' || w === 'an') && /^(few|little|bit|splash|drizzle|good|generous|small handful)\b/i.test(rest))) {
        out.qty = v; s = rest;
        if (w === 'half' && /^(a|an)\s/i.test(s)) s = s.replace(/^(a|an)\s+/i, '');
      }
    }
    if (out.qty != null) {
      // "1 (14 oz) can tomatoes"
      const p = s.match(/^\(([^)]*)\)\s*/);
      if (p) { notes.push(p[1].trim()); s = s.slice(p[0].length); }
      const sizeWord = s.match(/^(small|medium|large|heaping|heaped|level|scant|generous|big|extra[- ]large)\s+/i);
      let u = readUnit(sizeWord ? s.slice(sizeWord[0].length) : s);
      if (u) {
        out.unit = u.unit; s = u.rest;
        if (sizeWord) notes.push(sizeWord[1].toLowerCase());
        if (out.unit === 'floz' && /^\(/.test(s)) { /* nothing */ }
      }
      const p2 = s.match(/^\(([^)]*)\)\s*/);
      if (p2) { notes.push(p2[1].trim()); s = s.slice(p2[0].length); }
      s = s.replace(/^of\s+/i, '');
    }
    // remaining parentheticals become notes
    s = s.replace(/\s*\(([^)]*)\)/g, (x, n) => { if (n.trim()) notes.push(n.trim()); return ''; }).trim();
    const comma = s.indexOf(',');
    if (comma > 0) { notes.push(s.slice(comma + 1).trim()); s = s.slice(0, comma).trim(); }
    out.name = s.replace(/[\s,;.]+$/, '').trim();
    out.note = notes.filter(Boolean).join(', ').replace(/\s+/g, ' ');
    return out;
  }

  // ---------- densities (grams per US cup) ----------
  const DENSITY = [
    ['all-purpose flour', 125], ['all purpose flour', 125], ['plain flour', 125], ['bread flour', 130], ['cake flour', 115], ['pastry flour', 115],
    ['whole wheat flour', 120], ['wholemeal flour', 120], ['self-rising flour', 125], ['self-raising flour', 125], ['almond flour', 96], ['almond meal', 96],
    ['coconut flour', 112], ['rye flour', 102], ['oat flour', 92], ['rice flour', 158], ['flour', 125],
    ['brown sugar', 213], ['powdered sugar', 120], ['confectioners sugar', 120], ["confectioners' sugar", 120], ['icing sugar', 120], ['caster sugar', 200], ['coconut sugar', 160], ['sugar', 200],
    ['butter', 227], ['margarine', 227], ['shortening', 191], ['coconut oil', 218],
    ['cocoa powder', 85], ['cocoa', 85], ['cornstarch', 128], ['cornflour', 128], ['corn starch', 128], ['baking powder', 220], ['baking soda', 220], ['bicarbonate of soda', 220],
    ['kosher salt', 135], ['sea salt', 230], ['salt', 288], ['yeast', 150],
    ['rolled oats', 90], ['oats', 90], ['quinoa', 170], ['arborio rice', 200], ['rice', 185], ['couscous', 175], ['lentils', 200], ['cornmeal', 150], ['polenta', 160],
    ['chocolate chips', 170], ['chopped chocolate', 170], ['raisins', 150], ['dried cranberries', 120], ['shredded coconut', 85], ['desiccated coconut', 85],
    ['walnuts', 120], ['pecans', 110], ['almonds', 140], ['peanuts', 145], ['cashews', 130], ['chopped nuts', 120], ['nuts', 120],
    ['breadcrumbs', 108], ['bread crumbs', 108], ['panko', 50], ['grated parmesan', 100], ['parmesan', 100], ['shredded cheese', 113], ['cheddar', 113], ['mozzarella', 113], ['cream cheese', 232], ['ricotta', 246],
    ['peanut butter', 258], ['honey', 340], ['maple syrup', 322], ['molasses', 337], ['corn syrup', 328], ['golden syrup', 340], ['jam', 320],
    ['heavy cream', 238], ['whipping cream', 238], ['double cream', 238], ['sour cream', 230], ['greek yogurt', 245], ['yogurt', 245], ['yoghurt', 245], ['buttermilk', 242], ['milk', 242], ['water', 237], ['broth', 240], ['stock', 240],
    ['olive oil', 216], ['vegetable oil', 218], ['canola oil', 218], ['oil', 218], ['mayonnaise', 220], ['ketchup', 240], ['soy sauce', 255], ['vinegar', 239],
    ['chopped onion', 160], ['diced onion', 160], ['spinach', 30], ['blueberries', 148], ['strawberries', 152], ['frozen peas', 145], ['peas', 145], ['corn kernels', 165],
  ].sort((a, b) => b[0].length - a[0].length);
  const LIQUIDS = /\b(water|milk|buttermilk|cream|broth|stock|oil|juice|vinegar|wine|beer|syrup|honey|molasses|sauce|extract|coffee|tea|yogurt|yoghurt|liquor|rum|vodka|brandy|whiskey|mayonnaise|ketchup)\b/i;
  function densityFor(name) {
    const n = ' ' + String(name || '').toLowerCase().replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ') + ' ';
    for (const [k, d] of DENSITY) if (n.includes(' ' + k + ' ') || n.includes(' ' + k + 's ')) return d;
    return null;
  }
  const isLiquid = (name) => LIQUIDS.test(String(name || '')) && !/\b(butter|powder|chips|chocolate|cream cheese|cheese)\b/i.test(String(name || ''));

  // ---------- amounts: scaling and unit systems ----------
  // Best US volume unit for an amount in ml.
  function bestUSVolume(ml) {
    const cup = UNITS.cup.f, tbsp = UNITS.tbsp.f, tsp = UNITS.tsp.f;
    if (ml >= 16 * cup) return { unit: 'gallon', qty: ml / UNITS.gallon.f, frac: true, only: ml >= UNITS.gallon.f };
    if (ml >= cup / 4 - 0.5) return { unit: 'cup', qty: ml / cup };
    if (ml >= tbsp - 0.2) return { unit: 'tbsp', qty: ml / tbsp };
    return { unit: 'tsp', qty: ml / tsp };
  }
  function bestUSWeight(g) {
    if (g >= UNITS.lb.f - 1) return { unit: 'lb', qty: g / UNITS.lb.f };
    return { unit: 'oz', qty: g / UNITS.oz.f };
  }
  function bestMetric(kind, base) {
    if (kind === 'v') return base >= 1000 ? { unit: 'l', qty: base / 1000 } : { unit: 'ml', qty: base };
    return base >= 1000 ? { unit: 'kg', qty: base / 1000 } : { unit: 'g', qty: base };
  }
  const TIDY = { tsp: 1, tbsp: 1, cup: 1 };
  // Convert one amount. system: 'original' | 'us' | 'metric'.
  function convertAmount(qty, unit, name, system) {
    if (qty == null || !unit || !UNITS[unit]) return { qty, unit };
    const U = UNITS[unit];
    const isButter = /\bbutter\b/i.test(name || '') && !/peanut|almond|nut butter|apple butter/i.test(name || '');
    if (unit === 'stick' && isButter) {
      if (system === 'metric') return bestMetric('w', qty * 113);
      return { qty, unit };
    }
    if (system === 'metric') {
      if (U.kind === 'v') {
        const ml = qty * U.f;
        const d = densityFor(name);
        if (d && !isLiquid(name) && (unit === 'cup' || unit === 'tbsp' || unit === 'tsp')) {
          const g = ml / UNITS.cup.f * d;
          if (g < 15 && unit !== 'cup') return { qty: ml, unit: 'ml' };
          return bestMetric('w', g);
        }
        return bestMetric('v', ml);
      }
      if (U.kind === 'w') return bestMetric('w', qty * U.f);
      return { qty, unit };
    }
    if (system === 'us') {
      if (U.kind === 'v') {
        if (!TIDY[unit] && ['floz', 'pint', 'quart', 'gallon'].includes(unit)) return { qty, unit };
        const b = bestUSVolume(qty * U.f); return { qty: b.qty, unit: b.unit };
      }
      if (U.kind === 'w') {
        if (unit === 'oz' || unit === 'lb') return bestUSWeight(qty * U.f);
        const g = qty * U.f, d = densityFor(name);
        if (d && !/\b(meat|chicken|beef|pork|fish|salmon|potato|potatoes|tomato|tomatoes|cheese block)\b/i.test(name || '')) {
          const b = bestUSVolume(g / d * UNITS.cup.f); return { qty: b.qty, unit: b.unit };
        }
        return bestUSWeight(g);
      }
      return { qty, unit };
    }
    // original: keep the unit system, but tidy tsp/tbsp/cup after scaling (12 tbsp -> 3/4 cup)
    if (TIDY[unit]) { const b = bestUSVolume(qty * U.f); return { qty: b.qty, unit: b.unit }; }
    if (unit === 'g' && qty >= 1000) return { qty: qty / 1000, unit: 'kg' };
    if (unit === 'ml' && qty >= 1000) return { qty: qty / 1000, unit: 'l' };
    if (unit === 'oz' && qty >= 16) return { qty: qty / 16, unit: 'lb' };
    return { qty, unit };
  }
  function formatQty(qty, unit) {
    if (qty == null) return '';
    if (unit && UNITS[unit] && ['g', 'ml', 'mg'].includes(unit)) return roundMetric(qty);
    if (unit === 'kg' || unit === 'l') return trimDec(qty, qty < 10 ? 2 : 1);
    if (unit === 'cl' || unit === 'dl') return trimDec(qty, 1);
    return formatFraction(qty);
  }
  // Scale and convert a parsed ingredient for display.
  function presentIngredient(ing, factor, system) {
    factor = factor == null ? 1 : factor;
    if (ing.section) return { section: ing.section };
    if (ing.qty == null) return { qtyText: '', unitText: '', name: ing.name, note: ing.note, toTaste: ing.toTaste, optional: ing.optional, text: [ing.name, ing.note].filter(Boolean).join(', ') };
    const a = convertAmount(ing.qty * factor, ing.unit, ing.name, system || 'original');
    let qtyText = formatQty(a.qty, a.unit);
    let unit = a.unit;
    if (ing.qtyMax != null) {
      const b = convertAmount(ing.qtyMax * factor, ing.unit, ing.name, system || 'original');
      if (b.unit === a.unit) { const t = formatQty(b.qty, b.unit); if (t !== qtyText) qtyText += '–' + t; }
    }
    const unitText = unit ? unitLabel(unit, ing.qtyMax != null ? ing.qtyMax * factor : a.qty) : '';
    let name = ing.name;
    if (!unit && factor !== 1) name = countNoun(name, ing.qtyMax != null ? ing.qtyMax * factor : a.qty, ing.qtyMax != null ? ing.qtyMax : ing.qty);
    const text = [qtyText, unitText, name].filter(Boolean).join(' ') + (ing.note ? ', ' + ing.note : '');
    return { qtyText, unitText, name, note: ing.note, toTaste: ing.toTaste, optional: ing.optional, text, qty: a.qty, unit };
  }
  const MASS = /^(water|milk|salt|pepper|sugar|flour|rice|butter|oil|cream|cheese|bread|garlic|ginger|spinach|lettuce|cilantro|parsley|basil|dill|mint|thyme|broth|stock|juice|zest|yeast|honey|chocolate|pasta|spaghetti|meat|beef|pork|chicken|fish|tofu|corn|celery|kale|asparagus|broccoli|cabbage|cauliflower)$/i;
  function countNoun(name, newQty, oldQty) {
    const m = String(name).match(/^(.*?)([A-Za-z]+)$/);
    if (!m || MASS.test(m[2]) || m[2].length < 3) return name;
    const w = m[2];
    const plural = (x) => /[^aeiou]y$/i.test(x) ? x.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/i.test(x) ? x + 'es' : /(tomato|potato|mango)$/i.test(x) ? x + 'es' : x + 's';
    const isPlural = /s$/i.test(w) && !/ss$/i.test(w);
    if (newQty > 1 + 1e-9 && oldQty <= 1 + 1e-9 && !isPlural) return m[1] + plural(w);
    if (newQty <= 1 + 1e-9 && oldQty > 1 + 1e-9 && isPlural) return m[1] + singular(w.toLowerCase()).replace(/^./, (c) => (w[0] === w[0].toUpperCase() ? c.toUpperCase() : c));
    return name;
  }
  function scaleFactor(fromServings, toServings) {
    const f = Number(fromServings), t = Number(toServings);
    if (!(f > 0) || !(t > 0)) return 1;
    return t / f;
  }

  // ---------- temperatures and sizes in step text ----------
  function convertTextUnits(text, system) {
    let s = String(text || '');
    if (system === 'metric') {
      s = s.replace(/(\d{2,3})\s*(?:°\s*|º\s*|degrees?\s*)(?:F|Fahrenheit)\b|(\d{3})\s*F\b/g, (m, a, b) => Math.round(((+(a || b)) - 32) * 5 / 9 / 5) * 5 + '°C');
      s = s.replace(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)(?:-|\s)?(?:inch|inches|in\.|")/gi, (m, a, b) => Math.round(a * 2.54) + '×' + Math.round(b * 2.54) + ' cm');
      s = s.replace(/(\d+(?:\.\d+)?)(?:-|\s)(?:inch|inches)\b/gi, (m, a) => trimDec(a * 2.54, a * 2.54 < 10 ? 1 : 0) + ' cm');
    } else if (system === 'us') {
      s = s.replace(/(\d{2,3})\s*(?:°\s*|º\s*|degrees?\s*)(?:C|Celsius|centigrade)\b|(\d{3})\s*C\b/g, (m, a, b) => { const f = (+(a || b)) * 9 / 5 + 32; return (f >= 200 ? Math.round(f / 25) * 25 : Math.round(f / 5) * 5) + '°F'; });
      s = s.replace(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*cm\b/gi, (m, a, b) => Math.round(a / 2.54) + '×' + Math.round(b / 2.54) + '-inch');
      s = s.replace(/(\d+(?:\.\d+)?)\s*(?:-\s*)?cm\b/gi, (m, a) => Math.round(a / 2.54) + '-inch');
    }
    return s;
  }

  // ---------- timers ----------
  const TNUM = '(\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|forty-five|sixty|half an?|a half)';
  const TUNIT = '(hours?|hrs?|minutes?|mins?|seconds?|secs?)\\b';
  const TWORD = { fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, sixty: 60 };
  const T_ONE = TNUM + '(?:\\s*(?:-|–|—|to|or)\\s*' + TNUM + ')?\\s*(?:more\\s+|additional\\s+|extra\\s+)?' + TUNIT;
  const TIMER_RE = new RegExp('(?:^|[^\\w/])(' + T_ONE + '(?:\\s*(?:,|and)?\\s*' + T_ONE + ')?(?:\\s+and\\s+a\\s+half)?)', 'gi');
  function tnum(w) {
    if (w == null) return null;
    w = w.toLowerCase();
    if (w === 'a' || w === 'an') return 1;
    if (/^half an?$/.test(w) || w === 'a half') return 0.5;
    if (TWORD[w] != null) return TWORD[w];
    return parseNumber(w);
  }
  const unitSec = (u) => /^h/i.test(u) ? 3600 : /^s/i.test(u) ? 1 : 60;
  function detectTimers(text) {
    const s = normalizeFractions(String(text || ''));
    const out = [];
    const one = new RegExp(T_ONE, 'gi');
    let m;
    TIMER_RE.lastIndex = 0;
    while ((m = TIMER_RE.exec(s))) {
      const phrase = m[1];
      // ignore bare "m"/"s"/"h" that are not durations ("2 s" ok, "350 F" not matched anyway)
      let total = 0, totalMax = 0, parts = 0, p;
      one.lastIndex = 0;
      while ((p = one.exec(phrase))) {
        const a = tnum(p[1]), b = tnum(p[2]), u = unitSec(p[3]);
        if (a == null) continue;
        if (/^[mhs]$/i.test(p[3]) && !/^\d/.test(p[1])) continue;
        total += a * u; totalMax += (b != null && b > a ? b : a) * u; parts++;
      }
      if (/and\s+a\s+half$/i.test(phrase)) { const lastU = unitSec((phrase.match(new RegExp(TUNIT, 'gi')) || ['m']).pop()); total += lastU / 2; totalMax += lastU / 2; }
      if (!parts || total <= 0 || total > 48 * 3600) continue;
      const idx = m.index + m[0].indexOf(phrase);
      out.push({ label: phrase.trim(), seconds: Math.round(total), maxSeconds: Math.round(totalMax), index: idx, length: phrase.length });
    }
    return out;
  }
  function formatDuration(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0');
  }
  function humanMinutes(min) {
    if (!(min > 0)) return '';
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return (h ? h + ' hr' : '') + (h && m ? ' ' : '') + (m ? m + ' min' : '');
  }

  // ---------- names: normalization for matching / merging ----------
  const PREP = new Set('chopped minced diced sliced grated shredded crushed peeled cubed halved quartered trimmed rinsed drained softened melted cold warm hot room temperature fresh freshly finely roughly coarsely thinly thickly lightly packed firmly sifted divided beaten whisked large medium small extra big heaping heaped level scant generous ripe boneless skinless uncooked cooked raw organic plus more about approximately of the a an and or for to taste into pieces piece inch cut torn whole optional good quality best'.split(' '));
  function singular(w) {
    if (w.length <= 3) return w;
    if (/(ss|us|is)$/.test(w)) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/(ves)$/.test(w) && !/(cloves|olives|chives)$/.test(w)) return w.slice(0, -3) + 'f';
    if (/(oes|ches|shes|xes)$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function nameKey(name) {
    let n = String(name || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/,.*$/, '').replace(/[^a-z0-9' -]/g, ' ').replace(/-/g, ' ');
    const words = n.split(/\s+/).filter((w) => w && !PREP.has(w) && !/^\d/.test(w));
    if (!words.length) return n.trim();
    words[words.length - 1] = singular(words[words.length - 1]);
    let k = words.join(' ');
    const SYN = { 'all purpose flour': 'flour', 'plain flour': 'flour', 'ap flour': 'flour', 'granulated sugar': 'sugar', 'white sugar': 'sugar', 'caster sugar': 'sugar', 'scallion': 'green onion', 'spring onion': 'green onion', 'garlic clove': 'garlic', 'clove garlic': 'garlic', 'yellow onion': 'onion', 'unsalted butter': 'butter', 'salted butter': 'butter', 'extra virgin olive oil': 'olive oil', 'virgin olive oil': 'olive oil', 'kosher salt': 'salt', 'sea salt': 'salt', 'table salt': 'salt', 'black pepper': 'pepper', 'ground black pepper': 'pepper', 'egg yolk': 'egg yolk', 'cilantro leave': 'cilantro', 'coriander leave': 'cilantro', 'parsley leave': 'parsley', 'lemon juice': 'lemon juice', 'chicken stock': 'chicken broth', 'vegetable stock': 'vegetable broth', 'confectioners sugar': 'powdered sugar', "confectioners' sugar": 'powdered sugar', 'icing sugar': 'powdered sugar' };
    k = k.replace(/^(cilantro|parsley|basil|mint|sage|thyme|oregano|curry|bay) (leaf|sprig)$/, '$1');
    if (SYN[k]) k = SYN[k];
    else if (/^salt and pepper$/.test(k)) k = 'salt and pepper';
    return k;
  }
  // Which ingredients does a step mention? Returns indexes into ingredients.
  function ingredientsInStep(step, ingredients) {
    const t = ' ' + String(step || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ') + ' ';
    const hits = [];
    (ingredients || []).forEach((ing, i) => {
      if (!ing || ing.section || !ing.name) return;
      const k = nameKey(ing.name);
      const words = k.split(' ').filter((w) => w.length > 2 && !['salt and pepper'].includes(w));
      if (!words.length) return;
      const head = words[words.length - 1];
      const stem = head.replace(/(e?s)$/, '');
      const re = new RegExp('\\b' + stem.replace(/[^a-z0-9]/g, '') + '(e?s|ies|y)?\\b');
      const full = words.length > 1 && new RegExp('\\b' + words.slice(0, -1).join(' ').replace(/[^a-z0-9 ]/g, '') + ' ' + stem.replace(/[^a-z0-9]/g, '') + '(e?s|ies|y)?\\b').test(t);
      if (full || re.test(t)) hits.push({ i, stem, full, n: words.length });
    });
    // "onion" in a step means the plain onion, not "green onions", unless the full phrase appears.
    return hits.filter((h) => {
      const g = hits.filter((x) => x.stem === h.stem);
      if (g.some((x) => x.full)) return h.full;
      return h.n === Math.min(...g.map((x) => x.n));
    }).map((h) => h.i);
  }

  // ---------- grocery aisles & merging ----------
  const AISLES = [
    ['Produce', /\b(apple|banana|lemon|lime|orange|berr(y|ies)|strawberr|blueberr|raspberr|grape|avocado|tomato|potato|onion|shallot|garlic|ginger|carrot|celery|lettuce|spinach|kale|arugula|cabbage|broccoli|cauliflower|zucchini|squash|pumpkin|cucumber|pepper(s)? (red|green|yellow)|bell pepper|jalape|chil(e|i|ies)|mushroom|corn on|herb|basil|parsley|cilantro|coriander leaves|mint|dill|thyme|rosemary|sage|chive|scallion|green onion|spring onion|leek|eggplant|aubergine|pea pods|green bean|asparagus|beet|radish|sweet potato|mango|pineapple|peach|pear|plum|cherr|melon|watermelon|fruit|vegetable|salad|sprout)/i],
    ['Meat & Seafood', /\b(chicken|beef|pork|lamb|turkey|bacon|sausage|ham|steak|mince|ground (beef|pork|turkey|chicken)|prosciutto|chorizo|salmon|tuna steak|cod|shrimp|prawn|fish|scallop|crab|lobster|anchov)/i],
    ['Dairy & Eggs', /\b(milk|butter|cream|cheese|cheddar|mozzarella|parmesan|feta|ricotta|yogurt|yoghurt|eggs?|ghee|buttermilk|creme fraiche|sour cream|half-and-half)\b/i],
    ['Bakery', /\b(bread|baguette|bun|roll|tortilla|pita|naan|croissant|bagel|brioche|sourdough|pizza dough|pie crust)\b/i],
    ['Frozen', /\bfrozen\b|\bice cream\b/i],
    ['Canned & Jarred', /\b(canned|can of|tinned|tomato paste|tomato sauce|passata|crushed tomatoes|diced tomatoes|coconut milk|beans|chickpea|lentil|broth|stock|olives|pickle|capers|salsa|jam|peanut butter|tahini)\b/i],
    ['Spices & Seasonings', /\b(garlic powder|onion powder|ground ginger|salt|pepper|cumin|paprika|cinnamon|nutmeg|clove|turmeric|curry|chili powder|chilli powder|oregano|bay lea|garam masala|cardamom|cayenne|spice|seasoning|vanilla|extract|red pepper flakes|allspice|coriander|fennel seed|mustard seed|za'atar|sumac)\b/i],
    ['Pantry & Baking', /\b(flour|sugar|baking|yeast|cocoa|chocolate|oil|vinegar|honey|syrup|molasses|rice|pasta|spaghetti|noodle|oats|quinoa|couscous|cornstarch|cornmeal|breadcrumb|panko|nut|almond|walnut|pecan|cashew|peanut|raisin|seed|soy sauce|fish sauce|worcestershire|ketchup|mustard|mayo|mayonnaise|sriracha|hot sauce|stock cube|bouillon|gelatin|coconut)\b/i],
    ['Beverages', /\b(wine|beer|juice|coffee|tea|soda|sparkling water|rum|vodka|whiskey|brandy)\b/i],
  ];
  const AISLE_ORDER = AISLES.map((a) => a[0]).concat(['Other']);
  function aisleFor(name) {
    const n = String(name || '');
    for (const [a, re] of AISLES) {
      if (a === 'Produce' && /\b(garlic powder|onion powder|ginger powder|ground ginger|tomato paste|tomato sauce|canned|crushed tomatoes|diced tomatoes|dried|potato starch|black pepper|pepper flakes|chili powder|chilli powder|chili flakes|chile flakes|broth|stock|bouillon|vegetable oil)\b/i.test(n)) continue;
      if (a === 'Dairy & Eggs' && /\b(peanut butter|cocoa butter|coconut cream|coconut milk|almond milk|oat milk|cream of tartar)\b/i.test(n)) continue;
      if (re.test(n)) return a;
    }
    return 'Other';
  }
  // entries: [{ingredient (parsed or line), factor, source}] -> merged items
  function mergeGrocery(entries, opts) {
    opts = opts || {};
    const system = opts.system || 'us';
    const pantry = (opts.pantry || []).map((p) => nameKey(p)).filter(Boolean);
    const groups = new Map();
    for (const e of entries || []) {
      const ing = typeof e.ingredient === 'string' ? parseIngredient(e.ingredient) : e.ingredient;
      if (!ing || ing.section || !ing.name) continue;
      const factor = e.factor == null ? 1 : e.factor;
      let unit = ing.unit;
      if (!unit) { const cu = ing.name.match(/\b(cloves?|stalks?|sprigs?|slices?|heads?)\b/i); if (cu) unit = readUnit(cu[1].toLowerCase()).unit; }
      const packed = unit === 'can' || unit === 'jar' || unit === 'bottle' || unit === 'package';
      const key = packed ? unit + ':' + ing.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().replace(/s$/, '') : (nameKey(ing.name) || ing.name.toLowerCase());
      let g = groups.get(key);
      if (!g) { g = { key, packed: packed ? unit : null, name: ing.name.replace(/^(fresh|large|medium|small)\s+/i, ''), v: 0, w: 0, counts: {}, bare: 0, hasAmount: false, sources: [], notes: [] }; groups.set(key, g); }
      if (e.source && !g.sources.includes(e.source)) g.sources.push(e.source);
      if (ing.qty == null) continue;
      const q = (ing.qtyMax != null ? ing.qtyMax : ing.qty) * factor;
      g.hasAmount = true;
      const U = unit && UNITS[unit];
      if (U && U.kind === 'v') g.v += q * U.f;
      else if (U && U.kind === 'w') g.w += q * U.f;
      else if (unit === 'stick' && /butter/i.test(ing.name)) g.w += q * 113;
      else if (unit) g.counts[unit] = (g.counts[unit] || 0) + q;
      else g.bare += q;
    }
    const items = [];
    for (const g of groups.values()) {
      const d = densityFor(g.name);
      // fold volume into weight when both appear and we know the density
      if (g.v && g.w && d) {
        if (system === 'metric' && !isLiquid(g.name)) { g.w += g.v / UNITS.cup.f * d; g.v = 0; }
        else { g.v += g.w / d * UNITS.cup.f; g.w = 0; }
      }
      const parts = [];
      const fmt = (qty, unit) => { const a = convertAmount(qty, unit, g.name, system); return formatQty(a.qty, a.unit) + ' ' + unitLabel(a.unit, a.qty); };
      if (g.v) parts.push(system === 'metric' ? (() => { const b = bestMetric('v', g.v); return formatQty(b.qty, b.unit) + ' ' + b.unit; })() : (() => { const b = bestUSVolume(g.v); return formatQty(b.qty, b.unit) + ' ' + unitLabel(b.unit, b.qty); })());
      if (g.w) parts.push(system === 'metric' ? (() => { const b = bestMetric('w', g.w); return formatQty(b.qty, b.unit) + ' ' + b.unit; })() : (() => { const b = bestUSWeight(g.w); return formatQty(b.qty, b.unit) + ' ' + unitLabel(b.unit, b.qty); })());
      for (const [u, q] of Object.entries(g.counts)) parts.push(fmt(q, u));
      if (g.bare) parts.push(formatFraction(g.bare));
      if (g.bare && parts.length === 1) g.name = countNoun(g.name, g.bare, 1);
      const have = pantry.some((p) => p === g.key || (p.length > 2 && (g.key.endsWith(' ' + p) || g.key === p)));
      items.push({ key: g.key, name: g.name, amount: parts.join(' + '), category: g.packed ? 'Canned & Jarred' : aisleFor(g.name), sources: g.sources, have });
    }
    items.sort((a, b) => AISLE_ORDER.indexOf(a.category) - AISLE_ORDER.indexOf(b.category) || a.name.localeCompare(b.name));
    return items;
  }
  function groceryText(items, checked) {
    checked = checked || {};
    const lines = [];
    let cat = null;
    for (const it of items) {
      if (it.have) continue;
      if (it.category !== cat) { if (cat) lines.push(''); cat = it.category; lines.push(cat.toUpperCase()); }
      lines.push((checked[it.key] ? '[x] ' : '[ ] ') + (it.amount ? it.amount + ' ' : '') + it.name);
    }
    return lines.join('\n');
  }

  // ---------- HTML helpers ----------
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '½', frac14: '¼', frac34: '¾', frac13: '⅓', frac23: '⅔', frac18: '⅛', deg: '°', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', aacute: 'á', ccedil: 'ç', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä', iacute: 'í', oacute: 'ó', uacute: 'ú', times: '×', reg: '®', copy: '©', trade: '™', bull: '•', middot: '·' };
  function decodeEntities(s) {
    return String(s == null ? '' : s).replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
      if (e[0] === '#') { const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(c); } catch (x) { return m; } }
      return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
    });
  }
  function stripTags(s) {
    return decodeEntities(String(s == null ? '' : s).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s+/g, '\n').trim();
  }
  function htmlToText(html) {
    return decodeEntities(String(html || '')
      .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, '\n')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '\n- ').replace(/<\/(p|div|li|h\d|tr|ul|ol|section|article)>/gi, '\n').replace(/<h\d[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ''))
      .replace(/[ \t\u00a0]+/g, ' ').split('\n').map((l) => l.trim()).filter((l, i, a) => l || (a[i - 1] && a[i - 1].trim())).join('\n').trim();
  }
  const clean = (s) => stripTags(s).replace(/\s+/g, ' ').trim();

  // ---------- schema.org JSON-LD ----------
  function parseJsonLoose(txt) {
    let t = String(txt || '').trim().replace(/^<!--/, '').replace(/-->$/, '').replace(/^\s*\/\/\s*<!\[CDATA\[/, '').replace(/\/\/\s*\]\]>\s*$/, '').trim();
    try { return JSON.parse(t); } catch (e) { /* retry */ }
    try { return JSON.parse(t.replace(/[\u0000-\u001f]+/g, ' ')); } catch (e) { /* retry */ }
    try { return JSON.parse(t.replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1')); } catch (e) { return null; }
  }
  const isType = (o, t) => o && typeof o === 'object' && [].concat(o['@type'] || []).some((x) => typeof x === 'string' && x.replace(/^.*[/:]/, '').toLowerCase() === t.toLowerCase());
  function findRecipeNode(data) {
    const seen = new Set();
    let found = null;
    (function walk(o, depth) {
      if (found || !o || typeof o !== 'object' || depth > 12 || seen.has(o)) return;
      seen.add(o);
      if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
      if (isType(o, 'Recipe')) { found = o; return; }
      for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item', 'hasPart', 'about']) if (o[k]) walk(o[k], depth + 1);
    })(data, 0);
    return found;
  }
  function extractJsonLd(html) {
    const out = [];
    const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(String(html || '')))) { const j = parseJsonLoose(m[1]); if (j) out.push(j); }
    return out;
  }
  function isoMinutes(d) {
    if (d == null) return null;
    if (typeof d === 'number') return d;
    const s = String(d).trim();
    const m = s.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
    if (m && s.length > 1) { const v = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) + (+m[4] || 0) / 60; return v > 0 ? Math.round(v) : null; }
    return textMinutes(s);
  }
  function textMinutes(s) {
    const t = detectTimers(s);
    if (t.length) return Math.round(t[0].seconds / 60) || null;
    const n = parseFloat(s); return n > 0 ? Math.round(n) : null;
  }
  function servingsFrom(y) {
    if (y == null) return { servings: null, yieldText: '' };
    const arr = [].concat(y).map((x) => typeof x === 'object' && x ? (x.value || x.name || '') : x).map(String);
    let num = null, text = '';
    for (const a of arr) { const n = normalizeFractions(a).match(/\d+(?:\.\d+)?/); if (n && num == null) num = parseFloat(n[0]); if (!/^\s*\d+(?:\.\d+)?\s*$/.test(a) && !text) text = clean(a); }
    return { servings: num, yieldText: text };
  }
  function imageFrom(img) {
    if (!img) return '';
    if (typeof img === 'string') return img;
    if (Array.isArray(img)) { for (const i of img) { const u = imageFrom(i); if (u) return u; } return ''; }
    return img.url || img.contentUrl || img['@id'] || '';
  }
  function instructionsFrom(ins) {
    const steps = [];
    (function walk(x) {
      if (x == null) return;
      if (typeof x === 'string') {
        const t = stripTags(x);
        const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
        if (lines.length > 1) lines.forEach((l) => steps.push(l.replace(/^(step\s*)?\d+\s*[.):-]\s*/i, '')));
        else if (lines.length) steps.push(lines[0].replace(/^(step\s*)?\d+\s*[.):-]\s+/i, ''));
        return;
      }
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (typeof x !== 'object') return;
      if (isType(x, 'HowToSection') || (x.itemListElement && !x.text)) {
        if (x.name) steps.push('# ' + clean(x.name));
        walk(x.itemListElement || x.steps || []);
        return;
      }
      if (x.text != null || x.name != null) { const t = clean(x.text != null ? x.text : x.name); if (t) steps.push(t); }
      if (x.itemListElement) walk(x.itemListElement);
    })(ins);
    return steps.filter(Boolean);
  }
  function listFrom(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.flatMap(listFrom);
    if (typeof v === 'object') return listFrom(v.name || v.text || '');
    return String(v).split(/\s*,\s*/).map((s) => clean(s)).filter(Boolean);
  }
  function recipeFromJsonLd(node, url) {
    if (!node) return null;
    const ys = servingsFrom(node.recipeYield != null ? node.recipeYield : node.yield);
    const ingredients = [].concat(node.recipeIngredient || node.ingredients || []).flatMap((l) => (typeof l === 'string' ? stripTags(l).split(/\n+/) : [clean(l && (l.text || l.name) || '')])).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    let tags = [...listFrom(node.recipeCategory), ...listFrom(node.recipeCuisine), ...listFrom(node.keywords)].map((t) => t.toLowerCase()).filter((t) => t.length < 30);
    tags = [...new Set(tags)].slice(0, 12);
    return normalizeRecipe({
      title: clean(node.name || node.headline || 'Untitled recipe'),
      description: clean(node.description || ''),
      servings: ys.servings, yieldText: ys.yieldText,
      prepMin: isoMinutes(node.prepTime), cookMin: isoMinutes(node.cookTime), totalMin: isoMinutes(node.totalTime),
      ingredients, steps: instructionsFrom(node.recipeInstructions), tags,
      photo: imageFrom(node.image), source: url || node.url || (node.mainEntityOfPage && typeof node.mainEntityOfPage === 'string' ? node.mainEntityOfPage : '') || '',
    });
  }
  function recipeFromHtml(html, url) {
    for (const j of extractJsonLd(html)) { const node = findRecipeNode(j); if (node) return { recipe: recipeFromJsonLd(node, url), via: 'json-ld' }; }
    // microdata fallback
    const md = [];
    const re = /itemprop\s*=\s*["']?(recipeIngredient|ingredients)["']?[^>]*>([\s\S]*?)<\/(?:li|span|p|div)>/gi;
    let m; while ((m = re.exec(html))) md.push(clean(m[2]));
    if (md.length) {
      const title = (html.match(/itemprop\s*=\s*["']?name["']?[^>]*>([\s\S]*?)</i) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
      const steps = []; const re2 = /itemprop\s*=\s*["']?(?:recipeInstructions)["']?[^>]*>([\s\S]*?)<\/(?:li|p|div|ol)>/gi;
      while ((m = re2.exec(html))) steps.push(...stripTags(m[1]).split(/\n+/).map((s) => s.trim()).filter(Boolean));
      return { recipe: normalizeRecipe({ title: clean(title || 'Imported recipe'), ingredients: md, steps, source: url || '' }), via: 'microdata' };
    }
    const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    const r = parseRecipeText((title ? clean(title) + '\n' : '') + htmlToText(html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '')));
    if (url) r.source = url;
    return { recipe: r, via: 'text' };
  }

  // ---------- plain text recipe parser ----------
  const H_ING = /^(?:ingredients?|ingredient list|what you(?:'|’)?ll need|you(?:'|’)?ll need|you will need|shopping list)\b(?:\s*\(.*\))?\s*:?\s*$/i;
  const H_STEP = /^(?:instructions?|directions?|method|steps?|preparation|prep(?:aration)? steps|how to make(?: it)?|to make)\b\s*:?\s*$/i;
  const H_NOTE = /^(?:notes?|tips?|cook(?:'|’)?s notes?|recipe notes?|variations?|storage)\b\s*:?\s*$/i;
  const META = /^(serves|servings?|yield|yields|makes|portions)\s*:?\s*(.+)$/i;
  const TIME_META = /^(prep|preparation|cook|cooking|bake|baking|total|ready in)(?:\s*time)?\s*:?\s+(.+)$/i;
  function stripMd(l) { return l.replace(/^#{1,6}\s*/, '').replace(/^\*\*(.+)\*\*:?$/, '$1').replace(/^__(.+)__$/, '$1').replace(/\*\*/g, '').trim(); }
  const looksNumbered = (l) => /^(?:step\s*)?\d+\s*[.):]\s+\S/i.test(l) || /^step\s*\d+\b/i.test(l);
  function ingredientLike(l) {
    const c = cleanLine(l);
    if (!c || c.length > 90 || looksNumbered(c) && !/^\d+\s*[.)]\s*\d/.test(c)) return false;
    const p = parseIngredient(c);
    if (p.section) return false;
    if (p.qty != null) return !/[.!?]$/.test(c) || c.length < 45;
    return p.toTaste || BULLET_RE.test(l) && c.length < 50 && !/[.!?]$/.test(c);
  }
  function stepLike(l) { const c = cleanLine(l); return looksNumbered(l) || c.length >= 70 || (/[.!?]$/.test(c) && c.split(' ').length > 5); }
  function stripStepNum(l) { return cleanLine(l).replace(/^(?:step\s*)?\d+\s*[.):-]?\s*/i, (m) => (/^\d+\s*(?:cups?|g|tbsp|tsp)\b/i.test(l) ? m : '')).trim(); }
  function sentences(p) { return (p.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [p]).map((x) => x.trim()).filter(Boolean); }
  function parseRecipeText(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''));
    const r = { title: '', description: '', servings: null, yieldText: '', prepMin: null, cookMin: null, totalMin: null, ingredients: [], steps: [], notes: '' };
    let mode = 'head';
    const headBuf = [], stepBuf = [], noteBuf = [];
    const hasHeadings = lines.some((l) => H_ING.test(stripMd(l.trim()))) || lines.some((l) => H_STEP.test(stripMd(l.trim())));
    for (let i = 0; i < lines.length; i++) {
      const rawL = lines[i].trim();
      const l = stripMd(rawL);
      if (!l) { if (mode === 'steps') stepBuf.push(''); continue; }
      if (H_ING.test(l)) { mode = 'ing'; continue; }
      if (H_STEP.test(l)) { mode = 'steps'; continue; }
      if (H_NOTE.test(l)) { mode = 'notes'; continue; }
      const mm = l.match(META);
      if (mm && mode !== 'steps' && l.length < 60) { const y = servingsFrom(mm[2]); r.servings = y.servings; if (!/^\d+(\.\d+)?$/.test(mm[2].trim())) r.yieldText = mm[2].trim(); continue; }
      const tm = l.match(TIME_META);
      if (tm && mode !== 'steps' && l.length < 50 && detectTimers(tm[2]).length) {
        const mins = textMinutes(tm[2]); const k = tm[1].toLowerCase();
        if (/^prep/.test(k)) r.prepMin = mins; else if (/^(total|ready)/.test(k)) r.totalMin = mins; else r.cookMin = mins;
        continue;
      }
      if (!r.title && mode === 'head') { r.title = l.replace(/^recipe\s*:\s*/i, ''); continue; }
      if (mode === 'head') {
        if (hasHeadings) { headBuf.push(l); continue; }
        // no headings: infer
        if (ingredientLike(rawL)) { mode = 'ing'; } else if (r.ingredients.length === 0 && !stepLike(rawL)) { headBuf.push(l); continue; } else { mode = 'steps'; }
      }
      if (mode === 'ing') {
        if (!hasHeadings && !ingredientLike(rawL) && stepLike(rawL)) { mode = 'steps'; }
        else {
          const c = cleanLine(rawL);
          if (/:$/.test(c) && c.length < 60 && parseIngredient(c).section) r.ingredients.push('# ' + c.replace(/:$/, ''));
          else if (/^#/.test(rawL)) r.ingredients.push('# ' + l);
          else r.ingredients.push(rawL.replace(BULLET_RE, '').replace(/\s+/g, ' ').trim());
          continue;
        }
      }
      if (mode === 'steps') { stepBuf.push(rawL); continue; }
      if (mode === 'notes') { noteBuf.push(l); continue; }
    }
    // steps: numbered lines start new steps, unnumbered continuation lines join; blank lines separate paragraphs
    const numbered = stepBuf.some(looksNumbered);
    const steps = [];
    let cur = '';
    const flush = () => { if (cur.trim()) steps.push(cur.trim()); cur = ''; };
    for (const l of stepBuf) {
      if (!l.trim()) { if (!numbered) flush(); continue; }
      const c = stripMd(l);
      if (/^#/.test(l) || (/:$/.test(c) && c.length < 50 && !looksNumbered(l))) { flush(); steps.push('# ' + c.replace(/:$/, '')); continue; }
      if (numbered) { if (looksNumbered(l)) { flush(); cur = stripStepNum(l); } else cur += (cur ? ' ' : '') + cleanLine(l); }
      else { if (BULLET_RE.test(l) || /[.!?]$/.test(cur) || !cur) { flush(); cur = cleanLine(l); } else cur += ' ' + cleanLine(l); }
    }
    flush();
    if (steps.length === 1 && sentences(steps[0]).length > 2) r.steps = sentences(steps[0]); else r.steps = steps;
    r.description = headBuf.join(' ').trim();
    r.notes = noteBuf.join('\n').trim();
    if (!r.title) r.title = 'Untitled recipe';
    return normalizeRecipe(r);
  }

  // ---------- recipe model ----------
  let idc = 0;
  function uid() { return Date.now().toString(36) + (idc++).toString(36) + Math.random().toString(36).slice(2, 7); }
  function normalizeRecipe(r) {
    r = r || {};
    const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : String(v).split(/\n/)).map((x) => String(x).trim()).filter(Boolean);
    const num = (v) => (v == null || v === '' || !(+v > 0) ? null : +v);
    return {
      id: r.id || uid(), title: String(r.title || 'Untitled recipe').trim().slice(0, 200), description: String(r.description || '').trim(),
      servings: num(r.servings), yieldText: String(r.yieldText || ''), prepMin: num(r.prepMin), cookMin: num(r.cookMin), totalMin: num(r.totalMin) || (num(r.prepMin) || num(r.cookMin) ? (num(r.prepMin) || 0) + (num(r.cookMin) || 0) : null),
      ingredients: arr(r.ingredients), steps: arr(r.steps), notes: String(r.notes || ''),
      tags: [...new Set(arr(Array.isArray(r.tags) ? r.tags : String(r.tags || '').split(',')).map((t) => t.replace(/^#/, '').toLowerCase()))],
      photo: typeof r.photo === 'string' ? r.photo : '', source: String(r.source || ''), rating: Math.max(0, Math.min(5, Math.round(+r.rating || 0))), favorite: !!r.favorite,
      createdAt: r.createdAt || new Date().toISOString(), updatedAt: r.updatedAt || new Date().toISOString(), sample: !!r.sample, extId: r.extId ? String(r.extId) : '',
    };
  }
  // Smart import: detect JSON, HTML, or plain text.
  function importAny(input, url) {
    const s = String(input || '').trim();
    if (!s) return { recipe: null, via: 'empty', error: 'Nothing to import.' };
    if (/^[[{]/.test(s)) {
      const j = parseJsonLoose(s);
      if (j) {
        if (j.app === 'recipebox-remix') return { recipe: null, via: 'backup', error: 'That looks like a full backup. Use Restore backup in Settings.' };
        const node = findRecipeNode(j);
        if (node) return { recipe: recipeFromJsonLd(node, url), via: 'json-ld' };
        if (j.title && (j.ingredients || j.steps)) return { recipe: normalizeRecipe(Object.assign({}, j, { id: null })), via: 'json' };
        return { recipe: null, via: 'json', error: 'No schema.org Recipe found in that JSON.' };
      }
    }
    if (/<(html|head|body|script|div|p|li|h1|article)\b/i.test(s)) return recipeFromHtml(s, url);
    return { recipe: parseRecipeText(s), via: 'text' };
  }

  // ---------- bookmarklet / handoff payloads ----------
  function b64urlEncode(str) {
    const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(str) : Buffer.from(str, 'utf8');
    let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    let b = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    const bin = typeof atob !== 'undefined' ? atob(b) : Buffer.from(b, 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : Buffer.from(bytes).toString('utf8');
  }
  // Payload: {v:1, url, title, recipe?: JSON-LD node, text?: string}
  function recipeFromPayload(p) {
    if (!p || typeof p !== 'object') return { recipe: null, error: 'Empty handoff.' };
    if (p.recipe) { const node = findRecipeNode(p.recipe) || p.recipe; return { recipe: recipeFromJsonLd(node, p.url), via: 'bookmarklet-json-ld' }; }
    if (p.html) { const r = recipeFromHtml(String(p.html), p.url); return Object.assign(r, { via: 'bookmarklet-' + r.via }); }
    if (p.text) { const r = parseRecipeText((p.title ? p.title + '\n' : '') + String(p.text)); if (p.url) r.source = p.url; return { recipe: r, via: 'bookmarklet-text' }; }
    return { recipe: null, error: 'No recipe data in handoff.' };
  }
  function decodeHashPayload(hash) {
    const m = String(hash || '').match(/[#&]import=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try { return JSON.parse(b64urlDecode(m[1])); } catch (e) { return { error: 'Could not read the recipe handoff.' }; }
  }
  function bookmarkletSource(appUrl) {
    const code = "(()=>{var A=" + JSON.stringify(appUrl) + ",r=null,K=['@type','name','headline','description','image','recipeYield','yield','recipeIngredient','ingredients','recipeInstructions','prepTime','cookTime','totalTime','keywords','recipeCategory','recipeCuisine','url'];" +
      "function t(o){return[].concat(o['@type']||[]).some(function(x){return /(^|[\\/:])Recipe$/i.test(x)})}" +
      "function w(o,d){if(r||!o||typeof o!='object'||d>12)return;if(Array.isArray(o)){o.forEach(function(x){w(x,d+1)});return}if(t(o)){r=o;return}['@graph','mainEntity','mainEntityOfPage','itemListElement','item'].forEach(function(k){if(o[k])w(o[k],d+1)})}" +
      "document.querySelectorAll('script[type=\"application/ld+json\"]').forEach(function(s){try{w(JSON.parse(s.textContent),0)}catch(e){}});" +
      "var p={v:1,url:location.href,title:document.title};if(r){var c={};K.forEach(function(k){if(r[k]!=null)c[k]=r[k]});p.recipe=c}else{var g=String(getSelection()||'');p.text=(g.length>40?g:document.body.innerText).slice(0,40000)}" +
      "var j=JSON.stringify(p),b=btoa(unescape(encodeURIComponent(j))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');" +
      "if(b.length<60000){var u=A+'#import='+b;if(!window.open(u,'_blank'))location.href=u}else{var x=window.open(A+'#handoff=1','_blank');if(!x){alert('Allow pop-ups to send this recipe to RecipeBox Remix.');return}" +
      "var o=new URL(A).origin;window.addEventListener('message',function h(e){if(e.source===x&&e.data&&e.data.type==='rbr-ready'){x.postMessage({type:'rbr-import',payload:p},o);window.removeEventListener('message',h)}})}})()";
    return 'javascript:' + encodeURIComponent(code).replace(/%20/g, ' ').replace(/%2C/g, ',').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/').replace(/%3B/g, ';').replace(/%2B/g, '+').replace(/%3F/g, '?').replace(/%40/g, '@');
  }

  // ---------- backup & export ----------
  function makeBackup(state) {
    return { app: 'recipebox-remix', version: 1, exportedAt: new Date().toISOString(), recipes: state.recipes || [], plan: state.plan || {}, grocery: state.grocery || { recipes: [], manual: [], checked: {} }, pantry: state.pantry || [], settings: state.settings || {} };
  }
  function readBackup(obj, current, mode) {
    if (typeof obj === 'string') obj = parseJsonLoose(obj);
    if (!obj || obj.app !== 'recipebox-remix' || !Array.isArray(obj.recipes)) throw new Error('This file is not a RecipeBox Remix backup.');
    const recipes = obj.recipes.map((r) => normalizeRecipe(r));
    if (mode !== 'merge' || !current) return { recipes, plan: obj.plan || {}, grocery: obj.grocery || { recipes: [], manual: [], checked: {} }, pantry: obj.pantry || [], settings: Object.assign({}, current && current.settings, obj.settings) };
    const byId = new Map((current.recipes || []).map((r) => [r.id, r]));
    for (const r of recipes) { const c = byId.get(r.id); if (!c || (r.updatedAt || '') >= (c.updatedAt || '')) byId.set(r.id, r); }
    const plan = Object.assign({}, current.plan); for (const [d, list] of Object.entries(obj.plan || {})) plan[d] = (plan[d] || []).concat(list.filter((x) => !(plan[d] || []).some((y) => y.id === x.id)));
    return { recipes: [...byId.values()], plan, grocery: current.grocery, pantry: [...new Set([...(current.pantry || []), ...(obj.pantry || [])])], settings: current.settings };
  }
  function toMarkdown(r, factor, system) {
    const ings = r.ingredients.map(parseIngredient);
    const L = ['# ' + r.title, ''];
    if (r.description) L.push(r.description, '');
    const meta = [];
    if (r.servings) meta.push('Serves ' + formatFraction(r.servings * (factor || 1)));
    if (r.prepMin) meta.push('Prep ' + humanMinutes(r.prepMin));
    if (r.cookMin) meta.push('Cook ' + humanMinutes(r.cookMin));
    if (r.totalMin) meta.push('Total ' + humanMinutes(r.totalMin));
    if (meta.length) L.push(meta.join(' · '), '');
    L.push('## Ingredients', '');
    for (const i of ings) { const p = presentIngredient(i, factor, system); L.push(p.section ? '\n**' + p.section + '**\n' : '- ' + p.text); }
    L.push('', '## Steps', '');
    let n = 0;
    for (const s of r.steps) { if (/^#\s*/.test(s)) L.push('', '**' + s.replace(/^#\s*/, '') + '**', ''); else L.push(++n + '. ' + convertTextUnits(s, system)); }
    if (r.notes) L.push('', '## Notes', '', r.notes);
    if (r.tags.length) L.push('', 'Tags: ' + r.tags.map((t) => '#' + t).join(' '));
    if (r.source) L.push('', 'Source: ' + r.source);
    return L.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
  }

  // ---------- meal plan helpers ----------
  function weekStart(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }
  function isoDate(d) { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function weekDays(d) { const s = weekStart(d); return Array.from({ length: 7 }, (_, i) => { const x = new Date(s); x.setDate(s.getDate() + i); return isoDate(x); }); }
  function planEntries(plan, days) { const out = []; for (const d of days) for (const e of (plan[d] || [])) out.push(Object.assign({ day: d }, e)); return out; }
  // Build grocery entries from {recipeId, servings} picks.
  function groceryEntries(picks, recipesById) {
    const out = [];
    for (const p of picks) {
      const r = recipesById[p.recipeId]; if (!r) continue;
      const f = r.servings && p.servings ? p.servings / r.servings : 1;
      for (const line of r.ingredients) out.push({ ingredient: line, factor: f, source: r.title });
    }
    return out;
  }

  return {
    normalizeFractions, parseNumber, formatFraction, roundMetric, UNITS, unitLabel, readUnit,
    parseIngredient, cleanLine, densityFor, isLiquid, convertAmount, formatQty, presentIngredient, scaleFactor, convertTextUnits,
    detectTimers, formatDuration, humanMinutes, nameKey, singular, ingredientsInStep, aisleFor, AISLE_ORDER, mergeGrocery, groceryText,
    decodeEntities, stripTags, htmlToText, parseJsonLoose, findRecipeNode, extractJsonLd, isoMinutes, recipeFromJsonLd, recipeFromHtml, instructionsFrom,
    parseRecipeText, normalizeRecipe, importAny, uid, b64urlEncode, b64urlDecode, recipeFromPayload, decodeHashPayload, bookmarkletSource,
    makeBackup, readBackup, toMarkdown, weekStart, isoDate, weekDays, planEntries, groceryEntries,
  };
});
