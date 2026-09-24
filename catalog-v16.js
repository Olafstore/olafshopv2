// Reuse the existing search/filter listeners and checkout links; no extra API calls.
document.addEventListener('DOMContentLoaded',()=>{
 const side=document.querySelector('.catalog-page .side-panel'),tabs=document.getElementById('category-tabs');if(!side||!tabs)return;
 const title=document.createElement('h3');title.innerHTML='<i data-lucide="search"></i> ค้นหาสินค้า';side.prepend(title);
 const search=document.querySelector('#catalog .search-box');if(search)title.after(search);
 const nav=document.createElement('nav');nav.className='catalog-side-categories';nav.setAttribute('aria-label','หมวดหมู่สินค้า');search?.after(nav);
 const sync=()=>{nav.replaceChildren(...Array.from(tabs.querySelectorAll('button')).map(source=>{const b=document.createElement('button');b.type='button';b.className=source.className;b.innerHTML=source.innerHTML;b.setAttribute('aria-pressed',source.getAttribute('aria-selected'));b.onclick=()=>source.click();return b;}));window.lucide?.createIcons();};
 new MutationObserver(sync).observe(tabs,{childList:true});sync();
 const filters=document.getElementById('filter-popover');if(filters){filters.hidden=false;side.append(filters);}
 const wrap=document.querySelector('.products-wrap'),bar=document.createElement('div');bar.className='catalog-results-bar';bar.innerHTML='<strong>สินค้าทั้งหมด <span id="catalog-result-count"></span></strong><label>เรียงโดย <select aria-label="เรียงสินค้า"><option value="default">แนะนำ</option><option value="priceAsc">ราคา: ต่ำไปสูง</option><option value="priceDesc">ราคา: สูงไปต่ำ</option><option value="nameAsc">ชื่อ A–Z</option><option value="nameDesc">ชื่อ Z–A</option></select></label><div class="catalog-view-controls"><button type="button" aria-label="มุมมองตาราง" aria-pressed="true"><i data-lucide="grid-2x2"></i></button><button type="button" aria-label="มุมมองรายการ" aria-pressed="false"><i data-lucide="list"></i></button></div>';wrap.prepend(bar);
 bar.querySelector('select').onchange=e=>{const radio=document.querySelector(`#sort-options input[value="${e.target.value}"]`);if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}};
 bar.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{wrap.classList.toggle('catalog-list-view',i===1);bar.querySelectorAll('button').forEach((x,j)=>x.setAttribute('aria-pressed',String(i===j)));});
 const heading=document.querySelector('#catalog>.section-heading>div');const subtitle=document.createElement('p');subtitle.textContent='เลือกซื้อเกมคุณภาพ พร้อมระบบชำระเงินและจัดส่งของร้าน';heading?.append(subtitle);
 window.lucide?.createIcons();
});
