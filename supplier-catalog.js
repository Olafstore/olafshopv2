// Public DTO only; supplier costs/secrets never enter this adapter.
(() => {
  const base=window.OlafProducts;if(!base)return;
  const prefix='supplier-';let snapshot=[],expires=0,pending;
  const metadata=new Map();
  const legacyRows=new Map(),legacyAges=new Map();
  const protect=p=>window.OlafAgeGate?.protect(p)||p;
  const mapLegacy=p=>{if(!p)return p;legacyRows.set(p.id,p);return protect({...p,ageLocked:false,...legacyAges.get(p.id)});};
  async function legacyDetail(id,cached=false){
    // Detail/hover must retain the original full-product fetch, not the compact Index row.
    const p=(cached&&legacyRows.get(id))||await byId.call(base,id);if(!p)return p;
    const appId=window.OlafAgeGate?.steamId(p);
    if(appId&&!legacyAges.has(id)){try{const r=await fetch('/api/steam-app?view=media&appid='+encodeURIComponent(appId));if(r.ok){const s=await r.json();if(String(s.appId)===String(appId))legacyAges.set(id,{ageStatus:s.ageStatus,ageRestricted:s.ageRestricted,requiredAge:s.requiredAge,...(s.screenshots?.length?{gallery:s.screenshots}:{}),...(s.headerImage?{image:s.headerImage}:{})});}}catch{}}
    return mapLegacy(p);
  }
  const mapProduct=(p,checkoutEnabled=true)=>protect({
        id:prefix+p.id,supplierProductId:p.id,supplierProduct:true,name:p.name,category:'offline',label:'Steam Offline',
        price:p.price,compareAt:p.compareAt,stock:p.available?p.stock:0,sold:0,rating:'',publisher:'Steam',
        image:p.image,heroImage:p.screenshots?.[0]||p.image,gallery:p.screenshots||[],tags:p.genres||[],
        description:p.description,shortDescription:p.shortDescription||'',steamAppId:p.steamAppId,steamMetadataStatus:p.steamMetadataStatus,delivery:'รับบัญชีในออเดอร์หลังตรวจชำระเงิน',warranty:'บัญชีเล่นออฟไลน์ ไม่ใช่ CD Key',
        detailSections:[{title:'เงื่อนไขบัญชี Steam Offline',body:'ใช้เล่นออฟไลน์เท่านั้น ห้ามเปลี่ยนข้อมูลบัญชี ไม่ใช่บัญชีส่วนตัวหรือ CD Key'+(p.denuvo?' · มี Denuvo อาจต้องรอคิวเปิดใช้งาน':'')}],
        systemRequirements:{minimum:p.requirements?p.requirements.split('\n').filter(Boolean):[],recommended:p.recommendedRequirements?p.recommendedRequirements.split('\n').filter(Boolean):[]},featureBlocks:[],platformLinks:p.steamUrl?[{label:'Steam',url:p.steamUrl}]:[],steamRelatedLinks:[],badgeOverrides:[],
        ageLocked:false,ageStatus:p.ageStatus,ageRestricted:p.ageRestricted,isActive:true,sortOrder:0,checkoutEnabled:checkoutEnabled,denuvo:p.denuvo,rawPublic:p
      });
  async function catalog(force=false){
    if(!force&&Date.now()<expires)return snapshot;
    if(pending)return pending;
    pending=(async()=>{
      const r=await fetch('/api/admin-supplier?action=shop-catalog',{credentials:'omit'});const j=await r.json();
      if(!r.ok||!j.success||!Array.isArray(j.data?.products))throw new Error('SUPPLIER_CATALOG_UNAVAILABLE');
      snapshot=j.data.products.map(p=>mapProduct({...p,...metadata.get(p.id),price:p.price,stock:p.stock,available:p.available,compareAt:p.compareAt},j.data.checkoutEnabled));expires=Date.now()+60000;return snapshot;
    })();try{return await pending;}finally{pending=null;}
  }
  const active=base.fetchActiveProducts,byId=base.fetchProductById,packages=base.fetchActiveProductPackages,related=base.fetchRelatedProducts;
  base.fetchActiveProducts=async function(options){const [legacy,supplier]=await Promise.all([active.call(base,options),catalog().catch(()=>[])]);return [...legacy.map(p=>window.OlafAgeGate?mapLegacy(p):p),...supplier];};
  base.fetchProductById=async id=>{
    if(!String(id).startsWith(prefix))return window.OlafAgeGate?legacyDetail(id):byId.call(base,id);
    const r=await fetch('/api/admin-supplier?action=shop-product&productId='+encodeURIComponent(id.slice(prefix.length)),{cache:'no-store'});const j=await r.json();
    if(r.status===404)return null;if(!r.ok||!j.success)throw new Error('SUPPLIER_PRODUCT_UNAVAILABLE');metadata.set(j.data.id,j.data);return mapProduct(j.data);
  };
  if(packages)base.fetchActiveProductPackages=(id,...args)=>String(id).startsWith(prefix)?Promise.resolve([]):packages.call(base,id,...args);
  if(related)base.fetchRelatedProducts=async(id,category,limit=8)=>String(id).startsWith(prefix)?(await catalog()).filter(p=>p.id!==id).slice(0,limit):(await related.call(base,id,category,limit)).map(p=>window.OlafAgeGate?mapLegacy(p):p);
  window.OlafSupplierCatalog={catalog,isSupplier:id=>String(id).startsWith(prefix)};
  // Enrich only visible supplier cards, at most two concurrent lookups; never purchase here.
  const queued=new Set(),queue=[];let running=0;
  async function drain(){
    if(running>=2||!queue.length)return;running++;const id=queue.shift();
    try{
      const product=await (id.startsWith(prefix)?base.fetchProductById(id):legacyDetail(id,true));
      if(product){
        const old=snapshot.find(p=>p.id===id);if(old)Object.assign(old,product);
        window.OlafAgeGate?.update(product);window.dispatchEvent(new CustomEvent('olaf:supplier-media',{detail:product}));}
    }catch{/* Leave the age gate and existing catalog intact on metadata failure. */}
    finally{running--;drain();}
  }
  if(document.addEventListener&&typeof IntersectionObserver!=='undefined')document.addEventListener('DOMContentLoaded',()=>{
    const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);
      const el=entry.target,source=el.getAttribute('src');
      const href=el.closest('.product-card')?.querySelector('a[href*="product.html?id="]')?.getAttribute('href');
      const cardId=href?new URL(href,location.href).searchParams.get('id'):null;
      const id=window.OlafAgeGate?.productIdForSource(source)||el.closest('[data-preview-product]')?.dataset.previewProduct||el.closest('[data-discovery-product]')?.dataset.discoveryProduct||cardId||snapshot.find(p=>p.image===source)?.id;
      if(!id||queued.has(id))continue;queued.add(id);queue.push(id);drain();
    }},{rootMargin:'150px'});
    const scan=()=>document.querySelectorAll('img').forEach(img=>{if(img.dataset.supplierMediaObserved)return;img.dataset.supplierMediaObserved='true';observer.observe(img);});
    scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  });
  // No per-tab background polling of the full catalog. Explicit page loads/data
  // requests refresh it; checkout still obtains a fresh server-side price quote.
  const orders=window.OlafOrders;
  if(orders?.fetchMyOrders){const original=orders.fetchMyOrders;orders.fetchMyOrders=async function(...args){
    const rows=await original.apply(orders,args);if(!rows.some(o=>String(o.orderNumber).startsWith('S499-')))return rows;
    try{const {data}=await window.olafSupabase.auth.getSession();if(!data?.session)return rows;
      const r=await fetch('/api/admin-supplier?action=shop-orders',{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store'});const j=await r.json();if(!j.success)return rows;
      const map=new Map(j.data.map(o=>[o.id,o]));return rows.map(o=>{const s=map.get(o.id);return !s?o:{...o,supplierOrder:true,items:[{id:o.id,orderId:o.id,productId:'supplier-order-'+o.id,productName:s.name,name:s.name,productImageUrl:s.image,image:s.image,unitPrice:s.price,quantity:1,lineTotal:s.price}]};});
    }catch{return rows;}
  };}
})();
