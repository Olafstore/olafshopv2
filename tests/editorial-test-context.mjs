import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const segment=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
export function editorialContext(seed=42){
 const context=vm.createContext({steamSpotlightSessionSeed:seed,
  cleanDisplayText:v=>String(v||''),escapeHtml:v=>String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
  productLink:p=>'product.html?id='+encodeURIComponent(p.id),getCategoryLabel:()=> 'คีย์ Steam',translateTagToThai:v=>v,
  getStockState:()=>({className:'stock',label:'พร้อมส่ง 24 ชิ้น'}),
  getDiscount:p=>p.compareAt>p.price?Math.round((1-p.price/p.compareAt)*100):0,
  fastImg:src=>'src="'+src+'"',formatPrice:n=>'฿'+n});
 vm.runInContext(segment('function steamPriceMarkup(', 'function steamSpotlightMarkup(')
  +segment('function steamDealCardMarkup(', 'function steamDiscoveryPreviewMarkup(')
  +segment('function steamEditorialRandomScore(', 'function steamActivitySlides(')
  +segment('const catalogDiscoverySkipped', 'function catalogDiscoveryModel(')
  +segment('function catalogProductTagsMarkup(', 'function catalogDiscoveryShelfMarkup('),context);
 return context;
}
