(async()=>{try{window.confirm=()=>true;window.alert=m=>console.log('ALERTA',m);
const espera=(f,ms=20000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},100)});
await espera(()=>window.__fb&&db);
for(const s of STORES)await clearStore(s,{local:true});
// sem implantação automática: o administrador é criado direto no emulador, com o acesso de dono (Bearer owner)
const rest=(c,id,campos)=>fetch(`http://127.0.0.1:8089/v1/projects/demo-tcs/databases/(default)/documents/${c}/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Authorization':'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:campos})});
await rest('usuarios','marceloclr@gmail.com',{email:{stringValue:'marceloclr@gmail.com'},nome:{stringValue:'Marcelo'},papel:{stringValue:'admin'},ativo:{booleanValue:true},acessos:{mapValue:{fields:{}}}});
await rest('config','admins',{lista:{arrayValue:{values:[{stringValue:'marceloclr@gmail.com'}]}}});
await window.__fb.loginTeste('marceloclr@gmail.com');
await espera(()=>Nuvem.perfil&&Nuvem.estado==='online');
await txWrite(['clients','projects'],os=>{os.clients.put({id:'CA',name:'Cliente A'});os.clients.put({id:'CB',name:'Cliente B'});
 os.projects.put({id:'P1',clientId:'CA',name:'Obra 1',status:'ativo'});os.projects.put({id:'P2',clientId:'CA',name:'Obra 2',status:'ativo'});os.projects.put({id:'P3',clientId:'CB',name:'Obra 3',status:'ativo'})});
await refresh();
const ex=escopoNormalizar(structuredClone({products:DEMO.products,invoices:DEMO.invoices,movements:DEMO.movements}));await txWrite(['products','invoices','movements','chaves'],os=>{for(const k of ['products','invoices','movements','chaves'])for(const item of ex[k])os[k].add(item)});await refresh();await espera(()=>Nuvem.pendentes===0);if(Nuvem.aviso)throw new Error('exemplo recusado: '+Nuvem.aviso);
await escopoRecalcular();await espera(()=>Nuvem.pendentes===0);if(Nuvem.aviso)throw new Error('preparo recusado');const inv=state.invoices[0];await saveInvoiceAllocations(inv,[makeAlloc(inv,0,'P1',1),makeAlloc(inv,1,'P3',1)]);
await espera(()=>Adm.ligado);
const users=[['esc@x.com','Escritório Um','escritorio',{'p:P1':{n:'E'}}],['lei@x.com','Leitor B','escritorio',{'c:CB':{n:'L'}}],['mestre@x.com','Mestre','obra',{'p:P1':{n:'L'}}]];
for(const [email,nome,papel,acessos] of users){Adm.edit={existe:false,email,nome,papel,ativo:true,acessos,antes:null};await admGravar();if(Adm.edit)throw new Error('não gravou '+email+': '+($('[data-adm-msg]')?.textContent||''))}
await espera(()=>Adm.usuarios.length>=4&&Adm.auditoria.length>=3);
await espera(()=>Nuvem.pendentes===0);
await new Promise(r=>setTimeout(r,1500));
return {estado:Nuvem.estado,papel:Nuvem.perfil.papel,admins:Adm.admins,usuarios:Adm.usuarios.map(u=>u.id+' '+u.papel+' pl='+u.pl+' cl='+u.cl+' clv='+u.clv+' esc='+u.esc),auditoria:Adm.auditoria.length,contagem:Object.fromEntries(STORES.map(s=>[s,state[s].length])),nota:{escopo:state.invoices[0].escopo,projetos:state.invoices[0].projetos},aviso:Nuvem.aviso,falhas:[...Nuvem.falhas]}}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
