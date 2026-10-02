(() => {
  const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const money=n=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(n);
  const date=s=>new Date(s).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
  const errors={AUTH_REQUIRED:'กรุณาเข้าสู่ระบบผ่านหน้าบัญชีของฉันก่อน',RENTAL_DISABLED:'ร้านยังไม่เปิดระบบเช่า',INVALID_START_AT:'เลือกเวลาเริ่มทุกนาที 00 หรือ 30 ภายใน 7 วัน',
    SLOT_UNAVAILABLE:'ช่วงเวลานี้ถูกจองแล้ว กรุณาโหลดคิวใหม่และเลือกอีกครั้ง',DURATION_UNAVAILABLE:'ไอดีนี้ไม่มีระยะเวลาเช่าที่เลือก',SUPPLIER_PRICE_CHANGED:'ราคา/ไอดีว่างเปลี่ยนแล้ว กรุณาตรวจราคาใหม่',
    RENEW_WINDOW_CLOSED:'ต่ออายุได้เฉพาะช่วงที่ยังเช่าอยู่',RENTAL_RENEWAL_BUSY:'มีออเดอร์ต่ออายุที่ยังไม่เสร็จ กรุณาดูออเดอร์เดิมก่อน',
    RENTAL_NOT_ACTIVE:'ยังไม่ถึงเวลาเช่าหรือสิทธิ์สิ้นสุดแล้ว',RENTAL_NOT_STARTED:'ยังไม่ถึงเวลาเช่า',RENTAL_EXPIRED:'หมดเวลาเช่าแล้ว',
    ACTIVATION_BUSY:'กำลังเปิดใช้งาน กรุณารอตามเวลาที่แจ้งแล้วกดใหม่',ACTIVATION_FAILED:'เปิดใช้งานไม่สำเร็จ ลองใหม่ภายหลัง หรือกดดูข้อมูลเข้าเกมเพื่อล็อกอินเอง',
    SUPPLIER_MANUAL_REVIEW_REQUIRED:'ยังยืนยันผลการจองไม่ได้ กรุณาติดต่อร้าน ห้ามโอนซ้ำ',RENTAL_RESULT_UNKNOWN:'ยังยืนยันผลไม่ได้ กรุณาโหลดออเดอร์ก่อนลองใหม่',
    SUPPLIER_MIGRATION_REQUIRED:'ระบบฐานข้อมูลเช่ายังไม่พร้อม กรุณาติดต่อร้าน',RATE_LIMITED:'เรียกข้อมูลถี่เกินไป กรุณารอ',SUPPLIER_RATE_LIMITED:'คำขอมาก กรุณารอ',
    INVALID_CHECKOUT:'ข้อมูลคำสั่งเช่าไม่ถูกต้อง กรุณาโหลดคิวและตรวจราคาใหม่',RENTAL_DATABASE_VALIDATION_FAILED:'ฐานข้อมูลปฏิเสธคำสั่งเช่า กรุณาให้แอดมินตรวจสูตรราคาเช่า v73 (+20 บาท) ยังไม่ได้สร้างออเดอร์',
    SESSION_CHANGED:'บัญชีที่เข้าสู่ระบบเปลี่ยน กรุณาโหลดใหม่',AUTH_TIMEOUT:'ระบบสมาชิกตอบกลับช้า กรุณาลองอีกครั้งหรือเข้าสู่ระบบใหม่',
    BROWSER_STORAGE_UNAVAILABLE:'พื้นที่บันทึกในเบราว์เซอร์ไม่พร้อม จึงยังไม่ได้สร้างออเดอร์ กรุณาเปิดเว็บในแท็บใหม่',
    NETWORK_ERROR:'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่โดยไม่โอนซ้ำ',PAYMENT_UI_UNAVAILABLE:'สร้างออเดอร์แล้ว แต่เปิดหน้าชำระไม่ได้ กรุณาเปิดออเดอร์เดิมจากลิงก์ด้านล่าง'};
  let epoch=0,secretEpoch=0,secretTimer=null,codeTimer=null,detailEpoch=0,orderEpoch=0,authIdentity;
  const notice=message=>{const target=$('rental-dialog').open?document.querySelector('#rental-detail [role=status]'):(document.querySelector('.rental-inline-status')||$('rental-notice'));if(target)target.textContent=message;};
  async function run(button,task){button.disabled=true;try{await task();}catch(e){notice((errors[e.code]||'ทำรายการไม่สำเร็จ กรุณาลองโหลดสถานะใหม่')+(e.code?` [${e.code}]`:'')+(e.retryAfter?` รอ ${e.retryAfter} วินาที`:''));
      if(e.retryAfter){button.dataset.locked='true';setTimeout(()=>{delete button.dataset.locked;if(button.isConnected)button.disabled=false;},e.retryAfter*1000);return;}
    }finally{if(button.isConnected&&!button.dataset.locked){if(button.syncDisabled)button.syncDisabled();else button.disabled=false;}}}
  const button=(text,task,primary=false)=>{const b=el('button',text);b.type='button';if(primary)b.className='primary';b.addEventListener('click',()=>run(b,()=>task(b)));return b;};
  async function session(){let timer;try{const {data,error}=await Promise.race([window.olafSupabase.auth.getSession(),new Promise((_,reject)=>{timer=setTimeout(()=>reject({code:'AUTH_TIMEOUT'}),12000);})]);if(error||!data?.session)throw {code:'AUTH_REQUIRED'};if(authIdentity===undefined)authIdentity=data.session.user.id;return data.session;}finally{clearTimeout(timer);}}
  async function api(action,body,query={}){
    const version=epoch,headers={Accept:'application/json'};
    if(!['catalog','product'].includes(action)){const s=await session();headers.Authorization=`Bearer ${s.access_token}`;}
    if(body!==undefined)headers['Content-Type']='application/json';
    const response=await fetch('/api/admin-supplier?'+new URLSearchParams({action:`rent-${action}`,...query}),{
      method:body===undefined?'GET':'POST',headers,cache:'no-store',signal:AbortSignal.timeout(45000),...(body!==undefined?{body:JSON.stringify(body)}:{})});
    let result;try{result=await response.json();}catch{throw {code:'NETWORK_ERROR'};}if(version!==epoch)throw {code:'SESSION_CHANGED'};
    if(!response.ok||!result.success)throw {code:result.code,retryAfter:Math.min(3600,Number(response.headers.get('Retry-After'))||0)};
    return result.data;
  }
  function clearSecrets(){secretEpoch++;clearTimeout(secretTimer);clearTimeout(codeTimer);document.querySelectorAll('[data-rental-secret]').forEach(n=>n.remove());}
  function secretBox(text,parent){const n=el('pre',text);n.className='rental-secret';n.dataset.rentalSecret='';parent.append(n);return n;}
  async function openBooking(product,parentOrder=null,inline=false){
    const current=++detailEpoch;await session();const data=await api('availability',undefined,{productId:product.id});if(current!==detailEpoch)return;
    const box=inline?$('rental-booking'):$('rental-detail');if(!box)return;box.replaceChildren();box.append(el('h2',parentOrder?'ต่ออายุ '+product.name:'เลือกแพ็กเกจเช่า'));box.firstChild.id=inline?'rental-booking-title':'rental-title';
    const status=el('p');status.setAttribute('role','status');if(inline)status.className='rental-inline-status';box.append(status);
    box.append(el('p',parentOrder?'ต่อจากเวลาสิ้นสุดเดิม ต้องชำระก่อนหมดเวลาเช่า':'เวลาไทย UTC+7 • คิวว่างอาจเปลี่ยนก่อนชำระสำเร็จ'));
    const form=el('div');form.className='rental-fields';
    const field=(text,input)=>{const label=el('label',text);label.append(input);form.append(label);return input;};
    const start=field('เริ่มเช่า (เวลาไทย)',el('input'));start.type='datetime-local';start.step='1800';
    const initial=parentOrder?Date.parse(parentOrder.endAt):Math.floor(Date.now()/1800000)*1800000;
    start.value=new Date(initial+7*3600000).toISOString().slice(0,16);start.disabled=Boolean(parentOrder);
    const days=field('ระยะเวลาเช่า',el('select'));
    const durations=[...new Set(data.accounts.flatMap(a=>Object.keys(a.rates)))].map(Number).sort((a,b)=>a-b);
    for(const d of durations){const option=el('option',`${d} วัน`);option.value=d;days.append(option);}
    const account=field('ไอดีที่ต้องการ',el('select'));const auto=el('option','เลือกไอดีที่ว่างและราคาถูกที่สุด');auto.value='';account.append(auto);
    for(const a of data.accounts){const option=el('option',`ไอดี #${a.account_id}`);option.value=a.account_id;account.append(option);}account.disabled=Boolean(parentOrder);
    const payment=field('ช่องทางชำระเงิน',el('select'));
    for(const [value,text] of [['promptpay','PromptPay'],['wallet','TrueMoney Wallet']]){const o=el('option',text);o.value=value;payment.append(o);}
    const availability=el('details'),summary=el('summary','ดูราคาและช่วงเวลาที่ถูกจอง (รวมเวลาพักแล้ว)');availability.append(summary);
    for(const a of data.accounts){availability.append(el('p',`ไอดี #${a.account_id} · `+Object.entries(a.rates).map(([d,r])=>`${d} วัน ${money(r.price)}`).join(' / ')));
      for(const busy of a.busy)availability.append(el('p',`${date(busy.from)} – ${date(busy.to)}`));}
    form.append(availability);box.append(form);
    const result=el('div');box.append(result);let quote=null,checkoutBusy=false;
    const consent=el('label');consent.className='rental-consent';const check=el('input');check.type='checkbox';
    consent.append(check,el('span','ฉันเข้าใจว่าเป็นการเช่าตามเวลา ไม่ใช่ซื้อขาด และหากคิวถูกจองตัดหน้าหลังชำระเงิน ต้องติดต่อร้านตรวจสอบออเดอร์ก่อนโอนเพิ่ม'));
    const buy=button('ยืนยันและไปชำระเงิน',async()=>{
      if(!quote||!check.checked||checkoutBusy){status.textContent='กรุณาตรวจคิวและราคา แล้วติ๊กยอมรับเงื่อนไขก่อน';return;}
      const confirmedQuote=quote,paymentMethod=payment.value;checkoutBusy=true;buy.textContent='กำลังสร้างออเดอร์…';buy.setAttribute('aria-busy','true');status.textContent='กำลังสร้างออเดอร์และเปิดหน้าชำระเงิน กรุณารอ ไม่ต้องกดซ้ำ';
      const controls=[start,days,account,payment,check,...box.querySelectorAll('button')].filter(c=>c!==buy),previousDisabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
      try{
        const s=await session();if(current!==detailEpoch)throw {code:'SESSION_CHANGED'};
        const requestKey=`rental-request:${s.user.id}:${JSON.stringify(confirmedQuote)}:${paymentMethod}`;
        let requestId;try{requestId=sessionStorage.getItem(requestKey);if(!requestId){requestId=crypto.randomUUID();sessionStorage.setItem(requestKey,requestId);}}catch{throw {code:'BROWSER_STORAGE_UNAVAILABLE'};}
        const order=await api('checkout',{...confirmedQuote,requestId,paymentMethod,expectedPrice:confirmedQuote.price});
        // Keep the idempotency key if the QR adapter fails, so retry returns this order.
        let recovery=box.querySelector('[data-rental-checkout-order]');if(!recovery){recovery=el('a','เปิดออเดอร์เดิม / ไปหน้าชำระเงิน');recovery.dataset.rentalCheckoutOrder='';recovery.className='secondary-button';box.append(recovery);}recovery.href='rental-order.html?order='+encodeURIComponent(order.id);
        if(order.paymentStatus==='verified'){location.href=recovery.href;return;}
        status.textContent='สร้างออเดอร์แล้ว กำลังเปิด QR หากไม่ขึ้นให้เปิดออเดอร์เดิมด้านล่าง';
        if(typeof window.OlafRentalPayment?.open!=='function')throw {code:'PAYMENT_UI_UNAVAILABLE'};
        if($('rental-dialog').open)$('rental-dialog').close();await window.OlafRentalPayment.open(order,product);
      }finally{checkoutBusy=false;buy.textContent='ยืนยันและไปชำระเงิน';buy.removeAttribute('aria-busy');controls.forEach((c,i)=>c.disabled=previousDisabled[i]);}
    },true);buy.disabled=true;
    const syncBuy=()=>buy.disabled=checkoutBusy||!quote||!check.checked;buy.syncDisabled=syncBuy;
    const invalidate=()=>{quote=null;result.replaceChildren();syncBuy();check.checked=false;status.textContent='เลือกแพ็กเกจแล้วกดตรวจคิวและราคาอีกครั้ง';};
    for(const input of [start,days,account,payment])input.addEventListener('change',invalidate);
    check.addEventListener('change',()=>{syncBuy();status.textContent=quote?(check.checked?'พร้อมชำระเงิน กดยืนยันและไปชำระเงินได้เลย':'ตรวจราคาแล้ว กรุณาติ๊กยอมรับเงื่อนไขก่อนชำระ'):'กรุณากดตรวจคิวและราคาก่อน';});
    box.append(button('ตรวจคิวและราคา',async()=>{
      invalidate();const input={productId:product.id,durationDays:Number(days.value),startAt:new Date(start.value+':00+07:00').toISOString(),accountId:account.value?Number(account.value):null,
        ...(parentOrder?{parentOrderId:parentOrder.id}:{})};
      const requestVersion=JSON.stringify(input);
      const q=await api('quote',input);
      const latest={...input,durationDays:Number(days.value),startAt:new Date(start.value+':00+07:00').toISOString(),accountId:account.value?Number(account.value):null};
      if(current!==detailEpoch||JSON.stringify(latest)!==requestVersion)return;
      quote=q;status.textContent='ตรวจราคาแล้ว กรุณาติ๊กยอมรับเงื่อนไขก่อนชำระ';result.className='rental-summary';result.replaceChildren(el('strong',`ยอดชำระ ${money(q.price)} · ${q.durationDays} วัน`),el('p',`${date(q.startAt)} – ${date(q.endAt)} · ไอดี #${q.accountId}`));syncBuy();
    }),consent,status,buy,button('โหลดคิวล่าสุด',()=>openBooking(product,parentOrder,inline)));
    if(!inline)$('rental-dialog').showModal();
  }
  async function refreshOrder(id){await renderOrder(await api('order',undefined,{orderId:id}));}
  async function renderOrder(order){
    clearSecrets();const version=++orderEpoch;const box=$('rental-order');box.hidden=false;box.replaceChildren(el('h2',order.name),el('p',`${order.orderNumber} · ${money(order.total)}`),el('p',`${date(order.startAt)} – ${date(order.endAt)}`));
    box.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'',`rental-order.html?order=${encodeURIComponent(order.id)}`);
    const actions=el('div');actions.className='rental-actions';actions.append(button('โหลดสถานะใหม่',()=>refreshOrder(order.id)));box.append(actions);
    if(order.kind==='renewal'&&order.parentOrderId)actions.append(button('เปิดออเดอร์เช่าหลัก',()=>refreshOrder(order.parentOrderId)));
    if(['awaiting_payment','waiting_admin'].includes(order.status)&&order.paymentStatus!=='verified'){
      if(Date.parse(order.expiresAt)<=Date.now())box.append(el('p','หมดเวลาชำระแล้ว ห้ามโอน กรุณาติดต่อร้านหากโอนแล้ว'));
      else actions.append(button('เปิดหน้าชำระเงิน / แนบสลิป',()=>window.OlafRentalPayment.open(order),true));
    }
    if(order.paymentStatus==='verified'&&order.state==='pending')actions.append(button('ดำเนินการจองหลังชำระ',async()=>{await api('fulfill',{orderId:order.id});await refreshOrder(order.id);}));
    if(order.needsSupport)box.append(el('p','ชำระเงินแล้ว แต่ยังยืนยันการจอง/ต่ออายุไม่ได้ กรุณาติดต่อร้านพร้อมหมายเลขออเดอร์ ห้ามโอนซ้ำ'));
    if(order.state==='reserved')box.append(el('p',order.canPlay?'อยู่ในช่วงเช่า กดเปิดใช้งานเมื่อพร้อมเล่น':Date.now()<Date.parse(order.startAt)?'จองสำเร็จ รอถึงเวลาเริ่มเช่าแล้วโหลดสถานะใหม่':'ต่ออายุสำเร็จ หรือสิ้นสุดช่วงเวลาเช่าแล้ว'));
    if(order.canPlay){
      const reveal=async(action)=>{clearSecrets();const token=secretEpoch;const result=await api(action,{orderId:order.id});
        if(token!==secretEpoch||document.hidden||version!==orderEpoch||Date.now()>=Date.parse(result.endAt))return;
        secretBox(`Steam ID: ${result.account.username}\nPassword: ${result.account.password}`,box);
        secretTimer=setTimeout(clearSecrets,Math.max(0,Math.min(Date.parse(result.endAt)-Date.now(),300000)));};
      actions.append(button('เปิดใช้งานเมื่อพร้อมเล่น',()=>reveal('activate'),true),button('ดูข้อมูลเข้าเกม',()=>reveal('delivery')),
        button('ขอ Steam Guard',async()=>{const token=secretEpoch;const result=await api('guard',{orderId:order.id});if(token!==secretEpoch||document.hidden||version!==orderEpoch)return;
          clearTimeout(codeTimer);document.querySelector('[data-rental-code]')?.remove();const code=secretBox(result.code,box);code.dataset.rentalCode='';codeTimer=setTimeout(()=>code.remove(),Math.min(result.validForSeconds*1000,Math.max(0,Date.parse(order.endAt)-Date.now())));}),
        button('ต่ออายุ',()=>openBooking({id:order.productId,name:order.name},order)));
    }
  }
  window.OlafRental={api,openBooking,notice,refreshOrder,session,clearSecrets};
  document.addEventListener('DOMContentLoaded',async()=>{
    $('rental-close').onclick=()=>{$('rental-dialog').close();detailEpoch++;};
    $('rental-dialog').addEventListener('close',()=>detailEpoch++);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clearSecrets();});window.addEventListener('pagehide',clearSecrets);
    window.olafSupabase?.auth.onAuthStateChange((event,authSession)=>{
      const nextIdentity=authSession?.user?.id||null;
      if(event==='INITIAL_SESSION'){if(authIdentity===undefined)authIdentity=nextIdentity;return;}
      if(!['SIGNED_IN','SIGNED_OUT'].includes(event))return;
      // Supabase also emits SIGNED_IN on tab focus/session recovery for the same user.
      // Only an actual identity change should invalidate checkout and close its QR.
      if(event==='SIGNED_IN'&&(authIdentity===undefined||authIdentity===nextIdentity)){authIdentity=nextIdentity;return;}
      authIdentity=nextIdentity;
      epoch++;clearSecrets();orderEpoch++;detailEpoch++;$('rental-dialog').close();
      if($('rental-order')){$('rental-order').hidden=true;$('rental-order').replaceChildren();}
      window.OlafRentalPayment?.reset();window.dispatchEvent(new Event('olaf:rental-auth'));
    });
    const id=new URLSearchParams(location.search).get('order');
    if(id&&document.body.dataset.rentalPage!=='order'){location.replace('rental-order.html?order='+encodeURIComponent(id));return;}
    if(document.body.dataset.rentalPage==='order'){
      if(!id){notice('กรุณาเลือกออเดอร์เช่าจากบัญชีของฉัน');return;}
      try{await refreshOrder(id);}catch(e){notice(errors[e.code]||'โหลดออเดอร์ไม่ได้');}
    }
  });
})();
