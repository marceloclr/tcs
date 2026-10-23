# Pedido de material pela obra: tabela do estoque e destino

Pedido (23/10/2026): "na tela do mestre, ao escolher pedir material, o sistema deve mostrar os materiais do estoque em uma tabela com campo para indicar a quantidade; os materiais que tiverem quantidade diferente de zero formarão o pedido, com coluna para informar o destino do material (laje, hidráulico, elétrico...)".

## Ponto de partida

O "Pedir material" já existe (commit 4a7799f, 22/10): busca na tabela de materiais, carrinho com − e +, requisição em `requisicoes`, atendida pelo escritório em Estoque › Requisições da obra (Estoque → Requisitado → Consumido). Este plano muda a tela de pedido e acrescenta o destino, sem trocar o fluxo.

## Decisões (aprovadas em 23/10)

- **Materiais mostrados:** o estoque disponível da obra escolhida, por material (saldo menos o que já está requisitado). O mestre não vê valores nem outras obras.
- **Atendimento:** continua como está: o escritório confere e atende, e a requisição passa a mostrar o destino de cada item. Quando o mestre confirma o uso, a baixa leva o destino.
- **Destino:** lista editável pelo administrador (Laje, Fundação, Alvenaria, Hidráulico, Elétrico, Acabamento, Cobertura) mais "Outro", com texto livre.
- **Quantidade:** só positiva e limitada ao disponível da obra.

## Por que uma projeção de saldo

O mestre não lê rateios, movimentos nem produtos, porque eles trazem custos. O disponível vai para `saldos_obra/{projetoId}`, um documento por obra com material, unidade e quantidade, sem valores. É o mesmo padrão das projeções de nota (`notas_projeto`). Só entram os produtos ligados a um material da tabela; os que estão sem material aparecem para o escritório em Estoque › Vincular itens.

## Etapas

### P1. Saldo por obra (`saldos_obra`)
- O escritório com escrita no projeto regrava o documento da obra depois de cada mudança, só quando o disponível muda. A preparação da base recalcula tudo.
- Regras: o mestre lê as obras concedidas; quem tem escrita no projeto grava. Testes no emulador.

### P2. Tela do mestre
- Pedir material: obra (chips) → tabela Material · Unidade · Disponível · Quantidade, com busca por nome.
- **Revisar pedido** mostra só as linhas com quantidade diferente de zero, com a coluna Destino (lista + Outro). O botão Enviar só fica disponível quando todas as linhas têm destino. A observação continua.
- O item da requisição ganha `destino`. Meus pedidos mostra o destino.

### P3. Escritório
- Requisições da obra: coluna Destino nos cartões e no CSV.
- Consumo confirmado pelo mestre: a baixa leva o destino na observação.
- Administrador: edita a lista de destinos (`config/geral.destinos`).

### P4. Validação e entrega
- Teste ponta a ponta: o escritório grava o saldo, o mestre monta o pedido pela tabela com destino e o escritório vê e atende.
- Manuais do mestre e do escritório, carimbo de versão e push.
- Pendência: publicar o novo `firestore.rules` (saldos_obra) no Firebase.
