(() => {
  const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>';
  window.addEventListener('olaf-profile-ready',async event=>{
    const root=document.getElementById('profile-overview-root'),user=window.OlafStore?.currentUser();
    if(!root||!user||root.querySelector('.member-sharing'))return;
    const box=document.createElement('details');box.className='member-sharing';
    box.innerHTML=`<summary>${icon}<span>แชร์โปรไฟล์ของฉัน</span><small data-state>กำลังโหลด…</small></summary><div class="member-sharing-body"><p>ผู้ที่มีลิงก์จะเห็นชื่อสาธารณะ รูปโปรไฟล์ พื้นหลัง สังเขป เกมที่เลือก และ Rank ที่เปิดแสดงไว้เท่านั้น ไม่แสดงอีเมล ยอดเงิน แต้ม หรือข้อมูลคำสั่งซื้อ</p><form><label>ชื่อที่ให้ผู้เยี่ยมชมเห็น<input name="public-name" maxlength="80" required autocomplete="off" placeholder="ชื่อสาธารณะของคุณ"></label><label class="member-share-consent"><input type="checkbox" name="consent"><span>ยินยอมเปิดโปรไฟล์สาธารณะ และตรวจแล้วว่าสังเขปไม่มีข้อมูลส่วนตัวที่ไม่ต้องการเผยแพร่</span></label><div class="member-share-actions"><button type="submit" disabled>${icon}<span data-save-label>เปิดแชร์โปรไฟล์</span></button><button type="button" data-revoke hidden>ปิดการแชร์</button></div></form><div class="member-share-link" hidden><label>ลิงก์โปรไฟล์สาธารณะ<input readonly aria-label="ลิงก์โปรไฟล์สาธารณะ"></label><div class="member-share-actions"><button type="button" data-copy>คัดลอกลิงก์</button><a data-preview target="_blank" rel="noopener noreferrer">ดูหน้าโปรไฟล์ ↗</a></div></div><p role="status" aria-live="polite"></p></div>`;
    const gamesSection=root.querySelector('.member-games');
    if(gamesSection)gamesSection.before(box);else root.append(box);
    window.OlafTheme?.animateDetails(box);
    const form=box.querySelector('form'),name=form.querySelector('[name="public-name"]'),consent=form.querySelector('[name="consent"]'),status=box.querySelector('[role="status"]'),linkArea=box.querySelector('.member-share-link'),link=linkArea.querySelector('input');
    let state=null,queue=Promise.resolve(),pending=0;
    const current=()=>window.OlafStore?.currentUser()?.id===user.id&&box.isConnected;
    const chosen=()=>{
      if(!event.detail?.ordersLoaded)return state?.games||[];
      const games=event.detail.games||[],allowed=new Set(games.map(g=>g.id));let ids=null;
      try{ids=JSON.parse(localStorage.getItem(`olaf-profile-layout:${user.id}`)||'{}').games;}catch{}
      return (Array.isArray(ids)?[...new Set(ids)]:games.slice(0,6).map(g=>g.id)).filter(id=>allowed.has(id)).slice(0,12);
    };
    const paint=()=>{
      const enabled=!!state?.enabled;
      box.querySelector('[data-state]').textContent=enabled?'เปิดแชร์อยู่':'ส่วนตัว';
      box.querySelector('[data-save-label]').textContent=enabled?'อัปเดตโปรไฟล์ที่แชร์':'เปิดแชร์โปรไฟล์';
      consent.closest('label').hidden=enabled;consent.required=!enabled;
      box.querySelector('[data-revoke]').hidden=!enabled;linkArea.hidden=!enabled;
      if(enabled){const origin=location.protocol==='file:'?'https://olafshop.com':location.origin;link.value=`${origin}/profie/user?id=${encodeURIComponent(state.shareId)}`;box.querySelector('[data-preview]').href=link.value;}
      box.querySelectorAll('button').forEach(button=>button.disabled=!!pending||!state);
    };
    const rpc=async(action,args)=>{if(!current())throw new Error('SESSION_CHANGED');const result=await window.olafSupabase.rpc(action,args);if(result.error)throw result.error;if(!current())throw new Error('SESSION_CHANGED');return result.data;};
    const schedule=operation=>{
      pending++;paint();queue=queue.then(operation).catch(()=>{if(current())status.textContent='บันทึกการแชร์ไม่สำเร็จ กรุณาลองอีกครั้ง การตั้งค่าที่บันทึกสำเร็จล่าสุดยังคงเดิม';}).finally(()=>{pending--;if(current())paint();});return queue;
    };
    form.addEventListener('submit',e=>{
      e.preventDefault();if(!state||pending||!name.value.trim()||(!state.enabled&&!consent.checked))return;
      const value=name.value.trim(),ids=chosen();
      schedule(async()=>{state=await rpc('shop_save_public_profile',{p_enabled:true,p_games:ids,p_name:value});name.value=state.name;status.textContent='บันทึกแล้ว สามารถคัดลอกลิงก์ให้ผู้อื่นเยี่ยมชมได้';});
    });
    box.querySelector('[data-revoke]').onclick=()=>{
      if(!state||pending)return;
      schedule(async()=>{state=await rpc('shop_save_public_profile',{p_enabled:false,p_games:[],p_name:state.name});consent.checked=false;status.textContent='ปิดการแชร์แล้ว ลิงก์จะไม่แสดงโปรไฟล์อีกต่อไป';});
    };
    box.querySelector('[data-copy]').onclick=async()=>{
      try{await navigator.clipboard.writeText(link.value);status.textContent='คัดลอกลิงก์แล้ว';}
      catch{link.focus();link.select();status.textContent='เลือกข้อความลิงก์ไว้แล้ว กรุณาคัดลอกด้วยตนเอง';}
    };
    window.addEventListener('olaf-profile-games-changed',e=>{
      if(e.detail?.userId!==user.id||!current()||!state?.enabled)return;
      const ids=[...new Set(e.detail.games||[])].slice(0,12);
      schedule(async()=>{if(!state.enabled)return;state=await rpc('shop_save_public_profile',{p_enabled:true,p_games:ids,p_name:state.name});status.textContent='อัปเดตเกมในโปรไฟล์สาธารณะแล้ว';});
    });
    try{state=await rpc('shop_public_profile_settings');name.value=state.name;paint();}
    catch{box.querySelector('[data-state]').textContent='ยังไม่พร้อม';status.textContent='โหลดการตั้งค่าแชร์ไม่ได้ กรุณาลองรีเฟรช หากยังไม่สำเร็จให้แอดมินตรวจว่ารัน supabase-public-profile.sql แล้ว';}
  });
})();
