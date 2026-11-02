// Store Settings logo: the save path (sanitize -> normalize -> mutation -> revalidate) and the render rule. Offline.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const filename = path.resolve(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  const localRequire = (spec) => {
    if (spec.startsWith('@/')) return load(`${spec.slice(2)}${spec.endsWith('.ts') ? '' : '.ts'}`);
    if (spec.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), spec.endsWith('.ts') ? spec : `${spec}.ts`)));
    return require(spec);
  };
  vm.runInNewContext(output, { module, exports: module.exports, require: localRequire }, { filename });
  return module.exports;
}

const { sanitizeStoreLogoSvg } = load('features/keystone/utils/storeLogo.ts');
const { normalizeLogoSettings } = load('features/keystone/domain/storefrontSettings.ts');
const { normalizeStoreLogoColor } = load('features/lib/store-logo.ts');
const { LOGO_ICONS } = load('features/platform/store-settings/lib/icon-registry.ts');
const { storeBrand, CANNABIS_LOGO_ICON } = load('features/storefront/lib/brand.ts');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('the old paths are re-exports of the E-commerce copies', () => {
  assert.match(read('features/lib/sanitize-store-logo.ts'), /^export \* from '..\/keystone\/utils\/storeLogo\.ts';\n$/);
  assert.match(read('features/platform/store-settings/lib/untitled-logo-registry.ts'), /^export \* from '\.\/icon-registry';\n$/);
  assert.equal(load('features/lib/sanitize-store-logo.ts').sanitizeStoreLogoSvg('<svg><script>x</script></svg>'), '');
  assert.equal(load('features/platform/store-settings/lib/untitled-logo-registry.ts').LOGO_ICONS.length, LOGO_ICONS.length);
});

test('the save action composes validate/normalize (sanitize, normalize), the mutation, then revalidatePath', () => {
  const source = read('features/platform/storefront-settings/actions/settings.ts');
  assert.match(source, /normalizeLogoSettings\(values\)/);
  const save = source.slice(source.indexOf('export async function saveStoreSettings'));
  assert.ok(save.indexOf('normalizeLogoSettings') < save.indexOf('configureCannabisStorefrontSettings'));
  assert.ok(save.indexOf('configureCannabisStorefrontSettings') < save.indexOf("revalidatePath('/')"));
  const domain = read('features/keystone/domain/storefrontSettings.ts');
  assert.ok(domain.indexOf('sanitizeStoreLogoSvg(value)') < domain.indexOf('normalizeStoreLogoColor(input.logoColor)'));
});

test('a preset icon and hue reach the mutation payload', () => {
  const icon = LOGO_ICONS.find((entry) => entry.id === 'luminous').lightSvg;
  assert.deepEqual({ ...normalizeLogoSettings({ logoIcon: icon, logoColor: '120' }) }, { logoIcon: icon, logoColor: '120' });
});

test('every preset survives the sanitizer', () => {
  assert.ok(LOGO_ICONS.length >= 40);
  for (const icon of LOGO_ICONS) assert.equal(normalizeLogoSettings({ logoIcon: icon.lightSvg }).logoIcon, icon.lightSvg, icon.id);
});

test('a pasted custom SVG is kept, trimmed', () => {
  const svg = '<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m48 11h-17z" fill="#087443"/></svg>';
  assert.equal(normalizeLogoSettings({ logoIcon: `\n${svg} ` }).logoIcon, svg);
});

test('the hue is normalized to 0..359', () => {
  assert.equal(normalizeStoreLogoColor('-30'), '330');
  assert.equal(normalizeStoreLogoColor('390'), '30');
  assert.equal(normalizeStoreLogoColor('nope'), '0');
  assert.equal(normalizeLogoSettings({ logoColor: '480' }).logoColor, '120');
});

test('an unsafe SVG is rejected', () => {
  for (const bad of ['<svg><script>alert(1)</script></svg>', '<svg onload="x()"></svg>', '<svg><a href="javascript:x"></a></svg>', 'not svg'])
    assert.throws(() => normalizeLogoSettings({ logoIcon: bad }), /safe SVG/);
  assert.equal(sanitizeStoreLogoSvg('<svg><script>x</script></svg>'), '');
});

test('the Store Settings page uses the E-commerce logo block and the shared save bar', () => {
  const form = read('features/platform/storefront-settings/components/StorefrontSettingsForm.tsx');
  assert.match(form, /\{\/\* Logo Icon Selector \*\/\}/);
  assert.match(form, /\{\/\* Logo Color Selector \*\/\}/);
  assert.match(form, /StoreSettingsSaveBar/);
  assert.doesNotMatch(form, /LogoPicker|type="range" min="0" max="359" step="1" value=\{values\.logoColor/);
  assert.match(read('features/platform/storefront-settings/screens/StorefrontSettingsPage.tsx'), /pb-24 md:px-6 md:pb-8/);
});

test('render rule: the saved icon and hue always show; empty renders the default icon, never nothing', () => {
  const icon = LOGO_ICONS.find((entry) => entry.id === 'acme-corp').lightSvg;
  assert.deepEqual({ ...storeBrand({ logoIcon: icon, logoColor: '120' }) }.logoSvg, icon);
  assert.equal(storeBrand({ logoIcon: icon, logoColor: '120' }).logoColor, '120');
  assert.equal(storeBrand({ logoIcon: '', logoColor: '40' }).logoSvg, CANNABIS_LOGO_ICON);
  assert.equal(storeBrand({ logoIcon: undefined }).logoSvg, CANNABIS_LOGO_ICON);
  assert.ok(CANNABIS_LOGO_ICON.startsWith('<svg'));
  const shell = read('features/storefront/components/StorefrontShell.tsx');
  assert.ok((shell.match(/logo\(/g) || []).length >= 3); // header, age gate, footer
  assert.doesNotMatch(read('features/storefront/components/StoreLogo.tsx'), /storeOwnMark|return null/);
});
