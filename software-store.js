document.addEventListener('DOMContentLoaded',async()=>{
 const main=document.querySelector('[data-software-store]');if(!main)return;
 document.body.classList.add('software-store-page');
 const {categories,safeImage,classify,icon}=window.OlafSoftwareStore;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const img=(url,alt,cls='')=>'<img class="'+cls+'" src="'+esc(safeImage(url)||'assets/placeholder.svg')+'" alt="'+esc(alt)+'" loading="lazy" decoding="async">';
 const buttonIcon=name=>img(icon(name),'','sw-button-icon');
 let config={},products=[],selected='all';
 const categoryName=c=>String(config.categoryNames?.[c.id]||c.name);
 const categoryImage=c=>safeImage(config.categories?.[c.id])||c.image;
 main.innerHTML='<div class="software-root"><section class="sw-hero sw-hero-banner" aria-label="แบนเนอร์ซอฟต์แวร์"><div class="sw-hero-actions"><a href="#software-products" class="sw-primary">'+buttonIcon('bag-check')+'เลือกซื้อสินค้า</a><a href="products.html" class="sw-secondary">'+buttonIcon('grid')+'ดูสินค้าทั้งหมด</a></div></section><nav class="sw-categories" aria-label="หมวดหมู่ซอฟต์แวร์"></nav><section class="sw-products" id="software-products"><div class="sw-section-heading"><div><h2>สินค้าแนะนำ</h2><p id="sw-category-caption"></p></div><button type="button" class="sw-show-all">'+buttonIcon('grid')+'ดูสินค้าทั้งหมด</button></div><div class="sw-grid" aria-live="polite"><p class="sw-empty">กำลังโหลดสินค้า…</p></div></section><section class="sw-promos" aria-label="โปรโมชันซอฟต์แวร์"></section></div>';
 main.querySelector('.software-root').insertAdjacentHTML('beforeend','<section class="sw-service-strip" aria-label="บริการของร้าน">'+[['lightning-charge-fill','การจัดส่งสินค้า','ดูเวลาจัดส่งในรายละเอียดสินค้า'],['shield-check','ข้อมูลสินค้าและสิทธิ์ใช้งาน','ตรวจสอบประเภทสิทธิ์ก่อนสั่งซื้อ'],['headset','ทีมงานดูแล','สอบถามร้านผ่านช่องทางติดต่อ'],['lock-fill','การชำระเงิน','ชำระผ่านช่องทางที่ร้านกำหนด']].map(([i,title,detail])=>'<div class="sw-service">'+img(icon(i),'')+'<div><strong>'+title+'</strong><p>'+detail+'</p></div></div>').join('')+'</section><section id="sw-category-results" class="sw-category-results" hidden aria-label="สินค้าตามหมวดหมู่"><div class="sw-section-heading"><div><h2 tabindex="-1"></h2><p class="sw-result-count"></p></div></div><div class="sw-grid" aria-live="polite"></div></section>');
 let categoryOpened=false;
 function render(){
  const heading=main.querySelector('.sw-section-heading>div');
  heading.classList.add('sw-heading-copy');
  if(!heading.querySelector('.sw-heading-flame'))heading.insertAdjacentHTML('afterbegin',img(icon('stars'),'','sw-heading-flame'));
  main.querySelector('.sw-categories').innerHTML=categories.map(c=>'<button type="button" data-sw-category="'+c.id+'" aria-pressed="'+(selected===c.id)+'">'+img(categoryImage(c),categoryName(c))+'<span><b>'+esc(categoryName(c))+'</b><small>ดูทั้งหมด <em>›</em></small></span></button>').join('');
  const sorted=[...products].sort((a,b)=>Number(Number(b.stock)>0)-Number(Number(a.stock)>0)||Number(b.sold||0)-Number(a.sold||0));
  const list=Array.isArray(config.featuredIds)?[...new Set(config.featuredIds)].slice(0,5).map(id=>products.find(p=>p.id===id)).filter(Boolean):sorted.slice(0,5);
  main.querySelector('.sw-products h2').textContent='สินค้าแนะนำ';
  main.querySelector('#sw-category-caption').textContent='เลือกซอฟต์แวร์สำหรับคุณ · ดูรายละเอียดก่อนสั่งซื้อ';
  const card=p=>{
   const href='product.html?id='+encodeURIComponent(p.id),category=categories.find(c=>c.id===classify(p));
   // The product editor owns product images; ignore legacy storefront overrides.
   const cover=safeImage(p.image)||safeImage(p.gallery?.[0])||categoryImage(category);
   const badge=/^(ยอดนิยม|ขายดี|รองรับ AI|ใหม่|ลดราคา)$/i.test(String(p.label||'').trim())?String(p.label).trim():'';
   return '<article class="sw-card"><a class="sw-cover" href="'+href+'">'+img(cover,p.name)+(badge?'<span>'+esc(badge)+'</span>':'')+'</a><div class="sw-card-content"><a class="sw-product-name" href="'+href+'" title="'+esc(p.name)+'">'+esc(p.name)+'</a><p>'+esc(p.publisher||categoryName(category))+'</p><small>'+(Number(p.stock)>0?'พร้อมจำหน่าย':'สินค้าหมดชั่วคราว')+'</small><div class="sw-buy-row"><strong>฿'+Number(p.price||0).toLocaleString('th-TH')+'</strong><a href="'+href+'" aria-label="ดูรายละเอียด '+esc(p.name)+'">'+buttonIcon('cart3')+(Number(p.stock)>0?'ซื้อเลย':'ดูสินค้า')+'</a></div></div></article>';
  };
  main.querySelector('.sw-products .sw-grid').innerHTML=list.length?list.map(card).join(''):'<p class="sw-empty">ยังไม่มีสินค้าแนะนำ</p>';
  const results=main.querySelector('#sw-category-results');
  results.hidden=!categoryOpened;
  if(categoryOpened){const filtered=sorted.filter(p=>selected==='all'||classify(p)===selected);results.querySelector('h2').textContent=selected==='all'?'สินค้าทั้งหมด':categoryName(categories.find(c=>c.id===selected));results.querySelector('.sw-result-count').textContent=filtered.length+' รายการ';results.querySelector('.sw-grid').innerHTML=filtered.length?filtered.map(card).join(''):'<p class="sw-empty">ยังไม่มีสินค้าในหมวดนี้ <button type="button" class="sw-show-all">ดูสินค้าหมวดอื่น</button></p>'}
  main.querySelector('.sw-promos').innerHTML=[['adobe','Adobe Creative Cloud','เลือกโปรแกรมสำหรับงานสร้างสรรค์'],['capcut','CapCut Pro','สร้างวิดีโอและคอนเทนต์ในสไตล์ของคุณ']].map(([id,title,desc])=>{
   const background=safeImage(config.promos?.[id]);
   return '<button type="button" aria-label="ดูรายละเอียด '+esc(categoryName(categories.find(c=>c.id===id)))+'" class="sw-promo sw-promo-'+id+(background?' has-custom-promo':'')+'" data-sw-category="'+id+'">'+(background?img(background,'','sw-promo-bg'):'')+'<div><span>'+buttonIcon('arrow-right-circle')+'ดูรายละเอียด</span></div>'+(background?'':img(categoryImage(categories.find(c=>c.id===id)),title,'sw-promo-icon'))+'</button>';
  }).join('');
 }
 main.addEventListener('click',e=>{const button=e.target.closest('[data-sw-category],.sw-show-all');if(!button)return;selected=button.dataset.swCategory||'all';categoryOpened=true;render();const results=main.querySelector('#sw-category-results');results.querySelector('h2').focus({preventScroll:true});results.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})});
 main.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&!e.target.dataset.fallback){e.target.dataset.fallback='1';e.target.src='assets/placeholder.svg'}},true);
 const results=await Promise.allSettled([window.OlafProducts?.fetchActiveProducts?.()||[],window.OlafStoreSettings?.fetchStoreSettings?.({forceRefresh:true})||{}]);
 config=results[1].status==='fulfilled'?(results[1].value?.softwareStore||{}):{};
 const online=results[0].status==='fulfilled'?(results[0].value||[]):[];
 products=window.OlafExtraProducts?.mergeProducts?.(online)||[];
 const ids=new Set(products.map(p=>p.id));
 online.filter(p=>p.isActive!==false&&/^(software|office|adobe|capcut|antivirus)$/.test(p.category||'')).forEach(p=>{if(!ids.has(p.id)){products.push(p);ids.add(p.id)}});
 const hero=safeImage(config.hero)||'assets/software-hero-1916x821.png';{const image=document.createElement('img');image.src=hero;image.alt='';image.className='sw-banner-image';image.fetchPriority='high';main.querySelector('.sw-hero').prepend(image)}
 const pageBackground=safeImage(config.pageBackground);if(pageBackground)document.body.style.backgroundImage='linear-gradient(#030d1866,#030d1866),url('+JSON.stringify(pageBackground)+')';
 render();
 if(results[0].status==='rejected')main.querySelector('#sw-category-caption').textContent+=' · กำลังแสดงข้อมูลสำรอง กรุณาตรวจสอบราคาที่หน้าสินค้า';
});
