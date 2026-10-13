Bibliotecas locais opcionais do Estoque NF-e v1.5

A aplicação procura primeiro as bibliotecas nestes caminhos e recorre à CDN se não estiverem instaladas:

PDF.js:
  libs/pdfjs/pdf.min.js
  libs/pdfjs/pdf.worker.min.js

Tesseract.js 5.1.1:
  libs/tesseract/tesseract.min.js
  libs/tesseract/worker.min.js
  libs/tesseract/core/ (arquivos JS/WASM de tesseract.js-core 5.1.1)
  libs/tesseract/tessdata/por.traineddata.gz

Para ficar 100% local/offline, todos esses arquivos são necessários. A pasta libs vazia não contém as bibliotecas binárias: o ambiente de geração estava sem acesso de rede para baixar e embutir os artefatos oficiais. Execute baixar-bibliotecas.ps1 em um Windows com internet (PowerShell) ou baixar-bibliotecas.sh em Linux/macOS para baixar as versões fixadas.

Se as bibliotecas locais não existirem, a aplicação tenta CDN; nesse caso, OCR depende de internet. PDF.js é distribuído sob Apache-2.0 e Tesseract.js sob Apache-2.0. Consulte as licenças oficiais antes de redistribuir versões modificadas.
