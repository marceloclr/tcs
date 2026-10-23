# TCS 100% no smartphone — planejamento (app × navegador, Android e iPhone)

## Contexto
O usuário quer o sistema rodando no celular e quer saber se é viável, quanto custa em complexidade e como evolui.
**Escopo escolhido:** a obra completa no celular, mais o essencial do escritório (atender requisições, conferir a fila da obra, aprovar acessos e consultar o estoque). Relatórios, planilhas e administração pesada continuam no computador.
**Restrições:**
- os mestres também usam iPhone;
- preferência por **não usar lojas**;
- **não há Mac**.

**Hoje:**
- `captura.html` (tela do mestre) já é um PWA: service worker `sw.js`, fila sem internet, Share Target no `manifest.webmanifest`, câmera, ZXing e Tesseract.
- No Android existe o **APK TWA** (`android/`, Bubblewrap, `apk/notas-tcs.apk`), que abre `/tcs/mestre` no Chrome em tela cheia.
- O escritório (`index.html`, cerca de 600 KB de JavaScript em `js/*.js`) foi feito para computador: tabelas com `min-width:760px` e poucos `@media`.
- **Não há servidor:** o site está no GitLab Pages, os dados no Firestore (plano gratuito) e o login é o Google do Firebase Auth, com `authDomain` em `thiago-17d18.web.app`.

## Veredito: app × navegador
| Caminho | Android | iPhone | Custo / complexidade | Veredito |
|---|---|---|---|---|
| **PWA (navegador + "Adicionar à tela inicial") + APK TWA no Android** | Já existe; quase nativo | Funciona pelo Safari, com limites | R$ 0; um código só; atualiza sem loja | **Recomendado** |
| Capacitor (o mesmo código web dentro de um app nativo) | Bom | Exige Apple Developer (US$ 99/ano), compilação em macOS na nuvem e TestFlight/App Store | Médio; dois pacotes nativos para manter | Plano B, só se o PWA bater num limite que bloqueie o trabalho |
| Reescrever em nativo (Flutter, React Native, Swift/Kotlin) | — | Mesmas exigências da Apple | Alto: reescrever cerca de 600 KB de lógica, com dois códigos | Não recomendado |

**Por que o PWA no iPhone:** sem loja, a Apple não permite instalar app nativo no Brasil. Ad hoc, TestFlight e Enterprise exigem contas pagas, e a distribuição alternativa da UE não vale aqui. O PWA instalado na tela inicial roda em tela cheia, tem armazenamento próprio (fora do limite de 7 dias do Safari), câmera e, no iOS 16.4 ou mais novo, notificações.

**Viabilidade:**
- **Android:** alta. O caminho já está pronto.
- **iPhone:** média para alta. Depende de **um ponto crítico (o login)**, que precisa ser provado num iPhone real antes de qualquer outra coisa.

## Pontos críticos (em ordem de risco)
1. **Login Google no iPhone instalado.** É o maior risco. No modo tela cheia, o `signInWithPopup` falha ou abre fora do app. O `signInWithRedirect` quebra porque o Safari bloqueia o armazenamento entre sites diferentes (o app está em `marceloclr.gitlab.io` e o login em `thiago-17d18.web.app`). Saídas, a confirmar na etapa M0:
   - (a) publicar o site também no **Firebase Hosting** (`thiago-17d18.web.app`, sem custo), no mesmo domínio do login;
   - (b) login pelo Google Identity Services com `signInWithCredential`;
   - (c) link de acesso por e-mail.

   A saída (a) obriga a ajustar o `assetlinks.json` e o APK caso o endereço do app mude.
2. **Sem "Compartilhar com Notas TCS" no iPhone.** O iOS não tem Share Target. A foto que chega pelo WhatsApp entra por "Usar foto da galeria", e a tela passa a explicar isso no iPhone.
3. **A fila sem internet só envia com o app aberto.** Não há Background Sync no iOS nem no TWA. A faixa "esperando para enviar" já existe. Vamos reenviar ao reabrir ou voltar ao app (`visibilitychange`) e avisar quando a fila ficar parada por muitas horas.
4. **Câmera e código de barras no Safari.** O Safari não tem `BarcodeDetector`, então tudo depende do ZXing, que é mais lento. O OCR (Tesseract) pesa e pode faltar memória em iPhones antigos. Vamos ajustar o ZXing para o iOS (resolução e região de leitura) e, no iPhone, deixar o OCR para o escritório: o celular só fotografa e lê o código.
5. **Armazenamento.** Com o disco cheio, o iOS pode apagar dados de sites. Vamos pedir `navigator.storage.persist()` e não deixar foto não enviada parada por muito tempo (aviso).
6. **Notificações precisam de servidor.** O Web Push (FCM) funciona no iPhone (16.4 ou mais novo, instalado) e no Android, mas alguém precisa disparar o envio. **Decisão a tomar:** Cloud Functions (plano Blaze, com cartão, custo perto de zero nesse volume) ou um worker gratuito (Cloudflare Workers com a API HTTP v1 do FCM e uma conta de serviço).
7. **Sem Mac, não há Inspetor Web do Safari.** O diagnóstico fica numa **página de diagnóstico** que grava o resultado na coluna de atividades, onde eu leio. O motor do Safari pode ser simulado com o **Playwright WebKit no Windows**. O iPhone real é sempre o do mestre.
8. **Escritório no celular.** Carregar toda a base pode pesar em celulares simples, e manter duas formas de tela dobra o trabalho de interface. Para conter isso: telas próprias para o celular só nas tarefas essenciais, reaproveitando a lógica existente.
9. **Atualizações.** O PWA do iPhone só se atualiza ao reabrir. O service worker já usa o carimbo de versão; vamos mostrar "versão nova, toque para atualizar".
10. **Celular perdido.** A sessão do Google fica salva no aparelho. Desativar o usuário em Usuários e acessos já corta o acesso, e isso entra no manual.

## Ganhos
- **R$ 0** de licença e loja.
- **Um código só** para Android, iPhone e computador.
- **Atualização na hora**, sem revisão de loja.
- Funciona **sem internet**.
- O APK Android que já existe continua valendo.
- O caminho para o Capacitor fica aberto, sem reescrever, caso um dia seja preciso ir para as lojas.

## Etapas (cada uma com plano, aprovação, commits e relatório)
**M0 — Prova no iPhone (decisiva, pequena)**
- `diagnostico.html` testa, no aparelho, cada recurso:
  - instalação na tela inicial (standalone);
  - login (popup, redirect e as alternativas);
  - câmera (`input capture` e `getUserMedia`) e ZXing ao vivo;
  - IndexedDB e persistência do Firestore;
  - `storage.persist`;
  - permissão de notificação;
  - HEIC.
- O resultado vai para `atividades`, e eu leio pelo sistema.
- O usuário roda num iPhone de mestre. **Saída:** a estratégia de login definida.

**M1 — Login e endereço únicos**
- Aplica a saída escolhida em M0. Se o endereço mudar para o Firebase Hosting, publica nele pelo CI (`.gitlab-ci.yml`) e ajusta `manifest.webmanifest`, `assetlinks.json`, `android/twa-manifest.json` e o APK.

**M2 — Mestre no iPhone com o mesmo nível do Android**
- `js/captura.js` e `captura.html`:
  - tutorial "Adicionar à Tela de Início" quando estiver no Safari sem instalar;
  - caminho da galeria no lugar do Share Target;
  - ZXing ajustado ao iOS;
  - OCR desligado no celular;
  - `storage.persist`;
  - reenvio ao voltar ao app;
  - aviso de versão nova.
- Reaproveita `codigosLer` e `codigosAltaResolucao` (`js/imagens.js`) e a fila do Firestore (`mtGravar`).

**M3 — Escritório essencial no celular**
- Um modo celular no próprio `index.html`, com navegação embaixo e quatro abas:
  - **Pendências:** contadores de requisições, fila da obra e acessos;
  - **Requisições:** cartões com Atender, Recusar e Confirmar devolução;
  - **Recebidas da obra:** ver fotos e descartar; lançar fica no computador;
  - **Estoque por obra:** só consulta.
- Reaproveita `reqAtender`, `reqRecusar` e `reqReceberDevolucao` (`js/requisicoes.js`), `filaAtualizar` e `filaVerFotos` (`js/fila.js`), o cadastro de acessos (`admGravar` em `js/acessos.js`) e `stockTree` (`js/paineis.js`).
- No celular entram só cartões novos; nenhuma lógica é duplicada.
- Uma tela inicial por papel: o mestre vai para `captura.html`, e o escritório e o administrador para o modo celular.

**M4 — Notificações** (decidido em 23/10/2026: serviço gratuito, sem o plano Blaze: Cloudflare Workers chamando a API HTTP v1 do FCM com uma conta de serviço)
- FCM Web Push: nova requisição ou devolução → escritório; pedido atendido ou recusado → mestre.
- O token fica em `usuarios/{email}`, com regras novas e testes no emulador.

**M5 — Distribuição e manuais**
- Página "Instalar" com QR code: no Android o APK, no iPhone o passo a passo do Safari.
- Manuais do mestre e do escritório com o uso no celular.
- APK novo, se o endereço tiver mudado.

**Evolução futura (fora do escopo)**
- Play Store pelo próprio TWA (US$ 25).
- App Store só com Capacitor, Apple Developer e compilação macOS na nuvem (Codemagic ou GitHub Actions). Para não fechar essa porta, a lógica continua separada da tela, e o `window.__fb` segue como ponto único de acesso ao Firebase, onde os plugins nativos entrariam.

## Complexidade estimada
| Etapa | Tamanho | Risco |
|---|---|---|
| M0 | Pequeno | Alto: define o resto |
| M1 | Pequeno a médio | Médio |
| M2 | Médio | Médio |
| M3 | Médio a grande (a maior) | Baixo: lógica pronta |
| M4 | Médio | Médio: precisa de servidor |
| M5 | Pequeno | Baixo |

## Verificação
- **Em todas as etapas:**
  - `node testes/verificar.mjs`;
  - regras no emulador (`npm test` em `testes/`);
  - testes de ponta a ponta no Edge, em tamanho de celular (`cdp.mjs` com 390×844, padrão dos testes 19, 21 e 23).
- **Motor do Safari:** Playwright WebKit no Windows, com as mesmas telas.
- **Aparelhos reais:**
  - iPhone do mestre, com a página de diagnóstico (M0) e um roteiro curto no fim de M2 e M3;
  - Android pelo APK.
- **Critério de aceite:**
  - o mestre faz login, pedido, prestação de contas e envio de nota sem internet no iPhone e no Android;
  - o escritório atende uma requisição e confirma uma devolução pelo celular.
