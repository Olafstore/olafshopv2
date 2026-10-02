(() => {
 const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const valid=p=>p?.mediaStatus==='ready'&&/^[1-9]\d{0,8}$/.test(String(p.steamAppId))&&typeof p.name==='string'&&p.name.trim()&&safeImage(p.image,p.steamAppId);
 function safeImage(url,id){try{const u=new URL(url);return u.protocol==='https:'&&/(^|\.)(steamstatic\.com|steamusercontent\.com)$/.test(u.hostname)&&u.pathname.includes(`/apps/${id}/`);}catch{return false;}}
 let products=[],genre='',loading=false,generation=0,activeProduct=null,bookingEpoch=0;
 const groups=[['Action','แอ็กชัน'],['Adventure','ผจญภัย'],['RPG','สวมบทบาท'],['Simulation','จำลองสถานการณ์']];
 const priceRequests=new Map(),priceQueue=[];let priceWorkers=0;
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function minimumPrice(p){
  if(!priceRequests.has(p.id))priceRequests.set(p.id,new Promise(resolve=>{priceQueue.push({p,resolve});pumpPrices();}));
  return priceRequests.get(p.id);
 }
 function pumpPrices(){while(priceWorkers<2&&priceQueue.length){const job=priceQueue.shift();priceWorkers++;(async()=>{
  let result;for(let attempt=0;attempt<2;attempt++){try{result=await window.OlafRental.api('price',undefined,{productId:job.p.id});break;}catch(e){if(!attempt&&['SUPPLIER_RATE_LIMITED','RATE_LIMITED'].includes(e.code)){await pause(Math.min(60000,Math.max(1000,(e.retryAfter||60)*1000)));continue;}break;}}
  job.resolve(result||null);
 })().finally(()=>{priceWorkers--;pumpPrices();});}}
 function priceLabel(target,p){minimumPrice(p).then(data=>{if(!target.isConnected)return;const amount=Number(data?.minPrice);target.textContent=data?.minPrice!=null&&Number.isFinite(amount)&&amount>0?'เริ่มต้น ฿'+new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(amount):data?'ยังไม่มีแพ็กเกจ':'ไม่สามารถโหลดราคาได้';});}
 async function verifiedGames(rows,onGame=()=>{}){
  const ready=rows.filter(valid);ready.forEach(onGame);const unresolved=rows.filter(p=>!valid(p)&&p.mediaStatus==='pending');let cursor=0,failed=0;
  async function worker(){while(cursor<unresolved.length){const p=unresolved[cursor++];let full;for(let attempt=0;attempt<2;attempt++){try{full=await window.OlafRental.api('product',undefined,{productId:p.id});break;}catch(e){if(e.code==='ORDER_NOT_FOUND'||e.code==='RENTAL_DISABLED')break;if(!attempt)await pause(Math.min(60000,Math.max(500,(e.retryAfter||0)*1000)));}}
   if(valid(full)){ready.push(full);onGame(full);}else failed++;}}
  await Promise.all([worker(),worker(),worker()]);return {games:ready,failed};
 }
 function categoryButtons(){const box=$('rental-categories');box.replaceChildren();for(const [value,label] of [['','เกมทั้งหมด'],...groups.filter(([g])=>products.some(p=>p.genres?.includes(g)))]){const b=node('button',label);b.type='button';b.setAttribute('aria-pressed',String(value===genre));b.onclick=()=>{genre=value;categoryButtons();renderCards();};box.append(b);}}
 function renderCards(){const grid=$('rental-grid'),search=$('rental-search').value.trim().normalize('NFKC').toLocaleLowerCase();grid.replaceChildren();
  const visible=products.filter(p=>(!genre||p.genres?.includes(genre))&&p.name.normalize('NFKC').toLocaleLowerCase().includes(search));
  for(const p of visible){const card=node('article',undefined,'rental-card'),href='rental-product.html?id='+encodeURIComponent(p.id),art=node('a',undefined,'rental-card-art');art.href=href;art.setAttribute('aria-label','ดูรายละเอียด '+p.name);
   const image=node('img');image.alt=p.name;image.loading='lazy';image.decoding='async';image.src=p.image;image.onerror=()=>{image.remove();art.classList.add('rental-art-unavailable');};art.append(image,node('span','เช่าไอดี Steam','rental-card-badge'));
   const body=node('div',undefined,'rental-card-body'),title=node('a',p.name,'rental-card-title');title.href=href;
   const price=node('strong',undefined,'rental-catalog-price'),priceText=node('span','กำลังโหลดราคา…');price.append(window.OlafRental.icon('wallet'),priceText);
   body.append(title,node('p',(p.genres||[]).slice(0,2).join(' · ')||'เกม Steam','rental-card-genres'),price);
   const cta=node('a',undefined,'rental-card-cta');cta.href=href;cta.append(window.OlafRental.icon('calendar'),node('span','เลือกแพ็กเกจเช่า'),node('span','→','rental-cta-arrow'));body.append(cta);card.append(art,body);grid.append(card);priceLabel(priceText,p);}
  if(loading){for(let i=0;i<(visible.length?2:6);i++){const skeleton=node('div',undefined,'rental-skeleton');skeleton.setAttribute('aria-hidden','true');skeleton.append(node('div',undefined,'rental-skeleton-art'),node('div',undefined,'rental-skeleton-line'),node('div',undefined,'rental-skeleton-line short'));grid.append(skeleton);}}
  else if(!visible.length)grid.append(node('p','ไม่พบเกมที่ตรงกับคำค้นหา','rental-empty'));
  $('rental-notice').classList.toggle('rental-loading-label',loading);
  $('rental-count').textContent=`${visible.length} / ${products.length} เกม`;grid.setAttribute('aria-busy',String(loading));$('rental-search-clear').hidden=!search;
 }
 async function catalog(){const token=++generation;loading=true;products=[];genre='';$('rental-notice').hidden=false;$('rental-notice').textContent='กำลังเตรียมรายการเกมเช่า…';renderCards();
  try{const data=await window.OlafRental.api('catalog');if(token!==generation)return;
   $('rental-notice').textContent='กำลังโหลดเกมทั้งหมดและตรวจสอบข้อมูลจาก Steam…';
   const result=await verifiedGames(data.products,p=>{if(token!==generation)return;products.push(p);categoryButtons();renderCards();});
   if(token!==generation)return;loading=false;categoryButtons();renderCards();$('rental-notice').textContent='';$('rental-notice').hidden=true;
  }catch(e){if(token!==generation)return;loading=false;renderCards();$('rental-notice').textContent=e.code==='RENTAL_DISABLED'?'ระบบเช่าเกมยังไม่เปิดให้บริการ':'ไม่สามารถโหลดรายการเกมได้ กรุณาลองใหม่ภายหลัง';const retry=node('button','ลองโหลดรายการอีกครั้ง');retry.onclick=catalog;$('rental-grid').append(retry);}
 }
 async function rentalBackground(){try{const settings=await window.OlafStoreSettings.fetchStoreSettings();const url=String(settings.rentalHeroBackgroundUrl||'');if(!/^https:\/\//.test(url)&&!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(url))return;
  if(url.length>2*1024*1024)return;const hero=document.querySelector('.rental-hero');if(!hero)return;const img=new Image();img.onload=()=>{if(hero.isConnected)hero.style.backgroundImage='linear-gradient(90deg,rgba(6,16,34,.94),rgba(6,16,34,.64)),url('+JSON.stringify(url)+')';};img.src=url;
 }catch{/* Keep the shipped banner when store settings or the image is unavailable. */}}
 function textSection(title,text){const box=node('section',undefined,'rental-panel');box.append(node('h2',title));for(const line of String(text||'').split(/\n+/).filter(Boolean))box.append(node('p',line));if(box.children.length===1)box.append(node('p','ยังไม่มีรายละเอียดส่วนนี้จาก Steam'));return box;}
 async function booking(){const token=++bookingEpoch,box=$('rental-booking');if(!box||!activeProduct)return;box.replaceChildren(node('p','กำลังโหลดแพ็กเกจและคิวว่าง…','rental-loading-label'));box.setAttribute('aria-busy','true');
  try{await window.OlafRental.openBooking(activeProduct,null,true);}catch(e){if(token!==bookingEpoch)return;box.replaceChildren(node('h2','เลือกแพ็กเกจเช่า'),node('p',e.code==='AUTH_REQUIRED'?'เข้าสู่ระบบก่อนเลือกเวลาและตรวจคิวว่าง':'โหลดแพ็กเกจไม่ได้ กรุณาลองใหม่'));
   if(e.code==='AUTH_REQUIRED'){const link=node('a','เข้าสู่บัญชีของฉัน','primary-button');link.href='login.html?return='+encodeURIComponent('rental-product.html?id='+activeProduct.id);box.append(link);}else{const retry=node('button','โหลดแพ็กเกจใหม่');retry.onclick=booking;box.append(retry);}}
  finally{if(token===bookingEpoch)box.setAttribute('aria-busy','false');}}
 async function product(){const target=$('rental-product'),id=new URLSearchParams(location.search).get('id');try{
   const p=await window.OlafRental.api('product',undefined,{productId:id});if(!valid(p))throw {code:'ORDER_NOT_FOUND'};activeProduct=p;document.title=p.name+' • เช่าไอดี Steam | OLAF SHOP';$('rental-crumb-title').textContent=p.name;$('rental-notice').textContent='';target.replaceChildren();
   const layout=node('div',undefined,'rental-product-layout'),left=node('div',undefined,'rental-product-content'),gallery=node('section',undefined,'rental-panel rental-gallery'),image=node('img');
   const heading=node('div',undefined,'rental-game-heading');heading.append(node('span','STEAM RENTAL','rental-kicker'),node('h1',p.name));
   const genres=node('div',undefined,'rental-genre-chips');for(const genre of (p.genres||[]).slice(0,4))genres.append(node('span',genre));heading.append(genres);gallery.append(heading);
   image.src=p.image;image.alt=p.name;image.className='rental-game-cover';image.onerror=()=>{target.replaceChildren(node('p','โหลดรูปเกมไม่ได้ กรุณาโหลดหน้านี้ใหม่ก่อนเลือกแพ็กเกจ'));activeProduct=null;};gallery.append(image);
   const thumbs=node('div',undefined,'rental-thumbnails');for(const [i,url] of [...new Set([p.image,...(p.screenshots||[])])].filter(u=>safeImage(u,p.steamAppId)).slice(0,7).entries()){const b=node('button');b.type='button';b.setAttribute('aria-label',i?'ดูภาพเกม '+i:'ดูภาพหน้าปก');b.setAttribute('aria-pressed',String(i===0));const img=node('img');img.src=url;img.alt='';img.loading='lazy';img.onerror=()=>b.remove();b.onclick=()=>{image.src=url;thumbs.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));};b.append(img);thumbs.append(b);}gallery.append(thumbs);
   heading.querySelector('h1').prepend(window.OlafRental.icon('gamepad'));left.append(gallery);
   const details=node('section',undefined,'rental-panel rental-information');
   const description=node('section',undefined,'rental-info-content');description.append(node('h2','รายละเอียดเกม'),node('p',String(p.shortDescription||p.description||'ยังไม่มีรายละเอียดเกมจากผู้พัฒนา').replace(/\s+/g,' ').trim(),'rental-description'));
   const source=node('a','ดูข้อมูลเกมบน Steam ↗','rental-source-link');source.href='https://store.steampowered.com/app/'+p.steamAppId+'/';source.target='_blank';source.rel='noopener noreferrer';description.append(source);
   const requirements=node('section',undefined,'rental-panel');requirements.append(node('h2','ความต้องการระบบ'));const columns=node('div',undefined,'rental-requirements');
   for(const [key,label] of [['minimum','ขั้นต่ำ'],['recommended','แนะนำ']]){
     const card=node('section',undefined,'rental-spec-card');card.append(node('h3',label+(key==='minimum'?' (Minimum)':' (Recommended)')));const list=node('ul');
     const lines=p.requirements?.[key]||[];for(const line of lines){if(!line.trim()||/^(ขั้นต่ำ|แนะนำ|minimum|recommended):?$/i.test(line.trim()))continue;const item=node('li'),parts=line.split(':');if(parts.length>1){item.append(node('strong',parts.shift()+': '),document.createTextNode(parts.join(':').trim()));}else item.textContent=line;list.append(item);}
     if(!list.children.length)list.append(node('li','ยังไม่มีข้อมูลจากผู้พัฒนา'));card.append(list);columns.append(card);
   }requirements.append(columns);
   const delivery=node('section',undefined,'rental-panel rental-delivery-guide');delivery.append(node('h2','การจัดส่งไอดีและ Steam Guard'));
   for(const [title,body] of [['01 · ชำระเงินและจองคิว','ใช้ Point หรือชำระและแนบสลิปผ่านระบบร้านเดิม ระบบจองไอดีเมื่อยืนยันชำระสำเร็จ'],['02 · ข้อมูลไอดีในคลังสินค้า','เมื่อถึงเวลาเช่า เปิดข้อมูลสินค้าเพื่อดู Steam ID และรหัสผ่านที่ซ่อนอยู่ กดเปิดใช้งานเมื่อพร้อมเล่น'],['03 · รับ Steam Guard','ขอรหัสจากคลังสินค้าในช่วงเช่า ระบบซ่อนรหัสเมื่อหมดอายุ และต่อไอดีเดิมได้ก่อนสิ้นสุดเวลา']]){
     const row=node('div',undefined,'rental-delivery-step'),label=node('strong',title);label.prepend(window.OlafRental.icon(title.startsWith('01')?'wallet':title.startsWith('02')?'key':'shield'));row.append(label,node('p',body.replace('เข้าหน้าออเดอร์','เข้าคลังสินค้า').replace('ในหน้าออเดอร์','จากคลังสินค้า')));delivery.append(row);
   }
   description.className='rental-info-content';requirements.className='rental-info-content';delivery.className='rental-info-content rental-delivery-guide';details.append(description,requirements,delivery);
   left.append(details);const aside=node('aside',undefined,'rental-panel rental-booking-panel');aside.id='rental-booking';layout.append(left,aside);target.append(layout);target.setAttribute('aria-busy','false');
   for(const h of target.querySelectorAll('h2,h3'))h.prepend(window.OlafRental.icon(h.textContent.includes('Recommended')?'recommended':h.textContent.includes('Minimum')?'minimum':h.textContent.includes('ระบบ')?'cpu':h.textContent.includes('Guard')?'delivery':'file'));recommendations(target,p);await booking();
  }catch(e){target.setAttribute('aria-busy','false');target.replaceChildren(node('h1',e.code==='ORDER_NOT_FOUND'?'เกมนี้ยังไม่มีชื่อและรูปที่ยืนยันได้':'โหลดรายละเอียดเกมไม่ได้'),node('p','กรุณากลับไปเลือกเกมอื่น หรือโหลดข้อมูลใหม่ภายหลัง'));const link=node('a','กลับไปเลือกเกม','secondary-button');link.href='rentals.html';target.append(link);}}
 document.addEventListener('DOMContentLoaded',()=>{const page=document.body.dataset.rentalPage;if(page==='catalog'){$('rental-search').addEventListener('input',renderCards);$('rental-search-clear').onclick=()=>{$('rental-search').value='';renderCards();$('rental-search').focus();};rentalBackground();catalog();}if(page==='product'){product();window.addEventListener('olaf:rental-auth',booking);}});
 async function recommendations(target,current){
   const panel=node('section',undefined,'rental-panel rental-recommendations rental-recommendations-v81'),grid=node('div',undefined,'rental-grid');const heading=node('h2','เกมแนะนำหมวดเกมเช่า');heading.prepend(window.OlafRental.icon('gamepad'));panel.append(heading,node('p','ราคาเริ่มต้นจากแพ็กเกจต่ำสุด · ตรวจคิวอีกครั้งก่อนชำระ'),grid);target.append(panel);
   try{const data=await window.OlafRental.api('catalog');if(!panel.isConnected)return;
     const candidates=data.products.filter(p=>p.id!==current.id).sort((a,b)=>Number(b.genres?.some(g=>current.genres?.includes(g)))-Number(a.genres?.some(g=>current.genres?.includes(g)))).slice(0,24);const {games:resolved}=await verifiedGames(candidates);if(!panel.isConnected)return;const games=resolved.slice(0,16);
     for(const p of games){const card=node('a',undefined,'rental-card rental-recommended-card');card.href='rental-product.html?id='+encodeURIComponent(p.id);
       const image=node('img');image.src=p.image;image.alt=p.name;image.loading='lazy';image.onerror=()=>card.remove();
       const body=node('div',undefined,'rental-card-body'),title=node('strong',p.name);title.prepend(window.OlafRental.icon('gamepad'));const footer=node('div',undefined,'rental-recommendation-price'),price=node('strong','กำลังโหลดราคา…'),state=node('span','เช่าไอดี Steam','rental-card-status');footer.append(price,state);body.append(title,node('p',(p.genres||[]).slice(0,2).join(' · ')),footer);card.append(image,body);grid.append(card);
       card.priceTarget=price;card.stateTarget=state;card.productId=p.id;
     }if(!games.length)panel.remove();
     await Promise.all([...grid.children].map(card=>minimumPrice({id:card.productId}).then(data=>{if(!card.isConnected)return;const price=Number(data?.minPrice);card.priceTarget.textContent=data?.minPrice!=null&&price>0?'เริ่มต้น ฿'+new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(price):data?'ยังไม่มีแพ็กเกจ':'ไม่สามารถโหลดราคาได้';card.stateTarget.textContent=data?.minPrice>0?'มีแพ็กเกจ':'ตรวจสอบแพ็กเกจ';})));
   }catch{panel.remove();}
 }
})();
