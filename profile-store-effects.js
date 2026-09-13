(() => {
 if(!document.body.classList.contains('profile-store-page'))return;
 function watch(doc,selector){
  const pending=new WeakMap();
  function state(img,value){
   img.dataset.shopMedia=value;const card=img.closest('.store-product');
   if(card){
    card.dataset.shopMedia=value;card.setAttribute('aria-busy',String(value==='loading'));
    let skeleton=card.querySelector('.shop-card-skeleton');
    if(value==='loading'&&!skeleton){skeleton=doc.createElement('span');skeleton.className='shop-card-skeleton';skeleton.setAttribute('aria-hidden','true');skeleton.innerHTML='<span class="shop-skeleton-box shop-skeleton-art"></span><span class="shop-skeleton-box shop-skeleton-title"></span><span class="shop-skeleton-box shop-skeleton-price"></span>';card.append(skeleton);}
    if(value!=='loading')skeleton?.remove();
   }
  }
  function scan(){doc.querySelectorAll(selector).forEach(img=>{
   const src=(img.getAttribute('src')||'')+'|'+(img.getAttribute('srcset')||'');
   if(pending.get(img)===src)return;pending.set(img,src);
   state(img,img.complete?(img.naturalWidth?'ready':'error'):'loading');
  });}
  function complete(e){if(e.target.matches?.(selector))state(e.target,e.type==='load'?'ready':'error');}
  doc.addEventListener('load',complete,true);doc.addEventListener('error',complete,true);
  const observer=new MutationObserver(scan);observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src','srcset']});scan();
  return ()=>{observer.disconnect();doc.removeEventListener('load',complete,true);doc.removeEventListener('error',complete,true);};
 }
 watch(document,'.store-product>img,.atelier-dialog img');
 const frames=new Map();
 function scanFrames(){
  for(const [frame,entry] of frames)if(!frame.isConnected){entry.stop?.();frame.removeEventListener('load',entry.load);frames.delete(frame);}
  document.querySelectorAll('iframe.profile-live-preview').forEach(frame=>{
   if(frames.has(frame))return;const entry={};
   entry.load=()=>{entry.stop?.();try{const doc=frame.contentDocument;if(!doc?.body)return;const css=doc.createElement('link');css.rel='stylesheet';css.href=new URL('profile-store-effects.css?v=20260913-v254',document.baseURI).href;doc.head.append(css);entry.stop=watch(doc,'.member-background,.member-portrait');}catch{/* Preview itself reports cross-origin/load failures. */}};
   frames.set(frame,entry);frame.addEventListener('load',entry.load);
  });
 }
 const observer=new MutationObserver(scanFrames);observer.observe(document.body,{childList:true,subtree:true});scanFrames();
})();
