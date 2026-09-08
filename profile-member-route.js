(() => {
  const parse=()=>{const hash=location.hash;let username='';try{if(hash.startsWith('#user/'))username=decodeURIComponent(hash.slice(6)).trim();}catch{}return {visiting:hash.startsWith('#user/'),username};};
  const route=parse();window.OlafProfileRoute=route;
  if(route.visiting)document.documentElement.dataset.profileVisitor='true';
  // Rebuild the page when crossing accounts: never reuse private owner handlers/data.
  window.addEventListener('hashchange',event=>{
    const next=parse();if(next.visiting!==route.visiting||next.username!==route.username){
      document.documentElement.dataset.profileVisitor='true';
      const root=document.getElementById('profile-overview-root');if(root)root.textContent='กำลังเปลี่ยนโปรไฟล์…';
      event.stopImmediatePropagation();location.reload();
    }
  },true);
})();
