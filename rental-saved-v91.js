/* Catalog-only adapter: use the existing shared favorites store, without loading
   the storefront checkout/cart application on the rental page. */
(() => {
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('open-favorites');
    if (!trigger || !window.OlafFavorites) return;
    const dialog = el('dialog', undefined, 'rental-saved-dialog');
    dialog.id = 'favorites-dialog';
    dialog.setAttribute('aria-labelledby', 'rental-saved-title');
    const head = el('div', undefined, 'rental-saved-head');
    const title = el('h2', 'รายการที่บันทึกไว้'); title.id = 'rental-saved-title';
    const close = el('button', '×'); close.type = 'button';
    close.setAttribute('aria-label', 'ปิดรายการที่บันทึกไว้');
    head.append(title, close);
    const count = el('p'), list = el('div', undefined, 'rental-saved-list');
    list.setAttribute('aria-live', 'polite');
    dialog.append(head, count, list); document.body.append(dialog);
    let rows = [], loaded = false, pending = false, failed = false;
    function render() {
      const ids = window.OlafFavorites.getIds();
      const badge = document.getElementById('favorites-badge');
      if (badge) { badge.textContent = String(ids.length); badge.hidden = !ids.length; }
      count.textContent = `${ids.length} รายการ`;
      list.replaceChildren(); list.setAttribute('aria-busy', String(pending));
      if (pending) { list.append(el('p', 'กำลังโหลดรายการที่บันทึกไว้…', 'rental-loading-label')); return; }
      if (!ids.length) { list.append(el('p', 'ยังไม่มีรายการที่บันทึกไว้ กดบุ๊กมาร์กบนสินค้าที่ชื่นชอบเพื่อดูภายหลัง')); return; }
      if (failed) {
        list.append(el('p', 'โหลดข้อมูลสินค้าได้ไม่ครบ กรุณาลองอีกครั้ง'));
        const retry = el('button', 'โหลดข้อมูลอีกครั้ง'); retry.onclick = load; list.append(retry);
      }
      for (const id of ids) {
        const p = rows.find(p => String(p.id) === String(id));
        const row = el('article', undefined, 'rental-saved-row');
        const link = el('a'); link.href = 'product.html?id=' + encodeURIComponent(id);
        const imageUrl = p?.image || p?.heroImage;
        if (imageUrl && /^(https?:\/\/|assets\/|\/assets\/)/i.test(imageUrl)) {
          const img = el('img'); img.src = imageUrl; img.alt = ''; img.loading = 'lazy';
          img.onerror = () => img.remove(); link.append(img);
        }
        const text = el('span'); text.append(el('strong', p?.name || 'ดูสินค้าที่บันทึกไว้'), el('small', p ? 'ดูรายละเอียดสินค้า' : 'ตรวจสอบรายละเอียดและสถานะสินค้า'));
        link.append(text);
        const remove = el('button', 'นำออก'); remove.type = 'button';
        remove.setAttribute('aria-label', 'นำ ' + (p?.name || 'สินค้า') + ' ออกจากรายการที่บันทึกไว้');
        remove.onclick = () => window.OlafFavorites.toggle(id);
        row.append(link, remove); list.append(row);
      }
    }
    async function load() {
      if (pending) return;
      pending = true; failed = false; render();
      const results = await Promise.allSettled([
        window.OlafProducts?.fetchActiveProducts ? window.OlafProducts.fetchActiveProducts() : Promise.reject(new Error('Unavailable')),
        fetch('assets/products-index.json').then(r => { if (!r.ok) throw new Error('Unavailable'); return r.json(); }).then(data => Array.isArray(data) ? data : data.products || [])
      ]);
      const byId = new Map();
      // Database rows take precedence over the static catalog.
      for (const result of results.reverse()) if (result.status === 'fulfilled') for (const p of result.value || []) byId.set(String(p.id), p);
      rows = [...byId.values()]; failed = results.some(r => r.status === 'rejected');
      pending = false; loaded = true; render();
    }
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.addEventListener('click', () => {
      if (!dialog.open) dialog.showModal();
      render(); if (!loaded) load();
      window.OlafFavorites.sync().then(render).catch(() => {});
    });
    close.onclick = () => dialog.close();
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => trigger.focus());
    window.OlafFavorites.subscribe(render);
  });
})();
