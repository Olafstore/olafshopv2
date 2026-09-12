// Read the same live logo field saved by Admin, never the old catalog photo.
export function createHandler({fetcher=fetch,env=process.env}={}){
 return async function handler(req,res){
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
  res.setHeader('Cache-Control','no-store');
  const base=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY;
  if(!base||!key)return res.status(503).end();
  try{
   const url=new URL('/rest/v1/store_settings',base);
   url.searchParams.set('select','settings->>siteIconUrl');url.searchParams.set('id','eq.main');url.searchParams.set('limit','1');
   const response=await fetcher(url,{headers:{apikey:key},signal:AbortSignal.timeout(6000)});
   if(!response.ok)throw new Error('SETTINGS_UNAVAILABLE');
   const rows=await response.json();if(!Array.isArray(rows))throw new Error('INVALID_SETTINGS');
   const logo=String(rows[0]?.siteIconUrl||'').trim();
   if(!logo)return res.status(404).end();
   const match=logo.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/);
   if(match){
    if(match[2].length>14*1024*1024)return res.status(422).end();
    const image=Buffer.from(match[2],'base64');
    const valid=match[1]==='jpeg'?image[0]===255&&image[1]===216:match[1]==='png'?image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='gif'?/^GIF8[79]a/.test(image.subarray(0,6).toString()):image.subarray(0,4).toString()==='RIFF'&&image.subarray(8,12).toString()==='WEBP';
    if(!valid)return res.status(422).end();
    res.setHeader('Content-Type','image/'+match[1]);res.setHeader('Content-Length',image.length);res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(200).end(req.method==='HEAD'?undefined:image);
   }
   let remote;try{remote=new URL(logo);}catch{return res.status(422).end();}
   if(remote.protocol!=='https:'||remote.username||remote.password)return res.status(422).end();
   // Do not proxy arbitrary URLs through our server.
   res.setHeader('Location',remote.href);return res.status(302).end();
  }catch{return res.status(503).end();}
 };
}
export default createHandler();
