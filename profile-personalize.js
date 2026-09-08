(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.addEventListener('olaf-profile-ready',async event=>{
    const root=document.getElementById('profile-overview-root'), user=window.OlafStore?.currentUser();
    if(!root||!user||root.dataset.personalized) return;
    root.dataset.personalized='true';
    const key=`olaf-profile-layout:${user.id}`; let prefs={theme:'main',games:null};
    try {prefs={...prefs,...JSON.parse(localStorage.getItem(key)||'{}')};} catch {}
    const save=()=>{try {localStorage.setItem(key,JSON.stringify(prefs));return true;} catch{return false;}};
    const bio=root.querySelector('.member-bio'), identity=root.querySelector('.member-identity > div');
    if(bio&&identity) {
      identity.querySelector('p')?.remove(); bio.querySelector('h3')?.remove(); identity.append(bio);
    }
    const theme=document.createElement('details'); theme.className='member-theme-control';
    theme.innerHTML='<summary>ธีมเว็บไซต์</summary><div class="member-theme-options"><button type="button" data-theme="main">น้ำเงิน · เว็บหลัก</button><button type="button" data-theme="store">ดำเทา · Steam</button></div><select hidden aria-label="ธีมโปรไฟล์"><option value="main">น้ำเงิน · เว็บหลัก</option><option value="store">ดำเทา · Steam</option></select><span role="status"></span>';
    root.querySelector('.member-cover').append(theme);
    const select=theme.querySelector('select'); select.value=document.documentElement.dataset.siteTheme || (prefs.theme==='store'?'store':'main');
    root.dataset.theme=select.value;
    const sync=()=>theme.querySelectorAll('button[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===select.value)));
    select.addEventListener('change',()=>{prefs.theme=select.value;root.dataset.theme=prefs.theme;window.OlafTheme?.set(prefs.theme);sync();theme.querySelector('span').textContent=save()?'':'บันทึกธีมในเบราว์เซอร์ไม่ได้';});
    theme.querySelectorAll('button[data-theme]').forEach(button=>button.onclick=()=>{select.value=button.dataset.theme;select.dispatchEvent(new Event('change'));});sync();window.OlafTheme?.animateDetails(theme);
    const games=event.detail?.games||[];
    if(!event.detail?.ordersLoaded) return;
    try {
      const result=await window.olafSupabase.rpc('shop_profile_showcase_state');
      if(!result.error&&Array.isArray(result.data?.games))prefs.games=result.data.games;
    } catch {}
    if(window.OlafStore?.currentUser()?.id!==user.id)return;
    const allowed=new Set(games.map(game=>game.id));
    let chosen=Array.isArray(prefs.games)?[...new Set(prefs.games)].filter(id=>allowed.has(id)).slice(0,12):games.slice(0,6).map(g=>g.id);
    const paint=()=>{root.querySelector('.member-game-grid').innerHTML=games.filter(g=>chosen.includes(g.id)).map(g=>`<a href="product.html?id=${encodeURIComponent(g.id)}">${g.image?`<img src="${esc(g.image)}" alt="" loading="lazy">`:''}<strong>${esc(g.name)}</strong></a>`).join('')||'<p>ยังไม่ได้เลือกเกมมาแสดง</p>';};
    paint();
    const button=document.createElement('button'); button.type='button';button.className='member-select-games';button.textContent='เลือกเกมที่โชว์ · สูงสุด 12 เกม';
    root.querySelector('.member-games h3').after(button);
    const publicNote=document.createElement('p');publicNote.className='member-private';publicNote.textContent='เกมที่บันทึกตรงนี้จะแสดงบนโปรไฟล์สมาชิกของคุณ (สูงสุด 12 เกม)';button.after(publicNote);
    button.addEventListener('click',()=>{
      const dialog=document.createElement('dialog');dialog.className='member-game-picker';
      dialog.innerHTML=`<form><header><h3>เลือกเกมที่โชว์ (สูงสุด 12 เกม)</h3><button type="button" data-close aria-label="ปิด">×</button></header><p>เลือกจากเกมที่ซื้อแล้ว ไม่จำเป็นต้องเลือกขั้นต่ำ</p><div class="member-picker-list">${games.map(g=>`<label><input type="checkbox" value="${esc(g.id)}" ${chosen.includes(g.id)?'checked':''}>${esc(g.name)}</label>`).join('')}</div><footer><span role="status"></span><button type="submit">บันทึกเกมที่เลือก</button></footer></form>`;
      document.body.append(dialog); dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.querySelector('[data-close]').onclick=()=>dialog.close();
      const checks=[...dialog.querySelectorAll('input')],status=dialog.querySelector('[role="status"]');
      const update=()=>{const count=checks.filter(c=>c.checked).length;status.textContent=`เลือกแล้ว ${count}/12 เกม`;checks.forEach(c=>c.disabled=!c.checked&&count>=12);};
      dialog.addEventListener('change',update);update();
      let savingGames=false;
      dialog.querySelector('form').onsubmit=async e=>{
        e.preventDefault();if(savingGames)return;const ids=checks.filter(c=>c.checked).map(c=>c.value);
        if(ids.length>12){status.textContent='เลือกได้สูงสุด 12 เกม';return;}
        savingGames=true;const submit=dialog.querySelector('[type="submit"]');submit.disabled=true;status.textContent='กำลังบันทึก…';
        try{
          if(window.OlafStore?.currentUser()?.id!==user.id)throw new Error('SESSION_CHANGED');
          const result=await window.olafSupabase.rpc('shop_save_profile_showcase',{p_games:ids});if(result.error)throw result.error;
          if(window.OlafStore?.currentUser()?.id!==user.id)throw new Error('SESSION_CHANGED');
          prefs.games=ids;save();chosen=ids;paint();dialog.close();
        }catch{status.textContent='บันทึกเกมไม่สำเร็จ กรุณาลองใหม่ หรือให้แอดมินตรวจ supabase-member-profiles.sql';}
        finally{savingGames=false;submit.disabled=false;}
      };
      dialog.showModal();
    });
  });
})();
