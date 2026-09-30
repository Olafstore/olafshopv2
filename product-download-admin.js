(() => {
  let revision = 0;
  let current = null;
  const messages = {
    STOCK_CHANGED_RELOAD: 'สต็อกเปลี่ยนระหว่างแก้ไข กรุณารีเฟรชหน้าแล้วเปิดสินค้าใหม่ก่อนบันทึก',
    CLEAR_LEGACY_AVAILABLE_STOCK_FIRST: 'สินค้านี้ยังมีบัญชีพร้อมขาย กรุณาจัดการสต็อกเดิมให้เหลือ 0 ก่อนเปลี่ยนเป็นลิงก์ เพื่อไม่เขียนทับข้อมูลเดิม',
    SET_DOWNLOAD_STOCK_ZERO_FIRST: 'ตั้งสต็อกดาวน์โหลดเป็น 0 และบันทึกก่อนเปลี่ยนกลับระบบเดิม',
    DOWNLOAD_PACKAGES_NOT_SUPPORTED: 'โหมดนี้ใช้กับสินค้าที่ไม่มีแพ็กเกจย่อย กรุณาใช้ระบบเดิมสำหรับสินค้าแพ็กเกจ',
    INVALID_DOWNLOAD_LINK: 'กรุณาใส่ลิงก์ HTTPS ที่ถูกต้อง',
    INVALID_STOCK: 'สต็อกต้องเป็นจำนวนเต็ม 0–100,000'
  };
  function sync(form) {
    const draft = form.elements.productDeliveryMode.value === 'download';
    form.querySelector('[data-product-download-fields]').hidden = !draft;
    if (draft || current?.config?.enabled) {
      form.querySelector('#offline-stock-editor').hidden = true;
      form.elements.stock.readOnly = true;
      form.elements.stock.title = 'แก้สต็อกในส่วนจัดส่งแบบลิงก์ดาวน์โหลดด้านล่าง';
    }
  }
  async function load(form, product, onSaved) {
    const token = ++revision;
    const status = form.querySelector('[data-product-download-status]');
    const button = form.querySelector('[data-save-product-download]');
    const mode = form.elements.productDeliveryMode;
    current = { id: product.id, ready: false, config: null };
    mode.value = 'legacy'; mode.disabled = true; button.disabled = true;
    form.querySelector('[data-product-download-fields]').hidden = true;
    status.textContent = product.id ? 'กำลังโหลดการจัดส่ง…' : 'บันทึกสินค้าใหม่ก่อนตั้งค่าลิงก์ดาวน์โหลด';
    if (!product.id) { current.ready = true; return; }
    try {
      const { data, error } = await window.olafSupabase.rpc('admin_get_product_download', { p_product_id: product.id });
      if (token !== revision) return;
      if (error) throw error;
      current = { id: product.id, ready: true, config: data, stock: Number(data.stock ?? product.stock ?? 0), onSaved };
      mode.value = data.enabled ? 'download' : 'legacy';
      form.elements.productDownloadUrl.value = data.url || '';
      form.elements.productDownloadLabel.value = data.label || 'ดาวน์โหลดไฟล์';
      form.elements.productDownloadNote.value = data.note || '';
      form.elements.productDownloadStock.value = current.stock;
      mode.disabled = false; button.disabled = false;
      status.textContent = 'ลิงก์เดียวใช้ได้หลายออเดอร์ • จองสต็อกตามจำนวนซื้อ • ส่งหลังยืนยันชำระเงิน';
      sync(form);
    } catch (error) {
      if (token !== revision) return;
      // Missing migration must never silently disable an already enabled configuration.
      status.textContent = 'โหลดการจัดส่งไม่สำเร็จ กรุณารัน supabase-product-download-v70.sql และเปิดสินค้าใหม่';
      console.warn('Download configuration unavailable', error.code);
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#product-form');
    if (!form) return;
    form.elements.productDeliveryMode.addEventListener('change', () => sync(form));
    form.querySelector('[data-save-product-download]').addEventListener('click', async event => {
      if (!current?.ready || !current.id) return;
      const entry = current;
      const token = revision;
      const button = event.currentTarget;
      const status = form.querySelector('[data-product-download-status]');
      const enabled = form.elements.productDeliveryMode.value === 'download';
      const stock = Number(form.elements.productDownloadStock.value);
      button.disabled = true;
      try {
        if (!Number.isInteger(stock) || stock < 0 || stock > 100000) throw Error(messages.INVALID_STOCK);
        const url = form.elements.productDownloadUrl.value.trim();
        if (enabled && !window.OlafDownloadDelivery.safeUrl(url)) throw Error(messages.INVALID_DOWNLOAD_LINK);
        const { data, error } = await window.olafSupabase.rpc('admin_save_product_download', {
          p_product_id: entry.id, p_enabled: enabled, p_url: url,
          p_label: form.elements.productDownloadLabel.value,
          p_note: form.elements.productDownloadNote.value,
          p_stock: stock, p_expected_stock: entry.stock
        });
        if (error) throw error;
        if (token !== revision) return;
        entry.config = data;
        form.elements.productDownloadUrl.value = data.url || '';
        form.elements.productDownloadLabel.value = data.label || 'ดาวน์โหลดไฟล์';
        form.elements.productDownloadNote.value = data.note || '';
        if (enabled) entry.stock = stock;
        form.elements.stock.value = entry.stock;
        entry.onSaved(entry.stock);
        status.textContent = 'บันทึกการจัดส่งและสต็อกแล้ว';
        sync(form);
      } catch (error) {
        if (token === revision) status.textContent = messages[error.message] || error.message || 'บันทึกไม่สำเร็จ';
      } finally { if (token === revision) button.disabled = false; }
    });
  });
  window.OlafProductDownloadAdmin = {
    load,
    sync,
    enabled: () => Boolean(current?.config?.enabled),
    validate(form, previous, packages) {
      if (!current?.ready) throw Error('กรุณาโหลดการตั้งค่าจัดส่งให้สำเร็จก่อนบันทึกสินค้า');
      if (current.id && (form.elements.productDeliveryMode.value === 'download') !== Boolean(current.config?.enabled)) {
        throw Error('กรุณากดบันทึกการจัดส่งก่อนบันทึกสินค้า');
      }
      if (current.config?.enabled && (packages.length || previous?.category !== form.elements.category.value)) {
        throw Error('กรุณาปิดโหมดดาวน์โหลดก่อนเปลี่ยนหมวดหมู่หรือเพิ่มแพ็กเกจ');
      }
      if (current.config?.enabled && (
        form.elements.productDownloadUrl.value.trim() !== current.config.url ||
        form.elements.productDownloadLabel.value !== current.config.label ||
        form.elements.productDownloadNote.value !== current.config.note ||
        Number(form.elements.productDownloadStock.value) !== current.stock
      )) throw Error('มีการแก้ไขลิงก์หรือสต็อก กรุณากดบันทึกการจัดส่งและสต็อกก่อน');
    }
  };
})();
