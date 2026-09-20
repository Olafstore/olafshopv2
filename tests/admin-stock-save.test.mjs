import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const adminSource = readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../supabase-client.js', import.meta.url), 'utf8');

// Run the actual form serializer, save handler and Supabase adapter against an
// in-memory database. No production account, stock or credentials are changed.
function setup({ managed = false, category = 'steam-key', summaryKnown = true, summaryFails = false, legacyOnly = false } = {}) {
  let row = { id: 'test-game', name: 'Test game', category, stock: 7, price: 100, is_active: true };
  let items = [{ id: 'unit-1', status: 'available', content: 'test-only-key' }];
  const packages = [];
  const calls = [];
  const notices = [];
  const values = { id: row.id, name: row.name, category, stock: '11', price: '100', isActive: 'true' };
  const elements = new Proxy({}, {
    get(target, name) { return target[name] ??= { value: values[name] ?? '', readOnly: false }; }
  });
  const submit = { innerHTML: 'Save', disabled: false };
  const form = { elements, querySelector: () => submit };
  const fieldLabel = { firstChild: { textContent: '' } };
  const textarea = { value: '', disabled: false, closest: () => fieldLabel };
  const section = { hidden: true, querySelector: () => ({ textContent: '' }) };
  const packageDraft = { id: '', title: 'Deluxe', stock: '3', price: '150', status: 'active' };
  const packageCards = [{ querySelector(selector) {
    const name = selector.match(/data-package-field="([^"]+)"/)[1];
    return { value: packageDraft[name] ?? '' };
  }}];
  const list = { innerHTML: '' };
  const addButton = { disabled: false };
  const nodes = { '#product-form': form, '#offline-stock-lines': textarea, '#offline-stock-editor': section,
    '#product-package-list': list, '#add-product-package': addButton };
  const client = {
    from(table) {
      assert.equal(table, 'products');
      return { update(update) {
        calls.push('update-products');
        return { eq() { return { select() { return { async single() {
          row = { ...row, ...update };
          return { data: row, error: null };
        }}; }}; }};
      }};
    },
    async rpc(name, args) {
      calls.push(name);
      if (name === 'admin_set_product_stock') {
        return { error: { message: 'PRODUCT_NOT_MANAGED_STOCK', code: 'P0001' } };
      }
      if (name.startsWith('admin_fetch_') && name.endsWith('stock_items')) {
        if (legacyOnly && name === 'admin_fetch_variable_stock_items') {
          return { error: { code: 'PGRST202', message: 'Function not found' } };
        }
        return managed ? { data: items } : { error: { message: 'PRODUCT_NOT_MANAGED_STOCK' } };
      }
      if (name.startsWith('admin_replace_')) {
        if (!managed) return { error: { message: 'PRODUCT_NOT_MANAGED_STOCK' } };
        items = args.p_items.map((content, i) => ({ id: `unit-${i}`, status: 'available', content }));
        row = { ...row, stock: items.length };
        return { data: { product: row, items, availableCount: items.length } };
      }
      if (name === 'admin_save_product_package') {
        const pkg = { id: args.p_id || 'new-package', product_id: args.p_product_id,
          title: args.p_title, price: args.p_price, stock: args.p_stock, status: args.p_status };
        packages.push(pkg);
        return { data: pkg };
      }
      if (name.startsWith('admin_inventory_summary')) {
        if (summaryFails) return { error: { message: 'Summary unavailable' } };
        return { data: [{ product_id: row.id, managed_stock: managed, available_count: row.stock }] };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    }
  };
  const context = vm.createContext({
    console: { warn() {}, error() {} }, URL, setTimeout, clearTimeout,
    window: { supabase: { createClient: () => client }, sessionStorage: { removeItem() {} } },
    document: { addEventListener() {}, querySelector: (s) => nodes[s] || null,
      querySelectorAll: (s) => s.includes('[data-package-card]') ? packageCards : [] },
    notices
  });
  vm.runInContext(clientSource, context);
  vm.runInContext(adminSource, context);
  vm.runInContext(`
    state.payload = { products: [window.OlafProducts.mapProductRow(${JSON.stringify(row)})], categories: [] };
    state.selectedProductId = 'test-game';
    setCachedProductPackages('test-game', []);
    ${summaryKnown ? `state.inventorySummaries['test-game'] = { productId: 'test-game', managedStock: ${managed}, availableCount: 7 };` : ''}
    createIconSet = () => {};
    renderAll = () => {};
    setStatus = () => {};
    isAdminMobileViewport = () => false;
    showAdminToast = (message, type) => notices.push({ message, type });
  `, context);
  return { context, calls, notices, textarea, form, submit, section, packageDraft, packages,
    row: () => row,
    run: (code) => vm.runInContext(code, context),
    save: () => context.saveProductFromForm({ currentTarget: form, preventDefault() {} }) };
}

test('normal-counter Steam product saves numeric stock and its independent package', async () => {
  const app = setup();
  app.run('renderOfflineStockEditor(selectedProduct())');
  assert.equal(app.section.hidden, true);
  assert.equal(app.form.elements.stock.readOnly, false);
  await app.save();
  assert.equal(app.row().stock, 11);
  assert.equal(app.packages[0].stock, 3);
  assert.equal(app.calls.some((c) => c.startsWith('admin_replace_')), false);
  assert.equal(app.notices.some((n) => n.type === 'error'), false);
  assert.equal(app.submit.disabled, false);
});

test('missing summary: explicit NOT_MANAGED response restores editable counter and package save', async () => {
  const app = setup({ summaryKnown: false });
  app.run('renderOfflineStockEditor(selectedProduct())');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.section.hidden, true);
  assert.equal(app.form.elements.stock.readOnly, false);
  assert.equal(Number(app.form.elements.stock.value), 7);
  app.form.elements.stock.value = '9';
  await app.save();
  assert.equal(app.row().stock, 9);
  assert.equal(app.packages[0].stock, 3);
  assert.equal(app.calls.some((c) => c.startsWith('admin_replace_')), false);
});

test('editing a package alone does not replace unchanged managed credentials', async () => {
  const app = setup({ managed: true });
  await app.run('loadOfflineStockItems("test-game")');
  app.run('renderOfflineStockEditor(selectedProduct())');
  await app.save();
  assert.equal(app.packages[0].stock, 3);
  assert.equal(app.row().stock, 7);
  assert.equal(app.calls.some((c) => c.startsWith('admin_replace_')), false);
});

test('legacy database exposes counter mode even when the newer stock RPC is missing', async () => {
  const app = setup({ summaryKnown: false, legacyOnly: true });
  app.run('renderOfflineStockEditor(selectedProduct())');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.form.elements.stock.readOnly, false);
  await app.save();
  assert.equal(app.packages.length, 1);
  assert.equal(app.row().stock, 7);
  assert.equal(app.calls.some((c) => c.startsWith('admin_replace_')), false);
});

test('intentional change to managed stock still writes the per-item inventory', async () => {
  const app = setup({ managed: true });
  await app.run('loadOfflineStockItems("test-game")');
  app.run('renderOfflineStockEditor(selectedProduct())');
  app.textarea.value = 'test-only-key\ntest-only-key-2';
  app.run('syncOfflineStockCacheFromEditor("test-game")');
  await app.save();
  assert.equal(app.row().stock, 2);
  assert.equal(app.packages[0].stock, 3);
  assert.equal(app.calls.filter((c) => c === 'admin_replace_variable_stock_items').length, 1);
});

test('saving before managed inventory loads cannot wipe stock or create a package', async () => {
  const app = setup({ managed: true });
  app.textarea.disabled = true;
  await app.save();
  assert.equal(app.calls.length, 0);
  assert.equal(app.row().stock, 7);
  assert.equal(app.notices.at(-1).type, 'error');
});

test('statistics failure after a successful save reports saved with a refresh warning', async () => {
  const app = setup({ summaryFails: true });
  await app.save();
  assert.equal(app.packages.length, 1);
  assert.equal(app.row().stock, 11);
  assert.equal(app.notices.at(-1).type, 'warning');
  assert.match(app.notices.at(-1).message, /บันทึกสินค้าและแพ็กเกจแล้ว/);
});

test('zero product stock does not erase independently stocked packages', async () => {
  const app = setup();
  app.form.elements.stock.value = '0';
  await app.save();
  assert.equal(app.row().stock, 0);
  assert.equal(app.packages[0].stock, 3);
  assert.equal(app.calls.some((c) => c.startsWith('admin_replace_')), false);
  assert.equal(app.notices.some((n) => n.type === 'error'), false);
});

test('zero package stock does not erase product inventory', async () => {
  const app = setup();
  app.packageDraft.stock = '0';
  await app.save();
  assert.equal(app.row().stock, 11);
  assert.equal(app.packages[0].stock, 0);
  assert.equal(app.notices.some((n) => n.type === 'error'), false);
});

test('unloaded packages prevent saving over the existing product and stock', async () => {
  const app = setup();
  app.run('delete state.productPackages["test-game"]');
  await app.save();
  assert.equal(app.calls.length, 0);
  assert.equal(app.row().stock, 7);
  assert.equal(app.packages.length, 0);
  assert.equal(app.notices.at(-1).type, 'error');
  assert.equal(app.submit.disabled, false);
});

test('server counter mode takes precedence over category defaults', async () => {
  for (const category of ['steam-key', 'steam-account', 'offline', 'rockstar', 'minecraft']) {
    const app = setup({ category });
    app.run('renderOfflineStockEditor(selectedProduct())');
    assert.equal(app.section.hidden, true, category);
    assert.equal(app.form.elements.stock.readOnly, false, category);
    await app.save();
    assert.equal(app.row().stock, 11, category);
    assert.equal(app.packages[0].stock, 3, category);
    assert.equal(app.calls.some((c) => c.startsWith('admin_replace_')), false, category);
  }
});
