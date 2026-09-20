(() => {
  // Profile has its own collection editor; never show shopping hover windows there.
  if (/\/profile\.html$/i.test(location.pathname)) return;
  const desktop=matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  const cards='article.product-card,article.feature-card,article.hero-game-card,article.olaf-steam-spotlight,article.catalog-genre-game,article.olaf-steam-taste-row,article.extras-product-card,article.license-card,.pd-related-card,.olaf-steam-deal-card,.olaf-steam-discovery-row,.olaf-steam-editorial-card,.olaf-steam-activity-card,.member-game-grid > a';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let active=null,anchor=null,imageAnchored=false,timer=0,popup=null,serial=0,closeTimer=0,galleryTimer=0,galleryCleanup=()=>{};
  const cache=new Map();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeImage=value=>{if(!value)return '';try{const url=new URL(value,location.href);return ['http:','https:'].includes(url.protocol)||(url.protocol==='file:'&&location.protocol==='file:')?url.href:'';}catch{return '';}};
  // Repair UTF-8 accidentally stored as Latin-1/Windows-1252, including mixed Thai text.
  const cp1252=new Map(Array.from('€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ', (c,i)=>[c,128+i]));
  function cleanText(value){
    let text=String(value??'');
    for(let pass=0;pass<3;pass++){
      const next=text.replace(/[\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]+/g,part=>{
        if(!/[ÃÂàâ]/.test(part))return part;
        try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(Array.from(part,c=>cp1252.get(c)??c.charCodeAt(0))));}catch{return part;}
      });
      if(next===text)break;text=next;
    }
    return text;
  }
  const plain=value=>cleanText(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const galleryImages=product=>[...new Set((Array.isArray(product?.gallery)?product.gallery:[]).map(safeImage).filter(Boolean))];
  function stopGallery(){clearTimeout(galleryTimer);galleryCleanup();galleryCleanup=()=>{};}
  function hide(){serial++;clearTimeout(timer);stopGallery();active=null;anchor=null;clearTimeout(closeTimer);
    if(popup){popup.classList.remove('is-visible');if(reduced.matches)popup.hidden=true;else closeTimer=setTimeout(()=>{if(!active)popup.hidden=true;},150);}
  }
  function startGallery(product,cover){
    stopGallery();
    const urls=galleryImages(product);
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
        const previous=media.querySelector('img');media.querySelector('.hover-preview-empty')?.remove();media.append(incoming);
        media.style.backgroundImage=`url(${JSON.stringify(urls[index])})`;
        void incoming.offsetWidth;incoming.classList.add('is-ready');
        fade=setTimeout(()=>{previous?.remove();incoming.className='';cleanup();galleryCleanup=()=>{};if(token===serial)galleryTimer=setTimeout(next,1500);},240);
      };
      timeout=setTimeout(skip,6000);incoming.src=urls[index];
    }
    galleryTimer=setTimeout(next,1500);
  }
  function position(){if(!popup||popup.hidden||!anchor)return;const pad=12;
    popup.classList.toggle('is-image-anchored',imageAnchored);
    // Grow into the source card, never beyond it or into neighbouring columns.
    const inset=4;
    const left=Math.ceil(Math.max(pad,anchor.left+inset));
    const top=Math.ceil(Math.max(pad,anchor.top+inset));
    const right=Math.floor(Math.min(innerWidth-pad,anchor.left+anchor.width-inset));
    const bottom=Math.floor(Math.min(innerHeight-pad,anchor.top+anchor.height-inset));
    const width=right-left,height=bottom-top;
    if(width<120||height<140){hide();return;}
    popup.classList.add('is-card-fitted');
    popup.classList.toggle('is-compact-card',height<300);
    popup.classList.toggle('is-short-card',height<190);
    popup.style.width=width+'px';popup.style.height=height+'px';
    popup.style.left=left+'px';popup.style.top=top+'px';
  }
  function render(card,product,loading=false){
    if(!popup){popup=document.createElement('aside');popup.className='product-hover-preview';popup.hidden=true;popup.setAttribute('aria-hidden','true');document.body.append(popup);}
    const image=galleryImages(product)[0]||'';
    const cover=safeImage(product?.image)||image;
    const title=product?.name||card.querySelector('h3,h2,.pd-related-name,.olaf-steam-deal-title,strong')?.textContent||card.querySelector('img')?.alt||'รายละเอียดสินค้า';
    const price=Number.isFinite(Number(product?.price))&&product?.price!=null?'฿'+Number(product.price).toLocaleString('th-TH'):card.querySelector('.price,.pd-related-price,.steam-price-final,.olaf-steam-price-current')?.textContent||'';
    const tags=Array.isArray(product?.tags)?product.tags.slice(0,6):[...card.querySelectorAll('.tag')].slice(0,6).map(n=>n.textContent);
    const stock=product?.stock!=null?(Number(product.stock)>0?'มีสินค้า':'สินค้าหมด'):card.querySelector('.stock-pill')?.textContent||'';
    const current=Number(product?.price),original=Number(product?.compareAt);
    const discounted=product?.price!=null&&Number.isFinite(current)&&current>=0&&Number.isFinite(original)&&original>current;
    const discount=discounted?Math.round((original-current)/original*100):0;
    const rating=plain(product?.rating).split(/\s*\|\s*/);
    const release=plain(product?.releaseDate||product?.sourceMetadata?.releaseDate||'');
    const saved=Boolean(product?.id&&window.OlafFavorites?.getIds?.().includes(String(product.id)));
    stopGallery();
    popup.classList.add('is-loading');popup.classList.remove('is-content-ready');popup.setAttribute('aria-busy','true');
    const href=card.matches('a[href]')?card.getAttribute('href'):card.querySelector('a[href*="product.html?"]')?.getAttribute('href');
    popup.innerHTML=`<a class="hover-preview-open" href="${esc(href||'#')}" tabindex="-1" aria-label="ดูรายละเอียด ${esc(plain(title))}"></a>
      <div class="hover-preview-media">${image?`<img src="${esc(image)}" alt="" decoding="async">`:`<span class="hover-preview-empty">${loading?'กำลังโหลดภาพ…':'ยังไม่มีภาพแกลเลอรี'}</span>`}</div>
      <span class="hover-preview-favorite${saved?' is-saved':''}" title="${saved?'บันทึกในรายการโปรดแล้ว':'รายการโปรด'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1Z"/></svg></span>
      <div class="hover-preview-summary">
        ${cover?`<div class="hover-preview-cover"><img src="${esc(cover)}" alt="" decoding="async"></div>`:''}
        <div class="hover-preview-price">${discounted?`<span class="hover-preview-discount">-${discount}%</span>`:''}<div>${discounted?`<del>฿${esc(original.toLocaleString('th-TH'))}</del>`:''}<strong>${esc(price)}</strong></div></div></div>
      <div class="hover-preview-body"><h3>${esc(plain(title))}</h3>
        <div class="hover-preview-tags">${tags.map(tag=>`<span>${esc(plain(tag))}</span>`).join('')}</div>
        <div class="hover-preview-reviews"><p class="hover-preview-rating">${esc(rating[0]||plain(product?.publisher)||'')}</p>${rating.length>1?`<p class="hover-preview-review-count">${esc(rating.slice(1).join(' · '))}</p>`:''}</div>
        <div class="hover-preview-meta">${release?`<span>${esc(release)}</span>`:''}<span>${esc(stock)}</span></div></div>`;
    const media=popup.querySelector('.hover-preview-media'),firstImage=media.querySelector('img'),renderToken=serial;
    popup.querySelector('.hover-preview-cover img')?.addEventListener('error',event=>event.target.parentElement.remove(),{once:true});
    if(image)media.style.backgroundImage=`url(${JSON.stringify(image)})`;
    let revealed=false;
    const reveal=()=>{if(renderToken!==serial||!media.isConnected)return;if(!loading&&!revealed){revealed=true;popup.classList.remove('is-loading');popup.classList.add('is-content-ready');popup.setAttribute('aria-busy','false');if(product)startGallery(product,image);}position();};
    firstImage?.addEventListener('error',event=>{event.target.remove();media.insertAdjacentHTML('beforeend','<span class="hover-preview-empty">โหลดภาพแกลเลอรีไม่สำเร็จ</span>');reveal();},{once:true});
    firstImage?.addEventListener('load',reveal,{once:true});
    if(!firstImage||firstImage.complete)reveal();
    else setTimeout(reveal,1200);
    clearTimeout(closeTimer);const opening=popup.hidden||!popup.classList.contains('is-visible');popup.hidden=false;position();
    if(active!==card)return;
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
    if(popup?.contains(event.target))return;
    // The featured spotlight already contains its details. Exclude its links
    // before the generic article/link fallback can turn them into previews.
    if(event.target.closest?.('.olaf-steam-spotlight')){hide();return;}
    let card=event.target.closest?.(cards+',article.olaf-license-card');
    if(!card){const article=event.target.closest?.('article');const links=article?[...article.querySelectorAll('a[href*="product.html?"]')]:[];if(links.length&&new Set(links.map(link=>link.getAttribute('href'))).size===1)card=article;}
    card ||= event.target.closest?.('a[href*="product.html?"]');if(!card||card===active)return;
    const link=card.matches('a[href]')?card:card.querySelector('a[href*="product.html?"]');
    let url;try{url=new URL(link?.getAttribute('href'),location.href);}catch{return;}
    if(!/\/product\.html$/.test(url.pathname)||url.origin!==location.origin)return;
    const id=url.searchParams.get('id');if(!id)return;
    hide();active=card;
    const mainImage=card.matches('.olaf-steam-taste-row')?card.querySelector('.olaf-steam-taste-main'):null;
    const imageRect=mainImage?.getBoundingClientRect();
    imageAnchored=Boolean(imageRect?.width&&imageRect?.height);
    anchor=imageAnchored?imageRect:card.getBoundingClientRect();const token=serial;
    timer=setTimeout(()=>show(card,id,token),280);
  });
  document.addEventListener('pointerout',event=>{
    if(!active)return;
    const inside=node=>node instanceof Node&&(active.contains(node)||popup?.contains(node));
    if(inside(event.target)&&!inside(event.relatedTarget))hide();
  });
  document.addEventListener('pointerdown',event=>{if(!popup?.contains(event.target))hide();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);window.addEventListener('blur',hide);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});desktop.addEventListener('change',hide);
  reduced.addEventListener('change',hide);
})();
