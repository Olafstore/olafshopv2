(() => {
  const ranks = [
    ['brone','Brone',100,'#d49b6b'], ['gold','Gold',500,'#edcf77'],
    ['platinum','Platinum',900,'#b3dce5'], ['diamonds','Diamonds',1500,'#88b9ff'],
    ['super','Super',3000,'#c1a0ff'], ['supreme','Supreme',5000,'#ffb2ce']
  ];
  const money = value => Number(value).toLocaleString('th-TH',{maximumFractionDigits:2});
  let root, pending=false, refreshTimer, displayState=null, saving=false;
  const visible = () => root && !root.hidden && !document.hidden && document.getElementById('panel-overview')?.classList.contains('is-active');
  function render(state) {
    const active = ranks[state.rank-1];
    const next = ranks[state.rank];
    const month = new Date(`${state.month}T00:00:00+07:00`).toLocaleDateString('th-TH',{month:'long',year:'numeric',timeZone:'Asia/Bangkok'});
    root.innerHTML = `<section class="member-ranks" aria-label="แรงค์ประจำเดือน">
      <header><div><small>MONTHLY RANK · ${month}</small><h3>แรงค์ปัจจุบัน <strong>${active?.[1] || 'ยังไม่มีแรงค์'}</strong></h3></div><div class="rank-month-total"><small>ยอดสะสมเดือนนี้</small><strong>฿${money(state.total)}</strong></div></header>
      <div class="rank-track" role="list">${ranks.map(([id,name,threshold,color],index)=>`<div role="listitem" class="rank-emblem ${state.rank===index+1?'is-current':''}" style="--rank-color:${color};--rank-opacity:${Math.max(.25,1-Math.abs(index+1-state.rank)*.15)}" ${state.rank===index+1?'aria-current="true"':''}>
        <img src="api/rank-image?rank=${id}" alt="แรงค์ ${name}" width="150" height="150" loading="lazy" decoding="async"><strong>${name}</strong><small>มากกว่า ฿${money(threshold)}</small><span>${state.rank===index+1?'แรงค์ของคุณ':state.rank>index+1?'ผ่านแล้ว':'ขั้นถัดไป'}</span></div>`).join('')}</div>
      <div class="rank-progress"><div role="progressbar" aria-label="ยอดสะสมเพื่อแรงค์ถัดไป" aria-valuemin="0" aria-valuemax="${next?.[2] || 5000}" aria-valuenow="${Math.min(Number(state.total),next?.[2] || 5000)}"><i style="width:${next?Math.min(100,Number(state.total)/next[2]*100):100}%"></i></div>
      <p>${next ? `สะสมยอดให้มากกว่า ฿${money(next[2])} เพื่อขึ้น ${next[1]}` : 'คุณอยู่ในแรงค์สูงสุดของเดือนนี้แล้ว'}</p></div>
      <p class="rank-rules">เปิดเพื่อโชว์ระดับ Rank ของคุณที่หน้าโปรไฟล์</p>
      <label class="rank-display-toggle"><input type="checkbox" data-rank-display ${displayState?.show?'checked':''} ${displayState===null?'disabled':''}><span>แสดง rank ของคุณที่หน้าโปรไฟล์</span></label><span class="rank-display-status" role="status">${displayState===null?'โหลดตัวเลือกไม่สำเร็จ กรุณาตรวจ SQL การแสดงแรงค์':''}</span>
      <p class="rank-announcement" role="status" aria-live="polite"></p></section>`;
  }
  async function refresh() {
    if (!visible() || pending || saving) return;
    pending=true;
    try {
      const {data,error}=await window.olafSupabase.rpc('shop_rank_state');
      if(error) throw error;
      const preference=await window.olafSupabase.rpc('shop_rank_badge_state');
      displayState=preference.error ? null : preference.data;
      if(displayState) window.OlafRankBadge?.update(displayState);
      if(!visible()) return;
      render(data);
      if(data.rank>data.seen) {
        const claim=await window.olafSupabase.rpc('shop_claim_rank_animation',{p_month:data.month,p_rank:data.rank});
        if(claim.error) throw claim.error;
        if(claim.data.animate && visible()) {
          const label=ranks[data.rank-1][1];
          root.querySelector('.rank-announcement').textContent=`เลื่อนแรงค์เป็น ${label} แล้ว!`;
          root.querySelector('.is-current')?.classList.add('rank-up');
        }
      }
      clearTimeout(refreshTimer);
      // A visible tab crosses month boundaries without needing a page reload.
      refreshTimer=setTimeout(refresh,Math.min(60000,Math.max(1000,new Date(data.resetsAt).getTime()-Date.now()+100)));
    } catch {
      if(!root.querySelector('.member-ranks')) root.innerHTML='<p class="rank-load-error">โหลดแรงค์ไม่สำเร็จ กรุณาตรวจการติดตั้ง SQL ระบบแรงค์ แล้วลองเปิดหน้าโปรไฟล์อีกครั้ง</p>';
    } finally { pending=false; }
  }
  document.addEventListener('DOMContentLoaded', async()=>{
    root=document.getElementById('profile-rank-root');
    if(!root) return;
    root.addEventListener('change',async event=>{
      if(!event.target.matches('[data-rank-display]') || saving) return;
      const input=event.target; saving=true; input.disabled=true;
      const status=root.querySelector('.rank-display-status');
      status.textContent='กำลังบันทึก…';
      try {
        const result=await window.olafSupabase.rpc('shop_set_rank_display',{p_show:input.checked});
        if(result.error) throw result.error;
        displayState=result.data; window.OlafRankBadge?.update(displayState);
        status.textContent='บันทึกแล้ว';
      } catch { input.checked=!!displayState?.show; status.textContent='บันทึกไม่สำเร็จ กรุณาลองใหม่'; }
      finally { saving=false; input.disabled=false; }
    });
    await window.OlafStore?.ready;
    if(!window.OlafStore?.currentUser()) return;
    const panel=document.getElementById('panel-overview');
    const observer=new MutationObserver(()=>{if(visible()) refresh();});
    observer.observe(panel,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('focus',refresh);
    window.addEventListener('hashchange',refresh);
    window.addEventListener('olaf-profile-ready',refresh);
    window.addEventListener('pagehide',()=>{clearTimeout(refreshTimer);observer.disconnect();},{once:true});
    refresh();
  });
})();
