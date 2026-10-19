// Etapa 5: fila "Notas recebidas da obra" no escritório. Pede 1-admin.js e 7-captura.js antes (capturas da Obra 1).
// Conta do Escritório com escrita na Obra 1: cartão, atraso de 48 h, conferir com o projeto indicado, lançar, fotos como
// comprovante, descartar com motivo e, por fim, o XML da mesma chave substituindo os dados lidos da foto.
(async()=>{try{window.confirm=()=>true;window.alert=m=>console.log('ALERTA',m);window.prompt=()=>'Foto repetida';const r={};
const espera=(f,ms=30000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},150)});
await espera(()=>window.__fb&&db&&gateAuthVisto);if(Nuvem.user&&Nuvem.user.email!=='esc@x.com'){await window.__fb.logout();await espera(()=>!Nuvem.user)}
if(!Nuvem.user)await window.__fb.loginTeste('esc@x.com');await espera(()=>Nuvem.perfil?.email==='esc@x.com'&&Nuvem.estado==='online'&&Nuvem.reconciliado);
await espera(()=>Fila.itens.size>=2);
// envelhece uma captura (sem chave) para 3 dias atrás, direto no emulador
const semChave=[...Fila.itens.values()].find(c=>!c.chave),comChave=[...Fila.itens.values()].find(c=>c.chave);
await fetch(`http://127.0.0.1:8089/v1/projects/demo-tcs/databases/(default)/documents/capturas/${semChave.id}?updateMask.fieldPaths=enviadoEm`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{enviadoEm:{stringValue:new Date(Date.now()-72*36e5).toISOString()}}})});
await espera(()=>filaContagem().atrasadas>=1);go('dashboard');r.cartao=$('#cardObra').innerText.replace(/\s+/g,' ');r.submenu=[...document.querySelectorAll('[data-view-sub="recebidas"]')].map(b=>b.innerText.replace(/\s+/g,' '))[0];
go('recebidas');r.fila=[...document.querySelectorAll('#filaBody tbody tr')].map(tr=>tr.className+' | '+[...tr.cells].slice(1,7).map(c=>c.innerText.replace(/\s+/g,' ')).join(' | '));
// conferir a captura com chave
await filaConferir(comChave.id);await espera(()=>draft.some(d=>d._captura===comChave.id),90000);const d=draft.find(x=>x._captura===comChave.id);
r.conferencia={projetoIndicado:d._projeto==='P1',seletor:!!document.querySelector('[data-fila-projeto]'),chaveExata:d._fontes.key?.f==='chave',numero:d.number,avisoObra:d._avisos.find(a=>/obra informou/.test(a))||'',statusNaFila:Fila.itens.get(comChave.id)?.status};
// completa o que a foto sintética não tem e confirma
d.date='2026-10-19';d.total=325;d.items=[{code:'CIM50',barcode:'',description:'CIMENTO CP II 50KG',unit:'SC',quantity:10,unitPrice:32.5,lineTotal:325,discount:0}];d.totalProducts=325;renderPreview();
await postDraft();await espera(()=>Fila.itens.get(comChave.id)?.status==='lancada');const inv=state.invoices.find(i=>i.key===d.key);
r.lancada={status:Fila.itens.get(comChave.id).status,notaLigada:Fila.itens.get(comChave.id).notaId===inv.id,situacaoNota:invoiceStatus(inv),projetos:inv.projetos,capturaNaNota:inv.capturaId===comChave.id};
// fotos como comprovante, a partir da nota
selectedInvoiceId=inv.id;invoiceTab='todas';go('invoices');renderInvoices();$('[data-nota-fotos]').click();await espera(()=>$('#notaFotosObra img'));r.comprovante=$('#notaFotosObra img').naturalWidth>0||'carregando';
// descartar a outra
$(`[data-fila-descartar="${semChave.id}"]`)?.click()||(go('recebidas'),document.querySelector(`[data-fila-descartar="${semChave.id}"]`).click());await espera(()=>Fila.itens.get(semChave.id)?.status==='descartada');r.descartada={status:Fila.itens.get(semChave.id).status,motivo:Fila.itens.get(semChave.id).motivo};
// XML da mesma chave chega depois
const xml=`<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${inv.key}"><ide><natOp>VENDA</natOp><serie>1</serie><nNF>12399</nNF><dhEmi>2026-10-19T10:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000195</CNPJ><xNome>MATERIAIS DE CONSTRUCAO SOL LTDA</xNome></emit><dest><xNome>CLIENTE</xNome></dest><det nItem="1"><prod><cProd>CIM50</cProd><cEAN>7891234567895</cEAN><xProd>CIMENTO CP II 50KG VOTORAN</xProd><NCM>25232910</NCM><CFOP>5102</CFOP><uCom>SC</uCom><qCom>10</qCom><vUnCom>32.50</vUnCom><vProd>325.00</vProd></prod></det><det nItem="2"><prod><cProd>ARG20</cProd><cEAN>SEM GTIN</cEAN><xProd>ARGAMASSA AC1 20KG</xProd><NCM>32149000</NCM><CFOP>5102</CFOP><uCom>SC</uCom><qCom>2</qCom><vUnCom>15.00</vUnCom><vProd>30.00</vProd></prod></det><total><ICMSTot><vProd>355.00</vProd><vDesc>0.00</vDesc><vNF>355.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;
go('import');await loadFiles([new File([xml],'nota.xml',{type:'text/xml'})],'material');r.xmlOferta=!!$('[data-xml-substituir]');$('[data-xml-substituir]').click();await espera(()=>/substituídos/.test($('#importMessage').innerText));
const novo=state.invoices.find(i=>i.key===inv.key);r.xml={formato:novo.format,anterior:novo.formatoAnterior,itens:novo.items.map(i=>i.description),total:novo.total,situacao:invoiceStatus(novo),projetos:novo.projetos,capturaMantida:novo.capturaId===comChave.id,entradas:state.movements.filter(m=>m.type==='ENTRADA'&&m.invoiceId===novo.id).length,mensagem:$('#importMessage').innerText.slice(0,120)};
go('recebidas');Fila.aba='abertas';filaRender();return r}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
