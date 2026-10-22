// ==== #JS-MANUAL: START ====
// Manuais do TCS: versão no canto, tema claro/escuro guardado neste navegador, índice com a seção atual marcada
// e, no celular, o índice em gaveta (botão "Índice"), que fecha ao escolher uma seção.
(function(){const h=document.documentElement;
 const v=document.getElementById('versao');if(v)v.textContent=(document.title.match(/V-\d{8}-\d{4}/)||[''])[0];
 try{const t=localStorage.getItem('tcs-manual-tema');if(t)h.dataset.tema=t}catch(e){}
 document.getElementById('tema')?.addEventListener('click',()=>{const escuro=h.dataset.tema?h.dataset.tema==='escuro':matchMedia('(prefers-color-scheme: dark)').matches;h.dataset.tema=escuro?'claro':'escuro';try{localStorage.setItem('tcs-manual-tema',h.dataset.tema)}catch(e){}});
 // gaveta do índice
 const fechar=()=>{document.body.classList.remove('indice-aberto');document.querySelector('.abre-indice')?.setAttribute('aria-expanded','false')};
 document.querySelector('.abre-indice')?.addEventListener('click',e=>{const aberto=document.body.classList.toggle('indice-aberto');e.currentTarget.setAttribute('aria-expanded',String(aberto));if(aberto)document.querySelector('.menu a')?.focus()});
 document.querySelector('.veu')?.addEventListener('click',fechar);
 document.querySelectorAll('.menu a').forEach(a=>a.addEventListener('click',fechar));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')fechar()});
 // seção atual no índice
 const links=new Map([...document.querySelectorAll('.menu a[href^="#"]')].map(a=>[a.getAttribute('href').slice(1),a]));
 const secoes=[...links.keys()].map(id=>document.getElementById(id)).filter(Boolean);
 const marcar=()=>{const y=innerHeight*.3;let atual=secoes[0];for(const s of secoes)if(s.getBoundingClientRect().top<=y)atual=s;links.forEach((a,id)=>a.setAttribute('aria-current',String(id===atual?.id)))};
 addEventListener('scroll',marcar,{passive:true});addEventListener('resize',marcar);marcar()})();
// ==== #JS-MANUAL: END ====
