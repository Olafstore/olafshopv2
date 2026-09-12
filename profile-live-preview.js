/* Render the real profile document, with a local-only decoration draft. */
(() => {
 window.OlafProfilePreview={mount(host,item,dialog){
  const frame=document.createElement('iframe');frame.className='profile-live-preview';frame.title='ตัวอย่างหน้าโปรไฟล์จริง';frame.style.visibility='hidden';
  const note=document.createElement('p');note.className='profile-preview-status';note.setAttribute('role','status');note.textContent='กำลังโหลดหน้าโปรไฟล์จริง…';
  host.replaceChildren(note,frame);
  let observer,resize,timer,disposed=false;
  const stop=()=>{disposed=true;observer?.disconnect();resize?.disconnect();clearTimeout(timer);frame.remove();};
  dialog.addEventListener('close',stop,{once:true});
  frame.addEventListener('load',()=>{
   if(disposed)return;
   try{
    const doc=frame.contentDocument;if(!doc)throw new Error('NO_DOCUMENT');
    const style=doc.createElement('style');style.textContent='html,body{min-width:0!important;margin:0!important;padding:0!important}body{background:transparent!important} [data-preview-path]{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important} #profile-overview-root{margin:0!important;width:100%!important}';doc.head.append(style);
    doc.body.inert=true;
    const apply=()=>{
     if(disposed)return;const root=doc.getElementById('profile-overview-root'),cover=root?.querySelector('.member-cover');if(!cover)return;
     let node=root;while(node&&node!==doc.body){const parent=node.parentElement;if(!parent)break;for(const sibling of parent.children){if(sibling!==node&&sibling.tagName!=='SCRIPT'&&sibling.style.display!=='none')sibling.style.display='none';}if(!parent.hasAttribute('data-preview-path'))parent.setAttribute('data-preview-path','');node=parent;}
     let image=cover.querySelector(item.kind==='background'?'.member-background':'.member-portrait');
     if(!image||image.tagName!=='IMG'){const replacement=doc.createElement('img');replacement.className=item.kind==='background'?'member-background':'member-portrait';if(image)image.replaceWith(replacement);else cover.prepend(replacement);image=replacement;}
     const src=new URL(item.image,document.baseURI).href;if(image.src!==src)image.src=src;
     image.alt=item.kind==='background'?'พื้นหลังที่เลือก · ยังไม่บันทึก':'รูปโปรไฟล์ที่เลือก · ยังไม่บันทึก';
     const theme=document.documentElement.dataset.siteTheme;if(doc.documentElement.dataset.siteTheme!==theme)doc.documentElement.dataset.siteTheme=theme;
     const height=Math.ceil(root.getBoundingClientRect().height);if(height>0&&frame.style.height!==height+'px')frame.style.height=height+'px';
     frame.style.visibility='visible';note.hidden=true;clearTimeout(timer);
     if(!resize){resize=new ResizeObserver(apply);resize.observe(root);}
    };
    observer=new MutationObserver(apply);observer.observe(doc.body,{childList:true,subtree:true});apply();
   }catch{note.textContent='โหลดตัวอย่างไม่ได้ กรุณาเปิดจากเว็บเดียวกันแล้วลองใหม่';}
  });
  timer=setTimeout(()=>{if(!disposed&&!note.hidden)note.textContent='ยังโหลดโปรไฟล์ไม่สำเร็จ กรุณาตรวจการเข้าสู่ระบบแล้วเปิดตัวอย่างอีกครั้ง';},30000);
  frame.src='profile.html?decorationPreview=1#user';
 }};
})();
