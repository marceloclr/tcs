# Plano — notas de serviço por cliente e projeto

Pedido de 16/10/2026: incluir notas específicas para a contratação de serviços dos projetos e levar essa informação para a visão geral, diferenciando materiais e serviços por cliente e projeto. O slogan passa a ser **"Contabilidade gerencial de custos por clientes e projetos"**.

## Decisões do usuário
- **Custo:** as mesmas regras das notas de materiais. O valor pago fecha com o total da nota: valor líquido de desconto, mais o rateio de despesas.
- **Tipo da nota:** ao subir uma nota, o sistema pergunta se ela é de **serviço** ou de **material**.
- **Upload:** uma segunda caixa, para notas de serviço, ao lado da que já existe, em Estoque › Importar notas.
- **Entrada:** formulário manual, XML de NFS-e e PDF.

## Modelo
- **Tipo:** a nota de serviço é uma nota (`invoices`) com `tipo: 'servico'`. As notas atuais valem como `tipo: 'material'`.
- **Mesmo fluxo dos materiais:** ela usa as mesmas alocações (`allocations`), situações (a vincular, em distribuição e vinculada), barra de distribuição e sincronização com a nuvem. Não há coleção nova nem mudança nas regras do Firestore.
- **Sem estoque:** a nota de serviço não cria produto, não gera ENTRADA e não entra na grid do estoque.
- **Item da NFS-e:** é um item com quantidade 1 (unidade "SV"), cujo valor é o valor dos serviços, com o desconto incondicionado como desconto. O total da nota é o valor dos serviços menos esse desconto. As retenções (ISS, IR, INSS, PIS, COFINS e CSLL) e o valor líquido ficam registrados como informação.
- **Distribuição por valor:** a nota coletiva de serviço é repartida em **R$** por projeto (internamente, como fração da quantidade 1). A soma nunca passa do total.
- **Identificação:**
  - padrão nacional: chave de 50 dígitos;
  - ABRASF e manual: `NFSE:<CNPJ do prestador>:<número>`.
  Notas duplicadas são recusadas.

## Passos (um commit cada)
1. **S1 — Importar notas, materiais e serviços:**
   - duas caixas de upload, com o tipo escolhido na prévia de cada nota;
   - XML de NFS-e no padrão nacional e no ABRASF (v1 e v2);
   - a confirmação grava a nota de serviço sem estoque.
2. **S2 — Nota de serviço manual e por PDF:**
   - formulário (prestador, número, data, descrição, valor, desconto e retenções);
   - o PDF (texto ou OCR) preenche o formulário para conferência.
3. **S3 — Notas fiscais:** tipo de cada nota, filtro Materiais/Serviços, e distribuição de serviços em R$ (matriz e vínculo simples).
4. **S4 — Visão geral, Clientes e Projetos:** custo total, materiais e serviços por cliente e projeto, gráficos e resumo. Também entra o slogan novo.
5. **S5 — LEIA-ME e teste completo.**

Pedido acrescentado durante o S4: linha do tempo na visão geral, com as entradas e as saídas em valor (gráfico de linhas). Entrou no S4.
