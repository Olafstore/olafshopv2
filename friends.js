(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const user=()=>window.OlafStore?.currentUser?.();
 const avatar=id=>typeof id==='string'&&id.startsWith('iconprofile/')?'api/profile-avatar?id='+encodeURIComponent(id):'';
 const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/></svg>';
 const stateLabel={friends:'เป็นเพื่อนกัน',incoming:'ส่งคำขอถึงคุณ',outgoing:'ส่งคำขอแล้ว',none:'ยังไม่ได้เป็นเพื่อน',self:'นี่คือโปรไฟล์ของคุณ'};
 const errorText=error=>String(error?.message||'').includes('FRIEND_REQUEST_LIMIT')?'ส่งคำขอค้างได้สูงสุด 50 คน กรุณายกเลิกคำขอเก่าก่อน':'ดำเนินการไม่สำเร็จ กรุณาลองใหม่ หากยังไม่สำเร็จให้แอดมินตรวจ supabase-friends.sql';
 let owner=null,launch,dialog,list,status,more,timer,busy=false,kind='friends',offset=0,loadVersion=0,latest='0',barVersion=0,barBusy=false;
 const key=()=>`olaf-friends-read:${owner}`;
 const active=()=>owner&&user()?.id===owner;
 async function rpc(name,args){const id=user()?.id;if(!id)throw new Error('AUTH_REQUIRED');const result=await window.olafSupabase.rpc(name,args);if(user()?.id!==id)throw new Error('SESSION_CHANGED');if(result.error)throw result.error;return result.data;}
 const online=value=>value?'<span class="friend-online"><i></i>ออนไลน์</span>':'<span class="friend-offline"><i></i>ออฟไลน์</span>';
 function actions(state){return state==='none'?[['request','เพิ่มเพื่อน']]:state==='incoming'?[['accept','ยืนยันเพื่อน'],['decline','ปฏิเสธ']]:state==='outgoing'?[['cancel','ยกเลิกคำขอ']]:state==='friends'?[['remove','เลิกเป็นเพื่อน']]:[];}
 async function profileButton(){
  const target=window.OlafProfileRoute?.username,root=document.getElementById('profile-overview-root');
  if(!target||!root?.querySelector('.member-visitor-showcase'))return;
  let bar=document.querySelector('.member-friend-bar');if(!bar){bar=document.createElement('div');bar.className='member-friend-bar';root.before(bar);}
  const ticket=++barVersion;
  if(!user()){bar.innerHTML='<a href="login.html">เข้าสู่ระบบเพื่อเพิ่มเพื่อน</a>';return;}
  if(barBusy)return;
  try{
   const data=await rpc('shop_friend_relation',{p_username:target});if(ticket!==barVersion)return;
   bar.innerHTML=`<span>${stateLabel[data.state]||''} ${data.state==='friends'?online(data.online):''}</span><div>${actions(data.state).map(([action,label])=>`<button type="button" data-action="${action}">${esc(label)}</button>`).join('')}</div><small role="status"></small>`;
   bar.querySelectorAll('button').forEach(button=>button.onclick=async()=>{
    if(barBusy)return;barBusy=true;bar.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await rpc('shop_friend_action',{p_username:target,p_action:button.dataset.action});barBusy=false;await profileButton();if(dialog?.open)await load(true);await heartbeat();}
    catch(error){bar.querySelector('[role="status"]').textContent=errorText(error);}
    finally{barBusy=false;bar.querySelectorAll('button').forEach(b=>b.disabled=false);}
   });
  }catch(error){if(ticket===barVersion){bar.textContent=errorText(error);}}
 }
 function markRead(){try{localStorage.setItem(key(),latest);}catch{}launch?.querySelector('[data-friend-dot]')?.setAttribute('hidden','');}
 async function load(reset=false){
  if(!active()||!dialog?.open)return;
  if(reset){offset=0;list.replaceChildren();}const ticket=++loadVersion,page=offset,tab=kind;
  status.textContent='กำลังโหลด…';more.hidden=true;
  try{
   const data=await rpc('shop_friends_list',{p_kind:tab,p_offset:page});if(ticket!==loadVersion||!active())return;
   const rows=Array.isArray(data)?data:[],shown=rows.slice(0,10);
   if(tab==='activity'){
    list.insertAdjacentHTML('beforeend',shown.map(r=>`<article class="friend-activity"><a href="profile.html#user/${encodeURIComponent(r.username)}"><strong>${esc(r.nickname||r.username)}</strong> <small>@${esc(r.username)}</small></a><p>${r.kind==='purchase'?'สั่งซื้อสินค้าสำเร็จ':'เข้ามาออนไลน์'}</p><time>${esc(new Date(r.createdAt).toLocaleString('th-TH'))}</time></article>`).join(''));markRead();
   }else{
    list.insertAdjacentHTML('beforeend',shown.map(r=>{const src=avatar(r.avatar),state=tab==='friends'?'friends':tab;return `<article class="friend-person"><a href="profile.html#user/${encodeURIComponent(r.username)}">${src?`<img src="${esc(src)}" alt="" loading="lazy">`:'<span class="friend-avatar-placeholder">'+icon+'</span>'}<span><strong>${esc(r.nickname||r.username)}</strong><small>@${esc(r.username)}</small>${tab==='friends'?online(r.online):''}</span></a><div>${actions(state).map(([action,label])=>`<button type="button" data-action="${action}" data-username="${esc(r.username)}">${label}</button>`).join('')}</div></article>`;}).join(''));
   }
   offset=page+10;more.hidden=rows.length<=10;status.textContent=list.children.length?'':'ยังไม่มีรายการ';
  }catch(error){if(ticket===loadVersion)status.textContent=errorText(error);}
 }
 async function heartbeat(){
  if(document.hidden||busy)return;
  clearTimeout(timer);
  if(!active()){if(dialog?.open)dialog.close();if(launch)launch.hidden=true;profileButton();return;}
  busy=true;
  try{
   const data=await rpc('shop_friend_heartbeat');if(!active())return;
   latest=/^\d+$/.test(String(data.latestEventId))?String(data.latestEventId):'0';
   let seen=null;try{seen=localStorage.getItem(key());if(seen===null){localStorage.setItem(key(),latest);seen=latest;}}catch{seen=latest;}
   const unread=BigInt(latest)>BigInt(/^\d+$/.test(seen||'')?seen:'0');
   launch.querySelector('[data-friend-count]').textContent=Number(data.incoming)>0?` · ${Math.min(99,Number(data.incoming))}${data.incoming>99?'+':''}`:'';
   launch.querySelector('[data-friend-dot]').hidden=!unread;launch.title=unread?'เพื่อนมีความเคลื่อนไหวใหม่':'เพื่อนและคำขอ';
   if(dialog.open&&offset<=10)await load(true);await profileButton();
  }catch{/* Optional social features must not interrupt checkout or authentication. */}
  finally{busy=false;if(active()&&!document.hidden)timer=setTimeout(heartbeat,45000);}
 }
 document.addEventListener('DOMContentLoaded',async()=>{
  await window.OlafStore?.ready;owner=user()?.id||null;
  await profileButton();if(!owner)return;
  launch=document.createElement('button');launch.type='button';launch.className='friends-launch';launch.innerHTML=icon+'<span>เพื่อน<span data-friend-count></span></span><i data-friend-dot hidden></i>';launch.setAttribute('aria-haspopup','dialog');
  dialog=document.createElement('dialog');dialog.className='friends-dialog';dialog.setAttribute('aria-label','เพื่อนของฉัน');
  dialog.innerHTML='<header><div><small>OLAF COMMUNITY</small><h2>เพื่อนของฉัน</h2></div><button type="button" data-close aria-label="ปิด">×</button></header><nav aria-label="หมวดเพื่อน"><button type="button" data-tab="friends">เพื่อน</button><button type="button" data-tab="incoming">คำขอที่ได้รับ</button><button type="button" data-tab="outgoing">ส่งคำขอแล้ว</button><button type="button" data-tab="activity">ความเคลื่อนไหว</button></nav><p class="friends-privacy">เฉพาะเพื่อนที่ยืนยันแล้วเห็นสถานะออนไลน์และกิจกรรมการซื้อของกันและกัน · ไม่แสดงรายละเอียดออเดอร์</p><div data-friend-list></div><p role="status" aria-live="polite"></p><button type="button" data-more hidden>โหลดเพิ่มอีก 10 รายการ</button>';
  document.body.append(launch,dialog);list=dialog.querySelector('[data-friend-list]');status=dialog.querySelector('[role="status"]');more=dialog.querySelector('[data-more]');
  launch.onclick=()=>{if(!active()){location.reload();return;}dialog.showModal();load(true);};dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{loadVersion++;});
  dialog.querySelectorAll('[data-tab]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.tab===kind));button.onclick=()=>{kind=button.dataset.tab;dialog.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));load(true);};});
  more.onclick=()=>{more.hidden=true;load();};
  list.addEventListener('click',async e=>{
   const button=e.target.closest('button[data-action]');if(!button||button.disabled)return;
   button.disabled=true;
   try{await rpc('shop_friend_action',{p_username:button.dataset.username,p_action:button.dataset.action});await load(true);await profileButton();await heartbeat();}
   catch(error){status.textContent=errorText(error);button.disabled=false;}
  });
  window.addEventListener('focus',heartbeat);document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)heartbeat();});
  window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});heartbeat();
 });
 window.addEventListener('olaf-member-profile-ready',profileButton);
})();
