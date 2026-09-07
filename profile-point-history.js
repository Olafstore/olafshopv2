(() => {
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>Number(value).toLocaleString('th-TH');
  document.addEventListener('DOMContentLoaded',async()=>{
    const root=document.getElementById('shop-point-history');if(!root)return;
    await window.OlafStore?.ready;
    const user=window.OlafStore?.currentUser();if(!user)return;
    const list=root.querySelector('[data-shop-history-list]'),status=root.querySelector('[data-shop-history-status]'),more=root.querySelector('[data-shop-history-more]'),filter=root.querySelector('select');
    let offset=0,cutoff='',loading=false,initialized=false;
    const rowMarkup=row=>{
      const earned=Number(row.amount)>0;
      const date=new Date(row.created_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'});
      return `<article class="shop-history-row"><div><strong>${escape(row.reason|| (earned?'ได้รับแต้มร้านค้า':'ใช้แต้มร้านค้า'))}</strong><time datetime="${escape(row.created_at)}">${escape(date)} · เวลาไทย</time></div><div class="shop-history-amount ${earned?'is-earned':'is-spent'}"><strong>${earned?'+':''}${number(row.amount)} แต้ม</strong><small>คงเหลือหลังรายการ ${number(row.balance_after)} แต้ม</small></div></article>`;
    };
    async function load(reset=false){
      if(loading)return;loading=true;
      if(reset){offset=0;cutoff=new Date().toISOString();list.innerHTML='';initialized=false;}
      status.textContent='กำลังโหลดประวัติแต้ม…';more.hidden=true;root.setAttribute('aria-busy','true');
      root.querySelectorAll('button,select').forEach(node=>node.disabled=true);
      try{
        let query=window.olafSupabase.from('shop_point_ledger').select('id,amount,balance_after,reason,created_at')
          .eq('user_id',user.id).lte('created_at',cutoff).order('created_at',{ascending:false}).order('id',{ascending:false});
        if(filter.value==='earned')query=query.gt('amount',0);
        if(filter.value==='spent')query=query.lt('amount',0);
        const {data,error}=await query.range(offset,offset+10);if(error)throw error;
        if(window.OlafStore.currentUser()?.id!==user.id){list.innerHTML='';throw new Error('ACCOUNT_CHANGED');}
        const rows=(data||[]).slice(0,10);
        list.insertAdjacentHTML('beforeend',rows.map(rowMarkup).join(''));offset+=rows.length;initialized=true;
        more.hidden=(data||[]).length<=10;
        status.textContent=offset?`แสดง ${offset} รายการ${more.hidden?' · ครบแล้ว':''}`:'ยังไม่มีประวัติแต้มในหมวดนี้';
      }catch{status.textContent='โหลดประวัติแต้มไม่สำเร็จ กรุณากดรีเฟรชอีกครั้ง';}
      finally{loading=false;root.removeAttribute('aria-busy');root.querySelectorAll('button,select').forEach(node=>node.disabled=false);}
    }
    root.addEventListener('toggle',()=>{if(root.open&&!initialized)load(true);});
    root.querySelector('[data-shop-history-refresh]').onclick=()=>load(true);
    more.onclick=()=>load();filter.onchange=()=>load(true);
    if(root.open)load(true);
  });
})();
