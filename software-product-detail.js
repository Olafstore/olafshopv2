window.OlafSoftwareDetail={
 applies:p=>Boolean(window.OlafExtraProducts?.isExtraCategory?.(p?.category))||/^(software|office|adobe|capcut|antivirus)$/.test(p?.category||''),
 enhance(container,p){
  if(!this.applies(p)){container.classList.remove('software-detail');return}
  container.classList.add('software-detail');
  const layout=container.querySelector('.pd-layout'),left=layout?.querySelector('.pd-left'),summary=layout?.querySelector('.pd-sidebar');
  if(!left||!summary)return;
  const gallery=document.createElement('section');gallery.className='sd-gallery';gallery.setAttribute('aria-label','รูปสินค้า');
  ['.pd-hero-img','.pd-screenshots'].forEach(selector=>{const node=left.querySelector(selector);if(node)gallery.append(node)});
  left.querySelector('.pd-gallery-label')?.remove();
  if(!gallery.querySelector('img')){const cover=summary.querySelector('.pd-sidebar-cover img');if(cover){const holder=document.createElement('div');holder.className='pd-hero-img';holder.append(cover.cloneNode(true));gallery.append(holder)}}
  const aside=document.createElement('aside');aside.className='sd-aside';
  const info=left.querySelector('.pd-info-card')?.closest('.pd-section');if(info)aside.append(info);
  if(p.warranty){const box=document.createElement('section');box.className='pd-section sd-warranty';const title=document.createElement('h3');title.textContent='การรับประกัน';const text=document.createElement('p');text.textContent=p.warranty;box.append(title,text);aside.append(box)}
  const details=document.createElement('section');details.className='sd-details';
  const nav=document.createElement('div');nav.className='sd-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','รายละเอียดสินค้า');
  const description=document.createElement('div'),guide=document.createElement('div');description.id='sd-description';guide.id='sd-guide';
  for(const node of [...left.children]){if(node.matches('.pd-description-section,.pd-admin-detail-section'))description.append(node);else guide.append(node)}
  if(!guide.children.length){const text=document.createElement('p');text.textContent='ดูเงื่อนไขในรายละเอียดสินค้า หรือติดต่อร้านเพื่อสอบถามวิธีใช้งาน';guide.append(text)}
  [[description,'รายละเอียดสินค้า'],[guide,'วิธีใช้งาน / เงื่อนไข']].forEach(([panel,label],i)=>{
   const button=document.createElement('button');button.type='button';button.textContent=label;button.id=panel.id+'-tab';button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-selected',String(i===0));button.tabIndex=i===0?0:-1;
   panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.hidden=i!==0;
   button.addEventListener('click',()=>{[description,guide].forEach(el=>el.hidden=el!==panel);nav.querySelectorAll('button').forEach(el=>{el.setAttribute('aria-selected',String(el===button));el.tabIndex=el===button?0:-1})});
   nav.append(button);
  });
  nav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...nav.children];const index=buttons.indexOf(document.activeElement);const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+1)%buttons.length;buttons[next].click();buttons[next].focus()});
  details.append(nav,description,guide);
  const related=container.querySelector('.pd-related-section');if(related){const title=related.querySelector('h3');if(title)title.textContent='สินค้าแนะนำ';const note=related.querySelector('.pd-related-heading p');if(note)note.textContent='เลือกดูสินค้าอื่นของร้าน';aside.append(related)}
  left.remove();layout.replaceChildren(gallery,summary,aside,details);
  container.querySelector('.pd-breadcrumb').href='more-products.html';
 }
};
