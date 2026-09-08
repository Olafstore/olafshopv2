(() => {
  // Profile has its own collection editor; never show shopping hover windows there.
  if (/\/profile\.html$/i.test(location.pathname)) return;
  const desktop=matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  const cards='article.product-card,article.feature-card,article.hero-game-card,article.olaf-steam-spotlight,article.catalog-genre-game,article.olaf-steam-taste-row,article.extras-product-card,article.license-card,.pd-related-card,.olaf-steam-deal-card,.olaf-steam-discovery-row,.olaf-steam-editorial-card,.olaf-steam-activity-card,.member-game-grid > a';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let active=null,timer=0,frame=0,popup=null,x=0,y=0,serial=0,closeTimer=0,galleryTimer=0,galleryCleanup=()=>{};
  const cache=new Map();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeImage=value=>{if(!value)return '';try{const url=new URL(value,location.href);return ['http:','https:'].includes(url.protocol)||(url.protocol==='file:'&&location.protocol==='file:')?url.href:'';}catch{return '';}};
  const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  function stopGallery(){clearTimeout(galleryTimer);galleryCleanup();galleryCleanup=()=>{};}
  function hide(){serial++;clearTimeout(timer);stopGallery();cancelAnimationFrame(frame);frame=0;active=null;clearTimeout(closeTimer);
    if(popup){popup.classList.remove('is-visible');if(reduced.matches)popup.hidden=true;else closeTimer=setTimeout(()=>{if(!active)popup.hidden=true;},150);}
  }
  function startGallery(product,cover){
    stopGallery();
    const urls=[...new Set([cover,...(Array.isArray(product?.gallery)?product.gallery:[])].map(safeImage).filter(Boolean))];
    if(urls.length<2||reduced.matches)return;
    const token=serial,media=popup.querySelector('.hover-preview-media');let index=0;const failed=new Set();
    function next(){
      if(token!==serial||!active||!active.isConnected||document.hidden)return;
      const candidates=urls.filter(url=>!failed.has(url));if(candidates.length<2)return;
      index=(index+1)%urls.length;if(failed.has(urls[index])){galleryTimer=setTimeout(next,0);return;}
      const incoming=new Image();incoming.alt='';incoming.decoding='async';incoming.className='hover-gallery-incoming';incoming.dataset.galleryFrame='true';
      let timeout,fade;
      const cleanup=()=>{clearTimeout(timeout);clearTimeout(fade);incoming.onload=null;incoming.onerror=null;};
      galleryCleanup=()=>{cleanup();incoming.remove();};
      const skip=()=>{cleanup();failed.add(urls[index]);incoming.remove();if(token===serial)galleryTimer=setTimeout(next,1500);};
      incoming.onerror=skip;
      incoming.onload=()=>{
        clearTimeout(timeout);if(token!==serial||!active){cleanup();incoming.remove();return;}
        const previous=media.querySelector('img');media.append(incoming);
        void incoming.offsetWidth;incoming.classList.add('is-ready');
        fade=setTimeout(()=>{previous?.remove();incoming.className='';cleanup();galleryCleanup=()=>{};if(token===serial)galleryTimer=setTimeout(next,1500);},240);
      };
      timeout=setTimeout(skip,6000);incoming.src=urls[index];
    }
    galleryTimer=setTimeout(next,1500);
  }
  function position(){frame=0;if(!popup||popup.hidden)return;const rect=popup.getBoundingClientRect(),gap=20,pad=12;
    let left=x+gap;if(left+rect.width>innerWidth-pad)left=x-rect.width-gap;
    const top=Math.max(pad,Math.min(y-28,innerHeight-rect.height-pad));
    popup.style.transform=`translate3d(${Math.max(pad,Math.min(left,innerWidth-rect.width-pad))}px,${top}px,0)`;
  }
  function render(card,product,loading=false){
    if(!popup){popup=document.createElement('aside');popup.className='product-hover-preview';popup.hidden=true;popup.setAttribute('aria-hidden','true');document.body.append(popup);}
    const image=safeImage(card.querySelector('img')?.currentSrc||card.querySelector('img')?.getAttribute('src')||product?.image||'');
    const title=product?.name||card.querySelector('h3,h2,.pd-related-name,.olaf-steam-deal-title,strong')?.textContent||card.querySelector('img')?.alt||'รายละเอียดสินค้า';
    const price=Number.isFinite(Number(product?.price))&&product?.price!=null?'฿'+Number(product.price).toLocaleString('th-TH'):card.querySelector('.price,.pd-related-price,.steam-price-final,.olaf-steam-price-current')?.textContent||'';
    const tags=Array.isArray(product?.tags)?product.tags.slice(0,4):[...card.querySelectorAll('.tag')].slice(0,4).map(n=>n.textContent);
    const stock=product?.stock!=null?(Number(product.stock)>0?'มีสินค้า':'สินค้าหมด'):card.querySelector('.stock-pill')?.textContent||'';
    stopGallery();
    popup.classList.add('is-loading');popup.classList.remove('is-content-ready');popup.setAttribute('aria-busy','true');
    popup.innerHTML=`<div class="hover-preview-media">${image?`<img src="${esc(image)}" alt="" decoding="async">`:''}</div><div class="hover-preview-body"><small>OLAF SHOP · ${loading?'กำลังโหลดรายละเอียด…':'ตัวอย่างสินค้า'}</small><h3>${esc(plain(title))}</h3><p class="hover-preview-publisher">${esc(product?.publisher||'')}</p><p class="hover-preview-description">${esc(plain(product?.description).slice(0,220))}</p><div class="hover-preview-tags">${tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div><footer><strong>${esc(price)}</strong><span>${esc(stock)}</span></footer><p class="hover-preview-hint">คลิกการ์ดเพื่อดูรายละเอียดสินค้า</p></div>`;
    const firstImage=popup.querySelector('img'),media=popup.querySelector('.hover-preview-media'),renderToken=serial;
    let revealed=false;
    const reveal=()=>{if(renderToken!==serial||!media.isConnected)return;if(!loading&&!revealed){revealed=true;popup.classList.remove('is-loading');popup.classList.add('is-content-ready');popup.setAttribute('aria-busy','false');if(product)startGallery(product,image);}position();};
    firstImage?.addEventListener('error',event=>{event.target.remove();reveal();},{once:true});
    firstImage?.addEventListener('load',reveal,{once:true});
    if(!firstImage||firstImage.complete)reveal();
    clearTimeout(closeTimer);const opening=popup.hidden||!popup.classList.contains('is-visible');popup.hidden=false;position();
    if(opening){void popup.offsetWidth;popup.classList.add('is-visible');}
  }
  async function show(card,id,token){
    if(active!==card||token!==serial||!desktop.matches||!card.isConnected)return;
    render(card,cache.get(id),true);
    const minimumLoading=new Promise(resolve=>setTimeout(resolve,reduced.matches?0:500));
    try{
      const [product]=await Promise.all([cache.has(id)?cache.get(id):window.OlafProducts?.fetchProductById?.(id),minimumLoading]);
      if(product){cache.set(id,product);if(cache.size>40)cache.delete(cache.keys().next().value);}
      if(token===serial&&active===card&&desktop.matches)render(card,product);
    }catch{await minimumLoading;if(token===serial&&active===card)render(card,null);/* Keep the original card usable. */}
  }
  document.addEventListener('pointerover',event=>{
    if(!desktop.matches||event.pointerType!=='mouse')return;
    let card=event.target.closest?.(cards+',article.olaf-license-card');
    if(!card){const article=event.target.closest?.('article');const links=article?[...article.querySelectorAll('a[href*="product.html?"]')]:[];if(links.length&&new Set(links.map(link=>link.getAttribute('href'))).size===1)card=article;}
    card ||= event.target.closest?.('a[href*="product.html?"]');if(!card||card===active)return;
    const link=card.matches('a[href]')?card:card.querySelector('a[href*="product.html?"]');
    let url;try{url=new URL(link?.getAttribute('href'),location.href);}catch{return;}
    if(!/\/product\.html$/.test(url.pathname)||url.origin!==location.origin)return;
    const id=url.searchParams.get('id');if(!id)return;
    hide();active=card;x=event.clientX;y=event.clientY;const token=serial;
    timer=setTimeout(()=>show(card,id,token),280);
  });
  document.addEventListener('pointermove',event=>{if(!active||event.pointerType!=='mouse')return;x=event.clientX;y=event.clientY;if(!frame)frame=requestAnimationFrame(position);});
  document.addEventListener('pointerout',event=>{if(active&&active.contains(event.target)&&!active.contains(event.relatedTarget))hide();});
  document.addEventListener('pointerdown',hide);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);window.addEventListener('blur',hide);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});desktop.addEventListener('change',hide);
  reduced.addEventListener('change',hide);
})();
