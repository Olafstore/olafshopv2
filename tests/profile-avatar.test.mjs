import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import handler from '../api/profile-avatar.js';
import { scanAvatarCatalog } from '../api/profile-shop.js';

const response = () => ({ headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},end(body){this.body=body;return this;} });

test('GIF backgrounds retain every frame and full portrait previews retain original aspect ratio',async()=>{
  const original=process.cwd(), root=await mkdtemp(path.join(os.tmpdir(),'olaf-gif-preview-'));
  try {
    await mkdir(path.join(root,'iconprofile/iconpoint'),{recursive:true});
    await mkdir(path.join(root,'iconprofile/BGolaf'),{recursive:true});
    const frame='21f904000a0000002c0000000001000100000202440100';
    const gif=Buffer.from('47494638396101000100800000000000ffffff'+frame+frame+'3b','hex');
    assert.equal((await sharp(gif,{animated:true}).metadata()).pages,2);
    await writeFile(path.join(root,'iconprofile/BGolaf/moving.gif'),gif);
    await writeFile(path.join(root,'iconprofile/free-moving.gif'),gif);
    await writeFile(path.join(root,'iconprofile/iconpoint/paid-moving.gif'),gif);
    await sharp({create:{width:200,height:100,channels:4,background:'#aa55cc'}}).png().toFile(path.join(root,'iconprofile/wide.png'));
    process.chdir(root);
    const res=response(); await handler({method:'GET',url:'/api/profile-avatar?id=iconprofile%2FBGolaf%2Fmoving.gif',headers:{}},res);
    assert.equal(res.code,200); assert.equal(res.headers['Content-Type'],'image/gif'); assert.deepEqual(res.body,gif);
    for(const id of ['iconprofile/free-moving.gif','iconprofile/iconpoint/paid-moving.gif']){
      assert((await scanAvatarCatalog()).some(item=>item.id===id));
      for(const view of ['', '&view=full']){
        const avatar=response();await handler({method:'GET',url:'/api/profile-avatar?id='+encodeURIComponent(id)+view,headers:{}},avatar);
        assert.equal(avatar.code,200);assert.equal(avatar.headers['Content-Type'],'image/gif');assert.deepEqual(avatar.body,gif);assert.equal((await sharp(avatar.body,{animated:true}).metadata()).pages,2);
      }
    }
    const full=response(); await handler({method:'GET',url:'/api/profile-avatar?id=iconprofile%2Fwide.png&view=full',headers:{}},full);
    const info=await sharp(full.body).metadata(); assert.equal(info.width,200); assert.equal(info.height,100);
  } finally {process.chdir(original); await rm(root,{recursive:true,force:true});}
});
test('all current profile images produce valid compact thumbnails without changing originals', async () => {
  for (const item of await scanAvatarCatalog()) {
    const res=response();
    await handler({ method:'GET',url:item.image,headers:{} },res);
    assert.equal(res.code,200,item.id);
    if(item.id.endsWith('.gif')){assert.equal(res.headers['Content-Type'],'image/gif');continue;}
    const info=await sharp(res.body).metadata();
    assert.equal(info.format,'webp');
    assert.equal(info.width,320); assert.equal(info.height,320);
    assert(res.body.length < 100000,item.id);
  }
});
test('thumbnail endpoint rejects traversal and revalidates cached images', async () => {
  const invalid=response();
  await handler({method:'GET',url:'/api/profile-avatar?id=../supabase-client.js',headers:{}},invalid);
  assert.equal(invalid.code,404);
  const res=response(); const url=(await scanAvatarCatalog())[0].image;
  await handler({method:'HEAD',url,headers:{}},res);
  assert.equal(res.code,200); assert.equal(res.body,undefined);
  const cached=response();
  await handler({method:'GET',url,headers:{'if-none-match':res.headers.ETag}},cached);
  assert.equal(cached.code,304);
});
