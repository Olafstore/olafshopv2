(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const user=()=>window.OlafStore?.currentUser?.();
 const avatar=id=>typeof id==='string'&&id.startsWith('iconprofile/')?'api/profile-avatar?id='+encodeURIComponent(id):'';
 const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/></svg>';
 const addIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m4-12v8m-4-4h8"/></svg>';
 const stateLabel={friends:'เป็นเพื่อนกัน',incoming:'ส่งคำขอถึงคุณ',outgoing:'ส่งคำขอแล้ว',none:'ยังไม่ได้เป็นเพื่อน',self:'นี่คือโปรไฟล์ของคุณ'};
 const errorText=error=>String(error?.message||'').includes('FRIEND_REQUEST_LIMIT')?'ส่งคำขอค้างได้สูงสุด 50 คน กรุณายกเลิกคำขอเก่าก่อน':'ดำเนินการไม่สำเร็จ กรุณาลองใหม่';
 let owner=null,launch,dialog,floating,pagePanel,timer,busy=false,latest='0',barVersion=0,barBusy=false,confirmation=null,ready=false,drag=null,positioned=false;
 const desktop=window.matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');
 const panels=new Set();
 const key=()=> 'olaf-friends-read:'+owner;
 const active=()=>owner&&user()?.id===owner;
 async function rpc(name,args){const id=user()?.id;if(!id)throw new Error('AUTH_REQUIRED');const result=await window.olafSupabase.rpc(name,args);if(user()?.id!==id)throw new Error('SESSION_CHANGED');if(result.error)throw result.error;return result.data;}
 const online=value=>value?'<span class="friend-online"><i></i>ออนไลน์</span>':'<span class="friend-offline"><i></i>ออฟไลน์</span>';
 function actions(state){return state==='none'?[['request','เพิ่มเพื่อน']]:state==='incoming'?[['accept','ยืนยันเพื่อน'],['decline','ปฏิเสธ']]:state==='outgoing'?[['cancel','ยกเลิกคำขอ']]:state==='friends'?[['remove','เลิกเป็นเพื่อน']]:[];}
 function confirmRemove(name){
  if(confirmation)return Promise.resolve(false);
  return new Promise(resolve=>{
   const box=document.createElement('dialog'),returnFocus=document.activeElement;
   box.className='friend-confirm';box.setAttribute('aria-labelledby','friend-confirm-title');box.setAttribute('aria-describedby','friend-confirm-text');
   box.innerHTML='<div class="friend-confirm-icon">'+icon+'</div><h2 id="friend-confirm-title">เลิกเป็นเพื่อน?</h2><p id="friend-confirm-text">ต้องการเลิกเป็นเพื่อนกับ <strong>'+esc(name||'ผู้ใช้นี้')+'</strong> ใช่ไหม?<br>คุณจะไม่เห็นสถานะออนไลน์และกิจกรรมของกันและกัน จนกว่าจะเพิ่มเพื่อนและยืนยันกันอีกครั้ง</p><div class="friend-confirm-actions"><button type="button" data-cancel autofocus>เป็นเพื่อนกันต่อ</button><button type="button" data-confirm-remove>ยืนยันเลิกเป็นเพื่อน</button></div>';
   let done=false;
   const finish=value=>{if(done)return;done=true;confirmation=null;box.close();box.remove();if(returnFocus?.isConnected)returnFocus.focus();resolve(value);};
   confirmation={cancel:()=>finish(false)};box.querySelector('[data-cancel]').onclick=()=>finish(false);
   box.querySelector('[data-confirm-remove]').onclick=()=>finish(true);
   box.addEventListener('cancel',e=>{e.preventDefault();finish(false);});box.addEventListener('close',()=>finish(false));
   document.body.append(box);box.showModal();
  });
 }
 async function perform(target,action,name){
  const id=user()?.id;if(!id)throw new Error('AUTH_REQUIRED');
  if(action==='remove'&&!await confirmRemove(name))return false;
  if(user()?.id!==id)throw new Error('SESSION_CHANGED');
  await rpc('shop_friend_action',{p_username:target,p_action:action});return true;
 }
 async function profileButton(){
  const target=window.OlafProfileRoute?.username,root=document.getElementById('profile-overview-root'),card=root?.querySelector('.member-visitor-showcase');
  if(!target||!card)return;
  let bar=card.querySelector('.member-friend-bar');
  if(!bar){bar=document.createElement('div');bar.className='member-friend-bar';const cover=card.querySelector('.member-cover');if(cover)cover.after(bar);else card.append(bar);}
  if(barBusy)return;
  const ticket=++barVersion;
  if(!user()){bar.innerHTML='<a href="login.html">เข้าสู่ระบบเพื่อเพิ่มเพื่อน</a>';return;}
  try{
   const data=await rpc('shop_friend_relation',{p_username:target});if(ticket!==barVersion)return;
   bar.innerHTML='<span>'+esc(stateLabel[data.state]||'')+' '+(data.state==='friends'?online(data.online):'')+'</span><div>'+actions(data.state).map(([action,label])=>'<button type="button" data-action="'+action+'">'+(action==='request'?addIcon:'')+esc(label)+'</button>').join('')+'</div><small role="status"></small>';
   bar.querySelectorAll('button').forEach(button=>button.onclick=async()=>{
    if(barBusy)return;barBusy=true;bar.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{if(await perform(target,button.dataset.action,card.querySelector('h2')?.textContent)){barBusy=false;await profileButton();await refreshPanels();await heartbeat();}}
    catch(error){if(bar.querySelector('[role="status"]'))bar.querySelector('[role="status"]').textContent=errorText(error);}
    finally{barBusy=false;bar.querySelectorAll('button').forEach(b=>b.disabled=false);}
   });
  }catch(error){if(ticket===barVersion)bar.textContent=errorText(error);}
 }
 function markRead(){try{localStorage.setItem(key(),latest);}catch{}launch?.querySelector('[data-friend-dot]')?.setAttribute('hidden','');}
 function person(r,state){
  const src=avatar(r.avatar),target=r.profileKey||r.username;
  return '<article class="friend-person"><a href="profile.html#user/'+encodeURIComponent(target)+'">'+(src?'<img src="'+esc(src)+'" alt="" loading="lazy">':'<span class="friend-avatar-placeholder">'+icon+'</span>')+'<span><strong>'+esc(r.nickname||r.username)+'</strong><small>@'+esc(r.username)+'</small>'+(state==='friends'?online(r.online):'')+'</span></a><div>'+actions(state).map(([action,label])=>'<button type="button" data-action="'+action+'" data-username="'+esc(target)+'" data-name="'+esc(r.nickname||r.username)+'">'+label+'</button>').join('')+'</div></article>';
 }
 function createPanel(host,isVisible){
  host.classList.add('friends-surface');
  host.innerHTML='<div class="friends-toolbar"><div><h3>พื้นที่ของเพื่อน</h3><p>พบเพื่อนและติดตามความเคลื่อนไหว</p></div><button type="button" data-add-friend aria-expanded="false">'+addIcon+'เพิ่มเพื่อน</button></div><form class="friends-search" hidden><label>ค้นหาด้วยชื่อเล่น หรือ user<input name="username" maxlength="80" autocomplete="off" placeholder="เช่น ADMIN หรือ ssonx" required></label><button type="submit">ค้นหา</button><div class="friends-search-results" aria-live="polite"></div></form><nav aria-label="หมวดเพื่อน"><button type="button" data-tab="friends" aria-pressed="true">เพื่อน</button><button type="button" data-tab="incoming" aria-pressed="false">คำขอที่ได้รับ</button><button type="button" data-tab="outgoing" aria-pressed="false">ส่งคำขอแล้ว</button><button type="button" data-tab="activity" aria-pressed="false">ความเคลื่อนไหว</button></nav><p class="friends-privacy">เฉพาะเพื่อนที่ยืนยันแล้วเห็นสถานะออนไลน์และกิจกรรมการซื้อของกันและกัน · ไม่แสดงรายละเอียดออเดอร์</p><div data-friend-list></div><p role="status" aria-live="polite"></p><button type="button" data-more hidden>โหลดเพิ่มอีก 10 รายการ</button>';
  const list=host.querySelector('[data-friend-list]'),status=host.querySelector('[role="status"]'),more=host.querySelector('[data-more]'),form=host.querySelector('form'),results=form.querySelector('.friends-search-results'),submit=form.querySelector('[type="submit"]'),add=host.querySelector('[data-add-friend]');
  let kind='friends',offset=0,version=0,searchVersion=0,loading=false;
  const panel={visible:isVisible,invalidate(){version++;searchVersion++;loading=false;submit.disabled=false;form.removeAttribute('aria-busy');host.removeAttribute('aria-busy');},clear(){list.replaceChildren();results.replaceChildren();form.elements.username.value='';more.hidden=true;},refresh:()=>offset<=10&&!loading?load(true):Promise.resolve(),load:()=>load(true)};
  panels.add(panel);
  async function load(reset=false){
   if(!isVisible())return;
   if(reset){offset=0;list.replaceChildren();}
   const ticket=++version,page=offset,tab=kind;more.hidden=true;
   if(!active()){status.innerHTML='<a href="login.html">เข้าสู่ระบบเพื่อดูรายชื่อเพื่อนของคุณ</a>';return;}
   loading=true;status.textContent='กำลังโหลด…';host.setAttribute('aria-busy','true');
   try{
    const data=await rpc('shop_friends_list',{p_kind:tab,p_offset:page});if(ticket!==version||!active()||!isVisible())return;
    const rows=Array.isArray(data)?data:[],shown=rows.slice(0,10);
    if(tab==='activity'){
     list.insertAdjacentHTML('beforeend',shown.map(r=>'<article class="friend-activity"><a href="profile.html#user/'+encodeURIComponent(r.profileKey||r.username)+'"><strong>'+esc(r.nickname||r.username)+'</strong> <small>@'+esc(r.username)+'</small></a><p>'+(r.kind==='purchase'?'สั่งซื้อสินค้าสำเร็จ':'เข้ามาออนไลน์')+'</p><time>'+esc(new Date(r.createdAt).toLocaleString('th-TH'))+'</time></article>').join(''));markRead();
    }else list.insertAdjacentHTML('beforeend',shown.map(r=>person(r,tab==='friends'?'friends':tab)).join(''));
    offset=page+10;more.hidden=rows.length<=10;status.textContent=list.children.length?'':(tab==='friends'?'ยังไม่มีเพื่อน · กดเพิ่มเพื่อนเพื่อเริ่มค้นหา':'ยังไม่มีรายการ');
   }catch(error){if(ticket===version)status.textContent=errorText(error);}
   finally{if(ticket===version){loading=false;host.removeAttribute('aria-busy');}}
  }
  host.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{kind=button.dataset.tab;host.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));load(true);});
  more.onclick=()=>{more.hidden=true;load();};
  add.onclick=()=>{form.hidden=!form.hidden;add.setAttribute('aria-expanded',String(!form.hidden));searchVersion++;submit.disabled=false;form.removeAttribute('aria-busy');results.replaceChildren();if(!form.hidden)form.elements.username.focus();};
  form.elements.username.addEventListener('input',()=>{searchVersion++;submit.disabled=false;form.removeAttribute('aria-busy');results.replaceChildren();});
  form.onsubmit=async e=>{
   e.preventDefault();const query=form.elements.username.value.trim();if(!query)return;
   const ticket=++searchVersion,id=user()?.id;submit.disabled=true;form.setAttribute('aria-busy','true');results.textContent='กำลังค้นหาสมาชิก…';
   try{
    const {data,error}=await window.olafSupabase.rpc('shop_search_members',{p_query:query});
    if(ticket!==searchVersion||!isVisible()||id!==user()?.id)return;if(error)throw error;
    const rows=Array.isArray(data)?data.slice(0,10):[];
    results.innerHTML=rows.length?'<p>เลือกโปรไฟล์เพื่อดูรายละเอียดหรือเพิ่มเพื่อน'+(rows.length===10?' · แสดงสูงสุด 10 คน':'')+'</p>'+rows.map(r=>person(r,'search')).join(''):'ไม่พบสมาชิกจากชื่อเล่นหรือ user นี้';
   }catch{if(ticket===searchVersion)results.textContent='ค้นหาไม่สำเร็จ กรุณาลองใหม่';}
   finally{if(ticket===searchVersion){submit.disabled=false;form.removeAttribute('aria-busy');}}
  };
  list.addEventListener('click',async e=>{
   const button=e.target.closest('button[data-action]');if(!button||button.disabled)return;
   button.disabled=true;
   try{if(await perform(button.dataset.username,button.dataset.action,button.dataset.name)){await load(true);await profileButton();await refreshPanels(panel);await heartbeat();}}
   catch(error){status.textContent=errorText(error);}
   finally{if(button.isConnected)button.disabled=false;}
  });
  return panel;
 }
 async function refreshPanels(except){await Promise.all([...panels].filter(p=>p!==except&&p.visible()).map(p=>p.refresh()));}
 function clampPosition(x,y){
  const rect=dialog.getBoundingClientRect(),gap=12;
  dialog.style.left=Math.max(gap,Math.min(x,Math.max(gap,window.innerWidth-rect.width-gap)))+'px';
  dialog.style.top=Math.max(gap,Math.min(y,Math.max(gap,window.innerHeight-rect.height-gap)))+'px';
 }
 function stopDrag(){const previous=drag;drag=null;if(previous){try{dialog.querySelector('header').releasePointerCapture(previous.id);}catch{}}dialog?.classList.remove('is-dragging');}
 function setWindowMode(){
  stopDrag();dialog.classList.toggle('is-floating',desktop.matches);
  if(!desktop.matches){dialog.style.left='';dialog.style.top='';positioned=false;}
  else if(dialog.open){const rect=dialog.getBoundingClientRect();clampPosition(positioned?rect.left:20,positioned?rect.top:Math.max(12,window.innerHeight-rect.height-84));positioned=true;}
 }
 function openWindow(){
  if(!active()){location.href='login.html';return;}
  if(dialog.open){dialog.close();return;}
  setWindowMode();if(desktop.matches)dialog.show();else dialog.showModal();setWindowMode();
  launch.setAttribute('aria-expanded','true');floating.load();
 }
 function mountPage(page){
  if(!page||!ready)return;
  if(!pagePanel){pagePanel=createPanel(page,()=>!page.hidden);}
  pagePanel.load();
 }
 async function heartbeat(){
  if(document.hidden||busy)return;clearTimeout(timer);
  if(!active()){
   confirmation?.cancel();if(dialog?.open)dialog.close();if(launch)launch.hidden=true;
   panels.forEach(p=>{p.invalidate();p.clear();});const page=document.getElementById('member-friends-page');
   if(page)page.innerHTML='<p class="friends-privacy">บัญชีเปลี่ยนแล้ว กรุณารีเฟรชหน้า หรือ <a href="login.html">เข้าสู่ระบบ</a></p>';
   profileButton();return;
  }
  busy=true;
  try{
   const data=await rpc('shop_friend_heartbeat');if(!active())return;
   latest=/^\d+$/.test(String(data.latestEventId))?String(data.latestEventId):'0';
   let seen=null;try{seen=localStorage.getItem(key());if(seen===null){localStorage.setItem(key(),latest);seen=latest;}}catch{seen=latest;}
   const unread=BigInt(latest)>BigInt(/^\d+$/.test(seen||'')?seen:'0');
   launch.querySelector('[data-friend-count]').textContent=Number(data.incoming)>0?' · '+Math.min(99,Number(data.incoming))+(data.incoming>99?'+':''):'';
   launch.querySelector('[data-friend-dot]').hidden=!unread;launch.title=unread?'เพื่อนมีความเคลื่อนไหวใหม่':'เพื่อนและคำขอ';
   if(!confirmation){await refreshPanels();await profileButton();}
  }catch{/* Social features must not interrupt checkout or authentication. */}
  finally{busy=false;if(active()&&!document.hidden)timer=setTimeout(heartbeat,45000);}
 }
 document.addEventListener('DOMContentLoaded',async()=>{
  await window.OlafStore?.ready;owner=user()?.id||null;ready=true;
  const page=document.getElementById('member-friends-page');if(page&&!page.hidden)mountPage(page);
  await profileButton();if(!owner)return;
  launch=document.createElement('button');launch.type='button';launch.className='friends-launch';launch.innerHTML='<span class="friends-launch-icon">'+icon+'</span><span>เพื่อน<span data-friend-count></span></span><i data-friend-dot hidden></i>';launch.setAttribute('aria-haspopup','dialog');launch.setAttribute('aria-expanded','false');launch.setAttribute('aria-controls','friends-floating-window');
  dialog=document.createElement('dialog');dialog.id='friends-floating-window';dialog.className='friends-dialog';dialog.setAttribute('aria-label','เพื่อนของฉัน');
  dialog.innerHTML='<header><div><small>OLAF COMMUNITY</small><h2>เพื่อนของฉัน</h2><span class="friends-drag-hint">ลากแถบนี้เพื่อย้ายหน้าต่าง</span></div><button type="button" data-close aria-label="ปิดหน้าต่างเพื่อน">×</button></header><div data-friends-content></div>';
  document.body.append(launch,dialog);floating=createPanel(dialog.querySelector('[data-friends-content]'),()=>dialog.open);
  launch.onclick=openWindow;dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(dialog.open)return;stopDrag();floating.invalidate();launch.setAttribute('aria-expanded','false');launch.focus();});
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'&&!confirmation){e.preventDefault();dialog.close();}});
  const header=dialog.querySelector('header');
  header.addEventListener('pointerdown',e=>{
   if(!desktop.matches||e.pointerType!=='mouse'||e.button!==0||e.target.closest('button,a,input'))return;
   const rect=dialog.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-rect.left,y:e.clientY-rect.top};positioned=true;
   header.setPointerCapture(e.pointerId);dialog.classList.add('is-dragging');e.preventDefault();
  });
  header.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)clampPosition(e.clientX-drag.x,e.clientY-drag.y);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>header.addEventListener(type,stopDrag));
  desktop.addEventListener('change',()=>{const wasOpen=dialog.open;if(wasOpen)dialog.close();setWindowMode();if(wasOpen)openWindow();});
  window.addEventListener('resize',()=>{if(dialog.open)setWindowMode();});
  window.addEventListener('focus',heartbeat);document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)heartbeat();});
  window.addEventListener('pagehide',()=>{clearTimeout(timer);stopDrag();confirmation?.cancel();},{once:true});heartbeat();
 });
 window.addEventListener('olaf-friends-page-open',e=>mountPage(e.detail?.page));
 window.addEventListener('olaf-friends-page-close',()=>pagePanel?.invalidate());
 window.addEventListener('olaf-member-profile-ready',profileButton);
})();
