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
    POINT_BALANCE_INSUFFICIENT:'พอยต์ไม่พอหรือยอดเปลี่ยนแล้ว กรุณาตรวจยอดใหม่',
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
  async function checkoutOptions(quote,product){
    const version=epoch;let balance=0,balanceLoaded=false;
    let balanceTimer;
    try{const wallet=await Promise.race([window.OlafOrders.fetchPointBalance(),new Promise((_,reject)=>{balanceTimer=setTimeout(()=>reject(new Error('POINT_TIMEOUT')),12000);})]);balance=Math.max(0,Number(wallet.balance)||0);balanceLoaded=true;}catch{}finally{clearTimeout(balanceTimer);}
    if(version!==epoch)throw {code:'SESSION_CHANGED'};
    return new Promise(resolve=>{
      const dialog=el('dialog');dialog.className='rental-booking-dialog rental-checkout-dialog';dialog.setAttribute('aria-labelledby','rental-checkout-heading');
      const heading=el('h2','ยืนยันการสั่งซื้อ'),summary=el('div');summary.className='rental-summary';
      heading.id='rental-checkout-heading';
      summary.append(el('strong',product.name),el('p',`${quote.durationDays} วัน · ${date(quote.startAt)}`));
      const methods=el('div');methods.className='rental-payment-choices';
      const radios=[];
      for(const [value,label] of [['promptpay','PromptPay'],['wallet','TrueMoney Wallet']]){
        const row=el('label'),radio=el('input');radio.type='radio';radio.name='rental-payment';radio.value=value;radio.checked=value==='promptpay';
        row.append(radio,el('span',label));methods.append(row);radios.push(radio);
      }
      const points=el('label');points.className='rental-points-choice';const use=el('input');use.type='checkbox';use.disabled=!balanceLoaded||!balance;
      points.append(use,el('span',balanceLoaded?`ใช้ Point ชำระ · คงเหลือ ${money(balance)}`:'โหลด Point ไม่สำเร็จ ใช้ช่องทางชำระอื่นได้'));
      const total=el('strong');total.className='rental-checkout-total';
      const update=()=>{const discount=use.checked?Math.min(balance,quote.price):0;total.textContent=`ยอดชำระ ${money(Math.round((quote.price-discount)*100)/100)}`;methods.hidden=discount===quote.price;};use.onchange=update;update();
      const actions=el('div');actions.className='rental-actions';let settled=false;
      const finish=value=>{if(settled)return;settled=true;dialog.close();dialog.remove();resolve(value);};
      actions.append(button('ย้อนกลับ',()=>finish(null)),button('ยืนยันชำระเงิน',()=>finish({paymentMethod:radios.find(r=>r.checked).value,pointsToUse:use.checked?Math.round(Math.min(balance,quote.price)*100)/100:0}),true));
      dialog.append(heading,summary,el('h3','ช่องทางชำระเงิน'),methods,points,total,actions);
      dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});dialog.addEventListener('close',()=>finish(null));
      document.body.append(dialog);dialog.showModal();
    });
  }
  async function openBooking(product,parentOrder=null,inline=false,draft=null){
    const current=++detailEpoch;await session();const data=await api('availability',undefined,{productId:product.id});if(current!==detailEpoch)return;
    const box=inline?$('rental-booking'):$('rental-detail');if(!box)return;box.replaceChildren();box.append(el('h2',parentOrder?'ต่ออายุ '+product.name:'เลือกแพ็กเกจเช่า'));box.firstChild.id=inline?'rental-booking-title':'rental-title';
    const status=el('p');status.setAttribute('role','status');if(inline)status.className='rental-inline-status';box.append(status);
    if(!data.accounts.some(a=>Object.keys(a.rates||{}).length)){
      const empty=el('div');empty.className='rental-booking-empty';empty.append(el('h3','ยังไม่มีแพ็กเกจเช่าพร้อมขาย'),el('p','กรุณาลองโหลดคิวใหม่ หรือเลือกเกมเช่าอื่น ยังไม่ได้สร้างออเดอร์หรือหัก Point'));
      box.append(empty,button('โหลดคิวล่าสุด',()=>openBooking(product,parentOrder,inline,draft)));
      if(!inline)$('rental-dialog').showModal();return;
    }
    const intro=el('p',parentOrder?'ต่อจากเวลาสิ้นสุดเดิม ต้องชำระก่อนหมดเวลาเช่า':'เลือกเวลา แพ็กเกจ และไอดี แล้วตรวจราคาเพื่อชำระ');intro.className='rental-booking-intro';box.append(intro);
    const form=el('div');form.className='rental-fields';
    const field=(text,input)=>{const label=el('label');label.append(el('span',text),input);form.append(label);return input;};
    const start=field('เริ่มเช่า (เวลาไทย)',el('input'));start.type='datetime-local';start.step='1800';
    const initial=parentOrder?Date.parse(parentOrder.endAt):Math.floor(Date.now()/1800000)*1800000;
    const localInput=value=>new Date(value+7*3600000).toISOString().slice(0,16);
    start.value=parentOrder?localInput(initial):(draft?.start||localInput(initial));start.disabled=Boolean(parentOrder);start.required=true;
    start.min=localInput(Math.floor(Date.now()/1800000)*1800000);start.max=localInput(Math.min(Date.now()+7*86400000,Date.parse(data.bookable_until)||Infinity));
    start.parentElement.classList.add('rental-start-field');
    const timeNote=el('small','เวลาไทย UTC+7 · เริ่มนาที 00 / 30 · จองล่วงหน้าไม่เกิน 7 วัน');timeNote.className='rental-time-note';form.append(timeNote);
    if(!parentOrder){const quick=el('div');quick.className='rental-time-quick';for(const [offset,text] of [[0,'เช่าตอนนี้'],[1,'บล็อกถัดไป']])quick.append(button(text,()=>{start.value=localInput((Math.floor(Date.now()/1800000)+offset)*1800000);start.dispatchEvent(new Event('change'));}));form.append(quick);}
    const days=field('ระยะเวลาเช่า',el('select'));
    const durations=[...new Set(data.accounts.flatMap(a=>Object.keys(a.rates)))].map(Number).sort((a,b)=>a-b);
    for(const d of durations){const option=el('option',`${d} วัน`);option.value=d;days.append(option);}
    if(draft?.days&&durations.includes(Number(draft.days)))days.value=draft.days;
    const account=field('ไอดีที่ต้องการ',el('select'));const auto=el('option','เลือกไอดีที่ว่างและราคาถูกที่สุด');auto.value='';account.append(auto);
    for(const a of data.accounts){const option=el('option',`ไอดี #${a.account_id}`);option.value=a.account_id;account.append(option);}account.disabled=Boolean(parentOrder);
    if(!parentOrder&&data.accounts.some(a=>String(a.account_id)===draft?.account))account.value=draft.account;
    // Payment choices live in the confirmation dialog, not in the rental package form.
    const payment=el('input');payment.type='hidden';payment.value='promptpay';
    days.parentElement.classList.add('rental-native-field');account.parentElement.classList.add('rental-native-field');
    const packages=el('div'),accounts=el('div');packages.className='rental-package-grid';accounts.className='rental-account-grid';
    packages.setAttribute('aria-label','แพ็กเกจเช่า');accounts.setAttribute('aria-label','ไอดีที่ว่างสำหรับช่วงเวลาที่เลือก');
    const accountHeading=el('div');accountHeading.className='rental-choice-heading';const count=el('span');count.className='rental-availability-count';count.setAttribute('aria-live','polite');accountHeading.append(el('h3','เลือกไอดีและคิวว่าง'),count);
    const more=button('',()=>{expanded=!expanded;renderChoices();});more.className='rental-account-more';
    const estimate=el('div');estimate.className='rental-estimate';estimate.setAttribute('aria-live','polite');
    form.append(el('h3','เลือกแพ็กเกจ'),packages,accountHeading,accounts,more,estimate);
    let expanded=false;
    function slots(){
      const from=Date.parse(start.value+':00+07:00'),to=from+Number(days.value)*86400000;
      const validStart=Number.isFinite(from)&&from%1800000===0&&from>=Math.floor(Date.now()/1800000)*1800000&&from<=Date.now()+7*86400000
        &&(!data.bookable_from||from>=Date.parse(data.bookable_from))&&(!data.bookable_until||from<=Date.parse(data.bookable_until));
      return data.accounts.map(a=>({a,available:Boolean(validStart&&a.rates[days.value]?.price>0&&!a.busy.some(b=>from<Date.parse(b.to)&&to>Date.parse(b.from)))}));
    }
    function renderChoices(){
      packages.replaceChildren();accounts.replaceChildren();
      for(const d of durations){const prices=data.accounts.filter(a=>!account.value||String(a.account_id)===account.value).map(a=>a.rates[d]?.price).filter(p=>p>0);
        const b=button('',()=>{days.value=String(d);days.dispatchEvent(new Event('change'));packages.querySelector('[data-duration="'+d+'"]')?.focus({preventScroll:true});});
        b.className='rental-package-choice';b.setAttribute('aria-pressed',String(Number(days.value)===d));b.disabled=checkoutBusy||!prices.length;
        b.dataset.duration=d;
        b.append(el('strong',d+' วัน'),el('span',prices.length?'เริ่ม '+money(Math.min(...prices)):'ไม่มีแพ็กเกจ'));packages.append(b);
      }
      const rows=slots().sort((x,y)=>Number(y.available)-Number(x.available)||(x.a.rates[days.value]?.price||Infinity)-(y.a.rates[days.value]?.price||Infinity)||x.a.account_id-y.a.account_id);
      const free=rows.filter(r=>r.available);count.textContent=`${free.length} ไอดีว่าง / ${rows.length} ไอดี`;
      if(!parentOrder){const b=button('',()=>{account.value='';account.dispatchEvent(new Event('change'));accounts.querySelector('.rental-account-auto')?.focus({preventScroll:true});});b.className='rental-account-choice rental-account-auto';b.setAttribute('aria-pressed',String(!account.value));b.disabled=checkoutBusy||!free.length;b.append(el('strong','ให้ระบบเลือกไอดี'),el('span','เลือกไอดีว่างราคาถูกที่สุดสำหรับช่วงเวลานี้'));accounts.append(b);}
      let shown=expanded?rows:rows.slice(0,4);
      const selected=rows.find(r=>String(r.a.account_id)===account.value);if(selected&&!shown.includes(selected))shown=[...shown.slice(0,3),selected];
      for(const {a,available} of shown){
        const b=button('',()=>{account.value=String(a.account_id);account.dispatchEvent(new Event('change'));accounts.querySelector('[data-account-id="'+a.account_id+'"]')?.focus({preventScroll:true});});b.className='rental-account-choice';b.setAttribute('aria-pressed',String(account.value===String(a.account_id)));b.disabled=checkoutBusy||!available||Boolean(parentOrder);
        b.dataset.accountId=a.account_id;b.dataset.available=String(Boolean(available));
        const name=el('strong','Steam ID #'+a.account_id),badge=el('span',available?'ว่าง':'ไม่ว่าง');badge.className='rental-slot-badge';b.append(name,badge,el('span',available?money(a.rates[days.value].price)+' / '+days.value+' วัน':a.rates[days.value]?'คิวชนกับช่วงที่เลือก':'ไม่มีแพ็กเกจนี้'));
        if(!available&&a.busy.length)b.append(el('small','มีคิว '+date(a.busy[0].from)));accounts.append(b);
      }
      more.hidden=rows.length<=4;more.textContent=expanded?'แสดงไอดีน้อยลง':`ดูไอดีทั้งหมด (${rows.length})`;more.disabled=checkoutBusy;
      const chosen=free.find(r=>String(r.a.account_id)===account.value)||(!account.value?free[0]:null);
      estimate.replaceChildren(el('span',chosen?'ราคาแพ็กเกจที่เลือก':'ยังไม่มีไอดีว่างสำหรับตัวเลือกนี้'),el('strong',chosen?money(chosen.a.rates[days.value].price):'เลือกช่วงเวลาอื่น'),el('small','ราคายืนยันหลังตรวจคิว · หัก Point ได้ในขั้นตอนชำระเงิน'));
    }
    const availability=el('details'),summary=el('summary','ดูราคาและช่วงเวลาที่ถูกจอง (รวมเวลาพักแล้ว)');availability.append(summary);
    for(const a of data.accounts){availability.append(el('p',`ไอดี #${a.account_id} · `+Object.entries(a.rates).map(([d,r])=>`${d} วัน ${money(r.price)}`).join(' / ')));
      for(const busy of a.busy)availability.append(el('p',`${date(busy.from)} – ${date(busy.to)}`));}
    form.append(availability);box.append(form);
    const result=el('div');box.append(result);let quote=null,checkoutBusy=false;
    const consent=el('label');consent.className='rental-consent';const check=el('input');check.type='checkbox';
    consent.append(check,el('span','ฉันเข้าใจว่าเป็นการเช่าตามเวลา ไม่ใช่ซื้อขาด และหากคิวถูกจองตัดหน้าหลังชำระเงิน ต้องติดต่อร้านตรวจสอบออเดอร์ก่อนโอนเพิ่ม'));
    const buy=button('ยืนยันและไปชำระเงิน',async()=>{
      if(!quote||!check.checked||checkoutBusy){status.textContent='กรุณาตรวจคิวและราคา แล้วติ๊กยอมรับเงื่อนไขก่อน';return;}
      const confirmedQuote=quote;checkoutBusy=true;buy.textContent='กำลังเปิดหน้าชำระเงิน…';buy.setAttribute('aria-busy','true');
      const controls=[start,days,account,payment,check,...box.querySelectorAll('button')].filter(c=>c!==buy),previousDisabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
      try{
        const choices=await checkoutOptions(confirmedQuote,product);if(!choices)return;
        const {paymentMethod,pointsToUse}=choices;buy.textContent='กำลังสร้างออเดอร์…';status.textContent='กำลังสร้างออเดอร์ กรุณารอ ไม่ต้องกดซ้ำ';
        const s=await session();if(current!==detailEpoch)throw {code:'SESSION_CHANGED'};
        const requestKey=`rental-request:${s.user.id}:${JSON.stringify(confirmedQuote)}:${paymentMethod}:${pointsToUse}`;
        let requestId;try{requestId=sessionStorage.getItem(requestKey);if(!requestId){requestId=crypto.randomUUID();sessionStorage.setItem(requestKey,requestId);}}catch{throw {code:'BROWSER_STORAGE_UNAVAILABLE'};}
        const order=await api('checkout',{...confirmedQuote,requestId,paymentMethod,pointsToUse,expectedPrice:confirmedQuote.price});
        // Keep the idempotency key if the QR adapter fails, so retry returns this order.
        let recovery=box.querySelector('[data-rental-checkout-order]');if(!recovery){recovery=el('a','เปิดออเดอร์เดิม / ไปหน้าชำระเงิน');recovery.dataset.rentalCheckoutOrder='';recovery.className='secondary-button';box.append(recovery);}recovery.href='rental-order.html?order='+encodeURIComponent(order.id);
        if(order.paymentStatus==='verified'){if(order.state==='pending')try{await api('fulfill',{orderId:order.id});}catch{}location.href=recovery.href;return;}
        status.textContent='สร้างออเดอร์แล้ว กำลังเปิด QR หากไม่ขึ้นให้เปิดออเดอร์เดิมด้านล่าง';
        if(typeof window.OlafRentalPayment?.open!=='function')throw {code:'PAYMENT_UI_UNAVAILABLE'};
        if($('rental-dialog').open)$('rental-dialog').close();await window.OlafRentalPayment.open(order,product);
      }finally{checkoutBusy=false;buy.textContent='ยืนยันและไปชำระเงิน';buy.removeAttribute('aria-busy');controls.forEach((c,i)=>c.disabled=previousDisabled[i]);}
    },true);buy.disabled=true;
    const syncBuy=()=>buy.disabled=checkoutBusy||!quote||!check.checked;buy.syncDisabled=syncBuy;
    const invalidate=()=>{quote=null;result.replaceChildren();result.className='';syncBuy();check.checked=false;status.textContent='เลือกแพ็กเกจแล้วกดตรวจคิวและราคาอีกครั้ง';};
    for(const input of [start,days,account])input.addEventListener('change',()=>{invalidate();renderChoices();});
    renderChoices();
    check.addEventListener('change',()=>{syncBuy();status.textContent=quote?(check.checked?'พร้อมชำระเงิน กดยืนยันและไปชำระเงินได้เลย':'ตรวจราคาแล้ว กรุณาติ๊กยอมรับเงื่อนไขก่อนชำระ'):'กรุณากดตรวจคิวและราคาก่อน';});
    box.append(button('ตรวจคิวและราคา',async b=>{
      invalidate();b.textContent='กำลังตรวจคิวและราคา…';b.setAttribute('aria-busy','true');status.textContent='กำลังตรวจคิวว่างและราคาล่าสุด กรุณารอ';
      try{
      const selectedTime=Date.parse(start.value+':00+07:00');if(!Number.isFinite(selectedTime)||selectedTime%1800000!==0)throw {code:'INVALID_START_AT'};
      const input={productId:product.id,durationDays:Number(days.value),startAt:new Date(selectedTime).toISOString(),accountId:account.value?Number(account.value):null,
        ...(parentOrder?{parentOrderId:parentOrder.id}:{})};
      const requestVersion=JSON.stringify(input);
      const q=await api('quote',input);
      const latestTime=Date.parse(start.value+':00+07:00');if(current!==detailEpoch||!Number.isFinite(latestTime))return;
      const latest={...input,durationDays:Number(days.value),startAt:new Date(latestTime).toISOString(),accountId:account.value?Number(account.value):null};
      if(current!==detailEpoch||JSON.stringify(latest)!==requestVersion)return;
      quote=q;status.textContent='ตรวจราคาแล้ว กรุณาติ๊กยอมรับเงื่อนไขก่อนชำระ';result.className='rental-summary';result.replaceChildren(el('strong',`ยอดชำระ ${money(q.price)} · ${q.durationDays} วัน`),el('p',`${date(q.startAt)} – ${date(q.endAt)} · ไอดี #${q.accountId}`));syncBuy();
      }finally{b.textContent='ตรวจคิวและราคา';b.removeAttribute('aria-busy');}
    }),consent,status,buy,button('โหลดคิวล่าสุด',()=>openBooking(product,parentOrder,inline,{start:start.value,days:days.value,account:account.value})));
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
      const delivery=el('section');delivery.className='rental-access-card';delivery.append(el('h3','ไอดี Steam ของคุณ'),el('p','เปิดใช้งานเมื่อพร้อมเล่น หรือดูข้อมูลเพื่อล็อกอินเอง สิทธิ์ใช้ได้เฉพาะช่วงเวลาเช่า'));
      const deliveryActions=el('div');deliveryActions.className='rental-actions';delivery.append(deliveryActions);box.append(delivery);
      const guard=el('section');guard.className='rental-access-card rental-guard-card';guard.append(el('h3','Steam Guard'),el('p','ขอโค้ดได้ไม่จำกัดระหว่างเช่า โค้ดจะซ่อนอัตโนมัติเมื่อหมดอายุ'));box.append(guard);
      const reveal=async(action)=>{clearSecrets();const token=secretEpoch;const result=await api(action,{orderId:order.id});
        if(token!==secretEpoch||document.hidden||version!==orderEpoch||Date.now()>=Date.parse(result.endAt))return;
        const credentials=el('div');credentials.dataset.rentalSecret='';credentials.className='rental-credential-grid';
        for(const [label,value] of [['Steam ID',result.account.username],['Password',result.account.password]]){
          const row=el('div');row.className='rental-credential-row';row.append(el('span',label),el('strong',value),button('คัดลอก '+label,async()=>{await navigator.clipboard.writeText(value);notice('คัดลอก '+label+' แล้ว');}));credentials.append(row);
        }delivery.append(credentials);
        secretTimer=setTimeout(clearSecrets,Math.max(0,Math.min(Date.parse(result.endAt)-Date.now(),300000)));};
      deliveryActions.append(button('เปิดใช้งานเมื่อพร้อมเล่น',()=>reveal('activate'),true),button('ดูข้อมูลเข้าเกม',()=>reveal('delivery')));
      guard.append(button('ขอ Steam Guard',async()=>{const token=secretEpoch;const result=await api('guard',{orderId:order.id});if(token!==secretEpoch||document.hidden||version!==orderEpoch)return;
          clearTimeout(codeTimer);document.querySelector('[data-rental-code]')?.remove();const code=secretBox(result.code,guard);code.dataset.rentalCode='';codeTimer=setTimeout(()=>code.remove(),Math.min(result.validForSeconds*1000,Math.max(0,Date.parse(order.endAt)-Date.now())));},true));
      actions.append(button('ต่ออายุ',()=>openBooking({id:order.productId,name:order.name},order)));
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
      document.querySelectorAll('.rental-checkout-dialog').forEach(d=>d.close());
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
