# Estoque NF-e — versão 1.5

## Alterações
- Design system Slate, navegação escura unificada e dropzone com estados hover/dragover.
- Itens sem GTIN/EAN destacados na prévia com aviso visual.
- Cadastro de produtos com botão **Editar** em cada linha, sem `<select>` para localizar produto.
- Backup destacado e zona de perigo com confirmação dupla (confirmar e digitar `APAGAR`).
- OCR de páginas PDF digitalizadas: PDF.js renderiza a página em canvas e Tesseract.js reconhece texto em português. A extração tenta OCR quando a página não tem camada de texto.
- Bibliotecas configuradas para carregamento local em `./libs/`; CDN é fallback.

## Bibliotecas locais: resposta à dúvida
Sim. É possível manter as bibliotecas fora do HTML, em pastas. Esta versão procura PDF.js em `libs/pdfjs/` e Tesseract.js em `libs/tesseract/`. Para funcionar totalmente offline, é necessário colocar também o worker, os arquivos WASM do core e o modelo de idioma `por.traineddata.gz`. O script `baixar-bibliotecas.ps1` (Windows) ou `baixar-bibliotecas.sh` (Linux/macOS) baixa as versões fixadas quando executado em um computador com internet.

**Nota sobre este pacote:** o ambiente em que o pacote foi gerado não tinha acesso de rede, portanto as pastas locais estão preparadas, mas os arquivos de biblioteca binários não foram embutidos. Ao abrir o HTML sem esses arquivos, ele tenta carregar as bibliotecas por CDN. Para uso offline/privado, execute o script de download e publique/mantenha a pasta `libs/` ao lado do `index.html`.

## Limitações do OCR
OCR pode confundir números, CNPJ, quantidade e valores; o resultado deve ser revisado. O parser de DANFE é heurístico e layouts variados podem não ser reconhecidos. O XML continua preferível. O sistema não consulta a SEFAZ e o OCR não comprova autorização fiscal.

## Preservação de dados
O IndexedDB mantém o nome `estoque_nfe_erp_v1` e versão 1. Use a mesma origem do navegador para continuar vendo os dados existentes. Exporte backup JSON antes de atualizar ou limpar dados.

## Testes
- Sintaxe JavaScript verificada com Node.js.
- Não foi possível executar teste completo de OCR no navegador neste ambiente. Teste com um PDF digitalizado e confira itens, quantidades, descontos, CNPJ e totais antes de confirmar a entrada.
