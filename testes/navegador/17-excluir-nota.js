// Excluir nota (administrador), em index.html?emulador=1 (porta 8767), depois de 1-admin.js, 7-captura.js e 10-fila.js
// (a nota lançada a partir da captura da obra). Bloqueio: com baixa no projeto, a nota de exemplo não se exclui.
// Liberada: a nota da obra some, o estoque volta, a chave fica livre, a captura volta para "A conferir" e o log guarda o motivo.
(async()=>{try{window.confirm=()=>true;const r={};
const espera=(f,ms=30000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},150)});
await espera(()=>window.__fb&&db&&gateAuthVisto);if(Nuvem.user&&Nuvem.user.email!=='marceloclr@gmail.com'){await window.__fb.logout();await espera(()=>!Nuvem.user)}
if(!Nuvem.user)await window.__fb.loginTeste('marceloclr@gmail.com');await espera(()=>Nuvem.perfil?.papel==='admin'&&Nuvem.estado==='online'&&Nuvem.reconciliado);
const obra=await espera(()=>state.invoices.find(i=>i.capturaId));const demo=state.invoices.find(i=>!i.capturaId&&state.allocations.some(a=>a.invoiceId===i.id&&a.projectId==='P1'));
// botão só para administradores, no painel da nota
selectedInvoiceId=obra.id;go('invoices');renderInvoices();r.botao=!!document.querySelector(`[data-excluir-nota="${obra.id}"]`);
// 1) bloqueio: baixa de 1 unidade do produto da nota de exemplo na Obra 1
const al=state.allocations.find(a=>a.invoiceId===demo.id&&a.projectId==='P1');
await txWrite(['movements'],os=>os.movements.add({id:uid(),type:'SAIDA',productId:al.productId,projectId:'P1',clientId:'CA',quantity:1,unitCost:1,date:'2026-10-22',note:'teste de bloqueio',criadoPor:Nuvem.user.email,createdAt:new Date().toISOString()}));await refresh();
r.bloqueio=await invoiceExcluir(demo,'teste').then(()=>'EXCLUIU (errado)',e=>e.message);r.demoContinua=state.invoices.some(i=>i.id===demo.id);
// 2) liberada: a nota que veio da obra
const prods=new Map();state.movements.filter(m=>m.type==='ENTRADA'&&m.invoiceId===obra.id).forEach(m=>prods.set(m.productId,(prods.get(m.productId)||0)+Number(m.quantity)));
const antes=[...prods].map(([pid,q])=>({pid,q,stock:Number(state.products.find(p=>p.id===pid)?.stock||0)}));
const ok=await invoiceExcluir(obra,'nota lançada em duplicidade (teste)');await espera(()=>Nuvem.pendentes===0);
r.excluida={captura:ok.captura,notaSumiu:!state.invoices.some(i=>i.id===obra.id),rateios:state.allocations.filter(a=>a.invoiceId===obra.id).length,projecoes:state.notas_projeto.filter(p=>p.invoiceId===obra.id).length,entradas:state.movements.filter(m=>m.invoiceId===obra.id).length,chaveLivre:!state.chaves.some(c=>c.id===obra.key),
 estoque:antes.map(a=>{const mv=state.movements.filter(m=>m.productId===a.pid).reduce((s,m)=>s+(m.type==="ENTRADA"?1:-1)*Number(m.quantity),0);return `${state.products.find(p=>p.id===a.pid)?.name}: ${a.stock} → ${state.products.find(p=>p.id===a.pid)?.stock} (entrada ${a.q}; saldo pelos movimentos ${mv})`})};
await espera(()=>Fila.itens.get(obra.capturaId)?.status==='pendente');const c=Fila.itens.get(obra.capturaId);r.captura={status:c.status,notaId:c.notaId,motivo:c.voltouMotivo};
// nuvem: a nota e a chave sumiram do emulador
const g=async p=>(await fetch(`http://127.0.0.1:8089/v1/projects/demo-tcs/databases/(default)/documents/${p}`,{headers:{Authorization:'Bearer owner'}})).status;
r.nuvem={nota:await g('invoices/'+obra.id),chave:await g('chaves/'+obra.key)};
await new Promise(res=>setTimeout(res,2500));await espera(()=>Adm.ligado);const log=await window.__fb.getAll?null:null;
r.log=(await new Promise(res=>{const u=window.__fb.listen('atividades',[['acao','==','nota_excluida']],ch=>{u();res(ch.map(x=>x.data.texto))})}));
return r}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
