(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const adminPage=location.pathname.endsWith('/supplier-store.html');
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
  const money=n=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',minimumFractionDigits:2}).format(Number(n)||0);
  const button=(text,handler)=>{const b=el('button',text);b.type='button';b.addEventListener('click',()=>run(b,handler));return b;};
  const errors={AUTH_REQUIRED:'กรุณาเข้าสู่ระบบก่อน',LIVE_PURCHASE_DISABLED:'ยังไม่เปิดรับคำสั่งซื้อจริง',ACTIVE_ACCOUNT_REQUIRED:'บัญชีนี้ยังใช้งานไม่ได้ กรุณาติดต่อร้าน',
    SUPPLIER_PRICE_CHANGED:'ต้นทุนเปลี่ยน กรุณาติดต่อร้านก่อนชำระเงิน',SUPPLIER_OUT_OF_STOCK:'สินค้าหมดชั่วคราว',OUT_OF_STOCK:'สินค้าหมดชั่วคราว',
    SUPPLIER_PRODUCT_UNAVAILABLE:'สินค้านี้ยังไม่เปิดขาย',IDEMPOTENCY_CONFLICT:'คำขอสั่งซื้อเดิมไม่ตรงกัน กรุณาโหลดออเดอร์ก่อนลองใหม่',
    SUPPLIER_FULFILLMENT_BUSY:'กำลังจัดส่ง กรุณารอสักครู่แล้วโหลดออเดอร์ใหม่',SUPPLIER_MANUAL_REVIEW_REQUIRED:'ออเดอร์นี้ต้องให้ร้านตรวจสอบ กรุณาติดต่อร้าน',
    VERIFIED_PAYMENT_REQUIRED:'ยังไม่มีผลยืนยันชำระเงินที่ถูกต้อง',DELIVERY_NOT_READY:'ยังส่งมอบไม่สำเร็จ กรุณาโหลดสถานะใหม่',
    CODE_LIMIT_REACHED:'ใช้โควตา Steam Guard ครบแล้ว กรุณาติดต่อร้าน',CODE_UNAVAILABLE:'บัญชีนี้ไม่รองรับ Steam Guard อัตโนมัติ',
    ORDER_REFUNDED:'ออเดอร์นี้ถูกคืนเงินแล้ว',GUARD_WINDOW_CLOSED:'รอบ Steam Guard สิ้นสุดแล้ว กรุณากดเปิดรอบใหม่',
    GUARD_BUSY:'กำลังประมวลผล Steam Guard กรุณารออย่างน้อย 65 วินาที',RATE_LIMITED:'เรียกถี่เกินไป กรุณารอแล้วลองใหม่',
    SUPPLIER_RATE_LIMITED:'มีคำขอมาก กรุณารอหนึ่งนาทีแล้วลองใหม่',ORDER_NOT_FOUND:'ไม่พบออเดอร์ของคุณ',
    SUPPLIER_SERVICE_UNAVAILABLE:'ระบบยังไม่พร้อม กรุณาติดต่อร้านหรือลองใหม่ภายหลัง'};
  let products=[],checkoutEnabled=false,currentOrder=null,epoch=0,guardTimer=null,guardVersion=0;
  const notice=message=>{const box=document.querySelector('dialog.supplier-vault[open] [data-supplier-dialog-status]')||$('supplier-notice');if(box)box.textContent=message;};
  function clearSecrets(){guardVersion++;clearInterval(guardTimer);guardTimer=null;document.querySelectorAll('[data-supplier-secret]').forEach(n=>n.remove());document.querySelectorAll('[data-guard-start]').forEach(n=>{delete n.dataset.locked;n.disabled=false;});}
  Object.assign(errors,{SUPPLIER_MIGRATION_REQUIRED:'ยังไม่ได้ติดตั้ง SQL ชุดหน้าร้านหลัก กรุณาแจ้งแอดมิน',SUPPLIER_PERMISSION_REQUIRED:'สิทธิ์ฐานข้อมูลไม่พร้อม กรุณาแจ้งแอดมิน',SUPPLIER_SCHEMA_MISMATCH:'โครงสร้างฐานข้อมูลออเดอร์ไม่ตรง กรุณาแจ้งแอดมิน',SUPPLIER_DATABASE_UNAVAILABLE:'ฐานข้อมูลไม่พร้อม กรุณาลองใหม่',SERVER_CONFIG_REQUIRED:'Server Environment ยังไม่ครบ กรุณาแจ้งแอดมิน',MIN_TOPUP_REQUIRED:'ร้านยังไม่ผ่านเงื่อนไขยอดเติมของผู้ให้บริการ',SUPPLIER_PRICE_CHANGED:'ราคาเปลี่ยนแล้ว กรุณาปิดและเปิดสั่งซื้อใหม่เพื่อยืนยันราคาใหม่'});
  errors.SUPPLIER_UPSTREAM_BLOCKED='499K ปฏิเสธการเชื่อมต่อจากเซิร์ฟเวอร์ร้าน กรุณาติดต่อร้าน ยังไม่มีการสั่งซื้อหรือตัดเงิน';
  async function run(control,task){control.disabled=true;try{await task();}catch(e){notice((errors[e.code]||'ทำรายการไม่สำเร็จ กรุณาโหลดสถานะใหม่ก่อนลองซ้ำ')+(e.code?' ['+e.code+']':''));}finally{if(control.isConnected)control.disabled=control.dataset.locked==='true';}}
  async function session(){const result=await window.olafSupabase.auth.getSession();if(result.error||!result.data?.session)throw Object.assign(new Error(),{code:'AUTH_REQUIRED'});return result.data.session;}
  const checkoutCooldowns=new Map(),pendingQuotes=new Map();
  async function quoteProduct(productId){
    const s=await session(),key=`${epoch}:${s.user.id}:${productId}`;
    if(pendingQuotes.has(key))return pendingQuotes.get(key);
    const pending=api('quote',{productId}).finally(()=>pendingQuotes.delete(key));
    pendingQuotes.set(key,pending);return pending;
  }
  async function api(action,body){
    const version=epoch;const headers={Accept:'application/json'};
    let owner='';
    if(action!=='catalog'){const s=await session();owner=s.user.id;headers.Authorization=`Bearer ${s.access_token}`;}
    const checkoutAction=action==='quote'||action==='checkout';
    const cooldownKey=`${version}:${owner}`;
    const remaining=Math.ceil(((checkoutCooldowns.get(cooldownKey)||0)-Date.now())/1000);
    if(checkoutAction&&remaining>0)throw Object.assign(new Error(),{code:'SUPPLIER_RATE_LIMITED',retryAfter:remaining});
    if(body!==undefined)headers['Content-Type']='application/json';
    const res=await fetch(`/api/admin-supplier?action=shop-${action}`,{method:body===undefined?'GET':'POST',headers,cache:'no-store',signal:AbortSignal.timeout(30000),...(body!==undefined?{body:JSON.stringify(body)}:{})});
    const result=await res.json();if(version!==epoch)throw new Error('SESSION_CHANGED');
    if(!res.ok||!result.success){
      const retryAfter=Math.min(3600,Math.max(1,Number(res.headers.get('Retry-After'))||60));
      if(checkoutAction&&(res.status===429||['SUPPLIER_RATE_LIMITED','RATE_LIMITED','SUPPLIER_DATABASE_RATE_LIMITED'].includes(result.code)))checkoutCooldowns.set(cooldownKey,Date.now()+retryAfter*1000);
      throw Object.assign(new Error(),{code:result.code,diagnostics:result.diagnostics,retryAfter});
    }return result.data;
  }
  async function apiOrder(id){const s=await session();const r=await fetch('/api/admin-supplier?action=shop-order&orderId='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+s.access_token},cache:'no-store'});const j=await r.json();if(!j.success)throw Object.assign(new Error(),{code:j.code});return j.data;}
  function img(url,alt,cls){const n=el('img',undefined,cls);n.src=url;n.alt=alt;n.loading='lazy';n.referrerPolicy='no-referrer';return n;}
  function price(p){const box=el('div');if(p.compareAt)box.append(el('del',money(p.compareAt),'supplier-compare'));box.append(el('strong',money(p.price),'supplier-price'));return box;}
  function renderCatalog(){
    const q=$('supplier-search').value.trim().toLocaleLowerCase();const grid=$('supplier-grid');grid.replaceChildren();
    for(const p of products.filter(p=>(p.name+' '+p.genres.join(' ')).toLocaleLowerCase().includes(q))){
      const card=el('article',undefined,'supplier-card');if(p.image)card.append(img(p.image,p.name));
      const body=el('div',undefined,'supplier-card-body');body.append(el('h3',p.name),el('p',p.available?'Steam Offline':'สินค้าหมด'),price(p));
      body.append(button('ดูรายละเอียด',()=>showProduct(p)));card.append(body);grid.append(card);
    }
    if(!grid.children.length)grid.append(el('p','ยังไม่มีสินค้าที่ตรงกับการค้นหา หรือร้านยังไม่เปิดเผยรายการสินค้า'));
  }
  async function showProduct(p){
    try {await session();const q=await api('quote',{productId:p.id});p={...p,price:q.price,available:q.available};checkoutEnabled=true;}catch(e){if(e.code==='AUTH_REQUIRED'){location.href='login.html?return='+encodeURIComponent(location.pathname+location.search);return;}const d=e.diagnostics;notice((errors[e.code]||'ยังตรวจราคาล่าสุดไม่ได้ ['+(e.code||'NETWORK')+']')+(d?' · HTTP '+d.upstreamStatus+' / '+d.responseFormat+' / '+(d.reason||'unknown'):''));return;}
    const box=$('supplier-detail-content');box.replaceChildren();if(p.image)box.append(img(p.image,p.name,'supplier-detail-image'));
    const title=el('h2',p.name);title.id='supplier-detail-title';box.append(title,el('p',p.genres.join(' · '),'supplier-tags'),price(p));
    box.append(el('p','บัญชี Steam สำหรับเล่นออฟไลน์ ไม่ใช่ CD Key ห้ามเปลี่ยนข้อมูลบัญชี และโปรดทำตามคู่มือที่ร้านแจ้ง'));
    if(p.denuvo)box.append(el('p','เกมนี้มี Denuvo: การเข้าเกมครั้งแรกจำกัดสิทธิ์ต่อวัน อาจต้องรอคิว 1–3 วัน โดยเฉพาะช่วงเกมเปิดตัว','supplier-warning'));
    if(p.region)box.append(el('p',`ภูมิภาค: ${p.region}`));
    if(p.description)box.append(el('p',p.description,'supplier-description'));
    if(p.requirements){box.append(el('h3','สเปกขั้นต่ำ'),el('p',p.requirements,'supplier-description'));}
    const gallery=el('div',undefined,'supplier-screenshots');p.screenshots.forEach(url=>gallery.append(img(url,'ภาพเกม')));box.append(gallery);
    const consent=el('label',undefined,'supplier-consent'),check=el('input');check.type='checkbox';consent.append(check,el('span','ฉันเข้าใจว่าเป็นบัญชีสำหรับเล่นออฟไลน์ และอ่านเงื่อนไขรวมถึงคำเตือน Denuvo (ถ้ามี) แล้ว'));
    const select=el('select');select.setAttribute('aria-label','ช่องทางชำระเงิน');for(const [value,label] of [['promptpay','PromptPay'],['wallet','TrueMoney Wallet']]){const o=el('option',label);o.value=value;select.append(o);}
    const buy=button('สั่งซื้อ 1 บัญชี',async()=>{
      if(!check.checked)return;
      try{await session();}catch{location.href='login.html?return='+encodeURIComponent(location.pathname+location.search);return;}
      const s=await session();const key=`supplier-request:${s.user.id}:${p.id}:${select.value}`;
      let requestId=sessionStorage.getItem(key);if(!requestId){requestId=crypto.randomUUID();sessionStorage.setItem(key,requestId);}
      const order=await api('checkout',{productId:p.id,requestId,paymentMethod:select.value,expectedPrice:p.price});
      sessionStorage.removeItem(key);$('supplier-detail').close();notice('สร้างออเดอร์แล้ว ชำระยอดตามที่แสดงให้ครบถึงสตางค์');
      if(!adminPage){location.href=`profile.html?order=${encodeURIComponent(order.id)}#orders`;return;}
      history.replaceState(null,'',`supplier-store.html?order=${encodeURIComponent(order.id)}#supplier-order`);await renderOrder(order);await loadOrders();
    });
    buy.disabled=true;check.addEventListener('change',()=>{buy.disabled=!check.checked||!checkoutEnabled||!p.available;});
    box.append(consent,select,buy);if(!checkoutEnabled)box.append(el('p','ร้านยังไม่เปิดรับคำสั่งซื้อจริง','supplier-warning'));
    $('supplier-detail').showModal();
  }
  const labels={awaiting_payment:'รอชำระเงิน',waiting_admin:'กำลังตรวจชำระเงิน',confirmed:'ชำระแล้ว รอส่งมอบ',delivered:'ส่งมอบแล้ว',cancelled:'ยกเลิกแล้ว',expired:'หมดอายุ'};
  async function loadOrders(){
    const box=$('supplier-orders');let rows;
    try{rows=await api('orders');}catch(e){box.replaceChildren(el('p',errors[e.code]||'ยังโหลดออเดอร์ไม่ได้'));if(e.code==='AUTH_REQUIRED'){const a=el('a','เข้าสู่ระบบ');a.href='login.html?return='+encodeURIComponent(location.pathname+location.search+'#orders');box.append(a);}return;}
    if(location.pathname.endsWith('/profile.html')){
      document.dispatchEvent(new CustomEvent('olaf:supplier-inventory',{detail:rows}));
      const id=new URLSearchParams(location.search).get('order');
      if(id&&!currentOrder&&location.hash!=='#inventory'){const o=rows.find(o=>o.id===id);if(o)await renderOrder(o);}return;
    }
    box.replaceChildren();for(const o of rows){const row=el('article',undefined,'supplier-order-row'),text=el('div');text.append(el('strong',o.name),el('small',`${o.orderNumber} · ${money(o.price)} · ${labels[o.status]||o.status}`));
      row.append(text,button('เปิดออเดอร์',()=>renderOrder(o)));box.append(row);}
    if(!rows.length)box.append(el('p','ยังไม่มีออเดอร์สินค้าอัตโนมัติ'));
    const id=new URLSearchParams(location.search).get('order');if(id&&!currentOrder){const o=rows.find(o=>o.id===id);if(o)await renderOrder(o);}
  }
  async function refreshOrder(orderId){const list=await api('orders');const o=list.find(o=>o.id===orderId);if(o)await renderOrder(o);else notice('ไม่พบออเดอร์ในรายการล่าสุด กรุณาติดต่อร้าน');}
  async function paymentQR(order,box){
    try{
      const channels=await window.OlafStoreSettings.fetchPaymentChannels({activeOnly:true});
      if(currentOrder?.id!==order.id)return;
      const channel=channels.find(c=>c.method===order.paymentMethod||c.id===order.paymentMethod);
      if(!channel){box.append(el('p','ยังไม่พบช่องทางชำระเงิน กรุณาติดต่อร้านก่อนโอน','supplier-warning'));return;}
      let url=channel.qrUrl;
      if(channel.accountNumber)box.append(el('p',`${channel.bankName||channel.label} ${channel.accountNumber} ${channel.accountName||''}`));
      if(url && new URL(url).protocol==='https:'){const qr=img(url,'QR ชำระเงิน','supplier-qr');qr.addEventListener('error',()=>{qr.remove();box.append(el('p','โหลด QR ไม่สำเร็จ กรุณาติดต่อร้านก่อนโอน'));});box.append(qr);}
      else box.append(el('p','ไม่พบ QR กรุณาติดต่อร้านเพื่อยืนยันช่องทางชำระเงิน'));
      box.append(el('strong',`โอนให้ตรงยอด ${money(order.total)} ไม่ปัดเศษ`));
    }catch{box.append(el('p','โหลดช่องทางชำระเงินไม่สำเร็จ กรุณาติดต่อร้านก่อนโอน'));}
  }
  async function renderOrder(o){
    if(location.pathname.endsWith('/profile.html')){
      clearSecrets();currentOrder=o;
      const event=new CustomEvent('olaf:supplier-order-open',{detail:o,cancelable:true});document.dispatchEvent(event);
      if(event.defaultPrevented)return;
    }
    if($('supplier-orders-section'))$('supplier-orders-section').hidden=false;
    clearSecrets();currentOrder=o;const panel=$('supplier-order');panel.hidden=false;panel.replaceChildren(el('h2',o.name),el('p',o.orderNumber),el('strong',`${labels[o.status]||o.status} · ${money(o.total)}`));
    const actions=el('div',undefined,'supplier-actions');actions.append(button('โหลดสถานะใหม่',()=>refreshOrder(o.id)));panel.append(actions);
    if(o.status==='awaiting_payment'){
      if(o.expiresAt)panel.append(el('p',`ชำระก่อน ${new Date(o.expiresAt).toLocaleString('th-TH')}`));
      if(o.expiresAt&&new Date(o.expiresAt)<=new Date())panel.append(el('p','ออเดอร์หมดเวลาชำระแล้ว ห้ามโอน กรุณายกเลิกและสั่งใหม่','supplier-warning'));
      else{
        const pay=el('div');panel.append(pay);await paymentQR(o,pay);
        const input=el('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.setAttribute('aria-label','สลิปชำระเงิน');panel.append(input);
        actions.append(button('แนบสลิปและตรวจชำระเงิน',async()=>{if(!input.files[0]){notice('กรุณาเลือกรูปสลิป');return;}
          try{await window.OlafOrders.uploadPaymentSlip({orderId:o.id,file:input.files[0]});notice('รับผลตรวจแล้ว กดโหลดสถานะเพื่อดูการส่งมอบ');}
          catch{notice('ยังยืนยันผลตรวจไม่ได้ กรุณาโหลดสถานะก่อนแนบสลิปซ้ำ หากชำระแล้วห้ามโอนซ้ำ');}
          await refreshOrder(o.id);
        }));
      }
      actions.append(button('ยกเลิกออเดอร์',async()=>{if(confirm('ยกเลิกได้เฉพาะออเดอร์ที่ยังไม่โอนเงิน ยืนยันหรือไม่?')){await window.OlafOrders.cancelMyOrder(o.id);await refreshOrder(o.id);await loadOrders();}}));
    }
    if(o.status==='waiting_admin' && o.hasSlip)actions.append(button('ตรวจสลิปที่แนบไว้อีกครั้ง',async()=>{try{await window.OlafOrders.verifyPaymentSlip({orderId:o.id});}catch{notice('ยังตรวจไม่ผ่านหรืออยู่ระหว่างตรวจ กรุณาติดต่อร้าน ห้ามโอนซ้ำ');}await refreshOrder(o.id);}));
    if(o.paymentStatus==='verified'){
      panel.append(el('p',o.canReceive?'จัดส่งสินค้าแล้ว เปิดดูบัญชีและ Steam Guard ได้ที่คลังสินค้า':'ชำระเงินแล้ว ติดตามการจัดส่งได้ที่คลังสินค้า'));
      const link=el('a','ไปที่คลังสินค้า','supplier-inventory-link');link.href='profile.html#inventory';panel.append(link);
    }
    panel.scrollIntoView({block:'start',behavior:'smooth'});
  }
  function vaultDialog(title){
    const dialog=el('dialog',undefined,'supplier-widget supplier-vault');
    const heading=el('h2',title);heading.id='supplier-vault-title';dialog.setAttribute('aria-labelledby',heading.id);
    const close=el('button','×','supplier-vault-close');close.type='button';close.setAttribute('aria-label','ปิดหน้าต่าง');close.addEventListener('click',()=>dialog.close());
    const status=el('p');status.dataset.supplierDialogStatus='';status.setAttribute('role','status');
    const header=el('div',undefined,'supplier-vault-header');
    const icon=el('span',undefined,'supplier-steam-emblem');icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="30" fill="#071c42" stroke="#50bfff"/><path d="m3 38 19 8 9-4 13-16-5-9-17 21-8-3Z" fill="white"/><circle cx="44" cy="23" r="12" fill="#071c42" stroke="white" stroke-width="4"/><circle cx="44" cy="23" r="7" stroke="white" stroke-width="2"/><circle cx="23" cy="44" r="8" fill="#071c42" stroke="white" stroke-width="3"/><path d="m5 37 20 8" stroke="white" stroke-width="5" stroke-linecap="round"/></svg>';
    header.append(icon,heading);dialog.append(close,header,status);dialog.addEventListener('close',()=>{if(dialog.isConnected){clearSecrets();dialog.remove();}});
    document.body.append(dialog);dialog.showModal();return dialog;
  }
  function closeVaults(){document.querySelectorAll('dialog.supplier-vault').forEach(d=>{if(d.open)d.close();d.remove();});clearSecrets();}
  async function openInventory(orderId){
    closeVaults();const version=guardVersion;
    const dialog=vaultDialog('รับข้อมูลสินค้า Steam');dialog.append(el('p','รับไอดี รหัสผ่าน และ Steam Guard ในหน้าต่างเดียว','supplier-vault-subtitle'),el('p','กำลังโหลดข้อมูล…','supplier-vault-loading'));
    let o;
    try{o=await apiOrder(orderId);}catch(e){dialog.querySelector('.supplier-vault-loading')?.remove();notice(errors[e.code]||'ยังโหลดข้อมูลไม่ได้ กรุณาลองใหม่');return;}
    if(version!==guardVersion||!dialog.open||document.hidden)return;
    currentOrder=o;dialog.querySelector('.supplier-vault-loading')?.remove();
    const summary=el('section',undefined,'supplier-vault-product');
    if(o.image){const cover=el('img');cover.src=o.image;cover.alt=o.name;cover.addEventListener('error',()=>cover.remove(),{once:true});summary.append(cover);}
    const info=el('div');info.append(el('h3',o.name),el('p','หมวดหมู่: Steam Offline'),el('p',o.canReceive?'● พร้อมรับสินค้า':'กำลังตรวจสอบการจัดส่ง','supplier-vault-state'),el('small',o.orderNumber));summary.append(info);dialog.append(summary);
    if(o.paymentStatus!=='verified'){dialog.append(el('p','สินค้านี้ยังไม่ผ่านการชำระเงิน กรุณาตรวจออเดอร์ของฉัน'));return;}
    if(!o.canReceive){
      dialog.append(el('p',o.needsSupport?'ร้านต้องตรวจสอบการส่งมอบ กรุณาติดต่อพร้อมเลขออเดอร์ ห้ามชำระซ้ำ':'ชำระเงินแล้ว กำลังเตรียมจัดส่ง'));
      if(o.state!=='blocked')dialog.append(button('ตรวจการจัดส่ง',async()=>{await api('fulfill',{orderId:o.id});if(version!==guardVersion)return;await loadOrders();await openInventory(o.id);}));
      return;
    }
    dialog.append(el('p','บัญชี Steam Offline · เก็บข้อมูลนี้เป็นความลับ','supplier-vault-order'));
    try{
      const account=await api('delivery',{orderId:o.id});
      if(version!==guardVersion||!dialog.open||document.hidden)return;
      const box=el('div',undefined,'supplier-vault-account');box.dataset.supplierSecret='';box.dataset.supplierAccount='';box.append(el('h3','ข้อมูลบัญชีผู้ใช้'));
      for(const [field,title] of [['username','ชื่อบัญชี'],['password','รหัสผ่าน']]){
        const label=el('label',title),row=el('div',undefined,'supplier-vault-field'),input=el('input');input.value=account[field]||'';input.readOnly=true;input.type=field==='password'?'password':'text';input.autocomplete='off';input.setAttribute('aria-label',title);row.append(input);
        if(field==='password'){
          const eye=el('button',undefined,'supplier-vault-eye');eye.type='button';eye.setAttribute('aria-label','แสดงรหัสผ่าน');eye.setAttribute('aria-pressed','false');
          eye.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
          eye.addEventListener('click',()=>{const reveal=input.type==='password';input.type=reveal?'text':'password';eye.setAttribute('aria-label',reveal?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน');eye.setAttribute('aria-pressed',String(reveal));});row.append(eye);
        }
        row.append(button('คัดลอก',()=>navigator.clipboard.writeText(input.value)));label.append(row);box.append(label);
      }
      dialog.append(box);openGuard(o,dialog);
      const footer=el('div',undefined,'supplier-vault-footer');footer.append(el('span','จัดส่งอัตโนมัติ · รับสินค้าหลังชำระเงิน'),button('ปิด',()=>dialog.close()));dialog.append(footer);
    }catch(e){if(version===guardVersion)notice(errors[e.code]||'ยังเปิดข้อมูลไม่ได้ กรุณาลองใหม่');}
  }
  function openGuard(o,dialog){
    const section=el('section',undefined,'supplier-vault-guard');section.append(el('h3','Steam Guard'),el('p','รับรหัสเพื่อเข้าสู่ระบบ · สูงสุด 3 รอบต่อออเดอร์ตามข้อกำหนดผู้ให้บริการ'));
    const start=button('รับรหัส Steam Guard',async()=>{
      const version=guardVersion,result=await api('guard',{orderId:o.id,reason:'ลูกค้าขอ Steam Guard เพื่อเข้าสู่ระบบบัญชีที่ซื้อ'});
      if(version!==guardVersion||!dialog.open||document.hidden)return;showGuard(o,result,start,section);
    });start.dataset.guardStart='';section.append(start);
    section.append(el('p','รอบละ 60 วินาที · เก็บรหัสเป็นความลับ เมื่อปิดหน้าต่างหรือสลับแท็บข้อมูลจะถูกซ่อน','supplier-vault-order'));dialog.append(section);
  }
  function showGuard(o,result,start,target){
    document.querySelectorAll('[data-supplier-guard]').forEach(n=>n.remove());clearInterval(guardTimer);
    const box=el('div',undefined,'supplier-secret'),code=el('strong',result.code,'supplier-guard-code'),status=el('span');
    box.dataset.supplierSecret='';box.dataset.supplierGuard='';box.append(code,status,button('คัดลอกรหัส',()=>{if(Date.now()<validUntil)return navigator.clipboard.writeText(code.textContent);notice('รหัสหมดอายุแล้ว');}));target.append(box);
    let validUntil=Date.now()+result.valid_for_sec*1000,windowUntil=Date.now()+result.window.expires_in_sec*1000,busy=false;
    const version=guardVersion;start.disabled=true;start.dataset.locked='true';
    guardTimer=setInterval(async()=>{
      if(version!==guardVersion||document.hidden||currentOrder?.id!==o.id){clearInterval(guardTimer);box.remove();delete start.dataset.locked;start.disabled=false;return;}
      const left=Math.max(0,Math.ceil((windowUntil-Date.now())/1000));status.textContent=`เหลือ ${left} วินาที · ใช้แล้ว ${result.code_requests.used}/${result.code_requests.max} รอบ`;
      if(Date.now()>=validUntil)code.textContent='—';
      if(!left){clearInterval(guardTimer);code.textContent='หมดรอบ';delete start.dataset.locked;start.disabled=false;return;}
      if(Date.now()>=validUntil-1000 && left>4&&!busy){busy=true;try{const next=await api('guard',{orderId:o.id});if(version!==guardVersion||document.hidden)return;code.textContent=next.code;validUntil=Date.now()+next.valid_for_sec*1000;windowUntil=Date.now()+next.window.expires_in_sec*1000;}catch(e){clearInterval(guardTimer);code.textContent='—';status.textContent=errors[e.code]||'ยังไม่ทราบผล กรุณารอ 65 วินาทีก่อนเปิดรอบใหม่';delete start.dataset.locked;start.disabled=false;}finally{busy=false;}}
    },1000);
  }
  function mount(){
    if(adminPage)return;
    const root=el('section',undefined,'supplier-widget');root.id='supplier-customer-tools';
    root.innerHTML='<p id="supplier-notice" role="status"></p><section id="supplier-orders-section" hidden><button id="supplier-refresh" type="button" hidden>โหลดออเดอร์</button><div id="supplier-orders" hidden></div><section id="supplier-order" hidden></section></section><dialog id="supplier-detail" class="supplier-widget" aria-labelledby="supplier-detail-title"><button class="supplier-close" type="button" aria-label="ปิด">×</button><div id="supplier-detail-content"></div></dialog>';
    (document.querySelector('#panel-orders .profile-panel-body')||document.querySelector('#panel-orders')||document.body).append(root);
    if(!location.pathname.endsWith('/profile.html')){root.classList.add('supplier-product-tools');$('supplier-orders-section').hidden=true;}
  }
  async function init(){
    if(window.OlafProfileRoute?.visiting)return;
    mount();
    if(adminPage){
      try{await api('readiness');document.querySelector('main').hidden=false;}
      catch(e){document.querySelector('main').hidden=true;const msg=el('p',['AUTH_REQUIRED','ADMIN_REQUIRED'].includes(e.code)?'หน้านี้สำหรับแอดมินเท่านั้น กรุณาเข้าสู่ระบบบัญชีแอดมิน':'ตรวจความพร้อมไม่สำเร็จ ['+(e.code||'NETWORK')+'] กรุณาตรวจ SQL และ Environment');const a=el('a','เข้าสู่ระบบ');a.href='login.html?return=supplier-store.html';msg.append(a);document.body.append(msg);return;}
    }
    window.OlafSupplierUI={checkout:showProduct,openInventory,refreshInventory:loadOrders,
      quote:quoteProduct,
      createCheckout:async(p,paymentMethod,pointsToUse=0)=>{
        const userSession=await session();
        const key=`olaf-supplier-native:${userSession.user.id}:${p.id}:${paymentMethod}:${p.price}:${pointsToUse}`;
        let requestId=sessionStorage.getItem(key);if(!requestId){requestId=crypto.randomUUID();sessionStorage.setItem(key,requestId);}
        const order=await api('checkout',{productId:p.id,requestId,paymentMethod,expectedPrice:p.price,pointsToUse});
        // Clear only after a confirmed response; transport failures retain the ref.
        sessionStorage.removeItem(key);
        return order;
      },openOrder:async id=>{location.hash='orders';await renderOrder(await apiOrder(id));}};
    document.addEventListener('click',e=>{const control=e.target.closest('[data-supplier-order]');if(control){location.hash='orders';run(control,async()=>{await renderOrder(await apiOrder(control.dataset.supplierOrder));});}});

    $('supplier-search')?.addEventListener('input',renderCatalog);$('supplier-refresh').addEventListener('click',e=>run(e.currentTarget,loadOrders));
    document.querySelector('.supplier-close').addEventListener('click',()=>$('supplier-detail').close());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)closeVaults();});window.addEventListener('pagehide',closeVaults);
    window.addEventListener('hashchange',()=>{closeVaults();if(location.hash==='#inventory')loadOrders();});
    window.olafSupabase?.auth.onAuthStateChange((event)=>{if(['SIGNED_OUT','SIGNED_IN'].includes(event)){epoch++;closeVaults();document.dispatchEvent(new CustomEvent('olaf:supplier-inventory',{detail:[]}));currentOrder=null;$('supplier-order').hidden=true;$('supplier-order').replaceChildren();$('supplier-orders').replaceChildren();if($('supplier-admin')){$('supplier-admin').hidden=true;$('supplier-admin').replaceChildren();}if(adminPage&&event==='SIGNED_OUT')document.querySelector('main').hidden=true;}});
    if(adminPage){try{const data=await api('catalog');products=data.products;checkoutEnabled=data.checkoutEnabled;renderCatalog();notice(checkoutEnabled?'สินค้าแสดงในหมวดเกมออฟไลน์หน้าร้านหลักแล้ว':'ยังไม่พร้อมรับคำสั่งซื้อ กรุณาตรวจ Environment / SQL');}catch{notice('ยังโหลดสินค้าไม่ได้');}}
    if(adminPage||location.pathname.endsWith('/profile.html'))await loadOrders();
    if(!adminPage)return;
    try{
      const state=await api('readiness'),admin=$('supplier-admin');admin.hidden=false;admin.replaceChildren(el('h2','สำหรับแอดมิน: ความพร้อมระบบ 499K'));
      admin.append(el('p',`ฐานข้อมูล: ${state.database.revision} · สินค้าเผยแพร่: ${state.database.visibleProducts} · ออเดอร์ต้องตรวจ: ${state.database.ordersNeedingReview}`));
      admin.append(el('p',`Live Key: ${state.liveKeyReady?'พร้อม':'ไม่พร้อม'} · คีย์เข้ารหัส: ${state.deliveryKeyReady?'พร้อม':'ไม่พร้อม'} · ซื้อจริง: ${state.purchaseEnabled?'เปิด':'ปิด'}`));
      admin.append(el('p',`สูตรราคา: ต้นทุน × 1.50 · ซิงก์ล่าสุด: ${state.database.lastPriceSync?new Date(state.database.lastPriceSync).toLocaleString('th-TH'):'ยังไม่มีผลซิงก์'}`));
      admin.append(button('ตรวจบัญชี / แคตตาล็อก / สินค้า (ไม่สั่งซื้อ)',async()=>{try{const data=await api('diagnose');notice(JSON.stringify(data,null,2));}catch(e){notice('ตรวจไม่ได้ ['+(e.code||'NETWORK')+']');}}));
      admin.append(button('ปิดแสดงสินค้า 499K ทั้งหมด',async()=>{
        if(!confirm('ซ่อนสินค้า 499K ทั้งหมดจากหน้าร้านหลัก? ไม่ลบสินค้าและไม่กระทบออเดอร์เดิม'))return;
        await api('hide',{confirmation:'HIDE_499K_PRODUCTS'});
        products=[];checkoutEnabled=false;renderCatalog();
        notice('ซ่อนสินค้า 499K แล้ว รีโหลดหน้าร้านหลักเพื่อดูผล ไม่กระทบสินค้าเดิมหรือบัญชีในออเดอร์ที่ซื้อแล้ว');
      }));
      const publish=button('เผยแพร่ Steam Offline (กำไร 50% ของต้นทุน)',async()=>{
        if(!confirm('ยืนยันเผยแพร่สินค้า 499K Steam Offline และตั้งราคากำไร 50% ของต้นทุน? ลูกค้าจะเริ่มสั่งซื้อได้ ไม่เปลี่ยนสินค้าเดิม'))return;
        const result=await api('publish',{confirmation:'PUBLISH_499K_OFFLINE'});notice(`เผยแพร่ ${result.published} รายการแล้ว`);
        const data=await api('catalog');products=data.products;checkoutEnabled=data.checkoutEnabled;renderCatalog();
      });publish.disabled=!(state.deliveryKeyReady&&state.liveKeyReady&&state.purchaseEnabled);admin.append(publish);
    }catch{/* Admin-only tools are not shown to customers or when runtime SQL is missing. */}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
