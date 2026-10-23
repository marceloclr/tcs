// Desconto do item no PDF (DANFE): só com a coluna V.DESC no cabeçalho, em reais e menor que o item. Sem emuladores: index.html em 8767.
// Esperado: {comColuna:50, maiorQueOItem:0, semColuna:0}. Caso real: DANFE da Omie sem V.DESC, em que o número seguinte é a BC do ICMS.
(async()=>{try{const base=['RECEBEMOS DE LOJA TESTE OS PRODUTOS','IDENTIFICAÇÃO DO EMITENTE','LOJA TESTE LTDA','Nº 1.234','SÉRIE 1','DATA DA EMISSÃO','EMISSÃO: 01/10/2026','3526 1046 5138 1800 0109 5500 5000 0125 1513 7672 3054','VALOR TOTAL DOS PRODUTOS','0,00 0,00 0,00 0,00 1.000,00','VALOR TOTAL DA NOTA','950,00','DADOS DOS PRODUTOS / SERVIÇOS'];
const f=new File(['x'],'t.pdf');
const com=await parsePDF(f,[...base,'CÓDIGO DESCRIÇÃO NCM CST CFOP UN QUANT V.UNIT V.TOTAL V.DESC BC ICMS V.ICMS','AB1 Cimento 25232910 000 5102 SC 10 100,00 1.000,00 50,00 950,00 0,00']);
const absurdo=await parsePDF(f,[...base,'CÓDIGO DESCRIÇÃO NCM CST CFOP UN QUANT V.UNIT V.TOTAL V.DESC BC ICMS V.ICMS','AB1 Cimento 25232910 000 5102 SC 10 100,00 1.000,00 5.000,00 950,00 0,00']);
const sem=await parsePDF(f,[...base,'CÓDIGO DESCRIÇÃO NCM CST CFOP UN QUANT VALOR UNIT VALOR TOTAL B.CÁLC ICMS','AB1 Cimento 25232910 000 5102 SC 10 100,00 1.000,00 950,00 0,00']);
return {comColuna:com.items[0].discount,maiorQueOItem:absurdo.items[0].discount,semColuna:sem.items[0].discount}}catch(e){return "FALHOU "+e.message}})()
