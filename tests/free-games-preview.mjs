// Local preview of real page markup/CSS. Account/payment scripts are deliberately omitted.
import {createServer} from 'node:http';
import {readFileSync,readdirSync} from 'node:fs';
import handler from '../api/free-games.js';
const root=new URL('../',import.meta.url),files=new Set(readdirSync(root).filter(f=>f.endsWith('.css')||f.endsWith('.html')));
['site-theme.js','free-games.js','free-games-data.js'].forEach(f=>files.add(f));
createServer(async(req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname.slice(1)||'free-games.html';
 if(name==='api/free-games')return handler(req,{setHeader:(...a)=>res.setHeader(...a),status(code){res.statusCode=code;return this;},json(value){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));}});
 if(!files.has(name)){res.writeHead(404).end();return;}
 let body=readFileSync(new URL(name,root),'utf8');
 if(name.endsWith('.html'))body=body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>/src="(?:site-theme|free-games|free-games-data)\.js/.test(tag)?tag:'');
 res.setHeader('Content-Type',name.endsWith('.html')?'text/html;charset=utf-8':name.endsWith('.css')?'text/css':'application/javascript');res.end(body);
}).listen(8770,'127.0.0.1',()=>console.log('Free games live preview http://127.0.0.1:8770'));
