(()=>{
 if(location.pathname.endsWith('/profile-store.html'))return;
 const css=document.createElement('link');css.rel='stylesheet';css.href='site-header-refresh.css?v=20260929-v62';document.head.append(css);
 document.addEventListener('DOMContentLoaded',()=>{
  document.body.classList.add('olaf-header-refresh');
  let header=document.querySelector('.topbar');
  if(!header){
   header=document.createElement('header');header.className='topbar refresh-standalone';
   header.innerHTML='<a class="brand" href="index.html"><strong>OLAF SHOP</strong></a><nav class="main-nav" aria-label="เมนูหลัก"><a href="index.html">หน้าหลัก</a><a href="products.html">ดูสินค้าทั้งหมด</a><a href="more-products.html">หมวดหมู่</a><a href="manual.html">คู่มือ</a><a href="point-topup.html">เติมเงิน</a><a href="free-random.html">สุ่มเกม</a><a href="https://www.facebook.com/byOlafshop">ติดต่อเรา</a></nav><div class="topbar-actions"><form class="refresh-search" action="index.html"><span aria-hidden="true">⌕</span><input type="search" name="search" aria-label="ค้นหาสินค้า" placeholder="ค้นหาเกม โปรแกรม หรือสินค้า…"><button type="submit" aria-label="ค้นหา">ค้นหา</button></form><a class="icon-button" href="profile.html#notifications" aria-label="แจ้งเตือน">♧</a><a class="icon-button" href="profile.html#favorites" aria-label="รายการโปรด">♡</a><a class="account-button" href="profile.html">บัญชีของฉัน</a></div>';
   document.body.prepend(header);
  }
  header.classList.add('refresh-header');
  if(header.classList.contains('refresh-standalone')){
   const buttons=header.querySelectorAll('.topbar-actions>a.icon-button');
   const shapes=['<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>','<path d="M6 3h12v18l-6-4-6 4z"/>'];
   buttons.forEach((button,index)=>{button.href='index.html?headerAction='+['notifications','favorites'][index];button.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">'+shapes[index]+'</svg>'});
  }
  const action=new URLSearchParams(location.search).get('headerAction');
  if(['notifications','favorites'].includes(action))window.addEventListener('load',()=>{document.querySelector(action==='notifications'?'#open-notifications':'#open-favorites')?.click()},{once:true});
  header.querySelectorAll('input[type="search"]').forEach(input=>input.placeholder='ค้นหาเกม โปรแกรม หรือสินค้า…');
 });
})();
