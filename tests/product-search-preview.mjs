import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8');
const source=read('product.html');
const head=source.split('<body')[0].replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<html lang="th">','<html lang="th" data-site-theme="main">');
const search=source.match(/<div class="topbar-search-wrap"[\s\S]*?<div class="language-switcher">/)[0].replace('<div class="language-switcher">','').replace('<i data-lucide="search"></i>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>');
const html=head+'<body class="product-detail-page"><header class="topbar site-topbar-unified"><div class="topbar-actions">'+search+'</div></header></body></html>';
createServer((req,res)=>{const f=new URL(req.url,'http://localhost').pathname.slice(1);if(!f){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(html);}if(!/^[\w-]+\.css$/.test(f))return res.writeHead(404).end();try{res.setHeader('Content-Type','text/css');res.end(read(f));}catch{res.writeHead(404).end();}}).listen(8774,'127.0.0.1');
