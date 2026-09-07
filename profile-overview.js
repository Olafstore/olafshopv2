(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const number = value => Number(value || 0).toLocaleString('th-TH');
  function purchasedGames(orders) {
    const games = new Map();
    for (const order of orders) {
      if (order.status !== 'delivered' && order.paymentStatus !== 'verified') continue;
      if (['cancelled','refunded','rejected'].includes(order.status)) continue;
      for (const item of order.items || []) {
        const id = String(item.productId || '');
        if (!id || id === 'point-topup' || id.startsWith('point-topup-')) continue;
        if (!games.has(id)) games.set(id, {id,name:item.productName || item.name || 'เกมที่ซื้อ',image:item.productImageUrl || item.image || ''});
      }
    }
    return [...games.values()];
  }
  document.addEventListener('DOMContentLoaded', async () => {
    const root = document.getElementById('profile-overview-root');
    if (!root) return;
    await window.OlafStore?.ready;
    const member = window.OlafStore?.currentUser();
    if (!member) { root.textContent = 'กรุณาเข้าสู่ระบบเพื่อดูโปรไฟล์'; return; }
    const [decorationResult, orderResult, moneyResult] = await Promise.allSettled([
      window.olafSupabase.rpc('shop_decoration_state').then(result => {if(result.error) throw result.error; return result.data;}),
      window.OlafOrders.fetchMyOrders({summary:true}), window.OlafOrders.fetchPointBalance()
    ]);
    const decoration = decorationResult.status === 'fulfilled' ? decorationResult.value : null;
    const games = orderResult.status === 'fulfilled' ? purchasedGames(orderResult.value) : [];
    const background = decoration?.background ? `api/profile-avatar?id=${encodeURIComponent(decoration.background)}` : '';
    root.innerHTML = `<article class="member-showcase">
      <header class="member-cover">${background ? `<img class="member-background" src="${escape(background)}" alt="พื้นหลังโปรไฟล์" />` : ''}
      <div class="member-identity">${member.avatarUrl ? `<img class="member-portrait" src="${escape(member.avatarUrl)}" alt="รูปโปรไฟล์" />` : '<span class="member-portrait member-monogram">O</span>'}
      <div><small>OLAF COMMUNITY · โปรไฟล์ของฉัน</small><h2>${escape(member.displayName || member.username || 'สมาชิก')}</h2><p>พื้นที่ของคุณ สำหรับเกมที่คุณรัก</p></div></div>
      <a class="member-customize" href="profile-store.html"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>ตกแต่งโปรไฟล์</a></header>
      <div class="member-stats"><div><small>เกมที่ซื้อ (ไม่ซ้ำ)</small><strong>${orderResult.status === 'fulfilled' ? number(games.length) : '—'}</strong></div><div><small>ยอดเงินในเว็บ · Point</small><strong>${moneyResult.status === 'fulfilled' ? number(moneyResult.value.balance) : '—'}</strong></div><div><small>แต้มร้านค้าตกแต่ง</small><strong>${decoration ? number(decoration.balance) : '—'}</strong></div></div>
      <div class="member-bio"><h3>สังเขป</h3><p data-bio-text>${escape(decoration?.bio || 'ยังไม่ได้เขียนสังเขป แนะนำตัวในสไตล์คุณได้เลย')}</p>
      ${decoration ? `<form data-bio-form><textarea id="member-bio" aria-label="สังเขป คลิกเพื่อแก้ไข บันทึกเมื่อออกจากช่อง สูงสุด 300 ตัวอักษร" placeholder="สวัสดี" maxlength="300" rows="1">${escape(decoration.bio || '')}</textarea><span role="status" data-bio-status></span></form>` : '<p role="status">โหลดการตกแต่งไม่สำเร็จ กรุณาตรวจการติดตั้ง SQL พื้นหลังแล้วรีเฟรช</p>'}</div>
      <div data-profile-rank-slot></div>
      <section class="member-games"><h3>คอลเลกชันเกมของฉัน</h3><p class="member-private">ข้อมูลการซื้อและยอดเงินนี้แสดงเฉพาะเจ้าของบัญชี</p><div class="member-game-grid">${games.slice(0,6).map(game => `<a href="product.html?id=${encodeURIComponent(game.id)}">${game.image ? `<img src="${escape(game.image)}" alt="" loading="lazy" />` : ''}<strong>${escape(game.name)}</strong></a>`).join('') || `<p>${orderResult.status === 'fulfilled' ? 'ยังไม่มีเกมที่ชำระเงินสำเร็จ' : 'โหลดรายการเกมไม่สำเร็จ กรุณารีเฟรชเพื่อลองใหม่'}</p>`}</div></section>
      </article>`;
    const rankRoot = document.getElementById('profile-rank-root');
    if (rankRoot) { root.querySelector('[data-profile-rank-slot]').append(rankRoot); rankRoot.hidden = false; }
    window.dispatchEvent(new CustomEvent('olaf-profile-ready', {detail:{games, ordersLoaded:orderResult.status === 'fulfilled'}}));
    const form=root.querySelector('[data-bio-form]');
    if(form){
      const input=form.querySelector('textarea'),status=form.querySelector('[data-bio-status]');
      let saved=input.value.trim(),pending=null,saving=false;
      const resize=()=>{input.style.height='auto';input.style.height=input.scrollHeight+'px';};
      input.addEventListener('input',resize);resize();
      const saveBio=async()=>{
        pending=input.value.trim();if(saving)return;saving=true;
        try{
          while(pending!==null){
            const bio=pending;pending=null;if(bio===saved)continue;
            if(window.OlafStore.currentUser()?.id!==member.id)throw new Error('ACCOUNT_CHANGED');
            status.textContent='กำลังบันทึก…';
            const {error}=await window.olafSupabase.rpc('shop_save_bio',{p_bio:bio});if(error)throw error;
            saved=bio;root.querySelector('[data-bio-text]').textContent=bio||'สวัสดี';status.textContent='บันทึกแล้ว';
          }
        }catch{pending=null;status.textContent='บันทึกไม่สำเร็จ คลิกข้อความแล้วคลิกออกเพื่อลองใหม่';}
        finally{saving=false;}
      };
      input.addEventListener('blur',saveBio);
      form.addEventListener('submit',event=>{event.preventDefault();input.blur();});
    }
    window.OlafImages?.scheduleHydrate?.(root);
  });
})();
