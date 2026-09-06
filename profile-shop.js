(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const number = value => Number(value || 0).toLocaleString('th-TH');
  const messages = {
    SHOP_POINTS_INSUFFICIENT: 'แต้มร้านค้าไม่พอ ต้องใช้ 1,000 แต้มต่อรูป',
    AVATAR_NOT_OWNED: 'กรุณาแลกรูปนี้ก่อนเลือกใช้งาน',
    AVATAR_NOT_FOUND: 'ไม่พบรูปนี้ในโฟลเดอร์ กรุณาโหลดรายการใหม่',
    AUTH_REQUIRED: 'กรุณาเข้าสู่ระบบใหม่', ACCESS_DENIED: 'บัญชีนี้ไม่สามารถใช้ร้านค้าได้',
    SHOP_CONFIG_REQUIRED: 'ร้านค้ายังไม่พร้อม กรุณาให้แอดมินตั้งค่า API และติดตั้งฐานข้อมูล',
    LOCAL_FILE: 'ร้านค้าต้องเปิดผ่านเว็บโฮสที่รองรับ API ไม่สามารถซื้อหรือบันทึกผ่าน file:// ได้'
  };
  let root, catalog = [], wallet = { balance:0, owned:[], equipped:null, ledger:[] };
  let selected = null, tab = 'library', busy = false, loaded = false, lastRefresh = 0;
  let refreshPromise, channel, timer, dialog;
  const owned = item => item.price === 0 || wallet.owned.includes(item.id);
  const current = () => catalog.find(item => item.id === selected);
  function status(text, error = false) {
    const node = root?.querySelector('.atelier-status');
    if (node) { node.textContent = text; node.classList.toggle('is-error', error); }
  }
  function errorText(error) {
    return Object.entries(messages).find(([key]) => String(error.message).includes(key))?.[1]
      || 'โหลดหรือบันทึกไม่สำเร็จ กรุณาลองใหม่ หากยังพบปัญหาให้แอดมินตรวจการติดตั้ง supabase-profile-shop.sql';
  }
  function render() {
    const item = current();
    const items = tab === 'library' ? catalog.filter(owned) : catalog.filter(p => p.price > 0);
    root.innerHTML = `<div class="avatar-atelier">
      <header class="atelier-heading"><div><span class="atelier-eyebrow">OLAF · PROFILE ATELIER</span>
        <h2>ตัวตนในแบบของคุณ</h2><p>เลือกรูปที่ใช่ เก็บสะสม และเปลี่ยนได้ทุกวัน</p></div>
        <div class="atelier-wallet"><small>แต้มร้านค้าของคุณ</small><strong>${loaded ? number(wallet.balance) : '—'}</strong><small>แยกจากยอดเงิน Point</small></div></header>
      <div class="atelier-body"><aside class="atelier-preview">
        ${item ? `<img class="atelier-preview-image" src="${escape(item.image)}" alt="ตัวอย่างโปรไฟล์" />` : ''}
        <h3>${item ? `โปรไฟล์ ${escape(item.name)}` : 'เลือกรูปโปรไฟล์'}</h3>
        <p>${item ? (owned(item) ? (wallet.equipped === item.id ? 'กำลังใช้งานรูปนี้' : 'พร้อมใช้งาน · เลือกแล้วกดบันทึก') : 'รูปสะสม · 1,000 แต้ม') : 'รูปฟรีพร้อมใช้สำหรับสมาชิกทุกคน'}</p>
        <button type="button" class="atelier-save" data-shop-action="${item && owned(item) ? 'equip' : 'buy'}"
          ${!loaded || busy || !item || wallet.equipped === item.id || (!owned(item) && wallet.balance < 1000) ? 'disabled' : ''}>
          ${busy ? 'กำลังบันทึก…' : item && owned(item) ? 'บันทึกรูปโปรไฟล์' : 'แลกด้วย 1,000 แต้ม'}</button>
        <p>เติมเงินสำเร็จ 100 บาท = 1,000 แต้ม<br>หรือรับแต้มจากการเพิ่ม Point โดยแอดมิน</p>
      </aside><div class="atelier-content"><nav class="atelier-tabs" aria-label="รายการโปรไฟล์">
        <button type="button" data-shop-tab="library" aria-pressed="${tab === 'library'}">คลังโปรไฟล์ · ${catalog.filter(owned).length}</button>
        <button type="button" data-shop-tab="shop" aria-pressed="${tab === 'shop'}">ร้านค้าโปรไฟล์ · ${catalog.filter(p => p.price > 0).length}</button>
        <button type="button" data-shop-action="refresh" ${busy ? 'disabled' : ''}>โหลดใหม่</button></nav>
        <div class="atelier-grid">${items.map(p => `<button type="button" class="atelier-portrait" data-avatar="${escape(p.id)}" aria-pressed="${selected === p.id}" ${busy ? 'disabled' : ''}>
          <img src="${escape(p.image)}" alt="โปรไฟล์ ${escape(p.name)}" width="88" height="88" loading="lazy" decoding="async" />
          <strong>โปรไฟล์ ${escape(p.name)}</strong><small>${wallet.equipped === p.id ? '✓ กำลังใช้งาน' : p.price === 0 ? 'ฟรีสำหรับทุกคน' : owned(p) ? 'อยู่ในคลังแล้ว' : '1,000 แต้ม'}</small></button>`).join('')
          || '<p class="atelier-empty">ยังไม่มีรูปในหมวดนี้ รูปใหม่จะปรากฏเมื่อร้านอัปโหลดไฟล์</p>'}</div></div></div>
      <p class="atelier-status" role="status">${loaded ? 'เลือกรูปเพื่อดูตัวอย่าง · รูปที่แลกแล้วจะอยู่ในคลังถาวร' : 'กำลังโหลดข้อมูลร้านค้า…'}</p>
      <details class="atelier-history"><summary>ประวัติแต้มร้านค้า</summary>${wallet.ledger.map(row => `<div class="atelier-history-row"><span>${escape(row.reason)}
        <small>${escape(new Date(row.created_at).toLocaleString('th-TH'))}</small></span><strong>${row.amount > 0 ? '+' : ''}${number(row.amount)}</strong></div>`).join('') || 'ยังไม่มีรายการแต้ม'}</details>
    </div>`;
  }
  async function refresh(force = false) {
    if (refreshPromise) return refreshPromise;
    if (!force && Date.now() - lastRefresh < 8000) return;
    refreshPromise = (async () => {
      try {
        if (location.protocol === 'file:') throw new Error('LOCAL_FILE');
        const [response, state] = await Promise.all([
          fetch('api/profile-shop', { cache:'no-store', signal:AbortSignal.timeout(15000) }),
          window.olafSupabase.rpc('shop_get_state')
        ]);
        if (!response.ok) throw new Error('SHOP_CONFIG_REQUIRED');
        if (state.error) throw state.error;
        const data = await response.json();
        catalog = data.catalog;
        wallet = state.data;
        selected = catalog.some(p => p.id === selected) ? selected : wallet.equipped || catalog[0]?.id;
        loaded = true;
        lastRefresh = Date.now();
        render();
        await syncIdentity();
      } catch (error) {
        loaded = false;
        render();
        status(errorText(error), true);
      }
    })().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  async function syncIdentity() {
    try {
      const member = await window.OlafStore.refreshCurrentUser();
      window.OlafAvatarIdentity?.paint(member);
      window.dispatchEvent(new CustomEvent('olaf-avatar-changed', { detail: member }));
    } catch { /* Ownership and balance are already committed; identity can refresh next visit. */ }
  }
  async function mutate(action) {
    if (busy || !loaded || !current()) return;
    busy = true;
    const avatarId = selected;
    render();
    try {
      const { data, error } = await window.olafSupabase.auth.getSession();
      if (error || !data.session) throw new Error('AUTH_REQUIRED');
      const response = await fetch('api/profile-shop', { method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${data.session.access_token}` },
        body:JSON.stringify({ action, avatarId }), signal:AbortSignal.timeout(35000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'SHOP_UNAVAILABLE');
      wallet = result.state;
      if (action === 'purchase') tab = 'library';
      await syncIdentity();
      busy = false;
      render();
      status(action === 'purchase' ? 'แลกสำเร็จ! รูปอยู่ในคลังแล้ว กดบันทึกเพื่อตั้งเป็นรูปโปรไฟล์' : 'บันทึกรูปโปรไฟล์แล้ว');
      root.querySelector('.atelier-save')?.focus({ preventScroll:true });
    } catch (error) {
      busy = false;
      render();
      status(errorText(error), true);
    }
  }
  function confirmPurchase() {
    const item = current();
    if (!item || owned(item) || busy) return;
    dialog.innerHTML = `<h2>แลกรูปโปรไฟล์นี้?</h2><img src="${escape(item.image)}" alt="โปรไฟล์ ${escape(item.name)}" />
      <p>ใช้ 1,000 แต้มร้านค้า · คงเหลือหลังแลก ${number(wallet.balance - 1000)} แต้ม<br>รูปจะเข้าคลังของคุณทันที โดยไม่หักยอดเงิน Point</p>
      <div class="atelier-dialog-actions"><button class="atelier-cancel" type="button" data-cancel>ยกเลิก</button><button class="atelier-confirm" type="button" data-confirm>ยืนยันการแลก</button></div>`;
    dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
    dialog.querySelector('[data-confirm]').onclick = () => { dialog.close(); mutate('purchase'); };
    dialog.showModal();
    dialog.querySelector('[data-cancel]').focus();
  }
  document.addEventListener('DOMContentLoaded', async () => {
    root = document.getElementById('avatar-shop-root');
    if (!root) return;
    await window.OlafStore?.ready;
    const member = window.OlafStore?.currentUser();
    if (!member) return;
    dialog = document.createElement('dialog');
    dialog.className = 'atelier-dialog';
    dialog.setAttribute('aria-label','ยืนยันการแลกรูปโปรไฟล์');
    document.body.append(dialog);
    render();
    root.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled || busy) return;
      if (button.dataset.shopTab) { tab = button.dataset.shopTab; render(); }
      if (button.dataset.avatar) { selected = button.dataset.avatar; render(); }
      if (button.dataset.shopAction === 'buy') confirmPurchase();
      if (button.dataset.shopAction === 'equip') mutate('equip');
      if (button.dataset.shopAction === 'refresh') refresh(true);
    });
    await refresh(true);
    channel = window.olafSupabase.channel(`avatar-shop:${member.id}`);
    for (const table of ['shop_wallets','shop_avatar_inventory','shop_equipped_avatars']) {
      channel.on('postgres_changes', { event:'*', schema:'public', table, filter:`user_id=eq.${member.id}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => { if (!busy && !dialog.open) refresh(true); }, 350);
      });
    }
    channel.subscribe();
    window.addEventListener('focus', () => { if (!busy && !dialog.open) refresh(); });
    window.addEventListener('pagehide', () => { clearTimeout(timer); window.olafSupabase.removeChannel(channel); }, { once:true });
  });
})();
