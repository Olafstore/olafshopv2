window.OlafSoftwareDetail={
 applies:p=>Boolean(window.OlafExtraProducts?.isExtraCategory?.(p?.category))||/^(software|office|adobe|capcut|antivirus)$/.test(p?.category||''),
 enhance(container,p,store={}){
  if(!this.applies(p)){container.classList.remove('software-detail');return}
  container.classList.add('software-detail');
  // The old Microsoft theme forces 16:9 images and strips card backgrounds.
  // Keep product data/checkout logic, but stop that legacy skin on this layout.
  document.body.classList.remove('product-theme-windows','product-theme-minecraft','product-theme-rockstar');
  const layout=container.querySelector('.pd-layout'),left=layout?.querySelector('.pd-left'),summary=layout?.querySelector('.pd-sidebar');
  if(!left||!summary)return;
  const gallery=document.createElement('section');gallery.className='sd-gallery';gallery.setAttribute('aria-label','รูปสินค้า');
  ['.pd-hero-img','.pd-screenshots'].forEach(selector=>{const node=left.querySelector(selector);if(node)gallery.append(node)});
  left.querySelector('.pd-gallery-label')?.remove();
  if(!gallery.querySelector('img')){const cover=summary.querySelector('.pd-sidebar-cover img');if(cover){const holder=document.createElement('div');holder.className='pd-hero-img';holder.append(cover.cloneNode(true));gallery.append(holder)}}
  const thumbnails=gallery.querySelector('.pd-screenshots');if(thumbnails){const rail=document.createElement('div');rail.className='sd-thumbnail-rail';const control=(label,direction)=>{const button=document.createElement('button');button.type='button';button.textContent=direction<0?'⌃':'⌄';button.setAttribute('aria-label',label);button.addEventListener('click',()=>thumbnails.scrollBy({top:direction*160,left:matchMedia('(max-width:700px)').matches?direction*100:0,behavior:'smooth'}));return button};thumbnails.before(rail);rail.append(control('เลื่อนรูปก่อนหน้า',-1),thumbnails,control('เลื่อนรูปถัดไป',1))}
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
  window.OlafSoftwareDetailCards?.(container,p,store);
  const primary=document.createElement('div');primary.className='sd-primary';primary.append(gallery,summary,details);layout.replaceChildren(primary,aside);
  const warranty=aside.querySelector('.sd-warranty'),relatedCard=aside.querySelector('.pd-related-section');if(warranty&&relatedCard)aside.insertBefore(warranty,relatedCard);
  summary.querySelectorAll('.sd-payments>strong').forEach(node=>node.remove());
  const config=p.sourceMetadata?.softwareDetail||{};
  const paymentRow=summary.querySelector('.sd-payments');
  if(paymentRow){
   const panel=document.createElement('section');panel.className='sd-payment-panel';
   const title=document.createElement('strong');title.textContent=config.paymentTitle||'ช่องทางการชำระเงิน';
   const note=document.createElement('p');note.textContent=config.paymentNote||'ชำระผ่านช่องทางที่ร้านกำหนด';panel.append(title,note);
   [...paymentRow.children].forEach(node=>{const item=document.createElement('div');item.className='sd-payment-method';const name=document.createElement('strong');name.textContent=node.alt||node.textContent;item.append(node,name);paymentRow.append(item)});
   panel.append(paymentRow);summary.querySelector('.sd-purchase-actions')?.after(panel);
  }
  const highlights=description.querySelector('.sd-highlights');
  if(highlights&&!config.highlightsTitle)highlights.querySelector('h3').textContent='สิ่งที่คุณจะได้รับ';
  // Keep additional product information accessible below the primary composition.
  const more=document.createElement('details');more.className='sd-additional';
  const moreTitle=document.createElement('summary');moreTitle.textContent='ข้อมูลสินค้าและการรับประกัน';more.append(moreTitle,aside);details.append(more);
  layout.replaceChildren(primary);
 }
};
