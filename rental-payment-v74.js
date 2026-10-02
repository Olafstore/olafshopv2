// Rental adapter for the main product QR surface. Uses the existing slip/cancel clients.
(()=>{
 const q=s=>document.querySelector(s),text=(s,v)=>{const n=q(s);if(n)n.textContent=v;},money=n=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(n);
 let current=null,version=0,timer=null,qrTimer=null,busy=false;
 const method=value=>{const v=String(value||'').toLowerCase();return ['wallet','wallet-api','truemoney','true_money'].includes(v)?'wallet':['promptpay','prompt-pay','prompt_pay'].includes(v)?'promptpay':'';};
 const urls=s=>s?['qrUrl','qr_url','qrCodeUrl','qr_code_url','paymentQrUrl','payment_qr_url','imageUrl','image_url','publicUrl','public_url','signedUrl','signed_url','dataUrl','data_url'].map(k=>s[k]).filter(Boolean):[];
 const safeUrl=value=>{try{const u=new URL(value,location.href);return (u.protocol==='https:'&&!u.username&&!u.password)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);}catch{return false;}};
 function status(message){text('#rental-payment-status',message);}
 function close(){q('#qr-dialog')?.close();clearInterval(timer);clearTimeout(qrTimer);version++;}
 function reset(){close();current=null;busy=false;const image=q('[data-qr-image]');if(image){image.onload=image.onerror=null;image.removeAttribute('src');image.hidden=true;}if(q('#rental-slip-input'))q('#rental-slip-input').value='';}
 function loading(show){q('[data-qr-loading]').hidden=!show;q('[data-qr-loading]').style.display=show?'grid':'none';}
 function expire(){if(!current)return;const expired=Date.parse(current.expiresAt)<=Date.now();q('[data-qr-upload-slip-btn]').disabled=busy||expired;
   if(expired){status('หมดเวลาชำระออเดอร์นี้แล้ว ห้ามโอนเพิ่ม หากโอนแล้วกรุณาติดต่อร้านพร้อมเลขออเดอร์');loading(false);q('[data-qr-image]').hidden=true;clearInterval(timer);}}
 async function open(order,product){
  reset();const token=version;const dialog=q('#qr-dialog');if(!dialog)return;
  current=order;status('');dialog.showModal();dialog.classList.add('is-visible');dialog.dataset.paymentStage='ready';
  text('[data-qr-order-id]',order.orderNumber);text('[data-qr-product-name]',product?.name||order.name);text('[data-qr-product-label]',`เช่า ${order.durationDays} วัน • ${new Date(order.startAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}`);
  text('[data-qr-product-price]',money(order.total));text('[data-qr-total]',money(order.total));text('[data-qr-created-at]',new Date().toLocaleDateString('th-TH'));
  text('.qr-status-badge','รอการชำระเงิน');text('[data-qr-method-badge]',method(order.paymentMethod)==='wallet'?'TrueMoney Wallet':'QR พร้อมเพย์');
  const cover=q('[data-qr-product-image]');cover.hidden=!product?.image;if(product?.image)cover.src=product.image;else cover.removeAttribute('src');
  const img=q('[data-qr-image]'),unavailable=q('[data-qr-unavailable]');img.hidden=true;unavailable.hidden=true;loading(true);
  q('[data-qr-upload-slip-btn]').disabled=false;q('[data-qr-cancel-btn]').disabled=false;
  const oldRetry=q('[data-rental-recheck]');oldRetry?.remove();
  if(order.hasSlip){const b=document.createElement('button');b.type='button';b.className='secondary-button';b.dataset.rentalRecheck='';b.textContent='ตรวจสลิปเดิมอีกครั้ง';b.onclick=()=>verify(null);q('#qr-dialog .premium-actions').append(b);}
  try{
   const [channels,store]=await Promise.all([window.OlafStoreSettings.fetchPaymentChannels({activeOnly:true}),window.OlafStoreSettings.fetchStoreSettings()]);if(token!==version)return;
   const channel=channels.find(c=>c.isActive!==false&&method(c.method||c.id)===method(order.paymentMethod)),p=store?.payment||{};
   const orderUrls=order.paymentQrMethod&&method(order.paymentQrMethod)===method(order.paymentMethod)?urls(order):[];
   const promptId=String(channel?.promptPayId||channel?.promptpayId||p.promptPayId||p.promptpayId||store?.promptPayId||window.OLAF_CONFIG?.promptPayId||'').replace(/\D/g,'');
   const fallback=method(order.paymentMethod)==='wallet'?[p.trueMoneyQrUrl,p.true_money_qr_url,p.walletQrUrl,p.wallet_qr_url]:[p.manualQrUrl,p.manual_qr_url,p.qrUrl,p.qr_url,...(promptId?[`https://promptpay.io/${encodeURIComponent(promptId)}/${Number(order.total).toFixed(2)}.png`]:[])];
   const candidates=[...new Set([...orderUrls,...urls(channel),...fallback].filter(v=>typeof v==='string'&&safeUrl(v)))];
   const note=q('[data-qr-note]');note.replaceChildren();
   for(const value of [channel?.note||p.paymentNote,channel?.bankName||p.bankName,channel?.accountNumber||p.bankAccountNumber,channel?.accountName||p.bankAccountName,method(order.paymentMethod)==='wallet'?(channel?.walletName||p.walletName):''])if(value){const row=document.createElement('p');row.textContent=value;note.append(row);}
   const exact=document.createElement('p');exact.textContent=`ชำระตรงยอด ${money(order.total)} ไม่ปัดเศษ • ก่อน ${new Date(order.expiresAt).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok'})}`;note.append(exact);
   let i=0;function next(){clearTimeout(qrTimer);if(token!==version)return;if(i>=candidates.length){loading(false);unavailable.hidden=false;unavailable.textContent='โหลด QR ไม่สำเร็จ กรุณาโหลดหน้าชำระเดิมใหม่ ห้ามสร้างออเดอร์หรือโอนซ้ำ';return;}img.src=candidates[i++];qrTimer=setTimeout(next,10000);}
   img.onload=()=>{if(token!==version)return;clearTimeout(qrTimer);loading(false);img.hidden=false;expire();};img.onerror=next;next();
  }catch{if(token===version){loading(false);unavailable.hidden=false;unavailable.textContent='โหลดช่องทางชำระเงินไม่ได้ กรุณาติดต่อร้านก่อนโอน';}}
  if(token===version){expire();timer=setInterval(expire,1000);}window.lucide?.createIcons?.();
 }
 async function verify(file){
  if(!current||busy)return;busy=true;const order=current,token=version;q('[data-qr-upload-slip-btn]').disabled=true;q('[data-qr-cancel-btn]').disabled=true;
  status('กำลังตรวจสลิป กรุณารอ ไม่ต้องแนบหรือโอนซ้ำ');q('#qr-dialog').setAttribute('aria-busy','true');
  try{
   const result=file?await window.OlafOrders.uploadPaymentSlip({orderId:order.id,file}):await window.OlafOrders.verifyPaymentSlip({orderId:order.id});
   if(token!==version)return;
   const fresh=await window.OlafRental.api('order',undefined,{orderId:order.id});if(token!==version)return;
   if(fresh.paymentStatus==='verified'){close();location.href='rental-order.html?order='+encodeURIComponent(order.id);return;}
   status(result?.verificationPending?'เก็บสลิปไว้แล้ว กำลังรอผลตรวจ กรุณาดูสถานะออเดอร์ก่อนแนบซ้ำ':'ยังไม่ยืนยันชำระ กรุณาดูสถานะออเดอร์ก่อนโอนเพิ่ม');
  }catch(error){if(token===version)status(error?.code==='SLIP_QR_NOT_FOUND'||error?.message==='SLIP_QR_NOT_FOUND'?'ไม่พบ QR ในสลิป กรุณาใช้รูปสลิปต้นฉบับ':'ยังยืนยันผลตรวจไม่ได้ กรุณาดูสถานะออเดอร์ก่อนแนบซ้ำ ห้ามโอนซ้ำ');}
  finally{if(token===version){busy=false;q('#qr-dialog').removeAttribute('aria-busy');q('[data-qr-cancel-btn]').disabled=false;expire();}}
 }
 window.OlafRentalPayment={open,reset};
 document.addEventListener('DOMContentLoaded',()=>{
  q('[data-qr-close-btn]').onclick=close;q('#qr-dialog').addEventListener('cancel',e=>{e.preventDefault();close();});
  q('[data-qr-upload-slip-btn]').onclick=()=>{if(current&&!busy)q('#rental-slip-input').click();};
  q('#rental-slip-input').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)verify(file);};
  q('[data-qr-view-order-btn]').onclick=()=>{if(current)location.href='rental-order.html?order='+encodeURIComponent(current.id);};
  q('[data-qr-cancel-btn]').onclick=async()=>{if(!current||busy||!confirm('ยกเลิกเฉพาะกรณียังไม่โอนเงิน ยืนยันหรือไม่?'))return;busy=true;const id=current.id,token=version;
   try{await window.OlafOrders.cancelMyOrder(id);if(token===version){close();location.href='rental-order.html?order='+encodeURIComponent(id);}}catch{if(token===version)status('ยกเลิกไม่สำเร็จ กรุณาตรวจสถานะออเดอร์');}finally{if(token===version)busy=false;}};
 });
})();
