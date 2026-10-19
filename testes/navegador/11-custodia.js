// Estoque sob custódia × custo apropriado na Visão geral, em modo local: nota distribuída, baixa parcial, projeto encerrado com saldo
// e nota aguardando vínculo. Confere que estoque + custo apropriado = total adquirido.
(async()=>{try{window.alert=m=>console.log('ALERTA',m);gateOffline=true;gateRender();for(const s of STORES)await clearStore(s,{local:true});await refresh();
await txWrite(['clients','projects'],os=>{os.clients.put({id:'CA',name:'Construtora Alfa'});os.clients.put({id:'CB',name:'Residencial Beta'});os.projects.put({id:'P1',clientId:'CA',name:'Edifício Sol',status:'ativo'});os.projects.put({id:'P2',clientId:'CB',name:'Casa Lago',status:'encerrado'})});await refresh();
const ex=escopoNormalizar(structuredClone({products:DEMO.products,invoices:DEMO.invoices,movements:DEMO.movements}));await txWrite(['products','invoices','movements','chaves'],os=>{for(const k of ['products','invoices','movements','chaves'])for(const item of ex[k])os[k].add(item)});await refresh();
const inv=state.invoices[0];await saveInvoiceAllocations(inv,[makeAlloc(inv,0,'P1',1),makeAlloc(inv,1,'P2',1)]);
// baixa do item do Edifício Sol: vira custo apropriado
const prod=state.invoices[0].items[0].productId;const linha=stockTree().clientes.flatMap(c=>c.projetos).find(x=>x.p.id==='P1').itens[0];
await txWrite(['movements'],os=>os.movements.add({id:uid(),type:'SAIDA',productId:prod,projectId:'P1',clientId:'CA',quantity:1,unitCost:linha.custo,date:new Date().toISOString().slice(0,10),note:'',description:'',createdAt:new Date().toISOString()}));await refresh();
const {total,pend}=stockTree();go('dashboard');window.scrollTo(0,0);
return {estoque:total.estoque,baixados:materiaisBaixados(total),servicos:total.serv,apropriado:custoApropriado(total),adquirido:totalAdquirido(total),fecha:Math.abs(total.estoque+custoApropriado(total)-totalAdquirido(total))<0.01,aguardando:pend.pago,
 cartoes:['#mStock','#mCusto','#mMat','#mServ'].map(s=>$(s).closest('.metric').querySelector('label').innerText+': '+$(s).innerText+' — '+$(s).nextElementSibling.innerText),
 vivo:[...document.querySelectorAll('.vivo')].map(v=>v.querySelector('.vivo-t').innerText+': '+v.querySelector('.vivo-v').innerText),dica:$('#mStock').closest('.metric').title.split('\n')[0]}}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
