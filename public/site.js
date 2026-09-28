(() => {
 const menu=document.querySelector('#menu-toggle');
 menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));document.querySelector('#main-nav').classList.toggle('open',open);});
 let saved=[];try{saved=JSON.parse(localStorage.getItem('crochet-saved')||'[]');if(!Array.isArray(saved))saved=[];}catch{}
 let timer;const toast=message=>{const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),2300);};
 function refresh(){
  document.querySelectorAll('[data-save]').forEach(b=>b.setAttribute('aria-pressed',String(saved.includes(b.dataset.save))));
  const count=document.querySelector('#saved-count');if(count)count.textContent=saved.length||'';
  const grid=document.querySelector('#saved-grid');if(grid){let count=0;grid.querySelectorAll('.product-card').forEach(card=>{const show=saved.includes(card.querySelector('[data-save]').dataset.save);card.hidden=!show;if(show)count++;});document.querySelector('#saved-empty').hidden=!!count;}
 }
 document.querySelectorAll('[data-save]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.save;const exists=saved.includes(id);saved=exists?saved.filter(i=>i!==id):[...saved,id];try{localStorage.setItem('crochet-saved',JSON.stringify(saved));}catch{}refresh();toast(exists?'Removed from your saved patterns':'Saved for a little inspiration later');}));
 refresh();
})();
