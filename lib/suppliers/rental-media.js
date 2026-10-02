import {readFile} from 'node:fs/promises';
import {getSteamMetadata,steamImage,steamText} from '../steam-metadata.js';
let snapshot;
const appId=value=>/^[1-9][0-9]{0,8}$/.test(String(value||''))?String(value):null;
const usableName=value=>typeof value==='string'&&value.trim()&&!/^(?:unknown|untitled|null|undefined|steam app\s*\d*|ไม่มีชื่อ)$/i.test(value.trim());
const imageFor=(value,id)=>{const safe=steamImage(value);return safe&&new RegExp(`/apps/${id}/`).test(new URL(safe).pathname)?safe:'';};
export function verifiedRentalMedia(data,id){
 if(!data||String(data.appId)!==String(id)||!usableName(data.name)||!imageFor(data.headerImage,id))return null;
 if(data.type&&data.type!=='game')return null;
 const genres=(data.genres||[]).filter(g=>typeof g==='string').map(steamText).slice(0,8);
 if(genres.some(g=>/^(animation & modeling|design & illustration|photo editing|utilities|video production|software training)$/i.test(g)))return null;
 return {name:steamText(data.name),image:imageFor(data.headerImage,id),steamAppId:String(id),genres,mediaStatus:'ready',
  shortDescription:steamText(data.shortDescription),description:steamText(data.description),
  screenshots:(data.screenshots||[]).map(u=>imageFor(u,id)).filter(Boolean).slice(0,12),
  requirements:{minimum:(data.requirements?.minimum||[]).map(steamText),recommended:(data.requirements?.recommended||[]).map(steamText)},
  steamUrl:`https://store.steampowered.com/app/${id}/`,ageStatus:data.ageStatus,ageRestricted:data.ageRestricted,requiredAge:data.requiredAge};
}
async function mediaSnapshot(){
 if(!snapshot)snapshot=readFile(new URL('../../assets/supplier-steam-media-v18.json',import.meta.url),'utf8').then(t=>JSON.parse(t).apps||{}).catch(()=>({}));
 return snapshot;
}
export async function rentalCatalogMedia(rows,{snapshotData}={}){
 const apps=snapshotData||await mediaSnapshot();
 return rows.flatMap(p=>{
  const id=appId(p.product_id);if(!id||!usableName(p.name))return [];
  const verified=verifiedRentalMedia(apps[id],id);
  if(apps[id]&&!verified)return [];
  // Never use a supplier placeholder or a guessed Steam ID as verified artwork.
  const summary=verified?{name:verified.name,image:verified.image,genres:verified.genres,steamAppId:id,mediaStatus:'ready',ageStatus:verified.ageStatus,ageRestricted:verified.ageRestricted}:null;
  return [{id:String(p.product_id),type:'rental',...(summary||{name:steamText(p.name),image:'',genres:[],steamAppId:id,mediaStatus:'pending'})}];
 });
}
export async function rentalProductMedia(id,{fetcher=fetch}={}){
 if(!appId(id))return null;
 try{return verifiedRentalMedia(await getSteamMetadata(id,{fetcher}),String(id));}
 catch(error){if(error.message==='STEAM_APP_NOT_FOUND')return null;throw error;}
}
