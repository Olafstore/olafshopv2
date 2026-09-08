(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ranks=['brone','gold','platinum','diamonds','super','supreme'];
 const image=id=>typeof id==='string'&&id.startsWith('iconprofile/')?'api/profile-avatar?id='+encodeURIComponent(id):'';
 const safeImage=value=>{if(!value)return '';try{const u=new URL(value,document.baseURI);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
 document.addEventListener('DOMContentLoaded',async()=>{
  const root=document.getElementById('public-profile-root'),id=new URLSearchParams(location.search).get('id');
  const missing=()=>{root.innerHTML='<section class="public-profile-message"><h1>ไม่พบโปรไฟล์สาธารณะ</h1><p>ลิงก์อาจไม่ถูกต้อง หรือเจ้าของปิดการแชร์ไว้</p><a href="index.html">กลับหน้าร้าน</a></section>';};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')){missing();return;}
  try{
   const {data:p,error}=await window.olafSupabase.rpc('shop_view_public_profile',{p_share_id:id});if(error)throw error;if(!p){missing();return;}
   const avatar=image(p.avatar),background=image(p.background),rank=ranks[Number(p.rank)-1];
   const games=Array.isArray(p.games)?p.games.slice(0,12):[];
   document.title=`${p.displayName||'สมาชิก OLAF'} · OLAF COMMUNITY`;
   root.innerHTML=`<article class="public-profile-card"><header class="public-profile-cover">${background?`<img class="public-profile-background" src="${esc(background)}" alt="">`:''}<div class="public-profile-identity">${avatar?`<img class="public-profile-avatar" src="${esc(avatar)}" alt="รูปโปรไฟล์">`:'<span class="public-profile-avatar public-monogram">O</span>'}<div><small>OLAF COMMUNITY</small><h1>${esc(p.displayName||'สมาชิก OLAF')}${rank?`<img class="public-profile-rank" src="api/rank-image?rank=${rank}" alt="Rank ${rank}">`:''}</h1><p>${esc(p.bio||'สวัสดี')}</p></div></div></header><section class="public-profile-games"><h2>เกมที่เลือกโชว์ <span>${games.length} เกม</span></h2><div>${games.map(g=>{const src=safeImage(g.image);return `<a href="product.html?id=${encodeURIComponent(g.id)}">${src?`<img src="${esc(src)}" loading="lazy" alt="" referrerpolicy="no-referrer">`:''}<strong>${esc(g.name||'เกม')}</strong></a>`;}).join('')||'<p>ยังไม่ได้เลือกเกมมาแสดง</p>'}</div></section></article>`;
  }catch{root.innerHTML='<section class="public-profile-message"><h1>โหลดโปรไฟล์ไม่สำเร็จ</h1><p>กรุณาลองใหม่อีกครั้ง</p><button type="button">ลองใหม่</button></section>';root.querySelector('button').onclick=()=>location.reload();}
 });
})();
