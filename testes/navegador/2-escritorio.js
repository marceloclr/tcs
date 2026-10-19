(async()=>{try{window.confirm=()=>true;
const espera=(f,ms=20000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},100)});
await espera(()=>window.__fb&&db);
await window.__fb.loginTeste(window.EMAIL_TESTE||'esc@x.com');
await espera(()=>Nuvem.perfil&&Nuvem.estado==='online'&&Nuvem.reconciliado);await new Promise(r=>setTimeout(r,2500));
const r={papel:Nuvem.perfil.papel,clientes:state.clients.map(c=>c.name),projetos:state.projects.map(p=>p.name),notas:state.invoices.map(i=>({parcial:!!i._parcial,total:i.total,itens:i.items.filter(x=>!x._oculto).length})),rateios:state.allocations.map(a=>a.projectId),produtos:state.products.length,falhas:[...Nuvem.falhas]};
const t=async(n,f)=>{try{await f();r[n]='PERMITIDO'}catch(e){r[n]=e.code||e.message}};
await t('ler rateio de P3 direto',()=>window.__fb.get('allocations',''+(window.RATEIO_P3||'id-do-rateio-de-P3')+''));
await t('ler nota inteira direto',()=>window.__fb.get('invoices',state.invoices[0].id));
await t('ler cliente B direto',()=>window.__fb.get('clients','CB'));
await t('listar todos os rateios',()=>new Promise((res,rej)=>{const u=window.__fb.listen('allocations',[],(ch,m)=>{if(!m.fromCache){u();res()}},rej)}));
await t('gravar rateio em P3',()=>window.__fb.commit([{op:'set',store:'allocations',id:'zz',data:{projectId:'P3',clientId:'CB',quantity:1}}]));
await t('gravar saída em P1',()=>window.__fb.commit([{op:'set',store:'movements',id:'zz1',data:{type:'SAIDA',projectId:'P1',clientId:'CA',quantity:1}}]));
r.abaUsuarios=!$('[data-view="usuarios"]').hidden;r.avisoEscopo=!$('#avisoEscopo').hidden;r.dica=$('#mCusto').closest('.metric,.card,.panel')?.title||'';
go('dashboard');return r}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
