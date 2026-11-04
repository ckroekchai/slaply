import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import {
  BRAND_OBJECTS, BRAND_OBJECTS_ASSET, DEFAULT_CUSTOMIZATION, GUIDELINE_SIZE,
  buildGuidelineModel, normalizeCustomization, renderGuidelineMarkup,
  renderGuidelineDetails, renderGuidelineIngredients, renderObjectSprite,
} from '../src/brand-guideline-model.js';

const mood = { id: 'fresh', title: 'Fresh', paper: '#C8EAD5', ink: '#153D2C', palette: ['#A7DCBF','#FFC3A2','#214C35'], tagline: 'A little joy.\nEvery day.' };
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aoc8AAAAASUVORK5CYII=';
const recipe = {
  name: 'Daydream', words: 'Warm. Curious. Playful.', promise: 'A little joy, every day.',
  productImage: '/assets/ingredient-0.png', referenceImage: '/assets/ingredient-1.png', referenceColor: '#AFD7B8',
  ingredients: Array.from({ length: 6 }, (_, i) => ({ src: `/assets/ingredient-${i}.png`, name: `Ingredient ${i + 1}`, locked: i === 0 || i === 4 })),
};
const sprite = await readFile(new URL('../public/assets/brand-objects.png', import.meta.url));
const spriteData = `data:image/png;base64,${sprite.toString('base64')}`;
const spriteWidth = sprite.readUInt32BE(16), spriteHeight = sprite.readUInt32BE(20);

// Bundle only to resolve Vite's ?raw imports. Tests execute the production exporter,
// recording Canvas operations and downloaded blobs without a browser or network.
const bundle = await build({
  entryPoints: [new URL('../src/export-brand.js', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'browser',
  plugins: [{ name: 'raw-css', setup(build) {
    build.onResolve({ filter: /\.css\?raw$/ }, ({ path, resolveDir }) => ({ path: new URL(path.replace(/\?raw$/, ''), `file://${resolveDir}/`).pathname, namespace: 'raw-css' }));
    build.onLoad({ filter: /.*/, namespace: 'raw-css' }, async ({ path }) => ({ contents: `export default ${JSON.stringify(await readFile(path, 'utf8'))}`, loader: 'js' }));
  } }],
});
const { exportBrand } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

async function withExportBrowser(run) {
  const before = { window: globalThis.window, document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const downloads = [], canvases = [], blobs = new Map();
  class LocalImage {
    set src(value) {
      this.source = value;
      const png = Buffer.from(value.split(',')[1], 'base64');
      this.naturalWidth = png.readUInt32BE(16); this.naturalHeight = png.readUInt32BE(20);
      queueMicrotask(() => this.onload());
    }
  }
  const assets = Object.fromEntries(recipe.ingredients.map(item => [item.src, pixel]));
  assets[BRAND_OBJECTS_ASSET] = spriteData;
  globalThis.window = { __SLAPLY_ASSETS__: assets, Image: LocalImage, location: { href: 'http://localhost/', origin: 'http://localhost' }, setTimeout() { return 1; } };
  globalThis.document = {
    fonts: { ready: Promise.resolve() },
    styleSheets: [{ cssRules: [{ type: 5, cssText: '@font-face{font-family:"Space Grotesk";src:url(data:font/ttf;base64,AA==)}' }] }],
    body: { appendChild() {} },
    createElement(tag) {
      if (tag === 'a') return { style: {}, click() { downloads.push({ name: this.download, blob: blobs.get(this.href) }); }, remove() {} };
      assert.equal(tag, 'canvas');
      const calls = [];
      const context = {
        font: '16px sans-serif', save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, ellipse() {}, fill() {}, fillRect() {}, fillText() {},
        measureText(value) { return { width: String(value).length * (Number(/([\d.]+)px/.exec(this.font)?.[1]) || 16) * .5 }; },
        drawImage(image, ...args) { calls.push({ source: image.source, args }); },
      };
      const canvas = { width: 0, height: 0, calls, getContext() { return context; }, toBlob(callback) { callback(new Blob(['recorded PNG'], { type: 'image/png' })); } };
      canvases.push(canvas); return canvas;
    },
  };
  URL.createObjectURL = blob => { const url = `blob:test-${blobs.size}`; blobs.set(url, blob); return url; };
  URL.revokeObjectURL = () => {};
  try { return await run({ downloads, canvases }); }
  finally {
    if (before.window === undefined) delete globalThis.window; else globalThis.window = before.window;
    if (before.document === undefined) delete globalThis.document; else globalThis.document = before.document;
    URL.createObjectURL = before.create; URL.revokeObjectURL = before.revoke;
  }
}

test('object sizing changes designed objects while preserving the source image and product geometry', () => {
  const original = structuredClone(recipe);
  const small = buildGuidelineModel({ ...recipe, customization: { objectScale: 70 } }, mood);
  const large = buildGuidelineModel({ ...recipe, customization: { objectScale: 120 } }, mood);
  assert.deepEqual(small.layout.product, large.layout.product);
  assert.equal(small.productSource, recipe.productImage);
  assert.equal(large.productSource, recipe.productImage);
  assert.deepEqual(small.colors, large.colors);
  assert.equal(small.fonts.name, large.fonts.name);
  for (let i = 0; i < small.objects.length; i++) {
    assert.equal(small.objects[i].x, large.objects[i].x);
    assert.equal(small.objects[i].y, large.objects[i].y);
    assert.ok(Math.abs(large.objects[i].size / small.objects[i].size - 120 / 70) < 1e-10);
  }
  assert.deepEqual(recipe, original, 'Rendering must not mutate the saved recipe or images.');
});

test('invalid saved customization falls back safely and valid numeric settings are bounded', () => {
  for (const saved of [undefined, null, [], 'broken']) assert.deepEqual(normalizeCustomization(saved), DEFAULT_CUSTOMIZATION);
  const invalid = { textScale: null, objectScale: '', objectStyle: '<script>', hue: 'nope', brightness: false, saturation: {} };
  assert.deepEqual(normalizeCustomization(invalid), DEFAULT_CUSTOMIZATION);
  assert.deepEqual(normalizeCustomization({ textScale: 1000, objectScale: -7, objectStyle: 'ribbon', hue: 500, brightness: -2, saturation: 999 }), {
    textScale: 125, objectScale: 50, objectStyles: ['ribbon'], objectStyle: 'ribbon', hue: 180, brightness: 50, saturation: 180,
  });
  assert.equal(normalizeCustomization({ textScale: '110', saturation: 0 }).textScale, 110);
  assert.equal(normalizeCustomization({ saturation: 0 }).saturation, 0);
});

test('each family displays and exports a distinct complete sprite cell', async () => {
  assert.equal(spriteWidth, spriteHeight * 3, 'The source sheet must contain three equal square cells.');
  const usedCells = [];
  await withExportBrowser(async ({ canvases }) => {
    for (const family of BRAND_OBJECTS) {
      const input = { ...recipe, customization: { objectStyle: family.id } };
      const model = buildGuidelineModel(input, mood);
      assert.equal(model.objectFamily.id, family.id);
      const preview = renderObjectSprite(family.id);
      assert.match(preview, new RegExp(`left:-${family.position * 100}%`));
      await exportBrand(input, mood, 'png');
      const canvas = canvases.at(-1);
      assert.deepEqual({ width: canvas.width, height: canvas.height }, GUIDELINE_SIZE);
      const objects = canvas.calls.filter(call => call.source === spriteData);
      assert.equal(objects.length, 3);
      const expectedCell = [family.position * spriteHeight, 0, spriteHeight, spriteHeight];
      objects.forEach(call => assert.deepEqual(call.args.slice(0, 4), expectedCell));
      usedCells.push(expectedCell);
      const product = canvas.calls.find(call => call.source === pixel);
      assert.equal(product.args.length, 4, 'Original products use the uncropped drawImage overload.');
      assert.ok(product.args[2] <= model.layout.product.w && product.args[3] <= model.layout.product.h);
    }
  });
  assert.equal(new Set(usedCells.map(cell => cell.join(','))).size, 3);
  assert.equal(usedCells[0][0] + usedCells[0][2], usedCells[1][0]);
  assert.equal(usedCells[1][0] + usedCells[1][2], usedCells[2][0]);
});

test('user text stays escaped and ingredients remain outside the artwork', () => {
  const input = { ...recipe, name: '<img src=x onerror="bad()">', words: '</p><script>bad()</script>', promise: '<svg onload="bad()">', ingredients: [{ src: pixel, name: '"<script>bad()</script>', locked: true }] };
  const model = buildGuidelineModel(input, mood);
  const artwork = renderGuidelineMarkup(model);
  const details = renderGuidelineDetails(model);
  const ingredients = renderGuidelineIngredients(model);
  for (const markup of [artwork, details, ingredients]) {
    assert.doesNotMatch(markup, /<script|<svg|<img src=x|\sonerror=["']/i);
    assert.doesNotMatch(markup, />\s*0[1-6]\s*\//);
  }
  assert.match(artwork, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;/);
  assert.match(details, /&lt;svg onload=&quot;bad\(\)&quot;&gt;/);
  assert.doesNotMatch(artwork, /guide-sources|Your ingredients|Locked focus|Color story|Typography/);
  assert.match(ingredients, /Your ingredients/);
  assert.match(ingredients, /Locked focus/);
  const unsafe = buildGuidelineModel({ productImage: 'javascript:alert(1)', ingredients: [{ src: 'https://untrusted.example/x.png' }] }, mood);
  assert.equal(unsafe.productSource, ''); assert.deepEqual(unsafe.ingredients, []);
});

test('JSON export preserves six original sources, locks and the same applied artwork model', async () => {
  const input = { ...recipe, customization: { objectStyle: 'ribbon', objectScale: 116, textScale: 108, hue: 24, brightness: 92, saturation: 63 } };
  const model = buildGuidelineModel(input, mood);
  await withExportBrowser(async ({ downloads }) => {
    await exportBrand(input, mood, 'json');
    const payload = JSON.parse(await downloads[0].blob.text());
    assert.equal(payload.schema, 'slaply.brand-recipe.v5');
    assert.deepEqual(payload.recipe.customization, model.customization);
    assert.equal(payload.recipe.productImage, pixel);
    assert.equal(payload.recipe.referenceImage, pixel);
    assert.equal(payload.recipe.ingredients.length, 6);
    assert.deepEqual(payload.recipe.ingredients.map(item => item.locked), input.ingredients.map(item => item.locked));
    payload.recipe.ingredients.forEach(item => assert.equal(item.src, pixel));
    assert.deepEqual(payload.guideline.size, model.size);
    assert.deepEqual(payload.guideline.colors, model.colors);
    assert.deepEqual(payload.guideline.palette, model.palette);
    assert.deepEqual(payload.guideline.typography, model.typography);
    assert.deepEqual(payload.guideline.keywords, model.keywords);
    assert.equal(payload.guideline.objects.source, spriteData);
    assert.equal(payload.guideline.objects.style, model.objectStyle);
    assert.equal(payload.guideline.objects.selectedColumn, model.objectFamily.position);
    assert.deepEqual(payload.guideline.objects.instances, model.objects);
    assert.equal(payload.guideline.objects.filter, model.objectFilter);
    await exportBrand(input, mood, 'html');
    const html = await downloads[1].blob.text();
    const resolve = source => source === BRAND_OBJECTS_ASSET ? spriteData : pixel;
    assert.ok(html.includes(renderGuidelineMarkup(model, resolve)), 'Standalone HTML must use the exact live artwork markup.');
    assert.ok(html.includes(renderGuidelineDetails(model)));
    assert.ok(html.includes(renderGuidelineIngredients(model, resolve)));
  });
});

test('saved single-family recipes migrate, while explicit multi-selection and empty lists take precedence', () => {
  assert.deepEqual(normalizeCustomization({ objectStyle: 'orbit' }).objectStyles, ['orbit']);
  assert.deepEqual(normalizeCustomization({ objectStyle: 'ribbon', objectStyles: null }).objectStyles, ['ribbon']);
  assert.deepEqual(normalizeCustomization({ objectStyle: 'missing' }).objectStyles, ['bloom']);
  const input = { objectStyle: 'ribbon', objectStyles: ['orbit', 'bloom', 'orbit', 'unknown', 'ribbon'] };
  const original = structuredClone(input);
  const normalized = normalizeCustomization(input);
  assert.deepEqual(normalized.objectStyles, ['bloom', 'orbit', 'ribbon']);
  assert.equal(normalized.objectStyle, 'bloom');
  assert.deepEqual(input, original, 'Normalization must not reorder or mutate saved input arrays.');
  assert.notEqual(normalized.objectStyles, input.objectStyles);
  const none = normalizeCustomization({ objectStyle: 'ribbon', objectStyles: [] });
  assert.deepEqual(none.objectStyles, []);
  assert.equal(none.objectStyle, null);
  assert.deepEqual(normalizeCustomization(none), none, 'An empty selection must survive a save/restore cycle.');
  assert.deepEqual(normalizeCustomization({ objectStyles: ['invalid'] }).objectStyles, []);
});

test('two and three families produce the same stable mixture in artwork, PNG, HTML and JSON', async () => {
  const cases = [
    { selection: ['orbit', 'bloom'], expected: ['bloom', 'orbit', 'orbit'], columns: [0, 1, 1] },
    { selection: ['ribbon', 'orbit', 'bloom'], expected: ['bloom', 'orbit', 'ribbon'], columns: [0, 1, 2] },
  ];
  await withExportBrowser(async ({ downloads, canvases }) => {
    let productDraw;
    for (const { selection, expected, columns } of cases) {
      const input = { ...recipe, customization: { objectStyles: selection, objectScale: 120, hue: 14 } };
      const model = buildGuidelineModel(input, mood);
      assert.deepEqual(model.objects.map(item => item.style), expected);
      assert.deepEqual(model.objects.map(item => item.family.id), expected);
      const reversed = buildGuidelineModel({ ...input, customization: { ...input.customization, objectStyles: [...selection].reverse() } }, mood);
      assert.deepEqual(model.objects, reversed.objects, 'Click order must not reshuffle artwork positions.');
      const markup = renderGuidelineMarkup(model);
      const spriteColumns = [...markup.matchAll(/style="left:-(\d+)%"/g)].map(match => Number(match[1]) / 100);
      assert.deepEqual(spriteColumns, columns);
      await exportBrand(input, mood, 'png');
      const canvas = canvases.at(-1);
      const cells = canvas.calls.filter(call => call.source === spriteData).map(call => call.args.slice(0, 4));
      assert.deepEqual(cells, columns.map(column => [column * spriteHeight, 0, spriteHeight, spriteHeight]));
      const drawnProduct = canvas.calls.find(call => call.source === pixel).args;
      if (productDraw) assert.deepEqual(drawnProduct, productDraw); else productDraw = drawnProduct;
      await exportBrand(input, mood, 'json');
      const payload = JSON.parse(await downloads.at(-1).blob.text());
      assert.deepEqual(payload.recipe.customization.objectStyles, model.objectStyles);
      assert.deepEqual(payload.guideline.objects.styles, model.objectStyles);
      assert.deepEqual(payload.guideline.objects.instances.map(item => item.style), expected);
      assert.deepEqual(payload.guideline.objects.selectedColumns, model.objectFamilies.map(item => item.position));
      const restored = buildGuidelineModel(payload.recipe, mood);
      assert.deepEqual(restored.objects, model.objects, 'Downloaded recipes must restore the full mixture.');
      await exportBrand(input, mood, 'html');
      const html = await downloads.at(-1).blob.text();
      const resolve = source => source === BRAND_OBJECTS_ASSET ? spriteData : pixel;
      assert.ok(html.includes(renderGuidelineMarkup(model, resolve)));
      assert.ok(html.includes(renderGuidelineDetails(model)));
    }
  });
});

test('deselecting every object exports a clean composition without restoring a legacy family', async () => {
  const input = { ...recipe, customization: { objectStyles: [], objectStyle: 'orbit', objectScale: 140 } };
  const model = buildGuidelineModel(input, mood);
  assert.deepEqual(model.objects, []);
  assert.deepEqual(model.objectFamilies, []);
  assert.equal(model.objectFamily, null);
  assert.equal(model.objectStyle, null);
  assert.deepEqual(model.layout.product, buildGuidelineModel(recipe, mood).layout.product);
  const markup = renderGuidelineMarkup(model);
  assert.doesNotMatch(markup, /guide-art-object|guide-object-sprite/);
  assert.match(markup, /guide-art-product/);
  assert.match(renderGuidelineDetails(model), /no decorative objects/);
  await withExportBrowser(async ({ downloads, canvases }) => {
    await exportBrand(input, mood, 'png');
    assert.equal(canvases[0].calls.filter(call => call.source === spriteData).length, 0);
    assert.equal(canvases[0].calls.filter(call => call.source === pixel).length, 1);
    await exportBrand(input, mood, 'json');
    const payload = JSON.parse(await downloads.at(-1).blob.text());
    assert.deepEqual(payload.recipe.customization.objectStyles, []);
    assert.equal(payload.recipe.customization.objectStyle, null);
    assert.deepEqual(payload.guideline.objects.styles, []);
    assert.deepEqual(payload.guideline.objects.selectedColumns, []);
    assert.deepEqual(payload.guideline.objects.instances, []);
    assert.equal(payload.guideline.objects.selectedColumn, null);
    assert.equal(payload.guideline.objects.family, null);
    assert.deepEqual(buildGuidelineModel(payload.recipe, mood).objects, []);
    await exportBrand(input, mood, 'html');
    const html = await downloads.at(-1).blob.text();
    assert.ok(html.includes(renderGuidelineMarkup(model, () => pixel)));
    assert.match(html, /no decorative objects/);
  });
});


test('AI art and original product remain separate across live, PNG and portable recipe output', async () => {
  const input={...recipe,generatedImage:pixel,palette:['#115533','#EECC77','#112233'],keywords:['เรียบง่าย','สดใหม่','เป็นกันเอง']};
  const model=buildGuidelineModel(input,mood);
  assert.equal(model.productSource,recipe.productImage);
  assert.equal(model.generatedSource,pixel);
  assert.equal(model.palette[0].color,'#115533');
  assert.deepEqual(model.keywords,input.keywords);
  const html=renderGuidelineMarkup(model);
  assert.ok(html.includes('guide-generated-image'));
  assert.ok(html.includes('src="'+recipe.productImage+'"'));
  await withExportBrowser(async({downloads,canvases})=>{
    await exportBrand(input,mood,'json');
    const saved=JSON.parse(await downloads[0].blob.text());
    assert.equal(saved.recipe.generatedImage,pixel);
    assert.equal(saved.recipe.productImage,pixel);
    assert.equal(saved.prototype,false);
    await exportBrand(input,mood,'png');
    assert.equal(canvases[0].calls.filter(call=>call.source===pixel).length,2,'Draw both the generated layer and untouched product');
    await exportBrand(input,mood,'html');
    const portable=await downloads[2].blob.text();
    assert.ok(portable.includes('guide-generated-image'));
    assert.ok(!portable.includes('Generation and payments are simulated'));
  });
});

test('same-origin protected asset paths are renderable while arbitrary URLs stay blocked',()=>{
  const allowed=buildGuidelineModel({productImage:'/api/assets/product_1',generatedImage:'/api/assets/image-2',ingredients:[{src:'/api/assets/product_1'}]},mood);
  assert.equal(allowed.productSource,'/api/assets/product_1');
  assert.equal(allowed.generatedSource,'/api/assets/image-2');
  for(const path of ['https://other.test/image','//other.test/image','/api/assets/../secrets','/api/assets/a?redirect=1','javascript:alert(1)'])assert.equal(buildGuidelineModel({generatedImage:path},mood).generatedSource,'');
});
