# Free Bird WebM

App estático para comprimir e converter vídeos para `.webm` direto no navegador, pronto para publicar no GitHub Pages.

## Como usar

1. Abra `index.html` em um servidor local ou publique a pasta no GitHub Pages.
2. Escolha ou arraste um vídeo.
3. Ajuste compressão, tamanho, FPS, codec e áudio.
4. Clique em **Converter para WebM** e baixe o resultado.

## Observações

- A conversão usa FFmpeg WebAssembly carregado por CDN.
- Arquivos grandes dependem da memória do navegador.
- VP9 costuma gerar arquivos menores; VP8 costuma converter mais rápido.
