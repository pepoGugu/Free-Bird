# Free Bird WebM

App estático para comprimir e converter vídeos para `.webm` direto no navegador, pronto para publicar no GitHub Pages.

## Como usar

1. Abra `index.html` em um servidor local ou publique a pasta no GitHub Pages.
2. Escolha ou arraste um vídeo.
3. Ajuste compressão, tamanho, FPS e codec.
4. Clique em **Converter para WebM** e baixe o resultado.

## Publicar no GitHub Pages

1. Envie estes arquivos para um repositório no GitHub.
   Inclua `ffmpeg.js` e `814.ffmpeg.js` na raiz, do lado de `index.html`.
2. Vá em **Settings > Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione a branch e a pasta raiz.

## Observações

- A conversão usa FFmpeg WebAssembly carregado por CDN.
- Arquivos grandes dependem da memória do navegador.
- VP9 costuma gerar arquivos menores; VP8 costuma converter mais rápido.
- A saída é sempre sem áudio.
- Se o FFmpeg ficar sem memória, o app tenta automaticamente um modo leve com `MediaRecorder`.
