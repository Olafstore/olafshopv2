// Steam store data only; no supplier keys or purchases. Cache avoids per-view upstream calls.
const cache=new Map();
// Explicit matches verified against the Steam store; never strip supplier ID suffixes.
const verifiedAliases={'3764200001':'3764200','3768760001':'3768760'};
export const steamText=value=>String(value||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):'').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,40000);
export function steamImage(value){try{const u=new URL(value);return u.protocol==='https:'&&/(^|\.)(steamstatic\.com|steamcdn-a\.akamaihd\.net|steamusercontent\.com)$/.test(u.hostname)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export function supplierSteamId(row){
  if(verifiedAliases[row.supplier_product_id])return verifiedAliases[row.supplier_product_id];
  const s=row.steam||{};
  for(const value of [s.appid,s.app_id,s.steam_appid])if(/^\d{1,9}$/.test(String(value||'')))return String(value);
  for(const image of Array.isArray(s.screenshots)?s.screenshots:[]){const url=steamImage(typeof image==='string'?image:image?.path_full);const m=url.match(/\/apps\/(\d{1,9})\//);if(m)return m[1];}
  // Do not truncate synthetic supplier IDs or guess an unrelated app from its name.
  return s.name&&/^\d{1,9}$/.test(String(row.supplier_product_id||''))?String(row.supplier_product_id):null;
}
export async function getSteamMetadata(appId,{fetcher=fetch,language='thai',now=Date.now}={}){
  if(!/^\d{1,9}$/.test(String(appId)))throw new Error('INVALID_STEAM_APP');
  const key=appId+':'+language;const cached=cache.get(key);if(cached&&cached.until>now())return cached.value;
  const promise=(async()=>{
    const r=await fetcher(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=${language==='english'?'english':'thai'}&cc=th`,{headers:{Accept:'application/json','User-Agent':'OLAF-SHOP/1.0'},signal:AbortSignal.timeout(4500),redirect:'error'});
    if(!r.ok)throw new Error('STEAM_UNAVAILABLE');const body=await r.text();if(Buffer.byteLength(body)>4*1024*1024)throw new Error('STEAM_RESPONSE_TOO_LARGE');
    const item=JSON.parse(body)?.[appId];const d=item?.data;if(!item?.success||String(d?.steam_appid)!==String(appId))throw new Error('STEAM_APP_NOT_FOUND');
    return {appId:Number(appId),name:steamText(d.name),headerImage:steamImage(d.header_image),shortDescription:steamText(d.short_description),description:steamText(d.detailed_description||d.about_the_game),
      screenshots:(d.screenshots||[]).map(s=>steamImage(s.path_full)).filter(Boolean).slice(0,12),
      requirements:{minimum:steamText(d.pc_requirements?.minimum).split('\n').filter(Boolean),recommended:steamText(d.pc_requirements?.recommended).split('\n').filter(Boolean)},
      genres:(d.genres||[]).map(g=>steamText(g.description)).filter(Boolean),steamUrl:`https://store.steampowered.com/app/${appId}/`};
  })();
  if(cache.size>=300)cache.delete(cache.keys().next().value);cache.set(key,{value:promise,until:now()+21600000});
  try{return await promise;}catch(e){cache.delete(key);throw e;}
}
