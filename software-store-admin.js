document.addEventListener('DOMContentLoaded',()=>{
 const mount=document.getElementById('software-store-admin');if(!mount)return;
 const {categories,safeImage}=window.OlafSoftwareStore;
 let config={},loaded=false;
 const status=mount.querySelector('[data-software-status]'),fields=mount.querySelector('[data-software-fields]');
 function field(label,group,key,value,fallback=''){
  const row=document.createElement('div');row.style.cssText='display:grid;gap:8px;padding:12px;border:1px solid var(--border);border-radius:10px';
  const title=document.createElement('strong');title.textContent=label;
  const image=document.createElement('img');image.alt='ตัวอย่าง '+label;image.style.cssText='width:110px;height:75px;object-fit:contain;background:#102039;border-radius:8px';image.src=safeImage(value)||safeImage(fallback)||'assets/placeholder.svg';
  const input=document.createElement('input');input.type='text';input.placeholder='URL รูปภาพ หรืออัปโหลดไฟล์';input.value=value||'';input.dataset.softwareGroup=group;input.dataset.softwareKey=key;input.setAttribute('aria-label','รูป '+label);
  input.addEventListener('input',()=>{image.src=safeImage(input.value)||safeImage(fallback)||'assets/placeholder.svg'});
  const upload=document.createElement('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.setAttribute('aria-label','อัปโหลด '+label);
  upload.addEventListener('change',async()=>{const file=upload.files[0];if(!file)return;if(file.size>8*1024*1024){status.textContent='รูปต้องมีขนาดไม่เกิน 8 MB';return}upload.disabled=true;let url;try{url=URL.createObjectURL(file);const source=new Image();source.src=url;await source.decode();const canvas=document.createElement('canvas');const background=group==='hero'||group==='pageBackground';if(background){canvas.width=1916;canvas.height=821;const scale=Math.max(1916/source.width,821/source.height),width=source.width*scale,height=source.height*scale;canvas.getContext('2d').drawImage(source,(1916-width)/2,(821-height)/2,width,height)}else{const scale=Math.min(1,1600/Math.max(source.width,source.height));canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height)}input.value=canvas.toDataURL('image/webp',.86);image.src=input.value;status.textContent=background?'เตรียมพื้นหลังขนาด 1916 × 821 px แล้ว กดบันทึกเพื่อเผยแพร่':'เลือกรูปแล้ว กดบันทึกรูปหน้าร้านซอฟต์แวร์เพื่อเผยแพร่'}catch{status.textContent='เปิดไฟล์รูปไม่ได้ กรุณาใช้ PNG, JPEG หรือ WebP'}finally{upload.disabled=false;if(url)URL.revokeObjectURL(url)}});
  // Backgrounds retain the original bytes; do not crop or recompress the artwork.
  if(group==='hero'||group==='pageBackground'||group==='promos'){
   const originalUpload=upload.cloneNode(true);upload.replaceWith(originalUpload);
   originalUpload.addEventListener('change',async()=>{const file=originalUpload.files[0];if(!file)return;if(file.size>8*1024*1024){status.textContent='รูปต้องไม่เกิน 8 MB';return}originalUpload.disabled=true;try{const value=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});if(!safeImage(value))throw new Error();const check=new Image();check.src=value;await check.decode();input.value=value;image.src=value;status.textContent='เลือกรูปต้นฉบับแล้ว ('+check.width+' × '+check.height+' px) กดบันทึกเพื่อเผยแพร่'}catch{status.textContent='เปิดรูปไม่ได้ กรุณาใช้ PNG, JPEG หรือ WebP'}finally{originalUpload.disabled=false}});
   row.append(title,image,input,originalUpload);
   const hint=document.createElement('small');hint.textContent='เก็บรูปต้นฉบับ ไม่ลดความคมชัด — แบนเนอร์หลักแนะนำ 1916 × 821 px';row.append(hint);
   if(group==='hero'){const reset=document.createElement('button');reset.type='button';reset.textContent='ใช้รูปต้นฉบับ 1916 × 821 ที่แนบมา';reset.addEventListener('click',()=>{input.value='assets/software-hero-1916x821.png';image.src=input.value;status.textContent='เลือกรูปต้นฉบับแล้ว กดบันทึกเพื่อเผยแพร่'});row.append(reset)}
   return row;
  }
  row.append(title,image,input,upload);return row;
 }
 mount.querySelector('[data-software-load]').addEventListener('click',async e=>{
  e.target.disabled=true;status.textContent='กำลังโหลดรูปจากร้าน…';
  try{const settings=await window.OlafStoreSettings.fetchStoreSettings({forceRefresh:true});config=structuredClone(settings.softwareStore||{});fields.replaceChildren();
   const heading=document.createElement('h3');heading.textContent='รูปหมวดหมู่ — เลือกรูปใหม่หรือวาง URL แล้วกดบันทึก';heading.style.gridColumn='1 / -1';fields.append(heading);
   categories.forEach(c=>{
    const row=field('หมวดหมู่ '+c.name,'categories',c.id,config.categories?.[c.id]||'',c.image);
    const name=document.createElement('input');name.type='text';name.maxLength=80;name.value=config.categoryNames?.[c.id]||c.name;name.dataset.softwareGroup='categoryNames';name.dataset.softwareKey=c.id;name.setAttribute('aria-label','ชื่อหมวดหมู่ '+c.name);row.insertBefore(name,row.children[1]);fields.append(row);
   });
   const otherHeading=document.createElement('h3');otherHeading.textContent='พื้นหลังทั้งหมดและแบนเนอร์โปรโมชัน';otherHeading.style.gridColumn='1 / -1';fields.append(otherHeading,field('แบนเนอร์หลักเต็มความกว้าง','hero','',config.hero),field('พื้นหลังหน้าร้านทั้งหมด','pageBackground','',config.pageBackground));
   const promoHeading=document.createElement('h3');promoHeading.textContent='การ์ด Adobe / CapCut ด้านล่าง — เปลี่ยนพื้นหลังของการ์ดในภาพได้ที่นี่';promoHeading.style.gridColumn='1 / -1';fields.append(promoHeading);
   ['adobe','capcut'].forEach(id=>fields.append(field('พื้นหลังการ์ด '+(id==='adobe'?'Adobe':'CapCut')+' ด้านล่าง','promos',id,config.promos?.[id]||'')));
   loaded=true;status.textContent='รูปสินค้าใช้รูปจากเมนูจัดการสินค้าโดยตรง เปลี่ยนชื่อและรูปหมวดหมู่ได้ทุกช่อง แล้วกดบันทึก';
  }catch(error){status.textContent='โหลดไม่สำเร็จ: '+(error.message||'กรุณาลองใหม่')}finally{e.target.disabled=false}
 });
 mount.querySelector('[data-software-save]').addEventListener('click',async e=>{
  if(!loaded){status.textContent='กรุณากดโหลดรูปที่ตั้งไว้ก่อน';return}
  const next=structuredClone(config);for(const input of fields.querySelectorAll('[data-software-group]')){const value=input.value.trim(),group=input.dataset.softwareGroup;if(group!=='categoryNames'&&value&&!safeImage(value)){status.textContent='URL รูปไม่ถูกต้อง: '+input.getAttribute('aria-label');input.focus();return}if(group==='hero'||group==='pageBackground')next[group]=value;else{next[group]||={};next[group][input.dataset.softwareKey]=value}}
  e.target.disabled=true;try{status.textContent='กำลังบันทึกรูป…';const current=await window.OlafStoreSettings.fetchStoreSettings({forceRefresh:true});await window.OlafStoreSettings.saveStoreSettings({...current,softwareStore:next});const verified=await window.OlafStoreSettings.fetchStoreSettings({forceRefresh:true});const matches=Object.entries(next).every(([key,value])=>typeof value==='object'?Object.entries(value).every(([id,url])=>verified.softwareStore?.[key]?.[id]===url):verified.softwareStore?.[key]===value);if(!matches)throw new Error('ยังยืนยันข้อมูลที่บันทึกไม่ได้');config=next;window.dispatchEvent(new CustomEvent('olaf-software-settings-saved',{detail:next}));status.textContent='บันทึกแล้ว รีเฟรชหน้าร้านซอฟต์แวร์เพื่อดูรูปใหม่'}catch(error){status.textContent='บันทึกไม่สำเร็จ: '+(error.message||'กรุณาลองใหม่')}finally{e.target.disabled=false}
 });
 // Load once when the settings section is actually opened, after the admin gate.
 const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&!loaded){const button=mount.querySelector('[data-software-load]');if(!button.disabled)button.click();observer.disconnect()}},{threshold:0});
 observer.observe(mount);
});
