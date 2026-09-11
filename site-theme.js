(() => {
  const themes=[{id:'store',name:'ดำ–น้ำเงินเข้ม',label:'MIDNIGHT',description:'ดำสนิท ไล่แสงน้ำเงินนุ่ม ๆ'},{id:'main',name:'น้ำเงินดั้งเดิม',label:'CLASSIC BLUE',description:'โทนน้ำเงินเข้มเอกลักษณ์ OLAF'},{id:'light',name:'สีขาว',label:'DAYLIGHT',description:'ขาวสะอาด สบายตา อ่านง่าย'}];
  const normalize=value=>themes.some(item=>item.id===value)?value:'main';
  const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7c-.9-.5-.5-2 .5-2H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="11" cy="6.8" r=".8"/><circle cx="16" cy="8" r=".8"/></svg>';
  let dialog=null,opener=null;
  const sync=()=>{const theme=document.documentElement.dataset.siteTheme;document.querySelectorAll('[data-site-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.siteThemeChoice===theme)));document.querySelectorAll('[data-site-theme-name]').forEach(label=>label.textContent=themes.find(item=>item.id===theme)?.name||'น้ำเงินดั้งเดิม');};
  const apply=value=>{const theme=normalize(value);document.documentElement.dataset.siteTheme=theme;document.documentElement.style.colorScheme=theme==='light'?'light':'dark';const root=document.getElementById('profile-overview-root');if(root)root.dataset.theme=theme;sync();window.dispatchEvent(new CustomEvent('olaf-theme-changed',{detail:{theme}}));return theme;};
  try{apply(localStorage.getItem('olaf-site-theme'));}catch{apply('main');}
  window.OlafTheme={set(value){const theme=apply(value);try{localStorage.setItem('olaf-site-theme',theme);return true;}catch{return false;}},
    controlMarkup:()=>'<button type="button" class="site-theme-trigger" data-site-theme-open aria-haspopup="dialog" aria-label="เปลี่ยนธีมเว็บไซต์">'+icon+'<span class="site-theme-trigger-copy"><small>ธีมเว็บไซต์</small><strong data-site-theme-name></strong></span><span class="site-theme-mini-swatches" aria-hidden="true"><i></i><i></i><i></i></span></button>',
    open(source){
      opener=source||document.activeElement;
      if(!dialog){dialog=document.createElement('dialog');dialog.className='site-theme-dialog';dialog.setAttribute('aria-labelledby','site-theme-title');
        dialog.innerHTML='<header><div><span class="site-theme-eyebrow">MAKE IT YOURS</span><h2 id="site-theme-title">เลือกบรรยากาศที่เป็นคุณ</h2><p>เปลี่ยนสีทั่วเว็บได้ทันที</p></div><button type="button" data-theme-close aria-label="ปิดตัวเลือกธีม">×</button></header><div class="site-theme-choices">'+themes.map(item=>'<button type="button" class="site-theme-choice" data-site-theme-choice="'+item.id+'" aria-pressed="false"><span class="site-theme-preview" data-palette="'+item.id+'" aria-hidden="true"><i class="theme-preview-nav"></i><i class="theme-preview-hero"></i><i class="theme-preview-tile"></i><i class="theme-preview-tile"></i><i class="theme-preview-tile"></i><b>✓</b></span><small>'+item.label+'</small><strong>'+item.name+'</strong><span class="site-theme-choice-description">'+item.description+'</span></button>').join('')+'</div><p class="site-theme-save-note" role="status">จดจำธีมในเบราว์เซอร์นี้ ไม่เปลี่ยนโปรไฟล์ของผู้อื่น</p>';
        document.body.append(dialog);dialog.querySelector('[data-theme-close]').onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
        dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus();});
        dialog.querySelectorAll('[data-site-theme-choice]').forEach(button=>button.onclick=()=>{const saved=window.OlafTheme.set(button.dataset.siteThemeChoice);dialog.querySelector('[role=status]').textContent=saved?'บันทึกธีม '+themes.find(item=>item.id===button.dataset.siteThemeChoice).name+' แล้ว':'เปลี่ยนธีมแล้ว แต่เบราว์เซอร์ไม่อนุญาตให้บันทึก';});
      }
      sync();if(!dialog.open)dialog.showModal();
    },
    animateDetails(root){
      const summary=root.querySelector('summary');if(!summary||root.dataset.animated)return;root.dataset.animated='true';
      let animation=null,targetOpen=root.open;
      summary.addEventListener('click',event=>{
        if(!root.animate||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
        event.preventDefault();
        const from=root.getBoundingClientRect().height;
        animation?.cancel();targetOpen=!targetOpen;
        root.open=true;
        const style=getComputedStyle(root);
        const to=targetOpen?root.getBoundingClientRect().height:summary.getBoundingClientRect().height+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
        root.style.overflow='hidden';
        animation=root.animate([{height:from+'px'},{height:to+'px'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});
        animation.onfinish=()=>{root.open=targetOpen;root.style.overflow='';animation=null;};
      });
    }};
  window.addEventListener('storage',event=>{if(event.key==='olaf-site-theme')apply(event.newValue);});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-site-theme-open]');if(button)window.OlafTheme.open(button);});
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.shop-point-history').forEach(window.OlafTheme.animateDetails);
    // Theme selection lives in profile personalization; every page still restores it.
    document.querySelectorAll('.site-theme-switcher').forEach(node=>node.remove());
    sync();
  });
  window.addEventListener('olaf-profile-ready',sync);
})();
