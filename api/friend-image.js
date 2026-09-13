import sharp from 'sharp';
export async function sanitizeChatImage(data,mime,name){
 if(!['image/jpeg','image/png'].includes(mime)||!/^.+\.(jpe?g|png)$/i.test(name||''))throw Error('CHAT_INVALID_IMAGE');
 if(typeof data!=='string'||data.length>2800000||! /^[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('CHAT_INVALID_IMAGE');
 const bytes=Buffer.from(data,'base64');if(bytes.length>2*1024*1024||bytes.length<12)throw Error('CHAT_INVALID_IMAGE');
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(mime==='image/png'?!png:!jpeg)throw Error('CHAT_INVALID_IMAGE');
 const image=sharp(bytes,{limitInputPixels:16000000,failOn:'warning'}),meta=await image.metadata();
 if(!['jpeg','png'].includes(meta.format)||(meta.pages||1)>1)throw Error('CHAT_INVALID_IMAGE');
 const clean=await image.rotate().resize({width:960,height:960,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:75}).toBuffer();
 const result=clean.toString('base64');if(result.length>400000)throw Error('CHAT_IMAGE_TOO_LARGE');return result;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const reply=(code,error)=>res.status(code).json({error});
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,'METHOD_NOT_ALLOWED');}
 const url=(process.env.SUPABASE_URL||'').replace(/\/+$/,''),key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!service)return reply(503,'CHAT_CONFIG_REQUIRED');
 const auth=req.headers.authorization;if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth||''))return reply(401,'AUTH_REQUIRED');
 try{
  const request=(path,token,apiKey,body)=>fetch(url+path,{method:body?'POST':'GET',headers:{apikey:apiKey,Authorization:token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const check=await request('/auth/v1/user',auth,key);if(!check.ok)return reply(401,'AUTH_REQUIRED');const member=await check.json();
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!body||typeof body.username!=='string'||body.username.length>80||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.nonce||''))return reply(400,'INVALID_REQUEST');
  const relation=await request('/rest/v1/rpc/shop_friend_relation',auth,key,{p_username:body.username});
  if(!relation.ok||(await relation.json()).state!=='friends')return reply(403,'CHAT_FRIENDS_ONLY');
  let jpeg;try{jpeg=await sanitizeChatImage(body.data,body.mime,body.name);}catch{return reply(400,'CHAT_INVALID_IMAGE');}
  const sent=await request('/rest/v1/rpc/shop_friend_image_send','Bearer '+service,service,{p_user:member.id,p_username:body.username,p_jpeg:jpeg,p_nonce:body.nonce});
  if(!sent.ok){const err=await sent.json();return reply(400,String(err.message).includes('CHAT_RATE_LIMIT')?'CHAT_RATE_LIMIT':'CHAT_SEND_FAILED');}
  return res.status(200).json(await sent.json());
 }catch{return reply(400,'CHAT_REQUEST_FAILED');}
}
