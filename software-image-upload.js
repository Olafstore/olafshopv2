/* Bound inline settings payloads while preserving artwork aspect ratio. */
(()=>{
 const read=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));reader.readAsDataURL(blob)});
 async function optimize(value){
  const blob=typeof value==='string'?await (await fetch(value)).blob():value;
  if(blob.size>30*1024*1024)throw new Error('รูปต้องไม่เกิน 30 MB');
  if(!/^image\/(png|jpeg|webp)$/.test(blob.type))throw new Error('รองรับ PNG, JPEG และ WebP');
  const url=URL.createObjectURL(blob);
  try{
   const image=new Image();image.src=url;await image.decode();
   if(!image.width||!image.height)throw new Error('ไม่พบขนาดรูป');
   let scale=Math.min(1,2560/Math.max(image.width,image.height));
   const canvas=document.createElement('canvas');
   for(let pass=0;pass<8;pass++){
    canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',pass===0?.9:.82));
    if(!output)throw new Error('แปลงรูปไม่สำเร็จ');
    if(output.size<=240*1024)return await read(output);
    scale*=.8;
   }
   throw new Error('รูปมีรายละเอียดมากเกินไป กรุณาใช้ URL รูปแทน');
  }finally{URL.revokeObjectURL(url)}
 }
 async function compact(config){
  // Deprecated overrides are not read by the storefront anymore.
  delete config.products;
  const jobs=[];
  function visit(object){for(const [key,value] of Object.entries(object)){if(typeof value==='string'&&value.startsWith('data:image/')&&value.length>330000)jobs.push(async()=>{object[key]=await optimize(value)});else if(value&&typeof value==='object')visit(value)}}
  visit(config);for(const job of jobs)await job();
  if(JSON.stringify(config).length>2000000)throw new Error('รูปทั้งหมดรวมกันใหญ่เกินไป กรุณาใช้ URL รูปบางรายการ');
  return config;
 }
 window.OlafSoftwareImages={optimize,compact};
})();
