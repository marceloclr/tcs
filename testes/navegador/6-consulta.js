// Etapa 3: classificação dos links de consulta e leitura do conteúdo colado (adaptadores), em modo local.
(async()=>{try{window.alert=m=>console.log('ALERTA',m);gateOffline=true;gateRender();
for(const s of STORES)await clearStore(s,{local:true});await refresh();draft=[];const r={};
const fazChave=(uf,aamm,cnpj,mod,serie,num)=>{const b=String(uf)+aamm+cnpj+String(mod).padStart(2,'0')+String(serie).padStart(3,'0')+String(num).padStart(9,'0')+'1'+'12345678';return b+chaveDV(b)};
r.origens=Object.fromEntries(['https://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=1|2','http://www.fazenda.sp.gov.br/nfce/qrcode?p=1','https://dfe-portal.svrs.rs.gov.br/NFCE/QRCode?p=1','https://www.nfse.gov.br/consultapublica/?tpc=1&chave=1','https://notacarioca.rio.gov.br/contribuinte/nota.aspx','https://iss.fortaleza.ce.gov.br/grpfor/consultarNfse','https://www.cte.fazenda.gov.br/portal/consulta.aspx','https://portal.leroymerlin.com.br/minhas-notas/123','https://exemplo.xyz/abc'].map(u=>[u,consultaOrigem(u).rotulo]));
const k65=fazChave(23,'2610','12345678000195',65,1,12345);
const svrs=['MATERIAIS DE CONSTRUCAO SOL LTDA','CNPJ: 12.345.678/0001-95 , Inscrição Estadual: 061234567','RUA DAS FLORES, 100, , CENTRO, FORTALEZA, CE','Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica','CIMENTO CP II 50KG','(Código: 7891234567895 )','Qtde.:10','UN: SC','Vl. Unit.:   32,50','Vl. Total','325,00','AREIA MEDIA','(Código: 123 )','Qtde.:2','UN: M3','Vl. Unit.:   90,00','Vl. Total','180,00','Qtd. total de itens:\t2','Valor total R$:\t505,00','Descontos R$:\t0,00','Valor a pagar R$:\t505,00','Forma de pagamento:\tValor pago R$:','Cartão de Crédito\t505,00','Chave de acesso:',k65.match(/.{4}/g).join(' '),'Número: 12345 Série: 1 Emissão: 15/10/2026 14:22:10 - Via Consumidor'].join('\n');
r.adaptadorEscolhido=consultaInterpretar(svrs).adaptador.id;
const a=await consultaParaConferencia(svrs,{origem:'Conteúdo colado',url:'https://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p='+k65+'|2|1|1|X'});
const d=a.inv;r.svrs={acao:a.acao,confianca:a.r.confianca,chave:d.key===k65,numero:d.number,serie:d.series,data:d.date,emitente:d.issuer,cnpj:d.issuerDoc,total:d.total,itens:d.items.map(i=>i.description+' '+i.quantity+i.unit+'x'+i.unitPrice+'='+i.lineTotal)};
const gen=['LOJA X COMERCIO LTDA','CNPJ 11.222.333/0001-81','Data 12/10/2026','TINTA ACRILICA 18L 2 UN 150,00 300,00','ROLO LA 23CM 3 UN 12,50 37,50','SUBTOTAL 337,50','TOTAL R$ 337,50'].join('\n');
const g=consultaInterpretar(gen);r.generico={adaptador:g.adaptador.id,confianca:g.confianca,emitente:g.issuer,cnpj:g.issuerDoc,data:g.date,total:g.total,itens:g.items.map(i=>i.description+' '+i.quantity+'x'+i.unitPrice)};
// foto já na conferência (simulada) com a mesma chave: a consulta completa a nota em vez de criar outra
draft=[{id:k65,key:k65,number:'12345',series:'1',date:'',issuer:'',issuerDoc:'12345678000195',total:0,discount:0,totalProducts:0,items:[],tipo:'material',format:'Foto/OCR',source:'foto.jpg',_foto:{url:'data:image/png;base64,iVBORw0KGgo=',nome:'foto.jpg'},_fontes:{date:{f:'vazio'},issuer:{f:'vazio'},total:{f:'vazio'}},_codigos:{url:'',lidos:1}}];
const m=await consultaParaConferencia(svrs,{origem:'Conteúdo colado',url:'https://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p='+k65});r.mescla={acao:m.acao,naConferencia:draft.length,itens:draft[0].items.length,total:draft[0].total,emitente:draft[0].issuer,selo:draft[0]._fontes.total?.f};
// grava e tenta colar de novo: bloqueia pela chave
go('import');renderPreview();await postDraft();r.gravadas=state.invoices.length;r.consultaGuardada=state.invoices[0]?.consultaUrl||'(sem link)';
const dup=await consultaParaConferencia(svrs,{origem:'Conteúdo colado'});r.duplicada=dup.acao;
// painel na tela
$('#consultaUrl').value='https://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p='+k65;consultaRenderOrigem();r.painelOrigem=$('#consultaOrigem').innerText.slice(0,60);
draft=[];await consultaParaConferencia(gen,{origem:'Conteúdo colado'});$('#consultaPainel').open=true;$('#consultaPainel').scrollIntoView();
return r}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
