(() => {
  const apply=value=>{const theme=value==='store'?'store':'main';document.documentElement.dataset.siteTheme=theme;const root=document.getElementById('profile-overview-root');if(root)root.dataset.theme=theme;return theme;};
  try{apply(localStorage.getItem('olaf-site-theme'));}catch{apply('main');}
  window.OlafTheme={set(value){const theme=apply(value);try{localStorage.setItem('olaf-site-theme',theme);}catch{}},
    animateDetails(root){
      const summary=root.querySelector('summary');if(!summary||root.dataset.animated)return;root.dataset.animated='true';
      let running=false;
      summary.addEventListener('click',event=>{
        if(!root.animate||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
        event.preventDefault();if(running)return;running=true;
        const closing=root.open,from=root.getBoundingClientRect().height;
        if(!closing)root.open=true;
        const to=closing?summary.getBoundingClientRect().height+parseFloat(getComputedStyle(root).paddingTop)+parseFloat(getComputedStyle(root).paddingBottom)+2:root.getBoundingClientRect().height;
        root.style.overflow='hidden';
        const animation=root.animate([{height:from+'px'},{height:to+'px'}],{duration:240,easing:'ease-in-out'});
        animation.onfinish=()=>{if(closing)root.open=false;root.style.overflow='';running=false;};
      });
    }};
  window.addEventListener('storage',event=>{if(event.key==='olaf-site-theme')apply(event.newValue);});
  document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.shop-point-history').forEach(window.OlafTheme.animateDetails));
})();
