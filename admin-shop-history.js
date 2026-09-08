(() => {
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>Number(value).toLocaleString('th-TH');
  let current=null,version=0,offset=0,before='',busy=false;
  window.addEventListener('olaf-admin-user-selected',event=>{
    current=event.detail?.userId||null;version++;busy=false;load(true);
  });
  async function load(reset=false){
    const root=document.getElementById('admin-shop-history');if(!root||busy)return;
    const list=root.querySelector('[data-history-list]'),status=root.querySelector('[role=status]'),more=root.querySelector('[data-history-more]');
    const token=version,userId=current;
    if(reset){offset=0;before=new Date().toISOString();list.innerHTML='';}
    more.hidden=true;
    if(!userId){root.removeAttribute('aria-busy');root.querySelectorAll('button,select').forEach(node=>node.disabled=false);status.textContent='เลือกผู้ใช้เพื่อดูประวัติแต้ม';return;}
    busy=true;status.textContent='กำลังโหลดประวัติ…';root.setAttribute('aria-busy','true');
    root.querySelectorAll('button,select').forEach(node=>node.disabled=true);
    try{
      const {data,error}=await window.olafSupabase.rpc('shop_admin_history',{p_user_id:userId,p_offset:offset,p_kind:root.querySelector('select').value,p_before:before});
      if(token!==version)return;if(error)throw error;
      const rows=(data||[]).slice(0,10);
      list.insertAdjacentHTML('beforeend',rows.map(row=>`<article><div><strong>${escape(row.reason||'รายการแต้มร้านค้า')}</strong><small>${escape(new Date(row.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}))}</small></div><div class="history-amount ${row.amount>0?'earned':'spent'}"><strong>${row.amount>0?'+':''}${number(row.amount)} แต้ม</strong><small>คงเหลือ ${number(row.balance_after)} แต้ม</small></div></article>`).join(''));
      offset+=rows.length;more.hidden=(data||[]).length<=10;status.textContent=offset?`แสดง ${offset} รายการ${more.hidden?' · ครบแล้ว':''}`:'ยังไม่มีรายการในหมวดนี้';
    }catch{if(token===version)status.textContent='โหลดไม่สำเร็จ กรุณารีเฟรช และตรวจการติดตั้ง supabase-admin-shop-history.sql';}
    finally{if(token===version){busy=false;root.removeAttribute('aria-busy');root.querySelectorAll('button,select').forEach(node=>node.disabled=false);}}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const root=document.getElementById('admin-shop-history');if(!root)return;
    root.querySelector('[data-history-more]').onclick=()=>load();
    root.querySelector('[data-history-refresh]').onclick=()=>load(true);
    root.querySelector('select').onchange=()=>load(true);
  });
})();
