window.OlafSoftwareDetailCards=(container,p,store={})=>{
 const c=p.sourceMetadata?.softwareDetail||{},summary=container.querySelector('.pd-sidebar-body'),aside=container.querySelector('.sd-aside'),description=container.querySelector('#sd-description'),nav=container.querySelector('.sd-tabs');
 if(!summary||!aside)return;
 const lines=value=>String(value||'').split('\n').map(s=>s.trim()).filter(Boolean);
 const image=url=>{if(!url)return '';if(/^data:image\/(png|jpeg|webp);base64,/i.test(url))return url;try{const parsed=new URL(url,location.href);return ['http:','https:'].includes(parsed.protocol)?parsed.href:''}catch{return ''}};
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node};
 const card=(title,items)=>{const box=el('section',null,'pd-section sd-editable-card');box.append(el('h3',title));items.forEach(item=>box.append(el('p',item)));return box};
 if(c.subtitle){const node=el('p',c.subtitle,'sd-subtitle');summary.querySelector('h1')?.after(node)}
 const category=window.OlafSoftwareStore?.categories.find(item=>item.id===window.OlafSoftwareStore.classify(p));
 const categoryName=store.softwareStore?.categoryNames?.[category?.id]||category?.name||p.publisher||p.category;
 const brand=el('div',null,'sd-brand-block'),header=el('div',null,'sd-product-header'),heading=el('div',null,'sd-heading-content');
 const logoUrl=image(store.softwareStore?.categories?.[category?.id]||c.brandLogo||category?.image);
 if(logoUrl){const logo=el('img',null,'sd-brand-logo');logo.src=logoUrl;logo.alt=categoryName;brand.append(logo)}
 brand.append(el('strong',c.brandName||categoryName));
 ['.pd-badges','.pd-sidebar-title','.sd-subtitle','.pd-sidebar-publisher'].forEach(selector=>{const node=summary.querySelector(selector);if(node)heading.append(node)});
 header.append(brand,heading);summary.prepend(header);
 summary.querySelectorAll('.pd-genre-tags,.pd-separator,.pd-features-row,.pd-sidebar-cover,.pd-mobile-cover').forEach(node=>node.remove());
 if(c.benefits){const row=el('div',null,'sd-benefit-grid');lines(c.benefits).forEach(line=>{const [title,...body]=line.split('|');const box=el('div');box.append(el('strong',title),el('small',body.join('|')));row.append(box)});summary.querySelector('.pd-package-section')?.before(row);if(!row.isConnected)summary.querySelector('h1')?.after(row)}
 const info=aside.querySelector('.pd-info-card');
 if(info&&c.infoRows){info.replaceChildren();lines(c.infoRows).forEach(line=>{const [key,...value]=line.split('|');const row=el('div',null,'pd-info-row');row.append(el('span',key),el('strong',value.join('|')));info.append(row)})}
 if(c.infoTitle&&info)info.closest('.pd-section').querySelector('h3').textContent=c.infoTitle;
 if(c.warrantyLines){aside.querySelector('.sd-warranty')?.remove();const box=card(c.warrantyTitle||'การรับประกัน',lines(c.warrantyLines));box.classList.add('sd-warranty');aside.append(box)}else if(c.warrantyTitle){const title=aside.querySelector('.sd-warranty h3');if(title)title.textContent=c.warrantyTitle}
 if(c.highlights){const highlights=card(c.highlightsTitle||'จุดเด่น',lines(c.highlights));highlights.classList.add('sd-highlights');description.append(highlights)}
 if(c.guide)container.querySelector('#sd-guide').prepend(card(c.guideTitle||'วิธีใช้งาน',lines(c.guide)));
 if(c.paymentImages){const box=el('div',null,'sd-payments');box.append(el('strong',c.paymentTitle||'ช่องทางชำระเงิน'));lines(c.paymentImages).forEach(line=>{const [name,url]=line.split('|');if(image(url)){const logo=el('img');logo.src=image(url);logo.alt=name;box.append(logo)}});summary.append(box)}
 const panels=[container.querySelector('#sd-description'),container.querySelector('#sd-guide')];
 [c.descriptionTab,c.guideTab].forEach((title,i)=>{if(title)nav.children[i].textContent=title});
 for(const [key,label] of [['faq',c.faqTab||'คำถามที่พบบ่อย'],['reviews',c.reviewsTab||'รีวิวจากลูกค้า']]){
  const panel=el('div');panel.id='sd-'+key;panel.hidden=true;panel.setAttribute('role','tabpanel');
  if(c[key])lines(c[key]).forEach(line=>{const [title,...body]=line.split('|');panel.append(card(title,[body.join('|')]))});else panel.append(el('p',key==='faq'?(c.faqEmpty||'สอบถามข้อมูลเพิ่มเติมผ่านช่องทางติดต่อของร้าน'):(c.reviewsEmpty||'ยังไม่มีรีวิวที่เผยแพร่')));
  const button=el('button',label);button.type='button';button.id=panel.id+'-tab';button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-selected','false');button.tabIndex=-1;panel.setAttribute('aria-labelledby',button.id);
  panels.push(panel);nav.append(button);nav.parentNode.append(panel);
 }
 [...nav.children].forEach((button,i)=>button.addEventListener('click',()=>{panels.forEach((panel,j)=>panel.hidden=i!==j);[...nav.children].forEach((tab,j)=>{tab.setAttribute('aria-selected',String(i===j));tab.tabIndex=i===j?0:-1})}));
 if(c.relatedTitle){const title=aside.querySelector('.pd-related-heading h3');if(title)title.textContent=c.relatedTitle}
 if(c.relatedNote){const note=aside.querySelector('.pd-related-heading p');if(note)note.textContent=c.relatedNote}
 if(c.buyLabel){const button=summary.querySelector('#btn-buy');if(button&&!button.disabled){[...button.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.remove());button.append(document.createTextNode(' '+c.buyLabel))}}
 if(c.backLabel)container.querySelector('.pd-breadcrumb').textContent=c.backLabel;
 const packageTitle=summary.querySelector('.pd-package-head strong');if(packageTitle)packageTitle.textContent=c.packageTitle||'เลือกประเภทสินค้า';
 const priceLabel=summary.querySelector('.pd-price-label');if(priceLabel)priceLabel.textContent=c.priceLabel||'ราคาสินค้า';
 if(c.descriptionTitle){const title=description.querySelector('h3');if(title)title.textContent=c.descriptionTitle}
 if(!aside.querySelector('.sd-warranty')){const warranty=card(c.warrantyTitle||'การรับประกัน',[c.warrantyEmpty||'กรุณาสอบถามเงื่อนไขกับร้านก่อนสั่งซื้อ']);warranty.classList.add('sd-warranty');aside.append(warranty)}
 const actions=el('div',null,'sd-purchase-actions');
 const buy=summary.querySelector('#btn-buy');if(buy){buy.before(actions);actions.append(buy)}
 const favorite=summary.querySelector('[data-product-favorite]');if(favorite)actions.append(favorite);
 if(!c.benefits){const row=el('div',null,'sd-benefit-grid');[['การจัดส่ง',p.delivery],['การรับประกัน',p.warranty],['แบรนด์',p.publisher]].filter(([,value])=>value).forEach(([title,value])=>{const box=el('div');box.append(el('strong',title),el('small',value));row.append(box)});if(row.children.length)header.after(row)}
};
