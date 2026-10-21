# Testes do TCS

Instalação, uma vez: `cd testes && npm install` (precisa de Java 11+ para os emuladores).

## 1. Verificação estática
Na raiz do repositório: `node testes/verificar.mjs`. Confere a sintaxe de todo o JavaScript (`node --check`, inclusive scripts embutidos em HTML) e o balanceamento das tags dos HTML.

## 2. Regras do Firestore
`cd testes && npm test`. Sobe o emulador do Firestore, aplica `firestore.rules` e roda `regras.test.mjs`: consultas por projeto e por cliente, leitura e escrita negadas fora do acesso, nota coletiva inteira ou só o rateio, duplicidade pela chave, papel Obra, solicitação de acesso, implantação, auditoria obrigatória, último administrador e validade vencida; baixa com responsável e motivo, estorno único com a quantidade oposta, baixa imutável, log de atividades só do próprio usuário, com a hora do servidor, sem alteração nem exclusão e listado só por administradores.
   No Linux, se o `npm test` não achar o arquivo de testes, rode dentro de `testes/`: `npx firebase emulators:exec --config ../firebase.json --only firestore --project demo-tcs "node --test regras.test.mjs"` (ou, com os emuladores já abertos, `node --test regras.test.mjs`).

## 3. Ponta a ponta no navegador
O app real, ligado aos emuladores (`?emulador=1`, só funciona em localhost), com um usuário de cada papel.

1. `cd testes && npm run emuladores` (Firestore 8089 e Auth 9099, projeto `demo-tcs`).
2. Dois servidores na raiz, para simular dois navegadores (origens diferentes): `python -m http.server 8767` e `python -m http.server 8768`.
3. Edge sem janela: `msedge --headless=new --remote-debugging-port=9446 --user-data-dir=<pasta temporária>`.
   No Linux (21/10/2026): `flatpak run org.chromium.Chromium --headless=new --remote-debugging-port=9446 --user-data-dir=$HOME/Downloads/tcs-e2e-perfil`, com os servidores em `python3 -m http.server`. Nesse navegador o OCR da foto sintética não leu o emitente, e o `10-fila.js` parou em "Complete número, data, emitente e total"; preenchendo o emitente na conferência, o resto do fluxo passou.
4. Em `testes/navegador/`, rodar `node cdp.mjs "<url>?emulador=1" <script> [captura.png]`:
   - `0-limpar.js` (em cada origem) e, antes, apagar os dados dos emuladores:
     `curl -X DELETE "http://127.0.0.1:8089/emulator/v1/projects/demo-tcs/databases/(default)/documents"` e
     `curl -X DELETE "http://127.0.0.1:9099/emulator/v1/projects/demo-tcs/accounts"`;
   - `1-admin.js` em 8767: cria o administrador direto no emulador (a implantação automática foi encerrada) e cadastra clientes, projetos, nota de exemplo distribuída entre dois clientes, preparação da base e três cadastros (Escritório com escrita na Obra 1, Leitor do Cliente B e Obra);
   - `2-escritorio.js` em 8768: vê só o Cliente A e a Obra 1, a nota coletiva só pelo rateio, e as leituras e gravações diretas fora do acesso são negadas (defina `window.RATEIO_P3` com o id de um rateio da Obra 3 para testar a leitura direta);
   - `3-leitor-obra-novo.js` em 8768: troca de conta no mesmo navegador (a cópia local é apagada), leitor sem escrita, conta da obra e conta sem cadastro (solicitação de acesso);
   - `4-revogacao-entrar.js` com `FIM=15000`, retirar os acessos do usuário pelo REST do emulador enquanto a página está aberta, e `4-revogacao-conferir.js`: a cópia local fica vazia.

   - `5-fotos.js` e `6-consulta.js` (modo local, sem emuladores): fotos sintéticas com código de barras e QR, e texto de consulta colado;
   - `7-captura.js` em `captura.html?emulador=1` (porta 8768, depois do `1-admin.js`): conta da obra, envio com internet, foto escura, envio sem internet pela fila e reenvio automático;
   - `8-compartilhar.js` e, em seguida, `8-compartilhar-conferir.js` em `captura.html?compartilhado=1&emulador=1`: foto recebida pelo menu Compartilhar (service worker);
   - `9-captura-escritorio.js`: conta do Escritório na tela da obra vai para o sistema principal.
   - `12-baixas-log.js` em 8767 (depois do `1-admin.js`): baixa pela tela sem motivo (recusada) e com motivo, responsável na baixa, relatório de baixas, estorno sem e com motivo, estorno repetido bloqueado e aba Log de atividades com baixa, estorno, entrada e exportação vindas da nuvem;
   - `13-baixas-escritorio.js` em 8768 (depois do `12-baixas-log.js`): baixa do Escritório em nome dele; listar o log, apagar ou alterar uma baixa, gravar baixa ou atividade em nome de outra pessoa: tudo negado.
   - `14-ajustes.js` em 8767 (depois do `1-admin.js`): formulário do produto em Estoque › Produtos e ajustes e fora do Solicitar orçamento, nome alterado com registro no log, sobra com custo novo, falta, histórico, fechamento estoque + custo apropriado = total adquirido e ajustes fora do relatório de baixas.
   - `10-fila.js` em 8767 (depois do `7-captura.js`): fila do escritório, cartão e destaque de 48 h, conferir com o projeto indicado, lançar, fotos como comprovante, descartar com motivo e XML da mesma chave substituindo os dados da foto.

Variáveis do `cdp.mjs`: `CDP_PORTA` (9446), `ESPERA` (ms antes de rodar o script), `FIM` (ms antes de fechar), `INIT` (script injetado antes da página) e `TEMA=claro|escuro` força o tema; o script pode chamar `console.log('__cdp_offline__')` e `console.log('__cdp_online__')` para derrubar e religar a rede da página.

