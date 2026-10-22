# Busca automática da NFC-e (GitLab CI)

O mestre de obras pode mandar só o **código da nota**: o QR Code, o código de barras ou os 44 números da chave. Um job do GitLab CI busca os dados da NFC-e na SEFAZ e grava a página da nota na captura. No escritório, **Conferir** abre a nota já com emitente, data, itens e total.

## Por que no GitLab CI
- A SEFAZ-CE mostra a nota por uma API JSON: `POST /nfce/api/notasFiscal/qrcodev2/` (QR versão 2), `qrcodev3/` (só a chave) e `qrcode/` (versão 100). A página `ShowNFCe.html` é um app Angular que chama essa API.
- A API responde só por **http**. No https, o servidor pede certificado de cliente.
- O TCS roda em https (GitLab Pages), e o navegador bloqueia a chamada http (conteúdo misto). Já o runner do GitLab chama sem esse bloqueio, de graça e sem servidor próprio.

## O que o job faz (`servidor/buscar-nfce.mjs`)
- Lê as capturas `pendente` ou `em_conferencia` ainda sem busca. As que deram erro voltam até 3 vezes.
- **NFC-e do Ceará:** pelo link do QR, ou só pela chave (UF 23, modelo 65) pela versão 3 da API.
- **NFC-e de outro estado com link do QR:** baixa a página quando ela já traz os itens no HTML (padrão SVRS).
- **NF-e (modelo 55):** sem busca automática, porque exige certificado digital. Ela segue pela foto ou pelo XML.
- Grava em `capturas/{id}.busca` um destes resultados:
  - `{status:'ok', fonte, html}`;
  - `{status:'erro', motivo, tentativas}`;
  - `{status:'sem_fonte'}`.
- No navegador, `htmlParaTexto` (em `js/consulta.js`) transforma a página em texto, e os mesmos leitores do "Colar conteúdo da consulta" montam a nota.

## Implantação (uma vez)
1. **Conta de serviço do Firebase:** console do Firebase › projeto `thiago-17d18` › ⚙ Configurações do projeto › **Contas de serviço** › **Gerar nova chave privada**. Baixa um JSON; guarde-o fora do repositório.
2. **Variável no GitLab:** projeto `marceloclr/tcs` › Settings › CI/CD › **Variables** › Add variable:
   - Key: `FIREBASE_SA`;
   - Type: **File**;
   - Value: o conteúdo inteiro do JSON;
   - marque **Protect variable**. Mascarar não é possível com o JSON, mas a variável protegida só chega a pipelines da `main`.
3. **Bloquear variáveis de pipeline:** Settings › CI/CD › Variables › **Minimum role to use pipeline variables** = **No one allowed**. Assim, quem tiver o token de trigger (passo 5) não consegue mudar o comportamento do job.
4. **Agendamento:** Build › **Pipeline schedules** › New schedule:
   - Description: `Busca NFC-e`;
   - Interval: `0 7-18 * * 1-6` (de hora em hora, das 7 às 18 h, de segunda a sábado);
   - Cron timezone: `[UTC-3] Brasilia` ou Fortaleza;
   - Target branch: `main`.
   - Para testar, use **Run** (▶) na lista de agendamentos.
5. **Botão "Buscar agora" (opcional):**
   - Settings › CI/CD › **Pipeline trigger tokens** › Add new token (`Buscar agora TCS`) e copie o token;
   - no TCS, entre como administrador e abra **Estoque › Recebidas da obra** › **Configurar "Buscar agora"** › cole o token;
   - o token fica em `config/busca`, lido só por quem confere a fila;
   - para retirar o botão, deixe o campo vazio. Para trocar o token, revogue o antigo no GitLab.
6. Publique as regras do Firestore de novo (`firestore.rules`: capturas só com o código e `config/busca`).

## Cota
- O GitLab Free tem **400 minutos de CI por mês**.
- Cada rodada leva cerca de 40 s, quase tudo no `npm install` com cache. São 12 rodadas por dia × 26 dias, cerca de 210 min.
- O "Buscar agora" soma cerca de 1 min por clique.
- Sem capturas para buscar, o script termina em poucos segundos.

## Testes
- Consulta avulsa, sem Firestore:
  - `cd servidor && npm install && node buscar-nfce.mjs --url "<link do QR>"`, ou
  - `node buscar-nfce.mjs --chave <44 dígitos>`.
- Contra o emulador: dentro de `testes/`, `npx firebase emulators:exec --config ../firebase.json --only firestore --project demo-tcs "node ../servidor/testar-busca.mjs"`.
- No navegador: `testes/navegador/15-codigo.js` (tela da obra) e `16-fila-codigo.js` (fila com busca simulada), conforme `testes/LEIA-ME.md`.

## Riscos
- **A página da nota real ainda não foi testada:** o leitor `ADAPTADOR_NFCE_CE` foi escrito sobre o padrão SVRS. Rode `--url` com o link de um cupom real e confira os itens.
- A SEFAZ pode bloquear IPs de datacenter ou mudar a API. O erro aparece na fila ("Busca falhou: motivo"), e a conferência continua pela foto.
- A busca roda no máximo de hora em hora, sem contar o "Buscar agora".
