// Etapa 4: Share Target. Envia uma foto por POST para captura.html?compartilhado=1, como o Android faz ao compartilhar com "Notas TCS".
// O service worker guarda a foto e redireciona; depois, 8-compartilhar-conferir.js abre a tela e confere que a foto chegou.
(async()=>{try{const reg=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
 if(!navigator.serviceWorker.controller)await new Promise(r=>{navigator.serviceWorker.addEventListener('controllerchange',r,{once:true});setTimeout(r,4000)});
 const c=document.createElement('canvas');c.width=900;c.height=1200;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,900,1200);x.fillStyle='#000';x.font='40px Arial';x.fillText('NOTA RECEBIDA PELO WHATSAPP',40,200);
 const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));const fd=new FormData();fd.append('fotos',new File([blob],'IMG-WA0001.jpg',{type:'image/jpeg'}));fd.append('texto','enviado pelo WhatsApp');
 const resp=await fetch('captura.html?compartilhado=1',{method:'POST',body:fd});
 const n=await capOp('compartilhados','readonly',s=>s.count());
 return {controlado:!!navigator.serviceWorker.controller,status:resp.status,redirecionou:resp.redirected,url:resp.url.replace(location.origin,''),fotosGuardadas:n}}catch(e){return 'ERRO '+e.message}})()
