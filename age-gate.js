// Display consent only, not identity/age verification. No birthday or personal data stored.
(() => {
  const key='olaf-adult-images-v1';
  let confirmed=false;try{confirmed=sessionStorage.getItem(key)==='yes';}catch{}
  const records=new Map(),observers=new Set();let counter=0;
  const tokens=new Map();
  const explicit=p=>p.ageRestricted===true || Number(p.requiredAge||p.required_age||p.sourceMetadata?.required_age)>=18 || /18\s*\+|🔞|sexual content|nudity|adult only|เนื้อหาทางเพศ|โป๊เปลือย/i.test([p.name,...(Array.isArray(p.tags)?p.tags:[]),...(Array.isArray(p.genres)?p.genres:[])].join(' '));
  function steamId(p){
    const direct=p.steamAppId||p.steam_app_id||p.sourceMetadata?.steamAppId||p.sourceMetadata?.steam_app_id;
    if(/^\d{1,9}$/.test(String(direct||'')))return String(direct);
    for(const value of [p.image,p.heroImage,...(p.gallery||[])]){try{const u=new URL(value);if(/(^|\.)steamstatic\.com$/.test(u.hostname)){const id=u.pathname.match(/\/apps\/(\d{1,9})\//)?.[1];if(id)return id;}}catch{}}
    return null;
  }
  function protect(p){
    if(!p||confirmed||(!explicit(p)&&!((p.supplierProduct||steamId(p)||['offline','steam-key'].includes(p.category))&&p.ageStatus!=='checked')))return p;
    let token=tokens.get(p.id);if(!token){token=String(++counter);tokens.set(p.id,token);}
    records.set(token,{id:p.id,unknown:!explicit(p)});
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><rect width="800" height="450" fill="#101d34"/><circle cx="400" cy="160" r="65" fill="#1e3354"/><text x="400" y="180" text-anchor="middle" fill="#bdd9ff" font-family="sans-serif" font-size="48">18+</text></svg>';
    const placeholder='data:image/svg+xml,'+encodeURIComponent(svg)+'#olaf-age-'+token;
    // Real media URLs never enter src/srcset/background/preload before consent.
    return {...p,ageLocked:true,image:placeholder,imageUrl:placeholder,image_url:placeholder,heroImage:placeholder,heroImageUrl:placeholder,hero_image_url:placeholder,gallery:[placeholder],
      featureBlocks:[],steamRelatedLinks:[],rawPublic:p.rawPublic?{...p.rawPublic,image:placeholder,screenshots:[placeholder]}:p.rawPublic};
  }
  function hydrate(){
    if(confirmed)return;
    for(const entry of observers){if(!entry.img.isConnected){entry.observer.disconnect();observers.delete(entry);}}
    for(const img of document.querySelectorAll('img[src*="#olaf-age-"]')){
      if(img.dataset.ageGateAttached)continue;
      const token=img.getAttribute('src').split('#olaf-age-')[1],record=records.get(token);if(!record)continue;
      img.dataset.ageGateAttached='true';
      const parent=img.parentElement;
      let host=/^(A|BUTTON)$/.test(parent.tagName)?parent.parentElement:parent;
      while(host.parentElement&&getComputedStyle(host).display==='contents')host=host.parentElement;
      if(getComputedStyle(host).position==='static')host.style.position='relative';
      const button=document.createElement('button');button.type='button';button.className='olaf-age-confirm';
      button.dataset.ageToken=token;button.textContent='ฉันอายุ 18 ปีขึ้นไป · แสดงรูป';
      button.title=record.unknown?'ยังไม่มีข้อมูลเรทที่ยืนยันได้ จึงซ่อนภาพไว้ก่อน':'เนื้อหาสำหรับผู้ใหญ่ กรุณายืนยันอายุก่อนแสดงภาพ';
      button.setAttribute('aria-label',button.textContent);host.append(button);
      const position=()=>{const box=img.getBoundingClientRect(),h=host.getBoundingClientRect();button.style.maxWidth=Math.max(80,box.width-16)+'px';button.style.left=(box.left-h.left+(box.width-button.offsetWidth)/2)+'px';button.style.top=(box.top-h.top+box.height*0.67-button.offsetHeight/2)+'px';};
      position();if(window.ResizeObserver){const observer=new ResizeObserver(position);observer.observe(img);observers.add({img,observer});}
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();try{sessionStorage.setItem(key,'yes');}catch{button.textContent='กรุณาอนุญาต Session Storage แล้วลองใหม่';return;}location.reload();});
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{hydrate();new MutationObserver(hydrate).observe(document.body,{childList:true,subtree:true});});
  function update(p){
    if(p.ageLocked)return;const token=tokens.get(p.id);if(!token)return;
    document.querySelectorAll('img[src$="#olaf-age-'+token+'"]').forEach(img=>{img.src=p.image;});
    document.querySelectorAll('[data-age-token="'+token+'"]').forEach(button=>button.remove());
  }
  window.OlafAgeGate={protect,explicit,steamId,update,productIdForSource:src=>records.get(String(src).split('#olaf-age-')[1])?.id,isConfirmed:()=>confirmed};
})();
