(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const number = value => Number(value || 0).toLocaleString('th-TH');
  const messages = {
    SHOP_POINTS_INSUFFICIENT: 'แต้มร้านค้าไม่พอ ต้องใช้ 1,000 แต้มต่อรูป',
    AVATAR_NOT_OWNED: 'กรุณาแลกรูปนี้ก่อนเลือกใช้งาน',
    AVATAR_NOT_FOUND: 'ไม่พบรูปนี้ในโฟลเดอร์ กรุณาโหลดรายการใหม่',
    AUTH_REQUIRED: 'กรุณาเข้าสู่ระบบใหม่', ACCESS_DENIED: 'บัญชีนี้ไม่สามารถใช้ร้านค้าได้',
    SHOP_CONFIG_REQUIRED: 'API ร้านค้ายังไม่ได้ตั้งค่า Supabase Environment Variables บนโฮส',
    SHOP_API_NOT_FOUND: 'ไม่พบ API ร้านค้าบนโฮส กรุณา deploy api/profile-shop.js และ vercel.json',
    SHOP_RESPONSE_INVALID: 'API ส่งข้อมูลกลับมาไม่ถูกต้อง กรุณาตรวจการ deploy หรือการเปลี่ยนเส้นทางบนโฮส',
    SHOP_STATE_INVALID: 'รูปแบบข้อมูลแต้มจากฐานข้อมูลไม่ถูกต้อง กรุณาแจ้งแอดมินพร้อมรหัสที่แสดง',
    SHOP_SCHEMA_NOT_READY: 'ฐานข้อมูลที่เชื่อมต่อยังไม่พบฟังก์ชันร้านค้า กรุณาตรวจว่าเว็บและ API ใช้ Supabase project เดียวกับที่รัน SQL',
    SHOP_DATABASE_PERMISSION: 'ฐานข้อมูลปฏิเสธสิทธิ์เรียกฟังก์ชันร้านค้า กรุณาให้แอดมินตรวจสิทธิ์ฟังก์ชันตามรหัสที่แสดง',
    SHOP_DATABASE_ERROR: 'ฟังก์ชันร้านค้าในฐานข้อมูลทำงานผิดพลาด กรุณาแจ้งแอดมินพร้อมรหัสที่แสดง',
    SHOP_ASSETS_MISSING: 'ไม่พบโฟลเดอร์รูปบนเซิร์ฟเวอร์ กรุณา deploy iconprofile/ รวม iconpoint/ และ vercel.json',
    SHOP_TIMEOUT: 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่ ระบบจะไม่หักแต้มซ้ำสำหรับรูปเดิม',
    SHOP_NETWORK_ERROR: 'เชื่อมต่อร้านค้าไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่',
    SHOP_UNAVAILABLE: 'เซิร์ฟเวอร์ร้านค้าไม่พร้อม กรุณาแจ้งแอดมินพร้อมรหัสที่แสดง',
    LOCAL_FILE: 'ร้านค้าต้องเปิดผ่านเว็บโฮสที่รองรับ API ไม่สามารถซื้อหรือบันทึกผ่าน file:// ได้'
  };
  let root, catalog = [], wallet = { balance:0, owned:[], equipped:null, ledger:[] };
  let selected = null, tab = 'library', busy = false, loaded = false, lastRefresh = 0;
  let refreshPromise, channel, timer, dialog, notice = '', noticeError = false;
  const owned = item => item.price === 0 || wallet.owned.includes(item.id);
  const current = () => catalog.find(item => item.id === selected);
  function status(text, error = false) {
    notice = text;
    noticeError = error;
    const node = root?.querySelector('.atelier-status');
    if (node) { node.textContent = text; node.classList.toggle('is-error', error); }
  }
  function errorText(error) {
    const raw = String(error?.code || error?.databaseCode || '');
    const code = Object.keys(messages).find(key => String(error?.message).includes(key))
      || (['PGRST202','PGRST205','42883','42P01'].includes(raw) ? 'SHOP_SCHEMA_NOT_READY'
        : raw === '42501' ? 'SHOP_DATABASE_PERMISSION'
        : ['PGRST301','PGRST303'].includes(raw) ? 'AUTH_REQUIRED'
        : ['TimeoutError','AbortError'].includes(error?.name) ? 'SHOP_TIMEOUT'
        : error instanceof TypeError ? 'SHOP_NETWORK_ERROR'
        : raw ? 'SHOP_DATABASE_ERROR' : 'SHOP_UNAVAILABLE');
    const diagnostic = [error?.diagnostic?.stage || error?.stage, error?.diagnostic?.databaseCode || raw]
      .filter(value => /^[a-zA-Z0-9_]{1,64}$/.test(value || '')).join(' / ');
    return messages[code] + ` [${code}${diagnostic ? ' · ' + diagnostic : ''}]`;
  }
  async function apiResponse(response) {
    if (response.status === 404) throw new Error('SHOP_API_NOT_FOUND');
    let result;
    try { result = await response.json(); }
    catch { throw new Error('SHOP_RESPONSE_INVALID'); }
    if (!response.ok) throw Object.assign(new Error(result.error || 'SHOP_UNAVAILABLE'), { diagnostic:result.diagnostic });
    return result;
  }
  function normalizeState(state) {
    if (!state || !Number.isFinite(Number(state.balance)) || Number(state.balance) < 0 || !Array.isArray(state.owned)) {
      throw new Error('SHOP_STATE_INVALID');
    }
    return { balance:Number(state.balance), owned:state.owned, equipped:state.equipped || null,
      ledger:Array.isArray(state.ledger) ? state.ledger : [] };
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
      <p class="atelier-status${noticeError ? ' is-error' : ''}" role="status">${escape(notice || (loaded ? 'เลือกรูปเพื่อดูตัวอย่าง · รูปที่แลกแล้วจะอยู่ในคลังถาวร' : 'กำลังโหลดข้อมูลร้านค้า…'))}</p>
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
        status('กำลังโหลดข้อมูลร้านค้า…');
        const [catalogResult, stateResult] = await Promise.allSettled([
          fetch('/api/profile-shop', { cache:'no-store', signal:AbortSignal.timeout(15000) }).then(apiResponse),
          window.olafSupabase.rpc('shop_get_state')
        ]);
        // A wallet error must not discard successfully loaded pictures.
        if (catalogResult.status === 'fulfilled') {
          if (!Array.isArray(catalogResult.value.catalog)) throw new Error('SHOP_RESPONSE_INVALID');
          catalog = catalogResult.value.catalog;
        }
        if (stateResult.status === 'rejected') throw Object.assign(stateResult.reason, { stage:'shop_get_state' });
        if (stateResult.value.error) throw Object.assign(stateResult.value.error, { stage:'shop_get_state' });
        wallet = normalizeState(stateResult.value.data);
        if (catalogResult.status === 'rejected') throw catalogResult.reason;
        selected = catalog.some(p => p.id === selected) ? selected : wallet.equipped || catalog[0]?.id;
        loaded = true;
        notice = '';
        noticeError = false;
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
      const response = await fetch('/api/profile-shop', { method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${data.session.access_token}` },
        body:JSON.stringify({ action, avatarId }), signal:AbortSignal.timeout(35000) });
      const result = await apiResponse(response);
      wallet = normalizeState(result.state);
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
