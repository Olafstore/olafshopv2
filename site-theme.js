(() => {
  const apply=value=>{const theme=value==='store'?'store':'main';document.documentElement.dataset.siteTheme=theme;const root=document.getElementById('profile-overview-root');if(root)root.dataset.theme=theme;return theme;};
  try{apply(localStorage.getItem('olaf-site-theme'));}catch{apply('main');}
  window.OlafTheme={set(value){const theme=apply(value);try{localStorage.setItem('olaf-site-theme',theme);}catch{}},
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
  document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.shop-point-history').forEach(window.OlafTheme.animateDetails));
})();
