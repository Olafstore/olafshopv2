const EPIC_URL='https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=TH&allowCountries=TH';
let cached=null,pending=null;
export function parseEpicPromotions(payload,now=Date.now()){
 const elements=payload?.data?.Catalog?.searchStore?.elements;
 if(!Array.isArray(elements))throw new Error('INVALID_EPIC_FEED');
 const active=new Map(),upcoming=new Map();
 for(const item of elements){
  if(!item?.id||typeof item.title!=='string')continue;
  const groups=[...(item.promotions?.promotionalOffers||[]),...(item.promotions?.upcomingPromotionalOffers||[])];
  for(const group of groups){
   for(const promotion of group.promotionalOffers||[]){
    const start=Date.parse(promotion.startDate),end=Date.parse(promotion.endDate);
    if(promotion.discountSetting?.discountPercentage!==0||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end<=now)continue;
    if(start<=now&&item.price?.totalPrice?.discountPrice!==0)continue;
    const mappings=[...(item.offerMappings||[]),...(item.catalogNs?.mappings||[])];
    const slug=mappings.find(m=>m.pageType==='productHome')?.pageSlug||item.productSlug;
    const safeSlug=typeof slug==='string'&&/^[a-z0-9][a-z0-9/_-]*$/i.test(slug)?slug.replace(/\/home$/,''):'';
    const assets=item.keyImages||[];
    const asset=['OfferImageWide','DieselStoreFrontWide','Thumbnail','OfferImageTall'].map(type=>assets.find(a=>a.type===type)).find(Boolean);
    let image='';try{const url=new URL(asset?.url);if(url.protocol==='https:'&&(url.hostname==='epicgames.com'||url.hostname.endsWith('.epicgames.com')))image=url.href;}catch{}
    const offer={id:'epic-'+item.id,title:item.title,platform:'epic',platformLabel:'Epic Games',type:'keep',typeLabel:'รับเข้าคลังฟรี',startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString(),url:safeSlug?'https://store.epicgames.com/en-US/p/'+safeSlug:'https://store.epicgames.com/free-games',sourceUrl:'https://store.epicgames.com/free-games',image,summary:item.description||'รับสิทธิ์ผ่านบัญชี Epic Games ตามช่วงเวลาที่ประกาศ',verified:true};
    const target=start<=now?active:upcoming;
    if(!target.has(offer.id)||Date.parse(target.get(offer.id).startsAt)>start)target.set(offer.id,offer);
   }
  }
 }
 return {offers:[...active.values()],upcomingOffers:[...upcoming.values()].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt))};
}
export async function loadEpicPromotions(){
 const now=Date.now();if(cached&&cached.expires>now)return cached.data;
 if(pending)return pending;
 pending=(async()=>{
  const response=await fetch(EPIC_URL,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!response.ok)throw new Error('EPIC_UPSTREAM_ERROR');
  const timestamp=Date.now(),result=parseEpicPromotions(await response.json(),timestamp);
  const data={...result,checkedAt:new Date(timestamp).toISOString(),source:'epic',country:'TH'};
  const boundaries=[...result.offers,...result.upcomingOffers].flatMap(o=>[Date.parse(o.startsAt),Date.parse(o.endsAt)]).filter(t=>t>timestamp);
  cached={data,expires:Math.min(timestamp+60000,...boundaries)};return data;
 })();
 try{return await pending;}finally{pending=null;}
}
export default async function handler(request,response){
 response.setHeader('Cache-Control','no-store');
 if(request.method!=='GET'){response.setHeader('Allow','GET');return response.status(405).json({error:'METHOD_NOT_ALLOWED'});}
 try{return response.status(200).json(await loadEpicPromotions());}
 catch{return response.status(502).json({error:'EPIC_UNAVAILABLE',message:'ไม่สามารถยืนยันข้อมูลล่าสุดจาก Epic Games ได้ กรุณาลองใหม่'});}
}
