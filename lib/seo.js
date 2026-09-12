import catalog from '../assets/products-index.json' with {type:'json'};
export const ORIGIN='https://olafshop.com';
export const fallbackImage=ORIGIN+'/api/site-image?v=admin-logo-v1';
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const plain=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function imageUrl(value){try{const u=new URL(value,ORIGIN);return u.protocol==='https:'&&!u.username&&!u.password?u.href:fallbackImage;}catch{return fallbackImage;}}
export const productUrl=id=>ORIGIN+'/product?id='+encodeURIComponent(id);
export function metadata(product){
 const name=plain(product.name),title=name+' | OLAF SHOP';
 const description=(plain(product.description)||'ดูรายละเอียด '+name+' ประเภท '+plain(product.category||'เกม PC')+' เงื่อนไขการรับสินค้าและการรับประกันที่ OLAF SHOP').slice(0,180);
 const url=productUrl(product.id),image=imageUrl(product.image_url||product.image||product.hero_image_url||product.heroImage);
 const schema={'@context':'https://schema.org','@type':'Product',name,description,image:[image],url,sku:String(product.id)};
 return {name,title,description,url,image,html:`<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(url)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:site_name" content="OLAF SHOP"><meta property="og:locale" content="th_TH">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(image)}"><meta property="og:image:alt" content="${escape(name)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(image)}">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`};
}
const active=p=>p.is_active!==false&&p.isActive!==false;
export async function getProducts(id,{fetcher=fetch,env=process.env}={}){
 const base=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY;
 if(base&&key){
  const result=[];
  for(let offset=0;offset<50000;offset+=1000){
   const url=new URL('/rest/v1/products',base);url.searchParams.set('select','id,name,description,category,image_url,hero_image_url');url.searchParams.set('is_active','eq.true');url.searchParams.set('order','id.asc');url.searchParams.set('limit','1000');url.searchParams.set('offset',String(offset));if(id)url.searchParams.set('id','eq.'+id);
   const response=await fetcher(url,{headers:{apikey:key},signal:AbortSignal.timeout(6000)});
   if(!response.ok)throw new Error('CATALOG_UNAVAILABLE');const rows=await response.json();if(!Array.isArray(rows))throw new Error('INVALID_CATALOG');result.push(...rows);if(id||rows.length<1000)return result;
  }
  throw new Error('CATALOG_TOO_LARGE');
 }
 return (catalog.products||[]).filter(p=>active(p)&&(!id||p.id===id));
}
export function sitemap(products){return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[ORIGIN+'/',ORIGIN+'/more-products.html',ORIGIN+'/free-games.html',...products.map(p=>productUrl(p.id))].map(url=>'<url><loc>'+escape(url)+'</loc></url>').join('')+'</urlset>';}
