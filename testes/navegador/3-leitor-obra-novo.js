(async()=>{try{window.confirm=()=>true;const r={};
const espera=(f,ms=20000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},100)});
await espera(()=>window.__fb&&db&&gateAuthVisto);
r.antes={usuario:Nuvem.user?.email,notas:state.invoices.length};
await window.__fb.logout();await espera(()=>!Nuvem.user);
await window.__fb.loginTeste('lei@x.com');await espera(()=>Nuvem.perfil?.email==='lei@x.com'&&Nuvem.estado==='online'&&Nuvem.reconciliado);await new Promise(x=>setTimeout(x,2500));
r.leitor={clientes:state.clients.map(c=>c.name),projetos:state.projects.map(p=>p.name),notas:state.invoices.map(i=>(i._parcial?'parcial ':'inteira ')+i.total),saidasDeOutros:state.movements.filter(m=>m.projectId==='P1').length,importarVisivel:!$('[data-go="import"]')?.hidden};
try{await window.__fb.commit([{op:'set',store:'movements',id:'zz9',data:{type:'SAIDA',projectId:'P3',clientId:'CB',quantity:1}}]);r.leitorGrava='PERMITIDO'}catch(e){r.leitorGrava=e.code}
await window.__fb.logout();await espera(()=>!Nuvem.user);
await window.__fb.loginTeste('mestre@x.com');await espera(()=>Nuvem.estado==='obra');await new Promise(x=>setTimeout(x,1500));
r.obra={gate:!$('#loginGate').hidden,texto:$('#gateBody').innerText.slice(0,80),notasLocais:state.invoices.length,produtosLocais:state.products.length};
try{await window.__fb.get('products',state.products[0]?.id||'x');r.obraLeProduto='PERMITIDO'}catch(e){r.obraLeProduto=e.code}
await window.__fb.logout();await espera(()=>!Nuvem.user);
await window.__fb.loginTeste('novo@x.com');await espera(()=>Nuvem.estado==='aguardando');await new Promise(x=>setTimeout(x,1500));
r.novo={texto:$('#gateBody').innerText.slice(0,60),notasLocais:state.invoices.length};
return r}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
