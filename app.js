/* RecipeBox Remix app: UI, storage, routing. All data stays in this browser (IndexedDB). */
(() => {
  'use strict';
  const C = window.RBCore;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:|data:image\/)/i.test(String(u || '')) ? String(u) : '');
  const RB = (window.RB = { ready: false, core: C, state: null });

  const DEF = () => ({ recipes: [], plan: {}, grocery: { recipes: [], manual: [], checked: {}, hidden: {} }, pantry: ['salt', 'black pepper', 'olive oil'], settings: { units: 'original', theme: 'auto', voice: true, groUnits: 'us' }, timers: [], seeded: false });
  let S = DEF();

  // ---------- storage ----------
  const DB = {
    db: null,
    open() {
      return new Promise((res) => {
        if (!('indexedDB' in window)) return res(null);
        let req;
        try { req = indexedDB.open('recipebox-remix', 1); } catch (e) { return res(null); }
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => { this.db = req.result; res(this.db); };
        req.onerror = () => res(null);
        req.onblocked = () => res(null);
      });
    },
    get(k) {
      if (!this.db) { try { return Promise.resolve(JSON.parse(localStorage.getItem('rbr-' + k))); } catch (e) { return Promise.resolve(null); } }
      return new Promise((res) => { const t = this.db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); });
    },
    set(k, v) {
      if (!this.db) { try { localStorage.setItem('rbr-' + k, JSON.stringify(v)); } catch (e) { toast('Storage is full. Remove some photos or download a backup.'); } return Promise.resolve(); }
      return new Promise((res) => { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => { toast('Could not save. Storage may be full.'); res(); }; });
    },
  };
  let saveT = null, savePending = null;
  function save() {
    clearTimeout(saveT);
    savePending = new Promise((res) => { saveT = setTimeout(() => { saveT = null; write().then(res); }, 120); });
    return savePending;
  }
  // Other open tabs (e.g. one opened by the bookmarklet) hear about saves and reload, so an old tab never overwrites newer data.
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('recipebox-remix') : null;
  const write = () => DB.set('state', JSON.parse(JSON.stringify(S))).then(() => { if (bc) bc.postMessage('saved'); });
  RB.flush = () => { if (saveT) { clearTimeout(saveT); saveT = null; return write(); } return savePending || Promise.resolve(); };
  function loadState(saved) {
    const d = DEF();
    S = Object.assign(d, saved, { settings: Object.assign(d.settings, saved.settings), grocery: Object.assign(d.grocery, saved.grocery) });
    S.recipes = (S.recipes || []).map((r) => C.normalizeRecipe(r));
  }
  if (bc) bc.onmessage = async () => {
    if (saveT) return; // we have newer local changes about to be written
    const saved = await DB.get('state'); if (!saved) return;
    loadState(saved); RB.synced = (RB.synced || 0) + 1;
    if (typeof renderTimers === 'function') { dockSig = null; renderTimers(); updateBadge(); }
    const dlg = document.getElementById('editDlg');
    if (!cookState && !(dlg && dlg.open) && !document.querySelector('#impPreview:not([hidden])')) { RV.id = null; route(); }
  };

  // ---------- helpers ----------
  let toastT;
  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }
  const byId = (id) => S.recipes.find((r) => r.id === id);
  const recipesById = () => Object.fromEntries(S.recipes.map((r) => [r.id, r]));
  const now = () => Date.now();
  const EMOJI = [[/breakfast|pancake|waffle|brunch/, '🥞'], [/bread|loaf/, '🍞'], [/dessert|cookie|cake|sweet|baking/, '🍪'], [/curry/, '🍛'], [/pasta|noodle/, '🍝'], [/soup|stew/, '🍲'], [/salad/, '🥗'], [/chili|mexican|taco/, '🌶️'], [/chicken/, '🍗'], [/fish|seafood/, '🐟'], [/drink|smoothie|cocktail/, '🥤'], [/vegan|vegetarian/, '🥦']];
  function emojiFor(r) { const t = (r.tags.join(' ') + ' ' + r.title).toLowerCase(); for (const [re, e] of EMOJI) if (re.test(t)) return e; return '🍽️'; }
  function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  function artHtml(r) { const h = hue(r.id + r.title); return `<div class="ph-art" style="background:linear-gradient(135deg,hsl(${h} 80% 86%),hsl(${(h + 40) % 360} 75% 72%))">${emojiFor(r)}</div>`; }
  function photoHtml(r) { const u = safeUrl(r.photo); return u ? `<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createRange().createContextualFragment(this.dataset.art||''))" data-art="${esc(artHtml(r))}">` : artHtml(r); }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (x) { /* ignore */ } ta.remove(); return ok;
    }
  }
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'recipe';
  const today = () => C.isoDate(new Date());

  // ---------- theme ----------
  function applyTheme(t) {
    S.settings.theme = t; document.documentElement.dataset.theme = t;
    try { localStorage.setItem('rbr-theme', JSON.stringify(t)); } catch (e) { /* ignore */ }
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name=theme-color]').content = dark ? '#17110d' : '#c2410c';
    $('#themeSel').value = t;
  }
  $('#themeBtn').onclick = () => {
    const dark = document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    applyTheme(dark ? 'light' : 'dark'); save();
  };

  // ---------- routing ----------
  const VIEWS = ['recipes', 'recipe', 'plan', 'grocery', 'import', 'settings'];
  function show(v) {
    for (const x of VIEWS) $('#view-' + x).hidden = x !== v;
    const tab = v === 'recipe' ? 'recipes' : v;
    for (const a of $$('#tabs a')) { a.classList.toggle('on', a.dataset.tab === tab); if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  }
  function route() {
    const h = location.hash;
    if (/[#&]import=/.test(h)) { handleHashImport(h); return; }
    if (/[#&]handoff=1/.test(h)) { waitForHandoff(); return; }
    const m = h.match(/^#\/(\w+)(?:\/(.+))?/);
    const v = m ? m[1] : 'recipes';
    if (v === 'recipe' && m[2] && byId(decodeURIComponent(m[2]))) { renderRecipe(decodeURIComponent(m[2])); show('recipe'); window.scrollTo(0, 0); return; }
    if (v === 'plan') { renderPlan(); show('plan'); return; }
    if (v === 'grocery') { renderGrocery(); show('grocery'); return; }
    if (v === 'import') { show('import'); return; }
    if (v === 'settings') { renderSettings(); show('settings'); return; }
    renderList(); show('recipes');
  }
  window.addEventListener('hashchange', route);

  // ---------- recipe list ----------
  const LF = { q: '', tag: '', fav: false, sort: 'updated' };
  function renderList() {
    const tagCount = {};
    for (const r of S.recipes) for (const t of r.tags) tagCount[t] = (tagCount[t] || 0) + 1;
    const top = Object.entries(tagCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14).map((x) => x[0]);
    if (LF.tag && !top.includes(LF.tag)) top.unshift(LF.tag);
    $('#chips').innerHTML = `<button class="chip ${!LF.tag && !LF.fav ? 'on' : ''}" data-chip="">All</button><button class="chip ${LF.fav ? 'on' : ''}" data-chip="__fav">★ Favorites</button>` + top.map((t) => `<button class="chip ${LF.tag === t ? 'on' : ''}" data-chip="${esc(t)}">#${esc(t)}</button>`).join('');
    const q = LF.q.trim().toLowerCase();
    let list = S.recipes.filter((r) => (!LF.fav || r.favorite) && (!LF.tag || r.tags.includes(LF.tag)) && (!q || q.split(/\s+/).every((w) => (r.title + ' ' + r.description + ' ' + r.ingredients.join(' ') + ' ' + r.tags.join(' ')).toLowerCase().includes(w))));
    const S2 = { updated: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''), title: (a, b) => a.title.localeCompare(b.title), rating: (a, b) => b.rating - a.rating || a.title.localeCompare(b.title), time: (a, b) => (a.totalMin || 1e9) - (b.totalMin || 1e9) };
    list.sort(S2[LF.sort] || S2.updated);
    $('#grid').innerHTML = list.map((r) => `<a class="rcard" href="#/recipe/${encodeURIComponent(r.id)}" data-id="${esc(r.id)}"><div class="ph">${photoHtml(r)}${r.favorite ? '<span class="fav" aria-label="Favorite">★</span>' : ''}</div><div class="body"><h3>${esc(r.title)}</h3><div class="meta">${r.totalMin ? `<span>⏱ ${esc(C.humanMinutes(r.totalMin))}</span>` : ''}${r.servings ? `<span>🍽 ${esc(C.formatFraction(r.servings))}</span>` : ''}${r.rating ? `<span aria-label="${r.rating} stars">${'★'.repeat(r.rating)}</span>` : ''}<span>${r.ingredients.filter((l) => !/^#/.test(l)).length} ingredients</span></div></div></a>`).join('');
    $('#emptyList').hidden = S.recipes.length > 0;
    if (S.recipes.length && !list.length) $('#grid').innerHTML = '<p class="empty">No recipes match. Try another search.</p>';
  }
  $('#chips').onclick = (e) => { const b = e.target.closest('[data-chip]'); if (!b) return; const c = b.dataset.chip; if (c === '__fav') { LF.fav = !LF.fav; LF.tag = ''; } else { LF.tag = c === LF.tag ? '' : c; LF.fav = false; } renderList(); };
  $('#q').oninput = (e) => { LF.q = e.target.value; renderList(); };
  $('#sortSel').onchange = (e) => { LF.sort = e.target.value; renderList(); };
  $('#newBtn').onclick = () => openEditor(null);
  $('#emptyImport').onclick = () => { location.hash = '#/import'; };
  $('#emptySamples').onclick = $('#loadSamples').onclick = () => { const n = loadSamples(); toast(n ? `Added ${n} sample recipes` : 'Samples are already in your box'); route(); };
  function loadSamples() {
    let n = 0;
    for (const s of window.RB_SAMPLES || []) if (!byId(s.id)) { S.recipes.push(C.normalizeRecipe(Object.assign({}, s, { sample: true }))); n++; }
    save(); return n;
  }

  // ---------- recipe detail ----------
  const RV = { id: null, servings: {}, units: null, checks: {} };
  function factorFor(r) { const base = r.servings || 1; const s = RV.servings[r.id] != null ? RV.servings[r.id] : base; return { base, target: s, factor: s / base }; }
  function stars(n, name) { return `<span class="stars" role="radiogroup" aria-label="${name || 'Rating'}">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-star="${i}" role="radio" aria-checked="${i === n}" aria-label="${i} star${i > 1 ? 's' : ''}">${i <= n ? '★' : '☆'}</button>`).join('')}</span>`; }
  function renderRecipe(id) {
    const r = byId(id); if (!r) return;
    if (RV.id !== id) { RV.id = id; RV.units = S.settings.units; }
    const { base, target, factor } = factorFor(r);
    const units = RV.units || 'original';
    const ings = r.ingredients.map(C.parseIngredient);
    const checks = RV.checks[id] || (RV.checks[id] = {});
    let ingHtml = '';
    ings.forEach((ing, i) => {
      if (ing.section) { ingHtml += `<li class="sec">${esc(ing.section)}</li>`; return; }
      const p = C.presentIngredient(ing, factor, units);
      const qty = [p.qtyText, p.unitText].filter(Boolean).join(' ');
      ingHtml += `<li class="${checks[i] ? 'done' : ''}"><input type="checkbox" id="ing${i}" data-ing="${i}" ${checks[i] ? 'checked' : ''}><label for="ing${i}" class="itxt">${qty ? `<span class="q">${esc(qty)}</span> ` : ''}${esc(p.name)}${p.note ? `<span class="n">, ${esc(p.note)}</span>` : ''}${p.optional ? ' <span class="n">(optional)</span>' : ''}</label></li>`;
    });
    let stepHtml = '';
    r.steps.forEach((s, i) => {
      if (/^#/.test(s)) { stepHtml += `<li class="sec">${esc(s.replace(/^#\s*/, ''))}</li>`; return; }
      const timers = C.detectTimers(s);
      stepHtml += `<li class="step"><span>${esc(C.convertTextUnits(s, units))}</span>${timers.length ? '<div>' + timers.map((t) => `<button type="button" class="tchip" data-timer="${t.seconds}" data-label="${esc(t.label)}" data-step="${i}">⏲ ${esc(t.label)}</button>`).join('') + '</div>' : ''}</li>`;
    });
    $('#dFav').textContent = r.favorite ? '★ Favorite' : '☆ Favorite';
    $('#dFav').setAttribute('aria-pressed', String(r.favorite));
    const src = safeUrl(r.source);
    $('#recipe').innerHTML = `
      <div class="hero"><div class="hero-img">${photoHtml(r)}</div><div>
        <h1>${esc(r.title)}</h1>
        ${r.description ? `<p class="desc">${esc(r.description)}</p>` : ''}
        <div class="facts">${r.servings ? `<span class="fact"><b>Serves</b>${esc(C.formatFraction(r.servings))}</span>` : ''}${r.yieldText ? `<span class="fact"><b>Yield</b>${esc(r.yieldText)}</span>` : ''}${r.prepMin ? `<span class="fact"><b>Prep</b>${esc(C.humanMinutes(r.prepMin))}</span>` : ''}${r.cookMin ? `<span class="fact"><b>Cook</b>${esc(C.humanMinutes(r.cookMin))}</span>` : ''}${r.totalMin ? `<span class="fact"><b>Total</b>${esc(C.humanMinutes(r.totalMin))}</span>` : ''}</div>
        <div class="row wrap">${stars(r.rating, 'Your rating')}</div>
        ${r.tags.length ? `<div class="tags" style="margin-top:8px">${r.tags.map((t) => `<a class="tag" href="#/recipes" data-tag="${esc(t)}">#${esc(t)}</a>`).join('')}</div>` : ''}
        ${src ? `<p class="hint">Source: <a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${esc(src.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60))}</a></p>` : ''}
        <div class="actions"><button class="btn primary big" id="cookBtn" type="button">👩‍🍳 Start cooking</button><button class="btn" id="groBtn" type="button">🛒 Add to groceries</button><button class="btn" id="planBtn" type="button">🗓️ Plan</button></div>
      </div></div>
      <div class="controls">
        <span>${r.servings ? 'Servings' : 'Batches'}</span>
        <span class="stepper"><button type="button" id="servDown" aria-label="Fewer servings">−</button><input id="servIn" type="number" min="0.25" step="any" inputmode="decimal" value="${esc(+target.toFixed(3))}" aria-label="Servings"><button type="button" id="servUp" aria-label="More servings">＋</button></span>
        <span class="row">${[0.5, 1, 2, 3].map((m) => `<button type="button" class="chip ${Math.abs(factor - m) < 1e-9 ? 'on' : ''}" data-mult="${m}">${m === 0.5 ? '½' : m}×</button>`).join('')}</span>
        <span class="seg" role="group" aria-label="Units">${[['original', 'As written'], ['us', 'US'], ['metric', 'Metric']].map(([k, l]) => `<button type="button" data-units="${k}" class="${units === k ? 'on' : ''}" aria-pressed="${units === k}">${l}</button>`).join('')}</span>
      </div>
      <div class="cols">
        <section><div class="row" style="justify-content:space-between"><h2>Ingredients</h2><button class="btn ghost" id="clearChecks" type="button">Uncheck all</button></div><ul class="ings" id="ingList">${ingHtml || '<li>No ingredients yet.</li>'}</ul></section>
        <section><h2>Steps</h2><ol class="steps" id="stepList">${stepHtml || '<li>No steps yet.</li>'}</ol>
        ${r.notes ? `<h2>Notes</h2><div class="notes">${esc(r.notes)}</div>` : ''}</section>
      </div>`;
  }
  const setServ = (r, v) => { v = Math.max(0.25, Math.round(v * 1000) / 1000); RV.servings[r.id] = v; renderRecipe(r.id); };
  $('#recipe').addEventListener('click', (e) => {
    const r = byId(RV.id); if (!r) return;
    const t = e.target;
    const { target } = factorFor(r);
    if (t.closest('#servDown')) setServ(r, target > 1 ? Math.ceil(target) - 1 : target / 2);
    else if (t.closest('#servUp')) setServ(r, target < 1 ? target * 2 : Math.floor(target) + 1);
    else if (t.closest('[data-mult]')) setServ(r, (r.servings || 1) * +t.closest('[data-mult]').dataset.mult);
    else if (t.closest('[data-units]')) { RV.units = t.closest('[data-units]').dataset.units; renderRecipe(r.id); }
    else if (t.closest('[data-star]')) { const n = +t.closest('[data-star]').dataset.star; r.rating = r.rating === n ? 0 : n; r.updatedAt = new Date().toISOString(); save(); renderRecipe(r.id); }
    else if (t.closest('[data-tag]')) { LF.tag = t.closest('[data-tag]').dataset.tag; LF.fav = false; }
    else if (t.closest('[data-timer]')) { const b = t.closest('[data-timer]'); startTimer(+b.dataset.timer, b.dataset.label, r.title); }
    else if (t.closest('#cookBtn')) openCook(r.id);
    else if (t.closest('#groBtn')) addToGrocery(r.id, factorFor(r).target);
    else if (t.closest('#planBtn')) pickDay(r.id);
    else if (t.closest('#clearChecks')) { RV.checks[r.id] = {}; renderRecipe(r.id); }
  });
  $('#recipe').addEventListener('change', (e) => {
    const r = byId(RV.id); if (!r) return;
    if (e.target.id === 'servIn') { const v = parseFloat(e.target.value); if (v > 0) setServ(r, v); }
    if (e.target.dataset.ing != null) { (RV.checks[r.id] = RV.checks[r.id] || {})[e.target.dataset.ing] = e.target.checked; e.target.closest('li').classList.toggle('done', e.target.checked); }
  });
  $('#dFav').onclick = () => { const r = byId(RV.id); if (!r) return; r.favorite = !r.favorite; r.updatedAt = new Date().toISOString(); save(); renderRecipe(r.id); };
  $('#dEdit').onclick = () => openEditor(byId(RV.id));
  const closeMenu = () => { const d = $('#view-recipe details.menu'); if (d) d.open = false; };
  $('#dPlan').onclick = () => { closeMenu(); pickDay(RV.id); };
  $('#dMd').onclick = () => { closeMenu(); const r = byId(RV.id); const f = factorFor(r); download(slug(r.title) + '.md', C.toMarkdown(r, f.factor, RV.units), 'text/markdown'); };
  $('#dCopy').onclick = async () => { closeMenu(); const r = byId(RV.id); const f = factorFor(r); toast((await copyText(C.toMarkdown(r, f.factor, RV.units))) ? 'Recipe copied' : 'Copy failed'); };
  $('#dPrint').onclick = () => { closeMenu(); printRecipe(byId(RV.id)); };
  $('#dDup').onclick = () => { closeMenu(); const r = byId(RV.id); const c = C.normalizeRecipe(Object.assign({}, r, { id: null, title: r.title + ' (copy)', createdAt: null, updatedAt: null, sample: false })); S.recipes.push(c); save(); location.hash = '#/recipe/' + encodeURIComponent(c.id); toast('Duplicated'); };
  $('#dDel').onclick = () => {
    closeMenu(); const r = byId(RV.id); if (!r || !confirm(`Delete “${r.title}”? This can't be undone.`)) return;
    S.recipes = S.recipes.filter((x) => x.id !== r.id);
    for (const d of Object.keys(S.plan)) S.plan[d] = S.plan[d].filter((e) => e.recipeId !== r.id);
    S.grocery.recipes = S.grocery.recipes.filter((e) => e.recipeId !== r.id);
    save(); updateBadge(); location.hash = '#/recipes'; toast('Recipe deleted');
  };
  function printRecipe(r) {
    const f = factorFor(r); const units = RV.units || 'original';
    const ings = r.ingredients.map(C.parseIngredient).map((i) => { const p = C.presentIngredient(i, f.factor, units); return p.section ? `<li style="list-style:none;margin-top:8px"><b>${esc(p.section)}</b></li>` : `<li>${esc(p.text)}</li>`; }).join('');
    let n = 0; const steps = r.steps.map((s) => (/^#/.test(s) ? `<li style="list-style:none"><b>${esc(s.replace(/^#\s*/, ''))}</b></li>` : `<li value="${++n}">${esc(C.convertTextUnits(s, units))}</li>`)).join('');
    const ph = safeUrl(r.photo);
    $('#printArea').innerHTML = `<h1>${esc(r.title)}</h1>${r.description ? `<p>${esc(r.description)}</p>` : ''}<p>${r.servings ? 'Serves ' + esc(C.formatFraction(f.target)) + ' · ' : ''}${r.totalMin ? 'Total ' + esc(C.humanMinutes(r.totalMin)) : ''}</p>${ph ? `<img src="${esc(ph)}" alt="">` : ''}<div class="pcols"><div><h2>Ingredients</h2><ul>${ings}</ul></div><div><h2>Steps</h2><ol>${steps}</ol></div></div>${r.notes ? `<h2>Notes</h2><p style="white-space:pre-wrap">${esc(r.notes)}</p>` : ''}${safeUrl(r.source) ? `<p><small>Source: ${esc(r.source)}</small></p>` : ''}<p><small>Printed from RecipeBox Remix</small></p>`;
    setTimeout(() => window.print(), 50);
  }
  RB.printRecipe = (id) => printRecipe(byId(id));

  // ---------- editor ----------
  let editing = null, edPhoto = '', edRating = 0, edDraft = null;
  function renderEdStars() { $('#edRating').innerHTML = stars(edRating, 'Rating').replace(/^<span[^>]*>|<\/span>$/g, ''); }
  function openEditor(r, draft) {
    editing = r ? r.id : null; edDraft = draft || null;
    const x = r || draft || C.normalizeRecipe({ title: '' });
    $('#edTitleH').textContent = r ? 'Edit recipe' : 'New recipe';
    $('#edTitle').value = x.title === 'Untitled recipe' && !r ? '' : x.title;
    $('#edDesc').value = x.description || ''; $('#edServ').value = x.servings || ''; $('#edPrep').value = x.prepMin || ''; $('#edCook').value = x.cookMin || ''; $('#edYield').value = x.yieldText || '';
    $('#edIng').value = x.ingredients.join('\n'); $('#edSteps').value = x.steps.join('\n'); $('#edNotes').value = x.notes || ''; $('#edTags').value = x.tags.join(', ');
    $('#edFav').checked = !!x.favorite; $('#edSource').value = x.source || '';
    edRating = x.rating || 0; renderEdStars();
    edPhoto = x.photo || ''; showEdPhoto();
    $('#editDlg').showModal(); $('#edTitle').focus();
  }
  RB.openEditor = (id) => openEditor(id ? byId(id) : null);
  function showEdPhoto() { const im = $('#edPhotoPrev'); const u = safeUrl(edPhoto); im.hidden = !u; if (u) im.src = u; else im.removeAttribute('src'); }
  $('#edRating').onclick = (e) => { const b = e.target.closest('[data-star]'); if (!b) return; const n = +b.dataset.star; edRating = edRating === n ? 0 : n; renderEdStars(); };
  $('#edPhotoClear').onclick = () => { edPhoto = ''; showEdPhoto(); };
  $('#edPhoto').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { edPhoto = await shrinkImage(f, 1000, 0.82); showEdPhoto(); } catch (x) { toast('Could not read that image'); } };
  function shrinkImage(file, max, q) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => { const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q)); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
      img.src = url;
    });
  }
  $('#editDlg').addEventListener('close', () => {
    if ($('#editDlg').returnValue !== 'save') return;
    const title = $('#edTitle').value.trim() || 'Untitled recipe';
    const old = editing ? byId(editing) : null;
    const r = C.normalizeRecipe({
      id: old ? old.id : (edDraft && edDraft.id) || null, title, description: $('#edDesc').value, servings: $('#edServ').value, prepMin: $('#edPrep').value, cookMin: $('#edCook').value, yieldText: $('#edYield').value,
      totalMin: (+$('#edPrep').value || 0) + (+$('#edCook').value || 0) || (old && !$('#edPrep').value && !$('#edCook').value ? old.totalMin : null),
      ingredients: $('#edIng').value, steps: $('#edSteps').value, notes: $('#edNotes').value, tags: $('#edTags').value, rating: edRating, favorite: $('#edFav').checked, photo: edPhoto, source: $('#edSource').value,
      createdAt: old ? old.createdAt : null, updatedAt: new Date().toISOString(),
    });
    if (old) Object.assign(old, r); else S.recipes.push(r);
    save(); clearPreview(); toast(old ? 'Saved' : 'Recipe added');
    if (location.hash === '#/recipe/' + encodeURIComponent(r.id)) route(); else location.hash = '#/recipe/' + encodeURIComponent(r.id);
  });
  $('#edForm').addEventListener('submit', (e) => { if (e.submitter && e.submitter.value === 'save' && !$('#edTitle').value.trim()) { e.preventDefault(); $('#edTitle').focus(); } });

  // ---------- grocery ----------
  function addToGrocery(recipeId, servings, fromPlan) {
    const r = byId(recipeId); if (!r) return;
    if (fromPlan && S.grocery.recipes.some((e) => e.fromPlan === fromPlan)) return false;
    S.grocery.recipes.push({ id: C.uid(), recipeId, servings: servings || r.servings || 1, fromPlan: fromPlan || null });
    unhide(r.ingredients.map((l) => ({ ingredient: l })));
    save(); updateBadge();
    if (!fromPlan) toast(`Added ${r.title} to your grocery list`);
    return true;
  }
  RB.addToGrocery = addToGrocery;
  function unhide(entries) { for (const i of C.mergeGrocery(entries)) delete S.grocery.hidden[i.key]; }
  function groceryItems() {
    const by = recipesById();
    const entries = C.groceryEntries(S.grocery.recipes.map((e) => ({ recipeId: e.recipeId, servings: e.servings })), by);
    for (const m of S.grocery.manual) entries.push({ ingredient: m.text, factor: 1, source: 'Added by you' });
    return C.mergeGrocery(entries, { system: S.settings.groUnits || 'us', pantry: S.pantry }).filter((i) => !S.grocery.hidden[i.key]);
  }
  RB.groceryItems = groceryItems;
  function updateBadge() {
    const n = groceryItems().filter((i) => !i.have && !S.grocery.checked[i.key]).length;
    const b = $('#groBadge'); b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
  }
  function renderGrocery() {
    $('#groUnits').value = S.settings.groUnits || 'us';
    const items = groceryItems();
    const need = items.filter((i) => !i.have), have = items.filter((i) => i.have);
    let html = '', cat = null;
    const li = (i) => `<li class="${S.grocery.checked[i.key] ? 'done' : ''}"><input type="checkbox" data-gk="${esc(i.key)}" id="g-${esc(i.key)}" ${S.grocery.checked[i.key] ? 'checked' : ''}><label class="gt" for="g-${esc(i.key)}">${i.amount ? `<span class="amt">${esc(i.amount)}</span>` : ''}${esc(i.name)}<span class="src">${esc(i.sources.join(' · '))}</span></label><button type="button" data-gdel="${esc(i.key)}" aria-label="Remove ${esc(i.name)}">✕</button></li>`;
    for (const i of need) { if (i.category !== cat) { if (cat) html += '</ul>'; cat = i.category; html += `<h3>${esc(cat)}</h3><ul>`; } html += li(i); }
    if (cat) html += '</ul>';
    if (have.length) html += `<div class="have"><h3>Already have (pantry)</h3><ul>${have.map(li).join('')}</ul></div>`;
    $('#groList').innerHTML = html;
    $('#groEmpty').hidden = items.length > 0;
    const by = recipesById();
    $('#groRecipes').innerHTML = S.grocery.recipes.map((e) => { const r = by[e.recipeId]; return r ? `<li><span>${esc(r.title)}</span><input type="number" min="0.25" step="any" value="${esc(e.servings)}" data-gserv="${esc(e.id)}" aria-label="Servings of ${esc(r.title)}"><button type="button" data-grm="${esc(e.id)}" aria-label="Remove ${esc(r.title)}">✕</button></li>` : ''; }).join('') || '<li class="hint">No recipes added yet.</li>';
    $('#pantryChips').innerHTML = S.pantry.map((p, i) => `<button type="button" class="chip" data-pdel="${i}" aria-label="Remove ${esc(p)} from pantry">${esc(p)}<span class="x">✕</span></button>`).join('');
    updateBadge();
  }
  $('#groList').addEventListener('change', (e) => { const k = e.target.dataset.gk; if (k == null) return; if (e.target.checked) S.grocery.checked[k] = true; else delete S.grocery.checked[k]; e.target.closest('li').classList.toggle('done', e.target.checked); save(); updateBadge(); });
  $('#groList').addEventListener('click', (e) => { const b = e.target.closest('[data-gdel]'); if (!b) return; const k = b.dataset.gdel; S.grocery.manual = S.grocery.manual.filter((m) => { const p = C.parseIngredient(m.text); return C.nameKey(p.name) !== k; }); S.grocery.hidden[k] = true; save(); renderGrocery(); });
  $('#groRecipes').addEventListener('change', (e) => { const id = e.target.dataset.gserv; if (!id) return; const en = S.grocery.recipes.find((x) => x.id === id); const v = parseFloat(e.target.value); if (en && v > 0) { en.servings = v; save(); renderGrocery(); } });
  $('#groRecipes').addEventListener('click', (e) => { const b = e.target.closest('[data-grm]'); if (!b) return; S.grocery.recipes = S.grocery.recipes.filter((x) => x.id !== b.dataset.grm); save(); renderGrocery(); });
  $('#groAdd').onsubmit = (e) => { e.preventDefault(); const v = $('#groItem').value.trim(); if (!v) return; const add = v.split(/\s*[;\n]\s*/).filter(Boolean); for (const t of add) S.grocery.manual.push({ id: C.uid(), text: t }); unhide(add.map((t) => ({ ingredient: t }))); $('#groItem').value = ''; save(); renderGrocery(); };
  $('#pantryAdd').onsubmit = (e) => { e.preventDefault(); const v = $('#pantryItem').value.trim(); if (!v) return; for (const t of v.split(/\s*,\s*/)) if (t && !S.pantry.includes(t.toLowerCase())) S.pantry.push(t.toLowerCase()); $('#pantryItem').value = ''; save(); renderGrocery(); };
  $('#pantryChips').onclick = (e) => { const b = e.target.closest('[data-pdel]'); if (!b) return; S.pantry.splice(+b.dataset.pdel, 1); save(); renderGrocery(); };
  $('#groUnits').onchange = (e) => { S.settings.groUnits = e.target.value; save(); renderGrocery(); };
  const groText = () => 'Grocery list\n\n' + C.groceryText(groceryItems(), S.grocery.checked);
  RB.groceryText = groText;
  $('#groCopy').onclick = async () => toast((await copyText(groText())) ? 'List copied' : 'Copy failed');
  $('#groShare').onclick = async () => { const text = groText(); if (navigator.share) { try { await navigator.share({ title: 'Grocery list', text }); return; } catch (e) { if (e.name === 'AbortError') return; } } toast((await copyText(text)) ? 'Sharing not available here, so the list was copied' : 'Copy failed'); };
  $('#groClearChecked').onclick = () => { for (const k of Object.keys(S.grocery.checked)) S.grocery.hidden[k] = true; S.grocery.manual = S.grocery.manual.filter((m) => !S.grocery.checked[C.nameKey(C.parseIngredient(m.text).name)]); S.grocery.checked = {}; save(); renderGrocery(); };
  $('#groClear').onclick = () => { if (!confirm('Clear the whole grocery list?')) return; S.grocery = { recipes: [], manual: [], checked: {}, hidden: {} }; save(); renderGrocery(); };

  // ---------- meal planner ----------
  let wkOff = 0;
  const DAYN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function curDays() { const d = new Date(); d.setDate(d.getDate() + wkOff * 7); return C.weekDays(d); }
  function addToPlan(day, recipeId, servings) { const r = byId(recipeId); if (!r) return; (S.plan[day] = S.plan[day] || []).push({ id: C.uid(), recipeId, servings: servings || r.servings || 2 }); save(); }
  RB.addToPlan = addToPlan;
  function fmtDay(iso, opts) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, opts); }
  function renderPlan() {
    const days = curDays();
    $('#wkLabel').textContent = fmtDay(days[0], { month: 'short', day: 'numeric' }) + ' – ' + fmtDay(days[6], { month: 'short', day: 'numeric', year: 'numeric' });
    const by = recipesById(); const q = ($('#planQ').value || '').toLowerCase();
    $('#planPool').innerHTML = S.recipes.filter((r) => !q || r.title.toLowerCase().includes(q)).sort((a, b) => a.title.localeCompare(b.title)).map((r) => `<li draggable="true" data-drag="${esc(r.id)}"><span>${emojiFor(r)} ${esc(r.title)}</span><button type="button" data-pick="${esc(r.id)}" aria-label="Add ${esc(r.title)} to a day">＋</button></li>`).join('') || '<li class="hint">No recipes yet.</li>';
    const opts = '<option value="">＋ Add recipe…</option>' + S.recipes.slice().sort((a, b) => a.title.localeCompare(b.title)).map((r) => `<option value="${esc(r.id)}">${esc(r.title)}</option>`).join('');
    $('#planDays').innerHTML = days.map((d, i) => `<div class="day ${d === today() ? 'today' : ''}" data-day="${d}"><h4>${DAYN[i]} <small>${esc(fmtDay(d, { month: 'short', day: 'numeric' }))}</small></h4>${(S.plan[d] || []).map((e) => { const r = by[e.recipeId]; return r ? `<div class="entry" draggable="true" data-entry="${esc(e.id)}" data-from="${d}"><a href="#/recipe/${encodeURIComponent(r.id)}">${esc(r.title)}</a><div class="row"><input type="number" min="0.25" step="any" value="${esc(e.servings)}" data-eserv="${esc(e.id)}" data-d="${d}" aria-label="Servings"><span class="hint">serv.</span><button type="button" data-edel="${esc(e.id)}" data-d="${d}" aria-label="Remove ${esc(r.title)} from ${DAYN[i]}">✕</button></div></div>` : ''; }).join('')}<select data-add="${d}" aria-label="Add a recipe to ${DAYN[i]}">${opts}</select></div>`).join('');
  }
  $('#planQ').oninput = renderPlan;
  $('#wkPrev').onclick = () => { wkOff--; renderPlan(); };
  $('#wkNext').onclick = () => { wkOff++; renderPlan(); };
  $('#wkToday').onclick = () => { wkOff = 0; renderPlan(); };
  $('#view-plan').addEventListener('dragstart', (e) => {
    const r = e.target.closest('[data-drag]'), en = e.target.closest('[data-entry]');
    if (r) e.dataTransfer.setData('text/plain', 'r:' + r.dataset.drag);
    else if (en) e.dataTransfer.setData('text/plain', 'e:' + en.dataset.from + ':' + en.dataset.entry);
    e.dataTransfer.effectAllowed = 'copyMove';
  });
  $('#planDays').addEventListener('dragover', (e) => { const d = e.target.closest('[data-day]'); if (!d) return; e.preventDefault(); $$('.day.over').forEach((x) => x !== d && x.classList.remove('over')); d.classList.add('over'); });
  $('#planDays').addEventListener('dragleave', (e) => { const d = e.target.closest('[data-day]'); if (d && !d.contains(e.relatedTarget)) d.classList.remove('over'); });
  $('#planDays').addEventListener('drop', (e) => {
    const d = e.target.closest('[data-day]'); if (!d) return; e.preventDefault(); d.classList.remove('over');
    const v = e.dataTransfer.getData('text/plain') || '';
    if (v.startsWith('r:')) addToPlan(d.dataset.day, v.slice(2));
    else if (v.startsWith('e:')) { const [, from, id] = v.split(':'); const list = S.plan[from] || []; const i = list.findIndex((x) => x.id === id); if (i >= 0 && from !== d.dataset.day) { const [en] = list.splice(i, 1); (S.plan[d.dataset.day] = S.plan[d.dataset.day] || []).push(en); save(); } }
    renderPlan();
  });
  $('#planDays').addEventListener('change', (e) => {
    if (e.target.dataset.add != null && e.target.value) { addToPlan(e.target.dataset.add, e.target.value); renderPlan(); return; }
    if (e.target.dataset.eserv) { const en = (S.plan[e.target.dataset.d] || []).find((x) => x.id === e.target.dataset.eserv); const v = parseFloat(e.target.value); if (en && v > 0) { en.servings = v; save(); } }
  });
  $('#planDays').addEventListener('click', (e) => { const b = e.target.closest('[data-edel]'); if (!b) return; S.plan[b.dataset.d] = (S.plan[b.dataset.d] || []).filter((x) => x.id !== b.dataset.edel); if (!S.plan[b.dataset.d].length) delete S.plan[b.dataset.d]; save(); renderPlan(); });
  $('#planPool').addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) pickDay(b.dataset.pick); });
  $('#planToGro').onclick = () => {
    const entries = C.planEntries(S.plan, curDays());
    if (!entries.length) { toast('Nothing planned this week yet'); return; }
    let n = 0; for (const e of entries) if (addToGrocery(e.recipeId, e.servings, e.id)) n++;
    toast(n ? `Added ${n} planned meal${n > 1 ? 's' : ''} to groceries` : 'This week is already on your grocery list');
  };
  function pickDay(recipeId) {
    const r = byId(recipeId); if (!r) return;
    const days = curDays();
    $('#dayH').textContent = 'Plan “' + r.title + '”';
    $('#dayPick').innerHTML = days.map((d, i) => `<button class="btn" value="${d}" data-pd="${d}">${DAYN[i]} · ${esc(fmtDay(d, { month: 'short', day: 'numeric' }))}${(S.plan[d] || []).length ? ` <span class="hint">(${S.plan[d].length} planned)</span>` : ''}</button>`).join('');
    const dlg = $('#dayDlg');
    dlg.onclose = () => { const d = dlg.returnValue; if (/^\d{4}-/.test(d)) { addToPlan(d, recipeId); toast(`Planned for ${fmtDay(d, { weekday: 'long' })}`); if (!$('#view-plan').hidden) renderPlan(); } };
    dlg.returnValue = ''; dlg.showModal();
  }

  // ---------- import ----------
  let preview = null;
  function clearPreview() { preview = null; $('#impPreview').hidden = true; $('#impPreview').innerHTML = ''; }
  const VIA = { 'json-ld': 'schema.org JSON-LD', microdata: 'page microdata', text: 'text', json: 'JSON', 'bookmarklet-json-ld': 'bookmarklet (schema.org JSON-LD)', 'bookmarklet-text': 'bookmarklet (page text)', 'bookmarklet-text-fallback': 'bookmarklet (page text)', 'bookmarklet-microdata': 'bookmarklet (microdata)', 'bookmarklet-json': 'bookmarklet' };
  function showPreview(res) {
    const box = $('#impPreview');
    if (!res || !res.recipe) { $('#impMsg').textContent = (res && res.error) || 'No recipe found.'; clearPreview(); return; }
    const r = res.recipe; preview = r;
    const ingN = r.ingredients.filter((l) => !/^#/.test(l)).length, stepN = r.steps.filter((l) => !/^#/.test(l)).length;
    const warn = !ingN || !stepN ? `<p class="hint">⚠️ ${!ingN ? 'No ingredients' : 'No steps'} found. You can fix it in the editor before saving.</p>` : '';
    box.innerHTML = `<div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 id="pvTitle">${esc(r.title)}</h2><span class="hint">Found via ${esc(VIA[res.via] || res.via || 'import')}</span></div>
      ${r.description ? `<p class="hint">${esc(r.description)}</p>` : ''}
      <p class="hint" id="pvMeta">${ingN} ingredients · ${stepN} steps${r.servings ? ' · serves ' + esc(C.formatFraction(r.servings)) : ''}${r.totalMin ? ' · ' + esc(C.humanMinutes(r.totalMin)) : ''}${r.tags.length ? ' · ' + r.tags.map((t) => '#' + esc(t)).join(' ') : ''}</p>${warn}
      <div class="prev-cols"><div><h3>Ingredients</h3><ul id="pvIngs">${r.ingredients.map((l) => (/^#/.test(l) ? `<li style="list-style:none"><b>${esc(l.replace(/^#\s*/, ''))}</b></li>` : `<li>${esc(l)}</li>`)).join('')}</ul></div>
      <div><h3>Steps</h3><ol id="pvSteps">${r.steps.map((l) => (/^#/.test(l) ? `<li style="list-style:none"><b>${esc(l.replace(/^#\s*/, ''))}</b></li>` : `<li>${esc(l)}</li>`)).join('')}</ol></div></div>
      <div class="actions"><button class="btn primary" id="pvSave" type="button">Save recipe</button><button class="btn" id="pvEdit" type="button">Edit, then save</button><button class="btn ghost" id="pvDiscard" type="button">Discard</button></div>`;
    box.hidden = false; $('#impMsg').textContent = '';
    box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  RB.preview = () => preview;
  $('#impPreview').addEventListener('click', (e) => {
    if (!preview) return;
    if (e.target.closest('#pvSave')) { const r = preview; S.recipes.push(r); save(); clearPreview(); $('#impText').value = ''; toast('Recipe saved'); location.hash = '#/recipe/' + encodeURIComponent(r.id); }
    else if (e.target.closest('#pvEdit')) openEditor(null, preview);
    else if (e.target.closest('#pvDiscard')) clearPreview();
  });
  $('#impGo').onclick = () => { const t = $('#impText').value; if (/^\s*https?:\/\/\S+\s*$/.test(t)) { $('#impUrl').value = t.trim(); tryUrl(t.trim()); return; } showPreview(C.importAny(t, $('#impUrl').value.trim() || '')); };
  $('#impFile').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const t = await f.text(); $('#impText').value = t.length > 200000 ? '' : t; showPreview(C.importAny(t)); };
  $('#urlForm').onsubmit = (e) => { e.preventDefault(); tryUrl($('#impUrl').value.trim()); };
  async function tryUrl(url) {
    const msg = $('#urlMsg');
    if (!/^https?:\/\//i.test(url)) { msg.textContent = 'Enter a full link starting with https://'; return; }
    msg.textContent = 'Trying to read the page…';
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const to = setTimeout(() => ctl && ctl.abort(), 9000);
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal: ctl && ctl.signal });
      clearTimeout(to);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const out = C.importAny(text, url);
      if (out.recipe && out.recipe.ingredients.length) { msg.textContent = 'Got it. Check the preview below.'; showPreview(out); return; }
      msg.innerHTML = 'The page loaded but no recipe data was found. Open it and use the <b>Save to RecipeBox</b> bookmarklet, or paste the recipe text above.';
    } catch (err) {
      clearTimeout(to);
      msg.innerHTML = 'That site doesn\'t let other apps read its pages (browsers block this for privacy, known as CORS). Open the recipe in a tab and click the <b>📥 Save to RecipeBox</b> bookmarklet instead; it reads the recipe in your browser and sends it here. You can also paste the recipe text or the page source above.';
    }
  }
  const APP_URL = location.origin + location.pathname.replace(/index\.html$/, '');
  RB.appUrl = APP_URL;
  const bm = C.bookmarkletSource(APP_URL);
  $('#bmLink').setAttribute('href', bm); $('#bmCode').value = bm;
  $('#bmLink').addEventListener('click', (e) => { e.preventDefault(); toast('Drag this button to your bookmarks bar, then click it on a recipe page.', 4000); });
  $('#bmCopy').onclick = async () => toast((await copyText(bm)) ? 'Bookmarklet code copied' : 'Copy failed');
  function handleHashImport(h) {
    const p = C.decodeHashPayload(h);
    history.replaceState(null, '', location.pathname + location.search + '#/import');
    show('import');
    if (!p || p.error) { $('#impMsg').textContent = (p && p.error) || 'Could not read the recipe handoff.'; return; }
    const res = C.recipeFromPayload(p);
    if (!res.recipe) { $('#impMsg').textContent = res.error; return; }
    showPreview(res); toast('Recipe received from ' + (p.url ? new URL(p.url).hostname : 'the bookmarklet'));
  }
  function waitForHandoff() {
    history.replaceState(null, '', location.pathname + location.search + '#/import');
    show('import'); $('#impMsg').textContent = 'Waiting for the recipe from the other tab…';
    if (window.opener) { try { window.opener.postMessage({ type: 'rbr-ready' }, '*'); } catch (e) { /* ignore */ } }
  }
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'rbr-import' || !d.payload) return;
    if (window.opener && e.source !== window.opener) return;
    const res = C.recipeFromPayload(d.payload);
    show('import'); if (res.recipe) showPreview(res); else $('#impMsg').textContent = res.error;
  });

  // ---------- timers ----------
  let actx = null;
  function audio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; } return actx; }
  function beep() {
    const a = audio(); if (!a) return;
    const t0 = a.currentTime;
    [0, 0.25, 0.5].forEach((d, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = i === 2 ? 1046 : 880; g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.2); o.connect(g).connect(a.destination); o.start(t0 + d); o.stop(t0 + d + 0.22); });
  }
  RB.alarms = [];
  function startTimer(seconds, label, recipe) {
    audio();
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { /* ignore */ } }
    const t = { id: C.uid(), label: label || C.formatDuration(seconds), recipe: recipe || '', duration: seconds, end: now() + seconds * 1000, paused: null, rung: false };
    S.timers.push(t); save(); renderTimers(); toast(`Timer started: ${t.label}`);
    return t.id;
  }
  RB.startTimer = startTimer;
  function remaining(t) { return t.paused != null ? t.paused : Math.max(0, (t.end - now()) / 1000); }
  let lastBeep = 0;
  function tick() {
    let changed = false;
    for (const t of S.timers) {
      if (!t.rung && t.paused == null && t.end <= now()) {
        t.rung = true; changed = true; t.rangAt = now();
        RB.alarms.push({ id: t.id, label: t.label, at: now() });
        toast(`⏰ ${t.label} is up${t.recipe ? ' · ' + t.recipe : ''}`, 6000);
        if (navigator.vibrate) { try { navigator.vibrate([300, 150, 300, 150, 600]); } catch (e) { /* ignore */ } }
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) { try { new Notification('Timer done', { body: t.label + (t.recipe ? ' · ' + t.recipe : ''), icon: 'icon.svg' }); } catch (e) { /* ignore */ } }
        if (cookState && speakOn) speak(`Timer done: ${t.label}`);
      }
    }
    const ringing = S.timers.filter((t) => t.rung);
    if (ringing.length && now() - lastBeep > 1500 && ringing.some((t) => now() - t.rangAt < 120000)) { lastBeep = now(); beep(); }
    if (changed) save();
    renderTimers();
  }
  let dockSig = null;
  function renderTimers() {
    const dock = $('#timerDock');
    dock.hidden = !S.timers.length;
    const sig = S.timers.map((t) => t.id + (t.rung ? 'r' : '') + (t.paused != null ? 'p' : '')).join();
    if (sig === dockSig) { for (const t of S.timers) { const el = dock.querySelector(`[data-tid="${t.id}"] .tt`); if (el && !t.rung) el.textContent = C.formatDuration(Math.ceil(remaining(t))); } return; }
    dockSig = sig;
    dock.innerHTML = S.timers.map((t) => `<div class="timer ${t.rung ? 'ring' : ''}" data-tid="${esc(t.id)}"><div><div class="tl">${esc(t.label)}${t.recipe ? ' · ' + esc(t.recipe) : ''}</div><div class="tt" data-left="${Math.ceil(remaining(t))}">${t.rung ? "Time's up!" : C.formatDuration(Math.ceil(remaining(t)))}</div></div>${t.rung ? '' : `<button type="button" data-tp="${esc(t.id)}" aria-label="${t.paused != null ? 'Resume' : 'Pause'} timer">${t.paused != null ? '▶' : '⏸'}</button><button type="button" data-tadd="${esc(t.id)}" aria-label="Add one minute">+1</button>`}<button type="button" data-tx="${esc(t.id)}" aria-label="${t.rung ? 'Dismiss' : 'Cancel'} timer">${t.rung ? '✓' : '✕'}</button></div>`).join('');
  }
  $('#timerDock').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.tp || b.dataset.tadd || b.dataset.tx; const t = S.timers.find((x) => x.id === id); if (!t) return;
    if (b.dataset.tp) { if (t.paused != null) { t.end = now() + t.paused * 1000; t.paused = null; } else t.paused = remaining(t); }
    else if (b.dataset.tadd) { if (t.paused != null) t.paused += 60; else t.end += 60000; }
    else if (b.dataset.tx) S.timers = S.timers.filter((x) => x.id !== id);
    save(); renderTimers();
  });
  function stopRinging() { const n = S.timers.filter((t) => t.rung).length; S.timers = S.timers.filter((t) => !t.rung); save(); renderTimers(); return n; }

  // ---------- cook mode ----------
  let cookState = null, speakOn = false, wakeLock = null, recog = null, voiceOn = false;
  RB.cook = { wakeLock: 'off', voice: 'off' };
  async function requestWake() {
    if (!('wakeLock' in navigator)) { RB.cook.wakeLock = 'unsupported'; return; }
    try { wakeLock = await navigator.wakeLock.request('screen'); RB.cook.wakeLock = 'active'; wakeLock.addEventListener('release', () => { if (RB.cook.wakeLock === 'active') RB.cook.wakeLock = 'released'; }); }
    catch (e) { RB.cook.wakeLock = 'denied'; }
  }
  document.addEventListener('visibilitychange', () => { if (cookState && document.visibilityState === 'visible' && (!wakeLock || wakeLock.released)) requestWake(); });
  function openCook(id) {
    const r = byId(id); if (!r) return;
    const f = factorFor(r);
    const units = RV.units || S.settings.units;
    const ings = r.ingredients.map(C.parseIngredient);
    const steps = []; let sec = '';
    r.steps.forEach((s) => { if (/^#/.test(s)) sec = s.replace(/^#\s*/, ''); else steps.push({ text: C.convertTextUnits(s, units), raw: s, section: sec }); });
    if (!steps.length) { toast('This recipe has no steps yet'); return; }
    cookState = { id, idx: 0, steps, ings, factor: f.factor, units, title: r.title };
    $('#cookTitle').textContent = r.title;
    $('#cookIngs').innerHTML = `<h3>Ingredients${r.servings ? ' · ' + esc(C.formatFraction(f.target)) + ' servings' : ''}</h3><ul class="ings">` + ings.map((i, k) => { if (i.section) return `<li class="sec">${esc(i.section)}</li>`; const p = C.presentIngredient(i, f.factor, units); return `<li data-ci="${k}"><span class="itxt">${esc(p.text)}</span></li>`; }).join('') + '</ul>';
    $('#cook').hidden = false; document.body.style.overflow = 'hidden'; document.body.classList.add('cooking');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    $('#cookVoice').hidden = !SR || S.settings.voice === false;
    $('#cookIngs').hidden = matchMedia('(max-width:760px)').matches;
    $('#cookIngBtn').setAttribute('aria-pressed', String(!$('#cookIngs').hidden));
    requestWake();
    renderCook();
    $('#cookNext').focus();
  }
  RB.openCook = openCook;
  function renderCook() {
    const c = cookState; if (!c) return;
    const st = c.steps[c.idx];
    $('#cookSection').textContent = st.section || '';
    $('#cookStepNo').textContent = `Step ${c.idx + 1} of ${c.steps.length}`;
    $('#cookText').textContent = st.text;
    $('#cookBar').style.width = ((c.idx + 1) / c.steps.length * 100) + '%';
    const used = C.ingredientsInStep(st.raw, c.ings);
    $$('#cookIngs li[data-ci]').forEach((li) => li.classList.toggle('hl', used.includes(+li.dataset.ci)));
    $('#cookStepIngs').innerHTML = used.map((k) => `<span>${esc(C.presentIngredient(c.ings[k], c.factor, c.units).text)}</span>`).join('');
    const timers = C.detectTimers(st.raw);
    $('#cookTimers').innerHTML = timers.map((t) => `<button type="button" class="tchip" data-ctimer="${t.seconds}" data-label="${esc(t.label)}">⏲ Start ${esc(t.label)} timer</button>`).join('');
    $('#cookPrev').disabled = c.idx === 0;
    $('#cookNext').textContent = c.idx === c.steps.length - 1 ? 'Done ✓' : 'Next ›';
    if (speakOn) speak(st.text);
  }
  function cookGo(d) {
    const c = cookState; if (!c) return;
    if (d > 0 && c.idx === c.steps.length - 1) { closeCook(); toast('Enjoy your meal! 🍽️'); return; }
    c.idx = Math.max(0, Math.min(c.steps.length - 1, c.idx + d)); renderCook();
  }
  function closeCook() {
    cookState = null; $('#cook').hidden = true; document.body.style.overflow = ''; document.body.classList.remove('cooking');
    if (wakeLock) { try { wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }
    RB.cook.wakeLock = 'off';
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setVoice(false);
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('Read-aloud is not supported in this browser'); return; }
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; RB.cook.lastSpoken = text; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
  }
  function cookStartTimer() { const c = cookState; if (!c) return false; const t = C.detectTimers(c.steps[c.idx].raw)[0]; if (!t) { toast('No timer in this step'); return false; } startTimer(t.seconds, t.label, c.title); return true; }
  function voiceCommand(text) {
    const t = String(text || '').toLowerCase();
    let cmd = null;
    if (/\b(next|continue|forward|done)\b/.test(t)) cmd = 'next';
    else if (/\b(back|previous|go back)\b/.test(t)) cmd = 'back';
    else if (/\b(repeat|again|read)\b/.test(t)) cmd = 'repeat';
    else if (/\b(stop|dismiss|cancel) (the )?(timer|alarm)\b|\bstop\b/.test(t)) cmd = 'stop';
    else if (/\b(start|set)\b.*\btimer\b|\btimer\b/.test(t)) cmd = 'timer';
    else if (/\bingredients?\b/.test(t)) cmd = 'ingredients';
    RB.cook.lastCommand = cmd;
    if (cmd === 'next') cookGo(1);
    else if (cmd === 'back') cookGo(-1);
    else if (cmd === 'repeat') { if (cookState) speak(cookState.steps[cookState.idx].text); }
    else if (cmd === 'timer') cookStartTimer();
    else if (cmd === 'stop') stopRinging();
    else if (cmd === 'ingredients') toggleCookIngs();
    if (cmd) $('#cookStatus').textContent = `Heard “${text}”`;
    return cmd;
  }
  RB.voiceCommand = voiceCommand;
  function setVoice(on) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    voiceOn = on && !!SR;
    $('#cookVoice').setAttribute('aria-pressed', String(voiceOn));
    if (!voiceOn) { if (recog) { try { recog.onend = null; recog.abort(); } catch (e) { /* ignore */ } recog = null; } RB.cook.voice = 'off'; $('#cookStatus').textContent = ''; return; }
    recog = new SR(); recog.continuous = true; recog.interimResults = false; recog.lang = navigator.language || 'en-US';
    recog.onresult = (e) => { const r = e.results[e.results.length - 1]; if (r && r.isFinal) voiceCommand(r[0].transcript); };
    recog.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { toast('Microphone access was blocked'); setVoice(false); } };
    recog.onend = () => { if (voiceOn && cookState) { try { recog.start(); } catch (e) { /* ignore */ } } };
    try { recog.start(); RB.cook.voice = 'listening'; $('#cookStatus').textContent = 'Listening: say “next”, “back”, “repeat” or “start timer”'; } catch (e) { RB.cook.voice = 'error'; }
  }
  function toggleCookIngs() { const h = !$('#cookIngs').hidden; $('#cookIngs').hidden = h; $('#cookIngBtn').setAttribute('aria-pressed', String(!h)); }
  $('#cookNext').onclick = () => cookGo(1);
  $('#cookPrev').onclick = () => cookGo(-1);
  $('#cookClose').onclick = closeCook;
  $('#cookIngBtn').onclick = toggleCookIngs;
  $('#cookSpeak').onclick = () => { speakOn = !speakOn; $('#cookSpeak').setAttribute('aria-pressed', String(speakOn)); if (speakOn && cookState) speak(cookState.steps[cookState.idx].text); else if ('speechSynthesis' in window) speechSynthesis.cancel(); };
  $('#cookVoice').onclick = () => setVoice(!voiceOn);
  $('#cookTimers').onclick = (e) => { const b = e.target.closest('[data-ctimer]'); if (b && cookState) startTimer(+b.dataset.ctimer, b.dataset.label, cookState.title); };
  document.addEventListener('keydown', (e) => {
    if (!cookState || e.target.matches('input,textarea,select')) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); cookGo(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); cookGo(-1); }
    else if (e.key === 'Escape') closeCook();
  });
  let tx0 = null;
  $('#cook').addEventListener('touchstart', (e) => { tx0 = e.touches[0].clientX; }, { passive: true });
  $('#cook').addEventListener('touchend', (e) => { if (tx0 == null) return; const dx = e.changedTouches[0].clientX - tx0; tx0 = null; if (Math.abs(dx) > 70 && !e.target.closest('button,.cook-ings')) cookGo(dx < 0 ? 1 : -1); });

  // ---------- settings ----------
  function renderSettings() {
    $('#themeSel').value = S.settings.theme || 'auto'; $('#unitSel').value = S.settings.units || 'original'; $('#voiceSel').checked = S.settings.voice !== false;
    const info = $('#storeInfo');
    info.textContent = `${S.recipes.length} recipe${S.recipes.length === 1 ? '' : 's'} saved in this browser.`;
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => { if (e.usage != null) info.textContent += ` Using about ${(e.usage / 1048576).toFixed(1)} MB.`; }).catch(() => {});
  }
  $('#themeSel').onchange = (e) => { applyTheme(e.target.value); save(); };
  $('#unitSel').onchange = (e) => { S.settings.units = e.target.value; RV.id = null; save(); };
  $('#voiceSel').onchange = (e) => { S.settings.voice = e.target.checked; save(); };
  $('#bkDown').onclick = () => { download(`recipebox-backup-${today()}.json`, JSON.stringify(C.makeBackup(S), null, 1), 'application/json'); $('#bkMsg').textContent = 'Backup downloaded.'; };
  $('#bkFile').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const merge = $('#bkMerge').checked;
      if (!merge && !confirm('Replace everything here with this backup?')) return;
      const next = C.readBackup(await f.text(), S, merge ? 'merge' : 'replace');
      Object.assign(S, next); S.grocery.hidden = S.grocery.hidden || {}; S.grocery.checked = S.grocery.checked || {}; S.grocery.manual = S.grocery.manual || []; S.grocery.recipes = S.grocery.recipes || [];
      S.settings = Object.assign(DEF().settings, S.settings); S.seeded = true;
      applyTheme(S.settings.theme || 'auto');
      save(); await RB.flush(); RV.id = null; updateBadge();
      $('#bkMsg').textContent = `Restored ${next.recipes.length} recipes${merge ? ' (merged)' : ''}.`; renderSettings();
    } catch (err) { $('#bkMsg').textContent = err.message || 'Could not read that file.'; }
  };
  $('#wipe').onclick = async () => {
    if (!confirm('Erase all recipes, plans and lists from this browser? Download a backup first if you want to keep them.')) return;
    const theme = S.settings.theme; S = DEF(); S.seeded = true; S.settings.theme = theme; save(); await RB.flush(); updateBadge(); renderTimers(); toast('All data erased'); location.hash = '#/recipes'; route();
  };

  // ---------- boot ----------
  (async function init() {
    await DB.open();
    const saved = await DB.get('state');
    if (saved && typeof saved === 'object') loadState(saved);
    if (!S.seeded) { S.seeded = true; for (const s of window.RB_SAMPLES || []) S.recipes.push(C.normalizeRecipe(Object.assign({}, s, { sample: true }))); save(); }
    RB.state = S;
    Object.defineProperty(RB, 'state', { get: () => S, configurable: true });
    applyTheme(S.settings.theme || 'auto');
    renderTimers(); updateBadge();
    setInterval(tick, 250);
    route();
    RB.ready = true;
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').then(() => { RB.sw = 'registered'; }).catch(() => { RB.sw = 'failed'; });
    }
  })();
})();
