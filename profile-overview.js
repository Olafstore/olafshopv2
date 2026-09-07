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
      <a class="member-customize" href="profile-store.html">ตกแต่งโปรไฟล์ ↗</a></header>
      <div class="member-stats"><div><small>เกมที่ซื้อ (ไม่ซ้ำ)</small><strong>${orderResult.status === 'fulfilled' ? number(games.length) : '—'}</strong></div><div><small>ยอดเงินในเว็บ · Point</small><strong>${moneyResult.status === 'fulfilled' ? number(moneyResult.value.balance) : '—'}</strong></div><div><small>แต้มร้านค้าตกแต่ง</small><strong>${decoration ? number(decoration.balance) : '—'}</strong></div></div>
      <div class="member-bio"><h3>สังเขป</h3><p data-bio-text>${escape(decoration?.bio || 'ยังไม่ได้เขียนสังเขป แนะนำตัวในสไตล์คุณได้เลย')}</p>
      ${decoration ? `<details><summary>แก้ไขสังเขป</summary><form data-bio-form><label for="member-bio">แนะนำตัว (สูงสุด 300 ตัวอักษร)</label><textarea id="member-bio" maxlength="300" rows="4">${escape(decoration.bio)}</textarea><button type="submit">บันทึกสังเขป</button><span role="status" data-bio-status></span></form></details>` : '<p role="status">โหลดการตกแต่งไม่สำเร็จ กรุณาตรวจการติดตั้ง SQL พื้นหลังแล้วรีเฟรช</p>'}</div>
      <div data-profile-rank-slot></div>
      <section class="member-games"><h3>คอลเลกชันเกมของฉัน</h3><p class="member-private">ข้อมูลการซื้อและยอดเงินนี้แสดงเฉพาะเจ้าของบัญชี</p><div class="member-game-grid">${games.slice(0,6).map(game => `<a href="product.html?id=${encodeURIComponent(game.id)}">${game.image ? `<img src="${escape(game.image)}" alt="" loading="lazy" />` : ''}<strong>${escape(game.name)}</strong></a>`).join('') || `<p>${orderResult.status === 'fulfilled' ? 'ยังไม่มีเกมที่ชำระเงินสำเร็จ' : 'โหลดรายการเกมไม่สำเร็จ กรุณารีเฟรชเพื่อลองใหม่'}</p>`}</div></section>
      </article>`;
    const rankRoot = document.getElementById('profile-rank-root');
    if (rankRoot) { root.querySelector('[data-profile-rank-slot]').append(rankRoot); rankRoot.hidden = false; }
    window.dispatchEvent(new CustomEvent('olaf-profile-ready', {detail:{games, ordersLoaded:orderResult.status === 'fulfilled'}}));
    root.querySelector('[data-bio-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget, button = form.querySelector('button'), status = form.querySelector('[data-bio-status]');
      button.disabled = true; status.textContent = 'กำลังบันทึก…';
      try {
        const bio = form.querySelector('textarea').value.trim();
        const {error} = await window.olafSupabase.rpc('shop_save_bio',{p_bio:bio});
        if(error) throw error;
        root.querySelector('[data-bio-text]').textContent = bio || 'ยังไม่ได้เขียนสังเขป';
        status.textContent = 'บันทึกแล้ว';
      } catch { status.textContent = 'บันทึกไม่สำเร็จ กรุณาลองใหม่'; }
      finally { button.disabled = false; }
    });
    window.OlafImages?.scheduleHydrate?.(root);
  });
})();
