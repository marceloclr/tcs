#!/usr/bin/env bash
set -euo pipefail
fetch(){ mkdir -p "$(dirname "$2")"; echo "Baixando $1"; curl -fL "$1" -o "$2"; }
fetch https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js libs/pdfjs/pdf.min.js
fetch https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js libs/pdfjs/pdf.worker.min.js
fetch https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js libs/tesseract/tesseract.min.js
fetch https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js libs/tesseract/worker.min.js
for f in tesseract-core.wasm.js tesseract-core-simd.wasm.js tesseract-core-lstm.wasm.js tesseract-core-simd-lstm.wasm.js tesseract-core.wasm tesseract-core-simd.wasm tesseract-core-lstm.wasm tesseract-core-simd-lstm.wasm; do fetch "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/$f" "libs/tesseract/core/$f"; done
fetch https://tessdata.projectnaptha.com/4.0.0/por.traineddata.gz libs/tesseract/tessdata/por.traineddata.gz
echo 'Concluído. Mantenha a estrutura libs/ ao publicar.'
