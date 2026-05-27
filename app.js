const state = {
  ffmpeg: null,
  inputFile: null,
  inputUrl: null,
  outputUrl: null,
  isBusy: false,
};

const els = {
  root: document.documentElement,
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  fileStrip: document.querySelector("#fileStrip"),
  fileName: document.querySelector("#fileName"),
  fileMeta: document.querySelector("#fileMeta"),
  removeFile: document.querySelector("#removeFile"),
  qualityRange: document.querySelector("#qualityRange"),
  qualityValue: document.querySelector("#qualityValue"),
  sizeSelect: document.querySelector("#sizeSelect"),
  fpsSelect: document.querySelector("#fpsSelect"),
  codecSelect: document.querySelector("#codecSelect"),
  removeAudio: document.querySelector("#removeAudio"),
  convertButton: document.querySelector("#convertButton"),
  downloadLink: document.querySelector("#downloadLink"),
  resetButton: document.querySelector("#resetButton"),
  progressWrap: document.querySelector("#progressWrap"),
  progressLabel: document.querySelector("#progressLabel"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  message: document.querySelector("#message"),
  videoPreview: document.querySelector("#videoPreview"),
  previewEmpty: document.querySelector("#previewEmpty"),
  inputSize: document.querySelector("#inputSize"),
  outputSize: document.querySelector("#outputSize"),
  savingSize: document.querySelector("#savingSize"),
  themeToggle: document.querySelector("#themeToggle"),
  supportStatus: document.querySelector("#supportStatus"),
};

const qualityLabels = [
  { max: 23, text: "Alta qualidade" },
  { max: 29, text: "Leve" },
  { max: 35, text: "Equilibrado" },
  { max: 40, text: "Bem pequeno" },
];

function init() {
  setupTheme();
  bindEvents();
  updateQualityLabel();
  setMessage("Escolha um vídeo para começar.");
  renderIcons();
}

function renderIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function bindEvents() {
  els.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      setInputFile(file);
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("drag-over");
    });
  });

  els.dropZone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (file) {
      setInputFile(file);
    }
  });

  els.qualityRange.addEventListener("input", updateQualityLabel);
  els.convertButton.addEventListener("click", convertVideo);
  els.removeFile.addEventListener("click", clearInput);
  els.resetButton.addEventListener("click", resetAll);
  els.themeToggle.addEventListener("click", toggleTheme);
}

function setupTheme() {
  const savedTheme = localStorage.getItem("free-bird-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(savedTheme || (prefersDark ? "dark" : "light"));
}

function setTheme(theme) {
  els.root.dataset.theme = theme;
  localStorage.setItem("free-bird-theme", theme);
  els.themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Usar tema claro" : "Usar tema escuro",
  );
  els.themeToggle.innerHTML =
    theme === "dark" ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
  renderIcons();
}

function toggleTheme() {
  setTheme(els.root.dataset.theme === "dark" ? "light" : "dark");
}

function setInputFile(file) {
  if (!file.type.startsWith("video/") && !hasVideoLikeExtension(file.name)) {
    setMessage("Escolha um arquivo de vídeo válido.", true);
    return;
  }

  revokeUrl("inputUrl");
  revokeUrl("outputUrl");
  state.inputFile = file;
  state.inputUrl = URL.createObjectURL(file);

  els.fileName.textContent = file.name;
  els.fileMeta.textContent = `${formatBytes(file.size)} • ${file.type || "tipo detectado pelo FFmpeg"}`;
  els.fileStrip.hidden = false;
  els.convertButton.disabled = false;
  els.downloadLink.hidden = true;
  els.videoPreview.src = state.inputUrl;
  els.videoPreview.hidden = false;
  els.previewEmpty.hidden = true;
  els.inputSize.textContent = formatBytes(file.size);
  els.outputSize.textContent = "-";
  els.savingSize.textContent = "-";
  setProgress(0, "Pronto para converter.");
  els.progressWrap.hidden = true;
  setMessage("Ajuste a compressão e clique em converter.");
}

function hasVideoLikeExtension(fileName) {
  return /\.(avi|flv|m4v|mkv|mov|mp4|mpeg|mpg|ogg|ogv|webm|wmv)$/i.test(fileName);
}

function clearInput() {
  revokeUrl("inputUrl");
  state.inputFile = null;
  els.fileInput.value = "";
  els.fileStrip.hidden = true;
  els.convertButton.disabled = true;
  els.videoPreview.removeAttribute("src");
  els.videoPreview.load();
  els.videoPreview.hidden = true;
  els.previewEmpty.hidden = false;
  els.inputSize.textContent = "-";
}

function resetAll() {
  clearInput();
  revokeUrl("outputUrl");
  els.qualityRange.value = "32";
  els.sizeSelect.value = "720";
  els.fpsSelect.value = "original";
  els.codecSelect.value = "vp9";
  els.removeAudio.checked = false;
  els.downloadLink.hidden = true;
  els.progressWrap.hidden = true;
  els.outputSize.textContent = "-";
  els.savingSize.textContent = "-";
  updateQualityLabel();
  setMessage("Escolha um vídeo para começar.");
}

function updateQualityLabel() {
  const crf = Number(els.qualityRange.value);
  const label = qualityLabels.find((item) => crf <= item.max);
  els.qualityValue.textContent = `${label?.text || "Compacto"} • CRF ${crf}`;
}

async function convertVideo() {
  if (!state.inputFile || state.isBusy) {
    return;
  }

  state.isBusy = true;
  els.convertButton.disabled = true;
  els.downloadLink.hidden = true;
  revokeUrl("outputUrl");
  setMessage("Carregando motor de conversão. Na primeira vez pode demorar um pouco.");
  setProgress(2, "Preparando FFmpeg...");
  els.progressWrap.hidden = false;

  try {
    const ffmpeg = await getFFmpeg();
    const inputName = `input.${extensionFromName(state.inputFile.name)}`;
    const outputName = "free-bird-convertido.webm";

    await cleanVirtualFiles(ffmpeg, [inputName, outputName]);
    await ffmpeg.writeFile(inputName, await fetchFileBytes(state.inputFile));

    setProgress(7, "Convertendo para WebM...");
    const args = buildFfmpegArgs(inputName, outputName);
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: "video/webm" });
    showOutput(blob);
    setProgress(100, "Conversão concluída.");
    setMessage("WebM pronto para baixar.");

    await cleanVirtualFiles(ffmpeg, [inputName, outputName]);
  } catch (error) {
    console.error(error);
    if (isMemoryError(error)) {
      try {
        setMessage("FFmpeg ficou sem memória. Tentando modo leve do navegador...");
        setProgress(3, "Tentando modo leve...");
        const blob = await convertWithBrowserRecorder(state.inputFile);
        showOutput(blob);
        setProgress(100, "Conversão concluída no modo leve.");
        setMessage("WebM pronto para baixar. Usei o modo leve porque o FFmpeg estourou memória.");
      } catch (fallbackError) {
        console.error(fallbackError);
        setMessage(errorMessage(fallbackError), true);
        setProgress(0, "Falhou.");
      }
    } else {
      setMessage(errorMessage(error), true);
      setProgress(0, "Falhou.");
    }
  } finally {
    state.isBusy = false;
    els.convertButton.disabled = !state.inputFile;
  }
}

async function getFFmpeg() {
  if (state.ffmpeg) {
    return state.ffmpeg;
  }

  if (!window.FFmpegWASM) {
    throw new Error("Arquivo ffmpeg.js não carregou. Envie ffmpeg.js e 814.ffmpeg.js para a raiz do GitHub e aguarde o Pages atualizar.");
  }

  const { FFmpeg } = window.FFmpegWASM;
  const ffmpeg = new FFmpeg();

  ffmpeg.on("progress", ({ progress }) => {
    if (Number.isFinite(progress)) {
      const percent = Math.min(99, Math.max(7, Math.round(progress * 100)));
      setProgress(percent, "Convertendo para WebM...");
    }
  });

  ffmpeg.on("log", ({ message }) => {
    if (/error|invalid|failed/i.test(message)) {
      console.warn(message);
    }
  });

  const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  state.ffmpeg = ffmpeg;
  els.supportStatus.innerHTML = '<i data-lucide="check-circle-2"></i> FFmpeg carregado';
  renderIcons();
  return ffmpeg;
}

async function fetchFileBytes(source) {
  if (source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer());
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Não consegui ler o arquivo: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function toBlobURL(url, mimeType) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Não consegui carregar FFmpeg core: ${response.status}`);
  }

  const blob = new Blob([await response.arrayBuffer()], { type: mimeType });
  return URL.createObjectURL(blob);
}

async function convertWithBrowserRecorder(file) {
  if (!window.MediaRecorder) {
    throw new Error("O modo leve não está disponível neste navegador.");
  }

  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  let recorder = null;
  let frameId = 0;
  let outputStream = null;
  let sourceStream = null;

  if (!context) {
    URL.revokeObjectURL(sourceUrl);
    throw new Error("Canvas não está disponível neste navegador.");
  }

  try {
    video.src = sourceUrl;
    video.preload = "auto";
    video.playsInline = true;
    video.volume = 0;
    video.muted = els.removeAudio.checked;
    video.style.cssText = "position:fixed;left:-2px;top:-2px;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.append(video);

    await waitForVideoMetadata(video);

    const { width, height } = fallbackSize(video.videoWidth, video.videoHeight);
    const fps = fallbackFps();
    canvas.width = width;
    canvas.height = height;
    outputStream = canvas.captureStream(fps);

    if (!els.removeAudio.checked) {
      const captureStream = video.captureStream || video.mozCaptureStream;
      if (captureStream) {
        sourceStream = captureStream.call(video);
        sourceStream.getAudioTracks().forEach((track) => outputStream.addTrack(track));
      }
    }

    const chunks = [];
    const mimeType = recorderMimeType();
    const recorderOptions = {
      videoBitsPerSecond: recorderVideoBitrate(width, height, fps),
    };

    if (mimeType) {
      recorderOptions.mimeType = mimeType;
    }

    if (!els.removeAudio.checked) {
      recorderOptions.audioBitsPerSecond = 96000;
    }

    recorder = new MediaRecorder(outputStream, recorderOptions);

    const result = new Promise((resolve, reject) => {
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener("error", (event) => {
        reject(event.error || new Error("Falha no modo leve do navegador."));
      });

      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        if (!blob.size) {
          reject(new Error("O modo leve não conseguiu gerar um WebM."));
          return;
        }
        resolve(blob);
      });
    });

    video.addEventListener(
      "ended",
      () => {
        if (recorder?.state !== "inactive") {
          recorder.stop();
        }
      },
      { once: true },
    );

    const drawFrame = () => {
      context.drawImage(video, 0, 0, width, height);
      if (Number.isFinite(video.duration) && video.duration > 0) {
        const percent = Math.min(99, Math.max(3, Math.round((video.currentTime / video.duration) * 100)));
        setProgress(percent, "Convertendo no modo leve...");
      }
      if (!video.ended) {
        frameId = requestAnimationFrame(drawFrame);
      }
    };

    recorder.start(1000);
    await video.play();
    drawFrame();
    return await result;
  } finally {
    cancelAnimationFrame(frameId);
    if (recorder?.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Recorder may already be stopping after a browser error.
      }
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    stopStream(outputStream);
    stopStream(sourceStream);
    URL.revokeObjectURL(sourceUrl);
  }
}

function waitForVideoMetadata(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }

    video.addEventListener("loadedmetadata", resolve, { once: true });
    video.addEventListener(
      "error",
      () => reject(new Error("O navegador não conseguiu ler esse vídeo no modo leve.")),
      { once: true },
    );
  });
}

function fallbackSize(sourceWidth, sourceHeight) {
  const selected = els.sizeSelect.value;
  const maxHeight = selected === "original" ? 720 : Number(selected);
  const scale = Number.isFinite(maxHeight) ? Math.min(1, maxHeight / sourceHeight) : 1;
  const width = Math.max(2, Math.round((sourceWidth * scale) / 2) * 2);
  const height = Math.max(2, Math.round((sourceHeight * scale) / 2) * 2);
  return { width, height };
}

function fallbackFps() {
  return els.fpsSelect.value === "original" ? 30 : Number(els.fpsSelect.value);
}

function recorderMimeType() {
  const codec = els.codecSelect.value === "vp8" ? "vp8" : "vp9";
  const candidates = els.removeAudio.checked
    ? [`video/webm;codecs=${codec}`, "video/webm;codecs=vp8", "video/webm"]
    : [`video/webm;codecs=${codec},opus`, `video/webm;codecs=${codec}`, "video/webm;codecs=vp8,opus", "video/webm"];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function recorderVideoBitrate(width, height, fps) {
  const crf = Number(els.qualityRange.value);
  const quality = clamp((42 - crf) / 18, 0.35, 1.45);
  return Math.round(clamp(width * height * fps * 0.085 * quality, 250_000, 4_000_000));
}

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function showOutput(blob) {
  revokeUrl("outputUrl");
  state.outputUrl = URL.createObjectURL(blob);
  els.videoPreview.src = state.outputUrl;
  els.videoPreview.hidden = false;
  els.previewEmpty.hidden = true;
  els.downloadLink.href = state.outputUrl;
  els.downloadLink.download = outputFileName(state.inputFile.name);
  els.downloadLink.hidden = false;
  els.outputSize.textContent = formatBytes(blob.size);
  els.savingSize.textContent = savingsText(state.inputFile.size, blob.size);
}

function isMemoryError(error) {
  const detail = error?.message || String(error);
  return /memory|allocation|array buffer|out of bounds|cannot enlarge/i.test(detail);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildFfmpegArgs(inputName, outputName) {
  const codec = els.codecSelect.value;
  const args = ["-i", inputName, "-map", "0:v:0"];
  const filters = [];
  const maxHeight = els.sizeSelect.value;
  const fps = els.fpsSelect.value;

  if (maxHeight !== "original") {
    filters.push(`scale=-2:min(${maxHeight}\\,ih)`);
  }

  if (fps !== "original") {
    filters.push(`fps=${fps}`);
  }

  if (filters.length) {
    args.push("-vf", filters.join(","));
  }

  if (els.removeAudio.checked) {
    args.push("-an");
  } else {
    args.push("-map", "0:a?", "-c:a", "libopus", "-b:a", "96k");
  }

  if (codec === "vp8") {
    args.push("-c:v", "libvpx", "-b:v", "900k", "-deadline", "realtime", "-cpu-used", "8");
  } else {
    args.push(
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "0",
      "-crf",
      els.qualityRange.value,
      "-deadline",
      "good",
      "-cpu-used",
      "5",
    );
  }

  args.push("-f", "webm", outputName);
  return args;
}

async function cleanVirtualFiles(ffmpeg, names) {
  await Promise.all(
    names.map(async (name) => {
      try {
        await ffmpeg.deleteFile(name);
      } catch {
        // File may not exist in FFmpeg's virtual filesystem.
      }
    }),
  );
}

function extensionFromName(fileName) {
  return (fileName.split(".").pop() || "video").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function outputFileName(fileName) {
  return `${fileName.replace(/\.[^.]+$/, "") || "video"}-webm.webm`;
}

function setProgress(value, label) {
  const rounded = Math.round(value);
  els.progressBar.value = rounded;
  els.progressPercent.textContent = `${rounded}%`;
  els.progressLabel.textContent = label;
}

function setMessage(text, isError = false) {
  els.message.textContent = text;
  els.message.classList.toggle("error", isError);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function savingsText(inputBytes, outputBytes) {
  if (!inputBytes || !outputBytes) {
    return "-";
  }

  const change = 100 - (outputBytes / inputBytes) * 100;
  if (change > 0) {
    return `${Math.round(change)}% menor`;
  }
  return `${Math.abs(Math.round(change))}% maior`;
}

function revokeUrl(key) {
  if (state[key]) {
    URL.revokeObjectURL(state[key]);
    state[key] = null;
  }
}

function errorMessage(error) {
  const detail = error?.message || String(error);
  if (/memory|allocation/i.test(detail)) {
    return "O navegador ficou sem memória. Tente 480p, VP8 ou um trecho menor do vídeo.";
  }
  if (/SharedArrayBuffer|cross-origin/i.test(detail)) {
    return "O navegador bloqueou recursos do FFmpeg. Publique no GitHub Pages ou rode por um servidor local.";
  }
  return `Não consegui converter esse vídeo. Detalhe: ${detail}`;
}

window.addEventListener("DOMContentLoaded", init);
