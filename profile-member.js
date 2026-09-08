(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const artwork=id=>typeof id==='string'&&id.startsWith('iconprofile/')?'api/profile-avatar?id='+encodeURIComponent(id):'';
 const ranks=['brone','gold','platinum','diamonds','super','supreme'];
 function navigation(root){
  const form=document.createElement('form');form.className='member-visit-nav';
  form.innerHTML='<a href="profile.html#user">โปรไฟล์ของฉัน</a><label><span>ดูโปรไฟล์สมาชิก</span><input name="username" aria-label="ชื่อผู้ใช้ที่ต้องการเยี่ยมชม" maxlength="80" placeholder="ชื่อผู้ใช้" required></label><button type="submit">ดูโปรไฟล์ →</button>';
  form.onsubmit=e=>{e.preventDefault();const name=form.elements.username.value.trim();if(name)location.hash='user/'+encodeURIComponent(name);};root.before(form);
 }
 window.addEventListener('olaf-profile-ready',()=>{
  const root=document.getElementById('profile-overview-root');if(root&&!document.querySelector('.member-visit-nav'))navigation(root);
 });
 document.addEventListener('DOMContentLoaded',async()=>{
  const route=window.OlafProfileRoute;if(!route?.visiting)return;
  const root=document.getElementById('profile-overview-root'),panel=document.getElementById('panel-overview');
  document.querySelectorAll('.profile-panel').forEach(p=>p.classList.remove('is-active'));panel.classList.add('is-active');
  navigation(root);root.setAttribute('aria-busy','true');root.innerHTML='<p class="member-visit-message">กำลังโหลดโปรไฟล์สมาชิก…</p>';
  try{
   if(!route.username||route.username.length>80)throw new Error('NOT_FOUND');
   const {data:p,error}=await window.olafSupabase.rpc('shop_member_profile',{p_username:route.username});if(error)throw error;if(!p)throw new Error('NOT_FOUND');
   const avatar=artwork(p.avatar),background=artwork(p.background),rank=ranks[p.rank-1];
   const games=Array.isArray(p.games)?p.games.slice(0,12):[];
   document.title=`${p.displayName} · โปรไฟล์สมาชิก | OLAF SHOP`;
   root.innerHTML=`<article class="member-showcase member-visitor-showcase"><header class="member-cover">${background?`<img class="member-background" src="${esc(background)}" alt="พื้นหลังโปรไฟล์">`:''}<div class="member-identity">${avatar?`<img class="member-portrait" src="${esc(avatar)}" alt="รูปโปรไฟล์">`:'<span class="member-portrait member-monogram">O</span>'}<div><small>OLAF COMMUNITY · โปรไฟล์สมาชิก</small><h2>${esc(p.displayName)}${rank?`<img class="member-visitor-badge" src="api/rank-image?rank=${rank}" alt="Rank ${rank}">`:''}</h2><p class="member-visitor-bio">${esc(p.bio||'สวัสดี')}</p></div></div>${rank?`<div data-profile-rank-slot><section class="member-ranks"><h3>แรงค์ปัจจุบัน · ${esc(rank)}</h3><div class="rank-track">${ranks.map((r,i)=>`<div class="rank-emblem ${i===p.rank-1?'is-current':''}" style="--rank-opacity:${Math.max(.25,1-Math.abs(i+1-p.rank)*.15)}"><img src="api/rank-image?rank=${r}" alt="${r}"><strong>${r}</strong></div>`).join('')}</div></section></div>`:''}</header><section class="member-games"><h3>คอลเลกชันเกมที่เลือกโชว์</h3><div class="member-game-grid">${games.map(g=>{let src='';try{const url=new URL(g.image||'',document.baseURI);if(g.image&&['http:','https:'].includes(url.protocol))src=url.href;}catch{}return `<a href="product.html?id=${encodeURIComponent(g.id)}">${src?`<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<strong>${esc(g.name)}</strong></a>`;}).join('')||'<p>ยังไม่ได้เลือกเกมมาแสดง</p>'}</div></section></article>`;
  }catch(error){root.innerHTML=`<p class="member-visit-message">${error.message==='NOT_FOUND'?'ไม่พบสมาชิกนี้ หรือบัญชีไม่พร้อมแสดงโปรไฟล์':'โหลดโปรไฟล์ไม่สำเร็จ กรุณาลองรีเฟรช หากยังไม่สำเร็จให้แอดมินตรวจ supabase-member-profiles.sql'}</p>`;}
  finally{root.removeAttribute('aria-busy');}
 });
})();
