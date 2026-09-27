(()=>{
 const cdn='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/';
 const categories=[
  {id:'windows',name:'Windows',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/windows11/windows11-original.svg'},
  {id:'office',name:'Microsoft Office',image:'https://img.icons8.com/color/144/microsoft-office-2019.png'},
  {id:'adobe',name:'Adobe',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/photoshop/photoshop-original.svg'},
  {id:'capcut',name:'CapCut',image:cdn+'camera-reels-fill.svg'},
  {id:'antivirus',name:'Antivirus',image:cdn+'shield-check.svg'},
  {id:'other',name:'อื่น ๆ',image:cdn+'grid-fill.svg'}
 ];
 const safeImage=value=>{const s=String(value||'').trim();return /^(https?:\/\/|data:image\/(?:png|jpeg|webp);base64,|assets\/|\/[^/])/i.test(s)?s:''};
 const classify=p=>{const text=[p.name,p.publisher,p.category,...(p.tags||[])].join(' ').toLowerCase();if(/office|microsoft 365/.test(text))return 'office';if(/adobe|photoshop|illustrator|premiere/.test(text))return 'adobe';if(/capcut/.test(text))return 'capcut';if(/antivirus|kaspersky|eset|norton|mcafee|bitdefender/.test(text))return 'antivirus';if(/windows/.test(text))return 'windows';return 'other'};
 window.OlafSoftwareStore={categories,safeImage,classify,icon:name=>cdn+name+'.svg'};
})();
