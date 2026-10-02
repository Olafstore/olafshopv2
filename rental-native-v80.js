(() => {
  let ready;
  async function mount(){
    const response=await fetch('checkout-template-v81.html?v=20261002-native-v83',{cache:'no-cache',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw {code:'PAYMENT_UI_UNAVAILABLE'};
    const source=new DOMParser().parseFromString(await response.text(),'text/html');
    if(!document.getElementById('toast-container')){const toast=document.createElement('div');toast.id='toast-container';toast.className='toast-container';toast.setAttribute('aria-live','polite');document.body.append(toast);}
    const ids=['order-dialog','order-confirm-dialog','qr-dialog','cancel-confirm-dialog'];
    if(ids.some(id=>!source.getElementById(id)))throw {code:'PAYMENT_UI_UNAVAILABLE'};
    for(const id of ids){
      const template=source.getElementById(id);
      document.getElementById(id)?.remove();document.body.append(document.importNode(template,true));
    }
    if(!window.OlafNativeRentalCheckout)await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='product.js?v=20261002-native-v83';script.onload=resolve;script.onerror=()=>reject({code:'PAYMENT_UI_UNAVAILABLE'});document.head.append(script);
    });
    window.OlafNativeRentalCheckout.bind();
    document.querySelectorAll('#order-confirm-dialog input[type=checkbox]').forEach(n=>n.setAttribute('role','switch'));
    window.lucide?.createIcons();
  }
  async function ensure(){if(!ready)ready=mount().catch(e=>{ready=null;throw e;});await ready;}
  window.OlafRentalNative={
    async open(product,quote,create){await ensure();await window.OlafNativeRentalCheckout.open(product,quote,create);},
    async payment(order,product){await ensure();await window.OlafNativeRentalCheckout.payment(order,product);},
    reset(){window.OlafNativeRentalCheckout?.reset();}
  };
})();
