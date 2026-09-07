(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const number = value => Number(value || 0).toLocaleString('th-TH');
  const messages = {
    SHOP_POINTS_INSUFFICIENT: 'แต้มร้านค้าไม่พอสำหรับรายการนี้',
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
  let kind = 'avatar';
  let shopQuery = '', shopSort = 'price', shuffledIds = [];
  const shopIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 9h18l-2-6H5L3 9Zm1 0v11h16V9M9 20v-7h6v7"/><path d="M3 9c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0"/></svg>';
  function storeCard(p, featured=false) {
    return `<button type="button" class="atelier-portrait store-product ${featured?'is-featured':''}" data-avatar="${escape(p.id)}" aria-label="ดูตัวอย่าง ${escape(p.name)}" ${busy?'disabled':''}>
      <img src="${escape(p.image)}" alt="${escape(p.name)}" loading="lazy" decoding="async" width="320" height="320">
      <span class="store-product-type">${p.kind==='background'?'พื้นหลัง':'รูปโปรไฟล์'}</span>
      <span class="store-product-caption"><strong>${escape(p.name)}</strong><small>${p.price===0?'ฟรี':`${number(p.price)} แต้ม`}</small>${equipped(p)?'<em>✓ กำลังใช้งาน</em>':owned(p)?'<em>อยู่ในคลังแล้ว</em>':''}</span>
    </button>`;
  }
  function renderStore() {
    const group=catalog.filter(p=>kind==='all'||(p.kind||'avatar')===kind);
    const items=(tab==='library'?group.filter(owned):group).filter(p=>p.name.toLocaleLowerCase().includes(shopQuery.toLocaleLowerCase()));
    items.sort((a,b)=>shopSort==='name'?a.name.localeCompare(b.name,'th',{numeric:true}):shopSort==='random'?shuffledIds.indexOf(a.id)-shuffledIds.indexOf(b.id):a.price-b.price||a.name.localeCompare(b.name,'th',{numeric:true}));
    root.dataset.kind='store';
    root.innerHTML=`<div class="avatar-atelier store-market">
      <header class="store-topbar"><a href="index.html" class="store-mark" aria-label="กลับหน้าร้าน">${shopIcon}</a><nav aria-label="ร้านแต้ม"><button data-shop-tab="shop" aria-pressed="${tab==='shop'}">แนะนำ / ร้านค้า</button><button data-shop-tab="library" aria-pressed="${tab==='library'}">คลังของฉัน</button><a href="profile.html#overview">โปรไฟล์ของฉัน ↗</a></nav>
      <form class="store-search" data-store-search role="search"><input name="query" type="search" value="${escape(shopQuery)}" placeholder="ค้นหาในร้านค้า" aria-label="ค้นหาสินค้าตกแต่ง"><button type="submit" aria-label="ค้นหา">⌕</button></form>
      <div class="atelier-wallet store-balance" aria-label="แต้มร้านค้าคงเหลือ"><span>◇</span><strong>${loaded?number(wallet.balance):'—'}</strong><small>แต้ม</small></div></header>
      <div class="store-market-content"><div class="store-intro"><div><span>OLAF · POINT SHOP</span><h1>แต่งโปรไฟล์ให้เป็นคุณ</h1><p>เลือกสไตล์ที่ชอบ ดูตัวอย่างก่อนซื้อ และเก็บไว้ในคลังของคุณ</p></div><button data-shop-action="refresh" ${busy?'disabled':''}>โหลดใหม่</button></div>
      ${tab==='shop'&&!shopQuery&&items.length?`<section class="store-featured" aria-label="ของตกแต่งแนะนำ"><div class="store-section-heading"><h2>แนะนำสำหรับคุณ</h2><div><button data-featured-scroll="-1" aria-label="เลื่อนซ้าย">←</button><button data-featured-scroll="1" aria-label="เลื่อนขวา">→</button></div></div><div class="store-featured-track">${items.slice(0,6).map(p=>storeCard(p,true)).join('')}</div></section>`:''}
      <section><div class="store-toolbar"><h2>${tab==='library'?'คลังสไตล์ของคุณ':'ค้นหาสไตล์ของคุณ'}</h2><nav class="store-categories" aria-label="หมวดสินค้า">${[['all','ทั้งหมด'],['avatar','รูปโปรไฟล์'],['background','พื้นหลัง']].map(([id,label])=>`<button data-shop-kind="${id}" aria-pressed="${kind===id}">${label}</button>`).join('')}</nav><label>เรียงตาม <select data-store-sort><option value="price" ${shopSort==='price'?'selected':''}>ราคาน้อยไปมาก</option><option value="name" ${shopSort==='name'?'selected':''}>ชื่อสินค้า</option><option value="random" ${shopSort==='random'?'selected':''}>สุ่ม</option></select></label><button data-store-random>สุ่ม!</button></div>
      <div class="atelier-grid store-product-grid">${items.map(p=>storeCard(p)).join('')||`<div class="store-empty">${shopQuery?'ไม่พบสินค้าที่ค้นหา':'ยังไม่มีของตกแต่งในหมวดนี้'}<small>${shopQuery?'ลองค้นหาด้วยชื่ออื่น':'รูปใหม่จะแสดงที่นี่เมื่อร้านอัปโหลดไฟล์ ไม่ต้องแก้หน้าเว็บ'}</small></div>`}</div></section>
      <p class="atelier-status${noticeError?' is-error':''}" role="status">${escape(notice||(!loaded?'กำลังโหลดข้อมูลร้านค้า…':'เลือกรูปเพื่อดูตัวอย่างก่อนยืนยัน · เติมเงินสำเร็จ 100 บาท = 1,000 แต้ม'))}</p>
      <details class="atelier-history"><summary>ประวัติแต้มร้านค้า</summary>${wallet.ledger.map(row=>`<div class="atelier-history-row"><span>${escape(row.reason)}</span><strong>${number(row.amount)} แต้ม</strong></div>`).join('')||'ยังไม่มีรายการแต้ม'}</details></div></div>`;
    root.querySelector('[data-store-sort]').value = shopSort;
  }
  const equipped = item => (item?.kind === 'background' ? wallet.background : wallet.equipped) === item?.id;
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
    return { balance:Number(state.balance), owned:[...state.owned, ...(state.backgroundOwned || [])], equipped:state.equipped || null, background:state.background || null, bio:state.bio || '',
      ledger:Array.isArray(state.ledger) ? state.ledger : [] };
  }
  function render() {
    if (document.body.classList.contains('profile-store-page')) { renderStore(); return; }
    const group = catalog.filter(p => (p.kind || 'avatar') === kind);
    const items = (tab === 'library' ? group.filter(owned) : group.filter(p => p.price > 0)).sort((a,b) => a.price-b.price);
    if (!group.some(p => p.id === selected)) selected = items.find(equipped)?.id || items[0]?.id || null;
    const item = current();
    const label = kind === 'background' ? 'พื้นหลัง' : 'รูปโปรไฟล์';
    root.dataset.kind = kind;
    root.innerHTML = `<div class="avatar-atelier">
      <header class="atelier-heading"><div><span class="atelier-eyebrow">OLAF · PROFILE ATELIER</span>
        <h2>ร้านค้าและคลังโปรไฟล์</h2><p>ตกแต่งโปรไฟล์สไตล์คุณ</p></div>
        <div class="atelier-wallet"><small>แต้มร้านค้าของคุณ</small><strong>${loaded ? number(wallet.balance) : '—'}</strong><small>แยกจากยอดเงิน Point</small></div></header>
      <nav class="atelier-tabs" aria-label="หมวดของตกแต่ง"><button type="button" data-shop-kind="avatar" aria-pressed="${kind === 'avatar'}">รูปโปรไฟล์</button><button type="button" data-shop-kind="background" aria-pressed="${kind === 'background'}">พื้นหลัง</button></nav><div class="atelier-body"><aside class="atelier-preview">
        ${item ? `<img class="atelier-preview-image ${kind === 'background' ? 'is-background' : ''}" src="${escape(item.image)}" alt="ตัวอย่างโปรไฟล์" />` : ''}
        <h3>${item ? `${label} ${escape(item.name)}` : `เลือก${label}`}</h3>
        <p>${item ? (owned(item) ? (equipped(item) ? 'กำลังใช้งานรูปนี้' : 'พร้อมใช้งาน · เลือกแล้วกดบันทึก') : `รูปสะสม · ${number(item.price)} แต้ม`) : 'รูปฟรีพร้อมใช้สำหรับสมาชิกทุกคน'}</p>
        <button type="button" class="atelier-save" data-shop-action="${item && owned(item) ? 'equip' : 'buy'}"
          ${!loaded || busy || !item || equipped(item) || (!owned(item) && wallet.balance < item.price) ? 'disabled' : ''}>
          ${busy ? 'กำลังบันทึก…' : item && owned(item) ? `บันทึก${label}` : `แลกด้วย ${number(item?.price)} แต้ม`}</button>
        <p>เติมเงินสำเร็จ 100 บาท = 1,000 แต้ม</p>
      </aside><div class="atelier-content"><nav class="atelier-tabs" aria-label="รายการโปรไฟล์">
        <button type="button" data-shop-tab="library" aria-pressed="${tab === 'library'}">คลังของฉัน · ${group.filter(owned).length}</button>
        <button type="button" data-shop-tab="shop" aria-pressed="${tab === 'shop'}">ร้านค้า · ${group.filter(p => p.price > 0).length}</button>
        <button type="button" data-shop-action="refresh" ${busy ? 'disabled' : ''}>โหลดใหม่</button></nav>
        <div class="atelier-grid">${items.map(p => `<button type="button" class="atelier-portrait" data-avatar="${escape(p.id)}" aria-pressed="${selected === p.id}" ${busy ? 'disabled' : ''}>
          <img src="${escape(p.image)}" alt="โปรไฟล์ ${escape(p.name)}" width="88" height="88" loading="lazy" decoding="async" />
          <strong>โปรไฟล์ ${escape(p.name)}</strong><small>${equipped(p) ? '✓ กำลังใช้งาน' : p.price === 0 ? 'ฟรีสำหรับทุกคน' : owned(p) ? 'อยู่ในคลังแล้ว' : `${number(p.price)} แต้ม`}</small></button>`).join('')
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
          window.olafSupabase.rpc('shop_decoration_state')
        ]);
        // A wallet error must not discard successfully loaded pictures.
        if (catalogResult.status === 'fulfilled') {
          if (!Array.isArray(catalogResult.value.catalog)) throw new Error('SHOP_RESPONSE_INVALID');
          catalog = catalogResult.value.catalog;
        }
        if (stateResult.status === 'rejected') throw Object.assign(stateResult.reason, { stage:'shop_decoration_state' });
        if (stateResult.value.error) throw Object.assign(stateResult.value.error, { stage:'shop_decoration_state' });
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
      const decoration = await window.olafSupabase.rpc('shop_decoration_state');
      if (!decoration.error) wallet = normalizeState(decoration.data);
      if (action === 'purchase') tab = 'library';
      await syncIdentity();
      busy = false;
      render();
      status(action === 'purchase' ? 'แลกสำเร็จ! รูปอยู่ในคลังแล้ว กดบันทึกเพื่อตั้งค่าบนโปรไฟล์' : 'บันทึกการตกแต่งโปรไฟล์แล้ว');
      root.querySelector('.atelier-save')?.focus({ preventScroll:true });
    } catch (error) {
      busy = false;
      render();
      status(errorText(error), true);
    }
  }
  function previewSelection() {
    const item = current();
    if (!item || busy) return;
    const member = window.OlafStore.currentUser();
    dialog.classList.toggle('is-profile-preview', item.kind === 'background');
    const fullImage = item.image.startsWith('api/profile-avatar?') ? `${item.image}&view=full` : item.image;
    dialog.innerHTML = `<header class="preview-heading"><div><small>OLAF · PROFILE PREVIEW</small><h2>ตัวอย่างก่อนบันทึก</h2></div><button type="button" data-cancel aria-label="ปิดตัวอย่าง">×</button></header>
      ${item.kind !== 'background' ? `<div class="portrait-full-preview"><img src="${escape(fullImage)}" alt="${escape(item.name)} แบบเต็มภาพ" /></div>` : `<div class="preview-profile-card"><div class="decoration-preview"><img class="decoration-preview-bg" src="${escape(item.image)}" alt="พื้นหลังที่เลือก" />
      <div class="decoration-preview-person">${member.avatarUrl ? `<img src="${escape(member.avatarUrl)}" alt="รูปโปรไฟล์ปัจจุบัน" />` : '<span class="preview-avatar-placeholder">O</span>'}
      <div><small>OLAF COMMUNITY · โปรไฟล์ของฉัน</small><strong>${escape(member.displayName || member.username || 'โปรไฟล์ของคุณ')}<span data-preview-name-rank></span></strong><p>พื้นที่ของคุณ สำหรับเกมที่คุณรัก</p></div></div></div>
      <div class="preview-profile-stats"><div><small>ยอดเงินในเว็บ · Point</small><strong data-preview-money>—</strong></div><div><small>แต้มร้านค้าตกแต่ง</small><strong>${number(wallet.balance)}</strong></div></div>
      <div class="preview-profile-bio"><h3>สังเขป</h3><p>${escape(wallet.bio || 'ยังไม่ได้เขียนสังเขป แนะนำตัวในสไตล์คุณได้เลย')}</p></div><section class="preview-profile-rank" data-preview-rank><p>กำลังโหลดแรงค์ปัจจุบัน…</p></section></div>`}
      <p>${owned(item) ? 'บันทึกเพื่อใช้รูปนี้บนโปรไฟล์ของคุณ' : `ใช้ ${number(item.price)} แต้ม · ซื้อแล้วกดบันทึกเพื่อตั้งค่า`}</p>
      <div class="atelier-dialog-actions"><button type="button" class="atelier-cancel" data-cancel>ปิดตัวอย่าง</button><button type="button" class="atelier-confirm" data-save ${!loaded || equipped(item) || (!owned(item) && wallet.balance < item.price) ? 'disabled' : ''}>${owned(item) ? 'ยืนยันบันทึก' : 'ซื้อด้วยแต้ม'}</button></div>`;
    dialog.querySelectorAll('[data-cancel]').forEach(button => { button.onclick = () => dialog.close(); });
    dialog.querySelector('[data-save]').onclick = () => { dialog.close(); owned(item) ? mutate('equip') : confirmPurchase(); };
    dialog.showModal();
    dialog.querySelector('[data-cancel]').focus();
    if(item.kind === 'background') loadPreviewRank(dialog.querySelector('[data-preview-rank]'));
  }
  async function loadPreviewRank(slot) {
    const tiers=[['brone','Brone'],['gold','Gold'],['platinum','Platinum'],['diamonds','Diamonds'],['super','Super'],['supreme','Supreme']];
    const [rankResult,badgeResult,moneyResult]=await Promise.allSettled([
      window.olafSupabase.rpc('shop_rank_state'),window.olafSupabase.rpc('shop_rank_badge_state'),
      window.OlafOrders?.fetchPointBalance?.()
    ]);
    if(!slot.isConnected) return;
    const state=rankResult.status==='fulfilled'&&!rankResult.value?.error ? rankResult.value?.data : null;
    const rank=Number(state?.rank);
    if(Number.isInteger(rank)&&rank>=0&&rank<=6) {
      slot.innerHTML=`<h3>แรงค์ปัจจุบัน · ${tiers[rank-1]?.[1] || 'ยังไม่มีแรงค์'}</h3><div class="preview-rank-track">${tiers.map(([id,label],index)=>`<div class="${rank===index+1?'is-current':''}" style="--preview-opacity:${Math.max(.25,1-Math.abs(index+1-rank)*.15)}"><img src="api/rank-image?rank=${id}" alt="${label}"><small>${label}</small></div>`).join('')}</div>`;
      if(rank>0&&badgeResult.status==='fulfilled'&&badgeResult.value?.data?.show) dialog.querySelector('[data-preview-name-rank]').innerHTML=`<img src="api/rank-image?rank=${tiers[rank-1][0]}" alt="แรงค์ ${tiers[rank-1][1]}">`;
    } else slot.textContent='โหลดแรงค์ไม่สำเร็จ สามารถปิดแล้วเปิดตัวอย่างเพื่อลองใหม่';
    if(moneyResult.status==='fulfilled'&&moneyResult.value) dialog.querySelector('[data-preview-money]').textContent=number(moneyResult.value.balance);
  }
  function confirmPurchase() {
    const item = current();
    if (!item || owned(item) || busy) return;
    dialog.classList.remove('is-profile-preview');
    dialog.innerHTML = `<h2>แลก${item.kind === 'background' ? 'พื้นหลัง' : 'รูปโปรไฟล์'}นี้?</h2><img class="${item.kind === 'background' ? 'confirmation-background' : ''}" src="${escape(item.image)}" alt="${escape(item.name)}" />
      <p>ใช้ ${number(item.price)} แต้มร้านค้า · คงเหลือหลังแลก ${number(wallet.balance - item.price)} แต้ม<br>รูปจะเข้าคลังของคุณทันที โดยไม่หักยอดเงิน Point</p>
      <div class="atelier-dialog-actions"><button class="atelier-cancel" type="button" data-cancel>ยกเลิก</button><button class="atelier-confirm" type="button" data-confirm>ยืนยันการแลก</button></div>`;
    dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
    dialog.querySelector('[data-confirm]').onclick = () => { dialog.close(); mutate('purchase'); };
    dialog.showModal();
    dialog.querySelector('[data-cancel]').focus();
  }
  document.addEventListener('DOMContentLoaded', async () => {
    root = document.getElementById('avatar-shop-root');
    if (!root) return;
    if(document.body.classList.contains('profile-store-page')) { tab='shop'; kind='all'; }
    await window.OlafStore?.ready;
    const member = window.OlafStore?.currentUser();
    if (!member) { location.href = 'login.html?return=profile-store.html'; return; }
    dialog = document.createElement('dialog');
    dialog.className = 'atelier-dialog';
    dialog.setAttribute('aria-label','ยืนยันการแลกรูปโปรไฟล์');
    document.body.append(dialog);
    render();
    root.addEventListener('submit',event=>{
      if(!event.target.matches('[data-store-search]')) return;
      event.preventDefault(); shopQuery=event.target.elements.query.value.trim(); render();
      root.querySelector('.store-search input')?.focus();
    });
    root.addEventListener('change',event=>{
      if(event.target.matches('[data-store-sort]')) { shopSort=event.target.value; if(shopSort==='random') shuffleStore(); render(); }
    });
    root.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled || busy) return;
      if(button.dataset.featuredScroll) root.querySelector('.store-featured-track')?.scrollBy({left:Number(button.dataset.featuredScroll)*300,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      if(button.hasAttribute('data-store-random')) { shuffleStore(); shopSort='random'; render(); }
      if (button.dataset.shopKind) { kind = button.dataset.shopKind; selected = null; render(); }
      if (button.dataset.shopTab) { tab = button.dataset.shopTab; render(); }
      if (button.dataset.avatar) { selected = button.dataset.avatar; render(); previewSelection(); }
      if (button.dataset.shopAction === 'buy') confirmPurchase();
      if (button.dataset.shopAction === 'equip') previewSelection();
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
  function shuffleStore() {
    shuffledIds=catalog.map(p=>p.id);
    for(let i=shuffledIds.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1)); [shuffledIds[i],shuffledIds[j]]=[shuffledIds[j],shuffledIds[i]];}
  }
})();
