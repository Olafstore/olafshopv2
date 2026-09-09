(() => {
 let version=0;
 async function render(){
  const root=document.getElementById('profile-overview-root'),name=root?.querySelector('.member-identity h2');if(!name)return;
  const request=++version,route=window.OlafProfileRoute,visiting=!!route?.visiting,id=window.OlafStore?.currentUser?.()?.id;
  if(!visiting&&!id)return;
  let badge=name.querySelector('[data-profile-level]');if(!badge){badge=document.createElement('span');badge.dataset.profileLevel='';badge.className='profile-level';name.append(badge);}
  badge.removeAttribute('title');badge.removeAttribute('tabindex');badge.classList.add('is-loading');badge.setAttribute('aria-label','กำลังโหลดเลเวล');badge.innerHTML='<span class="profile-level-label">เลเวล</span><span class="profile-level-ring">…</span>';
  try{
   const {data,error}=await window.olafSupabase.rpc(visiting?'shop_member_level':'shop_my_level',visiting?{p_profile_key:route.username}:{});
   if(request!==version||!name.isConnected||(!visiting&&window.OlafStore?.currentUser?.()?.id!==id))return;
   if(error)throw error;
   if(!data||!Number.isSafeInteger(Number(data.level))||Number(data.level)<0||!Number.isFinite(Number(data.progress)))throw new Error('INVALID_LEVEL');
   const level=Number(data.level),progress=Math.min(99.99,Math.max(0,Number(data.progress)));
   // One full spectrum per 100 levels; include fractional progress for gradual color changes.
   const hue=12+(level+progress/100)*3.6;
   badge.style.setProperty('--level-hue',hue.toFixed(2));
   badge.style.setProperty('--level-progress',progress+'%');badge.classList.remove('is-loading');
   badge.setAttribute('tabindex','0');badge.setAttribute('aria-label','เลเวล '+level+' · ความคืบหน้า '+progress+'%');
   badge.innerHTML='<span class="profile-level-label">เลเวล</span><span class="profile-level-ring">'+level.toLocaleString('th-TH')+'</span><span class="profile-level-tip">เลเวล '+level.toLocaleString('th-TH')+'<small>สะสมอีก '+(100-progress).toLocaleString('th-TH',{maximumFractionDigits:2})+' บาท เพื่อขึ้นเลเวลถัดไป</small><span class="profile-level-track"><i></i></span><small>นับยอดชำระเงินจริงที่ตรวจสอบสำเร็จสะสมตลอด</small></span>';
  }catch{
   if(request!==version||!name.isConnected)return;
   badge.classList.remove('is-loading');badge.innerHTML='<span class="profile-level-label">เลเวล</span><span class="profile-level-ring">—</span>';
   badge.setAttribute('aria-label','โหลดเลเวลไม่สำเร็จ');badge.title='โหลดเลเวลไม่สำเร็จ กรุณารีเฟรช หรือตรวจการติดตั้ง supabase-profile-level.sql';
  }
 }
 window.addEventListener('olaf-profile-ready',render);window.addEventListener('olaf-member-profile-ready',render);
 window.addEventListener('focus',()=>{if(!document.hidden)render();});
})();
