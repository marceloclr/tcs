// Baixa pelo Escritório (porta 8768, depois do 12-baixas-log.js): a baixa fica em nome dele, a atividade sobe para a nuvem, e ele
// não consegue ler o log nem apagar ou alterar uma baixa.
(async()=>{try{window.confirm=()=>true;window.alert=m=>console.log('ALERTA',m);
const espera=(f,ms=20000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},100)});
const r={};
await espera(()=>window.__fb&&db);
if(Nuvem.user?.email!=='esc@x.com'){if(Nuvem.user)await window.__fb.logout();for(const s of STORES)await clearStore(s,{local:true});await window.__fb.loginTeste('esc@x.com')}
await espera(()=>Nuvem.perfil&&Nuvem.estado==='online',30000);
await espera(()=>state.allocations.some(a=>a.projectId==='P1'));
const prod=state.allocations.find(a=>a.projectId==='P1').productId,key='P1|'+prod;
go('stock');openProjects.add('P1');renderStock();aplicarPermissoes();
document.querySelector(`[data-saida="${CSS.escape(key)}"]`).click();
const tr=await espera(()=>document.querySelector('.saida-form'));
tr.querySelector('[data-sf="qtd"]').value='1';tr.querySelector('[data-sf="obs"]').value='entregue à turma A';
tr.querySelector('[data-saida-ok]').click();
const b=await espera(()=>state.movements.find(m=>m.type==='SAIDA'&&m.note==='entregue à turma A'));
await espera(()=>Nuvem.pendentes===0);
r.baixa={criadoPor:b.criadoPor,nome:b.criadoPorNome,recusada:Nuvem.aviso||''};
go('baixas');
r.relatorio=(await espera(()=>document.querySelector(`[data-bx-linha="${b.id}"]`))).innerText.replace(/\s+/g,' ');
r.estornadaDoAdmin=[...document.querySelectorAll('.bx-estornada')].map(t=>t.innerText.replace(/\s+/g,' ').slice(0,120));
await espera(()=>!atvFila().length,20000);
r.filaVazia=true;
const tenta=async(n,f)=>{try{await f();r[n]='PERMITIDO'}catch(e){r[n]='negado'}};
const c=window.__fb.commitDireto;
// a primeira resposta da escuta vem do cache local (vazio); vale a do servidor ou o erro
await tenta('listarLog',()=>new Promise((ok,falha)=>{const u=window.__fb.listen('atividades',[['em','>=','2026-01-01']],(ch,meta)=>{if(!meta.fromCache){u();ok()}},falha);setTimeout(()=>falha(new Error('sem resposta')),8000)}));
await tenta('apagarBaixa',()=>c([{op:'delete',store:'movements',id:b.id}]));
await tenta('alterarBaixa',()=>c([{op:'update',store:'movements',id:b.id,data:{quantity:0.5}}]));
await tenta('baixaEmNomeDeOutro',()=>c([{op:'set',store:'movements',id:'zz-outro',data:{type:'SAIDA',projectId:'P1',clientId:'CA',productId:prod,quantity:1,note:'teste',criadoPor:'marceloclr@gmail.com'}}]));
await tenta('atividadeDeOutro',()=>c([{op:'set',store:'atividades',id:'zz-a',data:{id:'zz-a',em:new Date().toISOString(),emServidor:window.__fb.agora(),por:'marceloclr@gmail.com',cat:'estoque',acao:'baixa',texto:'falsa'}}]));
r.menuLog=!!document.querySelector('[data-adm-aba="atividades"]');
return r}catch(e){return 'ERRO: '+e.message+'\n'+e.stack}})()
