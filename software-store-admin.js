document.addEventListener('DOMContentLoaded',()=>{
 const mount=document.getElementById('software-store-admin');if(!mount)return;
 const {categories,safeImage}=window.OlafSoftwareStore;
 let config={},loaded=false;
 const status=mount.querySelector('[data-software-status]'),fields=mount.querySelector('[data-software-fields]');
 function field(label,group,key,value){
  const row=document.createElement('label');row.style.cssText='display:grid;gap:8px;padding:12px;border:1px solid var(--border);border-radius:10px';
  const title=document.createElement('strong');title.textContent=label;
  const image=document.createElement('img');image.alt='ตัวอย่าง '+label;image.style.cssText='width:110px;height:75px;object-fit:contain;background:#102039;border-radius:8px';image.src=safeImage(value)||'assets/placeholder.svg';
  const input=document.createElement('input');input.type='text';input.placeholder='URL รูปภาพ หรืออัปโหลดไฟล์';input.value=value||'';input.dataset.softwareGroup=group;input.dataset.softwareKey=key;input.setAttribute('aria-label','รูป '+label);
  input.addEventListener('change',()=>{image.src=safeImage(input.value)||'assets/placeholder.svg'});
  const upload=document.createElement('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.setAttribute('aria-label','อัปโหลด '+label);
  upload.addEventListener('change',async()=>{const file=upload.files[0];if(!file)return;if(file.size>8*1024*1024){status.textContent='รูปต้องมีขนาดไม่เกิน 8 MB';return}upload.disabled=true;let url;try{url=URL.createObjectURL(file);const source=new Image();source.src=url;await source.decode();const scale=Math.min(1,1600/Math.max(source.width,source.height));const canvas=document.createElement('canvas');canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);input.value=canvas.toDataURL('image/webp',.86);image.src=input.value;status.textContent='เลือกรูปแล้ว กดบันทึกรูปหน้าร้านซอฟต์แวร์เพื่อเผยแพร่'}catch{status.textContent='เปิดไฟล์รูปไม่ได้ กรุณาใช้ PNG, JPEG หรือ WebP'}finally{upload.disabled=false;if(url)URL.revokeObjectURL(url)}});
  row.append(title,image,input,upload);return row;
 }
 mount.querySelector('[data-software-load]').addEventListener('click',async e=>{
  e.target.disabled=true;status.textContent='กำลังโหลดรูปจากร้าน…';
  try{const [settings,online]=await Promise.all([window.OlafStoreSettings.fetchStoreSettings({forceRefresh:true}),window.OlafProducts.fetchActiveProducts({forceRefresh:true})]);config=structuredClone(settings.softwareStore||{});fields.replaceChildren(field('แบนเนอร์หลัก','hero','',config.hero));
   categories.forEach(c=>fields.append(field('หมวดหมู่ '+c.name,'categories',c.id,config.categories?.[c.id]||'')));
   ['adobe','capcut'].forEach(id=>fields.append(field('แบนเนอร์โปรโมชัน '+id,'promos',id,config.promos?.[id]||'')));
   const items=window.OlafExtraProducts.mergeProducts(online);const ids=new Set(items.map(p=>p.id));online.filter(p=>/^(software|office|adobe|capcut|antivirus)$/.test(p.category||'')).forEach(p=>{if(!ids.has(p.id))items.push(p)});
   items.forEach(p=>fields.append(field('สินค้า: '+p.name,'products',p.id,config.products?.[p.id]||'')));
   loaded=true;status.textContent='เว้นว่างเพื่อใช้รูปเดิมของสินค้า/หมวดหมู่ รูปสินค้าเดิมแก้ได้ในเมนูจัดการสินค้าเช่นกัน';
  }catch(error){status.textContent='โหลดไม่สำเร็จ: '+(error.message||'กรุณาลองใหม่')}finally{e.target.disabled=false}
 });
 mount.querySelector('[data-software-save]').addEventListener('click',async e=>{
  if(!loaded){status.textContent='กรุณากดโหลดรูปที่ตั้งไว้ก่อน';return}
  const next=structuredClone(config);for(const input of fields.querySelectorAll('[data-software-group]')){const value=input.value.trim();if(value&&!safeImage(value)){status.textContent='URL รูปไม่ถูกต้อง: '+input.getAttribute('aria-label');input.focus();return}const group=input.dataset.softwareGroup;if(group==='hero')next.hero=value;else{next[group]||={};next[group][input.dataset.softwareKey]=value}}
  e.target.disabled=true;try{status.textContent='กำลังบันทึกรูป…';const current=await window.OlafStoreSettings.fetchStoreSettings({forceRefresh:true});await window.OlafStoreSettings.saveStoreSettings({...current,softwareStore:next});const verified=await window.OlafStoreSettings.fetchStoreSettings({forceRefresh:true});const matches=Object.entries(next).every(([key,value])=>typeof value==='object'?Object.entries(value).every(([id,url])=>verified.softwareStore?.[key]?.[id]===url):verified.softwareStore?.[key]===value);if(!matches)throw new Error('ยังยืนยันข้อมูลที่บันทึกไม่ได้');config=next;window.dispatchEvent(new CustomEvent('olaf-software-settings-saved',{detail:next}));status.textContent='บันทึกแล้ว รีเฟรชหน้าร้านซอฟต์แวร์เพื่อดูรูปใหม่'}catch(error){status.textContent='บันทึกไม่สำเร็จ: '+(error.message||'กรุณาลองใหม่')}finally{e.target.disabled=false}
 });
});
