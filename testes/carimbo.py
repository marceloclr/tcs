# Atualiza o carimbo de versão V-DDMMAAAA-HHMM em index.html, captura.html e sw.js (o sw.js usa a versão no nome do cache).
# Lê cada arquivo inteiro antes de gravar e recusa gravar se o resultado ficar vazio.
# Uso (na raiz do repositório): python testes/carimbo.py
import re, datetime, pathlib, sys
raiz = pathlib.Path(__file__).resolve().parent.parent
v = 'V-' + datetime.datetime.now().strftime('%d%m%Y-%H%M')
for nome in ['index.html', 'captura.html', 'sw.js']:
    p = raiz / nome
    texto = p.read_text(encoding='utf-8')
    novo, n = re.subn(r'V-\d{8}-\d{4}', v, texto)
    if not texto or not novo or n == 0:
        sys.exit(f'{nome}: carimbo não encontrado ou arquivo vazio; nada foi gravado.')
    p.write_text(novo, encoding='utf-8', newline='')
print(v)
