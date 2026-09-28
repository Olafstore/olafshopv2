document.addEventListener('DOMContentLoaded',()=>{
 const mount=document.getElementById('software-store-admin');if(!mount)return;
 const panel=document.createElement('section');panel.style.cssText='padding:16px;margin-bottom:20px;border:1px solid #28527a;border-radius:12px;display:grid;gap:12px';
 panel.innerHTML='<h3>เลือกสินค้าแนะนำ (สูงสุด 5 รายการ)</h3><p>ลำดับ 1–5 คือเรียงจากซ้ายไปขวาบนหน้าร้าน เลือกเว้นว่างได้ และไม่เลือกสินค้าซ้ำ</p><button type="button" data-featured-load>โหลดรายการสินค้าแนะนำ</button><label><input type="checkbox" data-featured-auto checked> เลือกอัตโนมัติตามระบบเดิม</label><div data-featured-slots style="display:grid;gap:10px"></div><button type="button" data-featured-save disabled>บันทึกสินค้าแนะนำ</button><p role="status" data-featured-status></p>';
 mount.prepend(panel);
 const slots=panel.querySelector('[data-featured-slots]'),auto=panel.querySelector('[data-featured-auto]'),status=panel.querySelector('[data-featured-status]'),save=panel.querySelector('[data-featured-save]');
 let loaded=false;
 auto.addEventListener('change',()=>{slots.querySelectorAll('select').forEach(select=>select.disabled=auto.checked)});
 panel.querySelector('[data-featured-load]').addEventListener('click',async e=>{
  e.target.disabled=true;save.disabled=true;loaded=false;status.textContent='กำลังโหลดสินค้า…';
  try{
   const [settings,online]=await Promise.all([window.OlafStoreSettings.fetchStoreSettings({forceRefresh:true}),window.OlafProducts.fetchActiveProducts({forceRefresh:true})]);
   const items=window.OlafExtraProducts.mergeProducts(online),ids=new Set(items.map(p=>p.id));
   online.filter(p=>p.isActive!==false&&/^(software|office|adobe|capcut|antivirus)$/.test(p.category||'')).forEach(p=>{if(!ids.has(p.id)){items.push(p);ids.add(p.id)}});
   const selected=settings.softwareStore?.featuredIds;auto.checked=!Array.isArray(selected);slots.replaceChildren();
   for(let i=0;i<5;i++){
    const label=document.createElement('label');label.textContent='ลำดับ '+(i+1)+' ';
    const select=document.createElement('select');select.dataset.featuredSlot=String(i);select.setAttribute('aria-label','สินค้าแนะนำลำดับ '+(i+1));select.style.cssText='width:100%;padding:10px';select.add(new Option('— ไม่แสดงในตำแหน่งนี้ —',''));
    items.forEach(p=>select.add(new Option(p.name+' · ฿'+Number(p.price||0).toLocaleString('th-TH'),p.id)));
    if(selected?.[i]&&!ids.has(selected[i]))select.add(new Option('สินค้าเดิมไม่พร้อมใช้งาน: '+selected[i],selected[i]));
    select.value=selected?.[i]||'';select.disabled=auto.checked;label.append(select);slots.append(label);
   }
   loaded=true;save.disabled=false;status.textContent='โหลดแล้ว ปิดเลือกอัตโนมัติเพื่อกำหนดสินค้าเอง';
  }catch(error){status.textContent='โหลดไม่สำเร็จ: '+error.message}finally{e.target.disabled=false}
 });
 save.addEventListener('click',async()=>{
  if(!loaded)return;
  const selected=[...slots.querySelectorAll('select')].map(s=>s.value).filter(Boolean);
  if(!auto.checked&&new Set(selected).size!==selected.length){status.textContent='กรุณาเลือกสินค้าไม่ซ้ำกัน';return}
  save.disabled=true;
  try{
   status.textContent='กำลังบันทึกสินค้าแนะนำ…';
   const current=await window.OlafStoreSettings.fetchStoreSettings({forceRefresh:true});
   const softwareStore={...current.softwareStore,featuredIds:auto.checked?null:selected};
   await window.OlafStoreSettings.saveStoreSettings({...current,softwareStore});
   const verified=await window.OlafStoreSettings.fetchStoreSettings({forceRefresh:true});
   if(JSON.stringify(verified.softwareStore?.featuredIds)!==JSON.stringify(softwareStore.featuredIds))throw new Error('ตรวจสอบข้อมูลที่บันทึกไม่ผ่าน');
   window.dispatchEvent(new CustomEvent('olaf-software-settings-saved',{detail:verified.softwareStore}));
   status.textContent='บันทึกสินค้าแนะนำแล้ว รีเฟรชหน้าร้านเพื่อดูผล';
  }catch(error){status.textContent='บันทึกไม่สำเร็จ: '+error.message}finally{save.disabled=false}
 });
});
