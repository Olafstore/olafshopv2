import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
export const sample=Array.from({length:8},(_,i)=>({id:'game-'+i,name:['CRIMSON DESERT','SPACE MARINE','ARMA III','PARADISE','READY OR NOT','RESIDENT EVIL','SHAPEZ 2','UTOPIA'][i],heroImage:'/art/'+i,image:'/art/'+i,gallery:['/art/'+i],price:49+i*10,compareAt:999,stock:10,sold:8-i,category:'offline'}));
export function storefront(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ctx=vm.createContext({cleanDisplayText:String,escapeHtml:esc,formatPrice:n=>'฿'+n,getDiscount:p=>p.compareAt?Math.round((1-p.price/p.compareAt)*100):0,getDisplayTags:()=>['แอ็กชัน','เล่นคนเดียว'],getStockState:()=>({className:'in-stock',label:'พร้อมส่ง'}),productLink:p=>'product.html?id='+encodeURIComponent(p.id),fastImg:(url,name)=>'src="'+esc(url)+'" alt="'+esc(name)+'"',getCategoryLabel:()=> 'Steam Offline',steamEditorialShuffle:p=>p,steamActivitySlideIndex:0});
 for(const name of ['steamPriceMarkup','steamStoreDescription','steamSpotlightMarkup','steamActivitySlides','steamActivityCardMarkup','steamActivityCarouselMarkup']){
  const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);
 }
 return ctx;
}
