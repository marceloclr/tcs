(async()=>{const espera=(f,ms=20000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo'))}},100)});
await espera(()=>window.__fb&&db&&gateAuthVisto);await window.__fb.logout();await espera(()=>!Nuvem.user);
await window.__fb.loginTeste('esc@x.com');await espera(()=>Nuvem.perfil&&Nuvem.estado==='online'&&Nuvem.reconciliado);await new Promise(x=>setTimeout(x,2000));
return {antes:{notas:state.invoices.length,rateios:state.allocations.length,clientes:state.clients.length}}})()
