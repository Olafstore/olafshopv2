(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const artwork=id=>typeof id==='string'&&id.startsWith('iconprofile/')?'api/profile-avatar?id='+encodeURIComponent(id):'';
 const ranks=['brone','gold','platinum','diamonds','super','supreme'];
 const number=value=>value==null||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('th-TH',{maximumFractionDigits:2});
 async function viewerSidebar(){
  const sidebar=document.querySelector('.profile-sidebar');if(!sidebar)return;
  const original=sidebar.innerHTML;
  sidebar.innerHTML='<p class="member-sidebar-message">กำลังโหลดบัญชีของคุณ…</p>';
  try{
   await window.OlafStore?.ready;
   const user=window.OlafStore?.currentUser();
   if(!user){sidebar.innerHTML='<div class="profile-sidebar-card member-sidebar-message">เข้าสู่ระบบเพื่อใช้เมนูบัญชีของคุณ<br><a href="login.html">เข้าสู่ระบบ</a></div>';return;}
   sidebar.innerHTML=original;
   const current=()=>window.OlafStore?.currentUser()?.id===user.id;
   const set=(selector,value)=>{const node=sidebar.querySelector(selector);if(node)node.textContent=value;};
   set('#profile-sidebar-name',user.displayName||user.username||'สมาชิก');set('#profile-sidebar-email',user.email||'');set('#profile-sidebar-role',user.role||'member');
   const avatar=sidebar.querySelector('#profile-sidebar-avatar');
   if(avatar){avatar.textContent=(user.displayName||user.username||'U').slice(0,1);if(user.avatarUrl){const img=document.createElement('img');try{const url=new URL(user.avatarUrl,document.baseURI);if(['http:','https:'].includes(url.protocol)){img.src=url.href;img.alt='รูปโปรไฟล์ของคุณ';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:inherit';avatar.replaceChildren(img);}}catch{}}}
   sidebar.querySelectorAll('[data-panel]').forEach(button=>{button.classList.remove('is-active');button.onclick=()=>{const panel=button.dataset.panel;location.href='profile.html#'+(panel==='overview'?'user':panel);};});
   sidebar.querySelector('[data-panel="overview"]')?.classList.add('is-active');
   sidebar.querySelectorAll('[data-refresh-points]').forEach(a=>a.href='profile.html#info');
   sidebar.querySelector('#profile-points-card')?.removeAttribute('hidden');
   set('#profile-sidebar-point-balance','—');set('#profile-point-balance','—');
   const status=document.createElement('p');status.dataset.viewerStatus='';status.setAttribute('role','status');sidebar.append(status);
   sidebar.querySelector('#logout-btn')?.addEventListener('click',async e=>{
    const button=e.currentTarget;button.disabled=true;
    try{await window.OlafStore.logout();location.href='index.html';}
    catch{status.textContent='ออกจากระบบไม่สำเร็จ กรุณาลองใหม่';button.disabled=false;}
   });
   window.lucide?.createIcons();
   let loading=false;
   const refresh=async()=>{
    if(loading)return;
    if(!current()){sidebar.innerHTML='<p class="member-sidebar-message">บัญชีเปลี่ยนแล้ว กรุณารีเฟรชหน้า</p>';return;}
    loading=true;
    try{const wallet=await window.OlafOrders.fetchPointBalance();if(!current()){sidebar.innerHTML='<p class="member-sidebar-message">บัญชีเปลี่ยนแล้ว กรุณารีเฟรชหน้า</p>';return;}set('#profile-sidebar-point-balance',number(wallet.balance));set('#profile-point-balance',number(wallet.balance));status.textContent='';}
    catch{if(current())status.textContent='โหลด Point ของคุณไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง';}
    finally{loading=false;}
   };
   window.addEventListener('focus',refresh);await refresh();
  }catch{sidebar.innerHTML='<p class="member-sidebar-message">โหลดบัญชีของคุณไม่สำเร็จ กรุณารีเฟรชหน้า</p>';}
 }
 function navigation(root){
  const form=document.createElement('form');form.className='member-visit-nav';
  form.innerHTML='<a href="profile.html#user">โปรไฟล์ของฉัน</a><label><span>ค้นหาสมาชิก</span><input name="username" aria-label="ค้นหาจากชื่อเล่นหรือ user" maxlength="80" placeholder="ชื่อเล่น หรือ user" autocomplete="off" required></label><button type="submit">ค้นหา →</button><div class="member-search-results" aria-live="polite" hidden></div>';
  const input=form.elements.username,button=form.querySelector('[type="submit"]'),results=form.querySelector('.member-search-results');let version=0;
  input.addEventListener('input',()=>{version++;results.replaceChildren();results.hidden=true;button.disabled=false;form.removeAttribute('aria-busy');});
  form.onsubmit=async e=>{
   e.preventDefault();const query=input.value.trim();if(!query)return;
   const request=++version;button.disabled=true;form.setAttribute('aria-busy','true');results.hidden=false;results.textContent='กำลังค้นหาสมาชิก…';
   try{
    const {data,error}=await window.olafSupabase.rpc('shop_search_members',{p_query:query});if(request!==version)return;if(error)throw error;
    const members=Array.isArray(data)?data.slice(0,10):[];
    results.innerHTML=members.length?`<p>เลือกโปรไฟล์ที่ต้องการเยี่ยมชม${members.length===10?' · แสดงสูงสุด 10 คน ระบุชื่อเพิ่มเพื่อค้นหาให้ตรงขึ้น':''}</p><div>${members.map(member=>{
     const avatar=artwork(member.avatar);
     const portrait=avatar?`<img src="${esc(avatar)}" alt="" loading="lazy">`:`<span class="member-search-avatar" aria-hidden="true">${esc((member.nickname||member.username||'U').slice(0,1))}</span>`;
     return `<a href="profile.html#user/${encodeURIComponent(member.username)}">${portrait}<span><strong>${esc(member.nickname||member.username)}</strong><small>@${esc(member.username)}</small></span><span aria-hidden="true">→</span></a>`;
    }).join('')}</div>`:'ไม่พบสมาชิกจากชื่อเล่นหรือ user นี้';
   }catch{if(request===version)results.textContent='ค้นหาไม่สำเร็จ กรุณาลองใหม่ หรือให้แอดมินตรวจการติดตั้ง supabase-member-search.sql';}
   finally{if(request===version){button.disabled=false;form.removeAttribute('aria-busy');}}
  };root.before(form);
 }
 window.addEventListener('olaf-profile-ready',()=>{
  const root=document.getElementById('profile-overview-root');if(root&&!document.querySelector('.member-visit-nav'))navigation(root);
 });
 document.addEventListener('DOMContentLoaded',async()=>{
  const route=window.OlafProfileRoute;if(!route?.visiting)return;
  viewerSidebar();
  const root=document.getElementById('profile-overview-root'),panel=document.getElementById('panel-overview');
  document.querySelectorAll('.profile-panel').forEach(p=>p.classList.remove('is-active'));panel.classList.add('is-active');
  navigation(root);root.setAttribute('aria-busy','true');root.innerHTML='<p class="member-visit-message">กำลังโหลดโปรไฟล์สมาชิก…</p>';
  try{
   if(!route.username||route.username.length>80)throw new Error('NOT_FOUND');
   const {data:p,error}=await window.olafSupabase.rpc('shop_member_profile',{p_username:route.username});if(error)throw error;if(!p)throw new Error('NOT_FOUND');
   const avatar=artwork(p.avatar),background=artwork(p.background),rank=ranks[p.rank-1];
   const games=Array.isArray(p.games)?p.games.slice(0,12):[];
   document.title=`${p.displayName} · โปรไฟล์สมาชิก | OLAF SHOP`;
   root.innerHTML=`<article class="member-showcase member-visitor-showcase"><header class="member-cover">${background?`<img class="member-background" src="${esc(background)}" alt="พื้นหลังโปรไฟล์">`:''}<div class="member-identity">${avatar?`<img class="member-portrait" src="${esc(avatar)}" alt="รูปโปรไฟล์">`:'<span class="member-portrait member-monogram">O</span>'}<div><small>OLAF COMMUNITY · โปรไฟล์สมาชิก</small><h2>${esc(p.displayName)}${rank?`<img class="member-visitor-badge" src="api/rank-image?rank=${rank}" alt="Rank ${rank}">`:''}</h2><p class="member-visitor-bio">${esc(p.bio||'สวัสดี')}</p></div></div>${rank?`<div data-profile-rank-slot><section class="member-ranks"><h3>แรงค์ปัจจุบัน · ${esc(rank)}</h3><div class="rank-track">${ranks.map((r,i)=>`<div class="rank-emblem ${i===p.rank-1?'is-current':''}" style="--rank-opacity:${Math.max(.25,1-Math.abs(i+1-p.rank)*.15)}"><img src="api/rank-image?rank=${r}" alt="${r}"><strong>${r}</strong></div>`).join('')}</div></section></div>`:''}</header><div class="member-stats" aria-label="สถิติของสมาชิกที่กำลังเยี่ยมชม"><div><small>เกมที่ซื้อ (ไม่ซ้ำ)</small><strong data-visited-game-count>${number(p.stats?.purchasedGames)}</strong></div><div><small>ยอดเงินในเว็บ · Point</small><strong data-visited-point-balance>${number(p.stats?.pointBalance)}</strong></div><div><small>แต้มร้านค้าตกแต่ง</small><strong data-visited-shop-points>${number(p.stats?.shopPoints)}</strong></div></div><section class="member-games"><h3>คอลเลกชันเกมที่เลือกโชว์</h3><div class="member-game-grid">${games.map(g=>{let src='';try{const url=new URL(g.image||'',document.baseURI);if(g.image&&['http:','https:'].includes(url.protocol))src=url.href;}catch{}return `<a href="product.html?id=${encodeURIComponent(g.id)}">${src?`<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<strong>${esc(g.name)}</strong></a>`;}).join('')||'<p>ยังไม่ได้เลือกเกมมาแสดง</p>'}</div></section></article>`;
  }catch(error){root.innerHTML=`<p class="member-visit-message">${error.message==='NOT_FOUND'?'ไม่พบสมาชิกนี้ หรือบัญชีไม่พร้อมแสดงโปรไฟล์':'โหลดโปรไฟล์ไม่สำเร็จ กรุณาลองรีเฟรช หากยังไม่สำเร็จให้แอดมินตรวจ supabase-member-profiles.sql'}</p>`;}
  finally{root.removeAttribute('aria-busy');}
 });
})();
