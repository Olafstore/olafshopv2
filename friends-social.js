/* Plain text plus server-reencoded JPEG/PNG only. Never accept dropped files. */
(() => {
 const user=()=>window.OlafStore?.currentUser?.()?.id;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const errorText=e=>String(e?.message).includes('CHAT_FRIENDS_ONLY')?'ส่งข้อความได้เมื่อยืนยันเป็นเพื่อนแล้วเท่านั้น':String(e?.message).includes('CHAT_RATE_LIMIT')?'ส่งข้อความถี่เกินไป กรุณารอสักครู่':'เชื่อมต่อไม่ได้ กรุณาลองใหม่ (ร้านต้องติดตั้งระบบแชต v257)';
 async function rpc(name,args){const id=user();if(!id)throw Error('AUTH_REQUIRED');const r=await window.olafSupabase.rpc(name,args);if(user()!==id)throw Error('SESSION_CHANGED');if(r.error)throw r.error;return r.data;}
 function mount(win){
  if(win.dataset.socialMounted)return;win.dataset.socialMounted='true';
  const owner=user(),content=win.querySelector('[data-friends-content]');if(!content)return;
  const suggestions=el('section','friends-suggestions'),head=el('header'),title=el('h4',null,'สมาชิกแนะนำ'),random=el('button',null,'สุ่มใหม่'),rows=el('div'),hint=el('p','friends-social-status');
  random.type='button';head.append(title,random);suggestions.append(head,rows,hint);content.append(suggestions);
  let suggestionTicket=0,chatTicket=0,poll,chat,peer='',sending=false,attempt=null,loading=false,resumeChat;
  const valid=()=>user()===owner&&win.open;
  async function suggest(){
   if(!valid())return;const ticket=++suggestionTicket;random.disabled=true;hint.textContent='กำลังค้นหาสมาชิก…';
   try{const data=await rpc('shop_friend_suggestions');if(!valid()||ticket!==suggestionTicket)return;rows.replaceChildren();
    for(const r of Array.isArray(data)?data:[]){const card=el('article','friend-person'),link=el('a'),name=el('strong',null,r.nickname||r.username),small=el('small',null,'@'+r.username),copy=el('span'),add=el('button',null,'เพิ่มเพื่อน');link.href='profile.html#user/'+encodeURIComponent(r.username);copy.append(name,small);link.append(copy);add.type='button';
     add.onclick=async()=>{add.disabled=true;try{await rpc('shop_friend_action',{p_username:r.username,p_action:'request'});if(valid())card.remove();}catch(e){if(valid()){hint.textContent=errorText(e);add.disabled=false;}}};
     card.append(link,add);rows.append(card);
    }hint.textContent=rows.children.length?'ข้อมูลโปรไฟล์สาธารณะ · สุ่มได้อีกครั้ง':'ยังไม่มีสมาชิกแนะนำเพิ่มเติม';
   }catch(e){if(valid()&&ticket===suggestionTicket)hint.textContent=errorText(e);}finally{if(ticket===suggestionTicket)random.disabled=false;}
  }
  random.onclick=suggest;
  function stopChat(){chatTicket++;clearTimeout(poll);chat?.remove();chat=null;peer='';sending=false;loading=false;attempt=null;resumeChat=null;content.hidden=false;}
  function openChat(username,name){
   stopChat();if(!valid())return;peer=username;const ticket=chatTicket;
   chat=el('section','friends-chat');const bar=el('header'),back=el('button',null,'← เพื่อน'),heading=el('strong',null,name),messages=el('div','friends-chat-messages'),status=el('p','friends-social-status'),form=el('form','friends-chat-form'),input=el('textarea'),send=el('button',null,'ส่ง'),older=el('button',null,'โหลดข้อความก่อนหน้า');
   back.type='button';back.onclick=stopChat;older.type='button';older.hidden=true;input.maxLength=2000;input.rows=2;input.placeholder='พิมพ์ข้อความ…';input.setAttribute('aria-label','ข้อความถึง '+name);send.type='submit';status.setAttribute('role','status');
   messages.setAttribute('role','log');messages.setAttribute('aria-label','ข้อความสนทนา');bar.append(back,heading);form.append(input,send);chat.append(bar,older,messages,status,form);content.hidden=true;content.after(chat);
   const current=()=>valid()&&chatTicket===ticket;
   const history=new Map(),pictures=new Map();let before=null;
   async function load(past=false){
    if(user()!==owner){stopChat();rows.replaceChildren();return;}if(!current()||loading||document.hidden)return;loading=true;clearTimeout(poll);
    try{const data=await rpc('shop_friend_messages_list',{p_username:username,p_before:past?before:null});if(!current())return;
     const list=Array.isArray(data)?data:[],atBottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<70,oldHeight=messages.scrollHeight;
     let changed=false;for(const r of list){if(JSON.stringify(history.get(r.id))!==JSON.stringify(r))changed=true;history.set(r.id,r);}
     if(past||before===null){before=list[0]?.id||before;older.hidden=list.length<50;}
     if(!changed&&history.size)return;
     messages.replaceChildren();for(const r of [...history.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1)){const bubble=el('article','friends-chat-bubble'+(r.mine?' is-mine':'')),text=el('p',null,r.body),time=el('small',null,new Date(r.createdAt).toLocaleString('th-TH'));bubble.append(text,time);messages.append(bubble);
      if(r.hasImage){const picture=el('img');picture.alt='รูปภาพจากคู่สนทนา';picture.loading='lazy';bubble.prepend(picture);if(!pictures.has(r.id))pictures.set(r.id,rpc('shop_friend_image_read',{p_id:r.id}));pictures.get(r.id).then(data=>{if(current()&&picture.isConnected&&typeof data==='string'&&/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(data))picture.src='data:image/jpeg;base64,'+data;}).catch(()=>{pictures.delete(r.id);if(picture.isConnected)picture.alt='โหลดรูปไม่ได้';});}
     }
     if(past)messages.scrollTop+=messages.scrollHeight-oldHeight;else if(atBottom)messages.scrollTop=messages.scrollHeight;
     status.textContent=history.size?'ข้อความและรูป JPEG/PNG · ไม่รับการลากไฟล์':'เริ่มบทสนทนาด้วยข้อความ';
    }catch(e){if(current())status.textContent=errorText(e);}finally{if(current()){loading=false;poll=setTimeout(()=>load(),5000);}}
   }
   older.onclick=()=>load(true);
   resumeChat=()=>load();
   const rejectFile=e=>{const d=e.dataTransfer||e.clipboardData;if(d&&(d.files?.length||Array.from(d.items||[]).some(i=>i.kind==='file')||Array.from(d.types||[]).includes('Files'))){e.preventDefault();e.stopPropagation();status.textContent='ไม่รับการลากหรือวางไฟล์ กรุณาใช้ปุ่มแนบรูป JPEG/PNG เท่านั้น';}};
   ['dragover','drop','paste'].forEach(type=>chat.addEventListener(type,rejectFile));
   const attach=el('button',null,'แนบรูป'),file=el('input');attach.type='button';file.type='file';file.accept='.jpg,.jpeg,.png,image/jpeg,image/png';file.hidden=true;form.prepend(attach,file);attach.onclick=()=>file.click();
   let uploadAttempt=null;
   file.onchange=async()=>{const image=file.files?.[0];file.value='';if(!image||!current()||sending)return;
    if(!['image/jpeg','image/png'].includes(image.type)||! /\.(jpe?g|png)$/i.test(image.name)||image.size>2*1024*1024){status.textContent='เลือกรูป JPEG/PNG ขนาดไม่เกิน 2 MB เท่านั้น';return;}
    sending=true;attach.disabled=true;send.disabled=true;status.textContent='กำลังตรวจสอบและส่งรูป…';
    try{const bytes=new Uint8Array(await image.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);const data=btoa(binary);
     if(!uploadAttempt||uploadAttempt.data!==data)uploadAttempt={data,nonce:crypto.randomUUID()};
     const {data:session}=await window.olafSupabase.auth.getSession();if(!current())return;
     const response=await fetch('/api/friend-image',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.session.access_token},body:JSON.stringify({username,name:image.name,mime:image.type,data,nonce:uploadAttempt.nonce}),signal:AbortSignal.timeout(30000)});
     const result=await response.json();if(!response.ok)throw Error(result.error);if(current()){uploadAttempt=null;await load();}
    }catch(e){if(current())status.textContent=String(e.message).includes('INVALID_IMAGE')?'ไฟล์ไม่ใช่ JPEG/PNG ที่รองรับ หรือรูปเสียหาย':errorText(e);}
    finally{if(current()){sending=false;attach.disabled=false;send.disabled=false;}}
   };
   form.onsubmit=async e=>{e.preventDefault();if(!current()||sending)return;const body=input.value.trim();if(!body||body.length>2000)return;const draft=input.value;sending=true;send.disabled=true;
    if(!attempt||attempt.body!==body)attempt={body,nonce:crypto.randomUUID()};
    try{await rpc('shop_friend_message_send',{p_username:username,p_body:body,p_nonce:attempt.nonce});if(!current())return;attempt=null;if(input.value===draft)input.value='';await load();}
    catch(e){if(current())status.textContent=errorText(e);}finally{if(current()){sending=false;send.disabled=false;}}
   };
   input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}});load();input.focus();
  }
  win.addEventListener('click',e=>{const b=e.target.closest('[data-chat-user]');if(b)openChat(b.dataset.chatUser,b.dataset.chatName);});
  const decorate=()=>{win.querySelectorAll('.friend-person [data-action="remove"]').forEach(remove=>{if(remove.parentElement.querySelector('[data-chat-user]'))return;const b=el('button',null,'แชต');b.type='button';b.dataset.chatUser=remove.dataset.username;b.dataset.chatName=remove.dataset.name||remove.dataset.username;remove.before(b);});};
  new MutationObserver(decorate).observe(content,{childList:true,subtree:true});decorate();
  new MutationObserver(()=>{if(win.open){if(user()===owner&&!rows.children.length)suggest();}else{suggestionTicket++;stopChat();}}).observe(win,{attributes:true,attributeFilter:['open']});
  const accountCheck=()=>{if(user()!==owner){suggestionTicket++;rows.replaceChildren();hint.textContent='บัญชีเปลี่ยนแล้ว กรุณารีเฟรชหน้า';stopChat();}else if(valid()&&peer&&!document.hidden){/* The bounded poll resumes below. */}};
  window.addEventListener('focus',accountCheck);document.addEventListener('visibilitychange',()=>{accountCheck();if(document.hidden)clearTimeout(poll);else if(valid())resumeChat?.();});
  window.addEventListener('pagehide',()=>{suggestionTicket++;stopChat();});suggest();
 }
 const scan=()=>document.querySelectorAll('#friends-floating-window').forEach(mount);
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});scan();
})();
