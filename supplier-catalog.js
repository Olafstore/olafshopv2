// Public DTO only; supplier costs/secrets never enter this adapter.
(() => {
  const base=window.OlafProducts;if(!base)return;
  const prefix='supplier-';let snapshot=[],expires=0,pending;
  const mapProduct=(p,checkoutEnabled=true)=>({
        id:prefix+p.id,supplierProductId:p.id,supplierProduct:true,name:p.name,category:'offline',label:'Steam Offline',
        price:p.price,compareAt:p.compareAt,stock:p.available?p.stock:0,sold:0,rating:'',publisher:'Steam',
        image:p.image,heroImage:p.screenshots?.[0]||p.image,gallery:p.screenshots||[],tags:p.genres||[],
        description:p.description,delivery:'รับบัญชีในออเดอร์หลังตรวจชำระเงิน',warranty:'บัญชีเล่นออฟไลน์ ไม่ใช่ CD Key',
        detailSections:[{title:'เงื่อนไขบัญชี Steam Offline',body:'ใช้เล่นออฟไลน์เท่านั้น ห้ามเปลี่ยนข้อมูลบัญชี ไม่ใช่บัญชีส่วนตัวหรือ CD Key'+(p.denuvo?' · มี Denuvo อาจต้องรอคิวเปิดใช้งาน':'')}],
        systemRequirements:{minimum:p.requirements?[p.requirements]:[],recommended:[]},featureBlocks:[],platformLinks:[],steamRelatedLinks:[],badgeOverrides:[],
        isActive:true,sortOrder:0,checkoutEnabled:checkoutEnabled,denuvo:p.denuvo,rawPublic:p
      });
  async function catalog(force=false){
    if(!force&&Date.now()<expires)return snapshot;
    if(pending)return pending;
    pending=(async()=>{
      const r=await fetch('/api/admin-supplier?action=shop-catalog',{cache:'no-store'});const j=await r.json();
      if(!r.ok||!j.success||!Array.isArray(j.data?.products))throw new Error('SUPPLIER_CATALOG_UNAVAILABLE');
      snapshot=j.data.products.map(p=>mapProduct(p,j.data.checkoutEnabled));expires=Date.now()+55000;return snapshot;
    })();try{return await pending;}finally{pending=null;}
  }
  const active=base.fetchActiveProducts,byId=base.fetchProductById,packages=base.fetchActiveProductPackages,related=base.fetchRelatedProducts;
  base.fetchActiveProducts=async function(options){const [legacy,supplier]=await Promise.all([active.call(base,options),catalog().catch(()=>[])]);return [...legacy,...supplier];};
  base.fetchProductById=async id=>{
    if(!String(id).startsWith(prefix))return byId.call(base,id);
    const r=await fetch('/api/admin-supplier?action=shop-product&productId='+encodeURIComponent(id.slice(prefix.length)),{cache:'no-store'});const j=await r.json();
    if(r.status===404)return null;if(!r.ok||!j.success)throw new Error('SUPPLIER_PRODUCT_UNAVAILABLE');return mapProduct(j.data);
  };
  if(packages)base.fetchActiveProductPackages=(id,...args)=>String(id).startsWith(prefix)?Promise.resolve([]):packages.call(base,id,...args);
  if(related)base.fetchRelatedProducts=async(id,category,limit=8)=>String(id).startsWith(prefix)?(await catalog()).filter(p=>p.id!==id).slice(0,limit):related.call(base,id,category,limit);
  window.OlafSupplierCatalog={catalog,isSupplier:id=>String(id).startsWith(prefix)};
  setInterval(async()=>{if(document.hidden)return;try{const products=await catalog(true);window.dispatchEvent(new CustomEvent('olaf:supplier-catalog',{detail:products}));}catch{/* Never replace a working legacy catalog on supplier failure. */}},60000);
  const orders=window.OlafOrders;
  if(orders?.fetchMyOrders){const original=orders.fetchMyOrders;orders.fetchMyOrders=async function(...args){
    const rows=await original.apply(orders,args);if(!rows.some(o=>String(o.orderNumber).startsWith('S499-')))return rows;
    try{const {data}=await window.olafSupabase.auth.getSession();if(!data?.session)return rows;
      const r=await fetch('/api/admin-supplier?action=shop-orders',{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store'});const j=await r.json();if(!j.success)return rows;
      const map=new Map(j.data.map(o=>[o.id,o]));return rows.map(o=>{const s=map.get(o.id);return !s?o:{...o,supplierOrder:true,items:[{id:o.id,orderId:o.id,productId:'supplier-order-'+o.id,productName:s.name,name:s.name,productImageUrl:s.image,image:s.image,unitPrice:s.price,quantity:1,lineTotal:s.price}]};});
    }catch{return rows;}
  };}
})();
