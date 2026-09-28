(()=>{
 const schema=[
 ['offerTitle','ชื่อบนการ์ดราคา (สินค้าที่ไม่มีแพ็กเกจ)'],['offerDescription','รายละเอียดสั้นใต้ชื่อบนการ์ดราคา'],
 ['ratingScore','คะแนนรีวิวจริง (0–5; เว้นว่างเมื่อยังไม่มีรีวิว)'],['reviewCount','จำนวนรีวิวจริง'],['soldCount','จำนวนขายจริง (เว้นว่างเพื่อไม่แสดง)'],
 ['promptPayNote','คำอธิบายการชำระพร้อมเพย์'],['walletNote','คำอธิบายการชำระวอลเล็ต'],
 ['paymentNote','คำอธิบายใต้หัวข้อช่องทางชำระเงิน'],
 ['categoryDescription','ข้อมูลสินค้า — รายละเอียดการใช้งานของหมวดหมู่ (เว้นว่างใช้ค่าเริ่มต้น)'],
 ['deliveryTitle','แถบบริการ — หัวข้อการจัดส่ง'],['deliveryText','แถบบริการ — รายละเอียดการจัดส่ง',true],
 ['warrantyBenefitTitle','แถบบริการ — หัวข้อการรับประกัน'],['warrantyBenefitText','แถบบริการ — รายละเอียดการรับประกัน',true],
 ['brandTitle','แถบบริการ — หัวข้อแบรนด์'],['brandText','แถบบริการ — ชื่อแบรนด์'],
 ['brandName','ชื่อใต้รูปหมวดหมู่ (เว้นว่างใช้ชื่อหมวดหมู่)'],['packageTitle','หัวข้อเลือกประเภทสินค้า'],['priceLabel','หัวข้อราคา'],['guideTitle','หัวข้อการ์ดวิธีใช้งาน'],['faqEmpty','ข้อความเมื่อไม่มี FAQ'],['reviewsEmpty','ข้อความเมื่อยังไม่มีรีวิว'],['descriptionTitle','หัวข้อการ์ดรายละเอียด'],['warrantyEmpty','ข้อความเมื่อยังไม่ระบุรับประกัน'],
 ['subtitle','คำโปรยใต้ชื่อสินค้า'],['brandLogo','URL โลโก้แบรนด์'],['infoTitle','หัวข้อข้อมูลสินค้า'],['infoRows','ข้อมูลสินค้า: หัวข้อ | ค่า (บรรทัดละรายการ)',true],
 ['warrantyTitle','หัวข้อรับประกัน'],['warrantyLines','เงื่อนไขรับประกัน (บรรทัดละข้อ)',true],['highlightsTitle','หัวข้อจุดเด่น'],['highlights','จุดเด่น (บรรทัดละข้อ)',true],
 ['benefits','การ์ดบริการ: หัวข้อ | รายละเอียด (บรรทัดละใบ)',true],['paymentTitle','หัวข้อช่องทางชำระเงิน'],['paymentImages','โลโก้ชำระเงิน: ชื่อ | URL รูป (บรรทัดละรายการ)',true],
 ['descriptionTab','ชื่อแท็บรายละเอียด'],['guideTab','ชื่อแท็บวิธีใช้งาน'],['faqTab','ชื่อแท็บ FAQ'],['reviewsTab','ชื่อแท็บรีวิว'],
 ['guide','วิธีใช้งานเพิ่มเติม',true],['faq','คำถามที่พบบ่อย: คำถาม | คำตอบ',true],['reviews','รีวิวจริงที่ได้รับอนุญาตให้เผยแพร่: ผู้รีวิว | ข้อความ',true],
 ['relatedTitle','หัวข้อสินค้าแนะนำ'],['relatedNote','คำอธิบายสินค้าแนะนำ'],['buyLabel','ข้อความปุ่มซื้อ (ไม่เปลี่ยนราคา)'],['backLabel','ข้อความกลับหน้าร้าน']
 ];
 window.OlafSoftwareDetailEditor={
 load(form,product){
  let box=form.querySelector('[data-software-detail-editor]');
  if(!box){box=document.createElement('fieldset');box.dataset.softwareDetailEditor='';box.style.cssText='display:grid;gap:12px;min-width:0';const title=document.createElement('legend');title.textContent='ออกแบบหน้ารายละเอียดซอฟต์แวร์';box.append(title);const note=document.createElement('p');note.textContent='แก้ข้อมูลแต่ละการ์ดได้ เว้นว่างใช้ข้อมูลสินค้าเดิม ชื่อ/ราคา/รูป/แพ็กเกจ/ป้าย ใช้ช่องเดิมของสินค้า ห้ามกรอกรีวิวหรือคำรับประกันที่ไม่เป็นจริง';box.append(note);schema.forEach(([key,label,multiline])=>{const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(multiline?'textarea':'input');input.dataset.sdField=key;if(multiline)input.rows=3;else input.type='text';wrap.append(input);box.append(wrap)});form.append(box)}
  const config=product.sourceMetadata?.softwareDetail||{};box.querySelectorAll('[data-sd-field]').forEach(input=>input.value=config[input.dataset.sdField]||'');
 },
 read(form){return Object.fromEntries([...form.querySelectorAll('[data-sd-field]')].map(input=>[input.dataset.sdField,input.value.trim()]))}
 };
})();
