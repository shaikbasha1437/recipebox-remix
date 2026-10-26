# 🍲 RecipeBox Remix

A private, offline-friendly recipe box that runs entirely in your browser. Discover dishes from a free online library, import recipes from almost any site, scale and convert them, build a merged grocery list, plan your week, and cook hands-free.

**Live app:** https://shaikbasha1437.github.io/recipebox-remix/

No account, no server, no tracking. Your recipes live in your browser's IndexedDB. Use **More → Backup** to move them between devices.

## Features

**Discover**
- Search a free online library, [TheMealDB](https://www.themealdb.com/), by dish name or ingredient. You can also browse by cuisine/country and by category, filter by main ingredient, or tap **🎲 Surprise me**.
- Each preview shows the photo, ingredients with measures, steps and cuisine, plus links to the original source, TheMealDB page and the YouTube video when there is one.
- **Save to My Recipes** converts the dish into the app's format. Measures are parsed so the recipe scales and converts, instructions are split into steps, category and cuisine become tags, and a credit with the source link goes in the notes. Dishes you already saved are detected and show **✓ Saved**.
- **Add to grocery list** works straight from the preview.
- Responses are cached in memory and in session storage. When you're offline or the service is down, Discover says so, and your saved recipes keep working.
- To be clear about its size: the library has about 790 dishes from 37 cuisines (counted October 2026). It is not every recipe in the world. For anything else, use Import or the bookmarklet. TheMealDB doesn't list servings, so saved dishes scale with ½×/2×/3×.

**Import**
- Paste recipe text, a page's HTML source, or schema.org JSON-LD. The importer reads JSON-LD (`@graph`, `HowToSection`, ISO durations), then microdata, then falls back to a plain-text parser that finds the ingredient and step sections.
- **📥 Save to RecipeBox bookmarklet.** On any recipe page, click it to send the recipe here. It reads the page's recipe data in your browser, then opens RecipeBox Remix with the recipe in the URL hash (`#import=…`). Very large pages are sent with `postMessage` instead.
- Optional direct link import. Most recipe sites block other apps from reading their pages (CORS), so when that fails the app explains why and points you to the bookmarklet. No third-party proxy is used.
- Import a saved `.html`, `.json` or `.txt` file.

**Recipes**
- Scale by servings or ½×/2×/3×, with friendly fractions.
- Units can be shown as written, US, or metric. Conversion uses an ingredient density table, so flour comes out in grams rather than millilitres, and oven temperatures and pan sizes in the steps are converted too.
- Ingredient checkboxes, editing, tags, photo (link or upload), notes, star rating, favorites, search, tag filters and sorting.
- Print view, Markdown export and copy, duplicate.

**Grocery list**
- Merges ingredients across recipes: "4 cloves garlic" + "4 cloves garlic, minced" becomes **8 cloves garlic**, and volumes and weights fold together.
- Grouped by aisle, check-off, add your own items, copy or share.
- Pantry list: staples you always have move to "Already have".

**Meal planner**
- Drag recipes onto days of the week (or use the picker on phones), set servings per meal, and send the whole week to the grocery list.

**Cook mode**
- Big step-by-step view with the current step's ingredients highlighted.
- Keeps the screen awake (Screen Wake Lock API, where supported).
- Timers are detected in the steps ("bake 25 minutes"). They keep running across pages and reloads, and they beep, vibrate and notify when done.
- Read-aloud (speech synthesis) and voice commands where the browser supports speech recognition: "next", "back", "repeat", "start timer", "stop", "ingredients".
- Keyboard: ← → / Space / Esc. Swipe on phones.

**Everything else**
- Six original sample recipes on first run.
- Backup and restore (merge or replace), and a one-click erase.
- Light/dark/auto themes, mobile-first layout, installable PWA that works offline.
- Every sheet and overlay (editor, plan picker, Discover preview, cook mode) has a ✕ and a Cancel/Close button. It also closes with Esc, a tap outside it, or the browser/Android Back button. If you have unsaved edits, it asks before discarding them.
- Deleting a recipe, grocery item, plan entry or pantry staple shows an **Undo** toast.

## Using the bookmarklet

1. Open **Import** in the app.
2. Drag the **📥 Save to RecipeBox** button to your bookmarks bar. On a phone, copy the code shown under it, then create a bookmark and paste the code as its URL.
3. On any recipe page, tap the bookmark. RecipeBox Remix opens with a preview, and you choose **Save**.

The bookmarklet only reads the page you are on, and only when you click it. It sends the data straight to this app in your browser. Some sites with strict security policies block bookmarklets. In that case, copy the recipe text (or use *View source*, then copy everything) and paste it into Import.

## Privacy

Everything stays on your device. The app makes no network requests apart from loading its own files, photos you link to, a direct link import if you ask for one, and requests to TheMealDB's public API (plus its photos) when you use Discover.

## Limits

- Voice commands need a browser with the Web Speech API (Chrome, Edge, Safari). Firefox supports read-aloud but not voice commands.
- Wake Lock needs a supported browser and HTTPS. When it isn't available, cook mode still works but the screen may dim.
- Timer alarms in a background tab depend on the browser. Notifications help when permission is granted.
- Unit conversion is approximate, so check baking recipes against the original.
- Discover covers TheMealDB's free library only, about 790 dishes. It uses the public test key `1` from TheMealDB's free tier, and some dishes have short or loosely formatted instructions.
- Imported recipes keep their source link. Respect the original authors and don't republish their content.

## Development

Plain HTML, CSS and JS with no build step. Core logic (parsing, scaling, conversion, grocery merging, import, planner, backup) lives in `core.js`, the TheMealDB converter in `mealdb.js`, and the modal/Back-button stack in `modal.js`. All three have Node tests:

```sh
npm test            # node --test test/*.test.js
python3 -m http.server 8000   # then open http://localhost:8000
```

## Credits

Recipe data and photos in Discover come from [TheMealDB](https://www.themealdb.com/), a free, crowd-sourced recipe database and API. Saved copies link back to TheMealDB and to the original source.

## License

MIT © 2026 shaikbasha1437. The sample recipes were written for this project and are under the same license.
