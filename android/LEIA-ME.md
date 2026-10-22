# App Android do mestre de obras (Notas TCS)

APK do tipo **TWA** (Trusted Web Activity), gerado com o [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap). Ele abre `https://marceloclr.gitlab.io/tcs/mestre` em tela cheia, no motor do Chrome. Por isso o login do Google, a câmera, a fila sem internet e o "Compartilhar com Notas TCS" funcionam como no navegador. **Mudanças na tela chegam ao app sozinhas; só é preciso gerar outro APK quando mudar o nome, o ícone, as cores ou o pacote.**

- Pacote: `io.gitlab.marceloclr.notastcs` · Android 7 ou mais novo (minSdk 24)
- Download: https://marceloclr.gitlab.io/tcs/apk/notas-tcs.apk (cópia em `../apk/notas-tcs.apk`)
- Tela cheia, sem a barra de endereço: depende de `https://marceloclr.gitlab.io/.well-known/assetlinks.json`, publicado pelo repositório `marceloclr.gitlab.io` (`app/estatico/.well-known/assetlinks.json`), com o SHA-256 da chave abaixo. Sem ele, o app abre com uma barra de endereço no topo.

## Chave de assinatura (não vai ao git)
- `~/.android-keys/notas-tcs.jks` (alias `notas-tcs`) e a senha em `~/.android-keys/notas-tcs.senha`.
- SHA-256: `72:CA:D9:E2:04:23:A4:23:C4:DD:A3:E1:34:97:08:2B:55:2C:8A:50:1C:CC:E0:38:5D:DF:7A:17:6E:94:63:7E`
- **Guarde uma cópia de segurança das duas.** Sem a mesma chave, uma versão nova não instala por cima da antiga (é preciso desinstalar), e o assetlinks.json precisa ser trocado.

## Gerar de novo (Linux)
Ferramentas em `~/Android`: JDK 17 (`jdk17`), Android SDK (`Sdk`, com o atalho `Sdk/bin` → `cmdline-tools/latest/bin` que o Bubblewrap exige, build-tools 36.1.0) e o Bubblewrap em `bubblewrap/`. A configuração fica em `~/.bubblewrap/config.json`.

```bash
cd tcs/android
# depois de editar twa-manifest.json, suba appVersionCode/appVersionName e regenere o projeto:
~/Android/bubblewrap/node_modules/.bin/bubblewrap update --skipVersionUpgrade
export BUBBLEWRAP_KEYSTORE_PASSWORD="$(cat ~/.android-keys/notas-tcs.senha)" BUBBLEWRAP_KEY_PASSWORD="$BUBBLEWRAP_KEYSTORE_PASSWORD"
~/Android/bubblewrap/node_modules/.bin/bubblewrap build --skipPwaValidation
cp app-release-signed.apk ../apk/notas-tcs.apk
```

## Instalar no celular
Abrir o link do download no Chrome do celular, baixar e tocar no arquivo. Na primeira vez, o Android pede para permitir "instalar apps desta fonte" para o Chrome. Se o mestre já tiver o atalho da tela instalado pelo Chrome (PWA), pode manter os dois ou remover o atalho.
