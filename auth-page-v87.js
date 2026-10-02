/* Standalone auth branding without initializing store navigation. */
document.addEventListener('DOMContentLoaded',async()=>{
  try {
    const settings=await window.OlafStoreSettings?.fetchStoreSettings?.();
    if(!settings?.siteIconUrl)return;
    const url=new URL(settings.siteIconUrl,location.href);
    if(!['http:','https:'].includes(url.protocol))return;
    document.querySelectorAll('.auth-brand-mark').forEach(mark=>{
      const image=document.createElement('img');image.src=url.href;image.alt='';image.width=56;image.height=56;
      image.addEventListener('load',()=>mark.replaceChildren(image),{once:true});
    });
  } catch { /* The existing brand mark remains usable if settings cannot load. */ }
});
