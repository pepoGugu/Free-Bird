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
  const savedTheme = localStorage.getItem("passarinho-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(savedTheme || (prefersDark ? "dark" : "light"));
}

function setTheme(theme) {
  els.root.dataset.theme = theme;
  localStorage.setItem("passarinho-theme", theme);
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
    const outputName = "passarinho-convertido.webm";

    await cleanVirtualFiles(ffmpeg, [inputName, outputName]);
    await ffmpeg.writeFile(inputName, await window.FFmpegUtil.fetchFile(state.inputFile));

    setProgress(7, "Convertendo para WebM...");
    const args = buildFfmpegArgs(inputName, outputName);
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: "video/webm" });
    state.outputUrl = URL.createObjectURL(blob);

    els.videoPreview.src = state.outputUrl;
    els.videoPreview.hidden = false;
    els.previewEmpty.hidden = true;
    els.downloadLink.href = state.outputUrl;
    els.downloadLink.download = outputFileName(state.inputFile.name);
    els.downloadLink.hidden = false;
    els.outputSize.textContent = formatBytes(blob.size);
    els.savingSize.textContent = savingsText(state.inputFile.size, blob.size);
    setProgress(100, "Conversão concluída.");
    setMessage("WebM pronto para baixar.");

    await cleanVirtualFiles(ffmpeg, [inputName, outputName]);
  } catch (error) {
    console.error(error);
    setMessage(errorMessage(error), true);
    setProgress(0, "Falhou.");
  } finally {
    state.isBusy = false;
    els.convertButton.disabled = !state.inputFile;
  }
}

async function getFFmpeg() {
  if (state.ffmpeg) {
    return state.ffmpeg;
  }

  if (!window.FFmpegWASM || !window.FFmpegUtil) {
    throw new Error("FFmpeg ainda não carregou. Verifique sua conexão e tente de novo.");
  }

  const { FFmpeg } = window.FFmpegWASM;
  const { toBlobURL } = window.FFmpegUtil;
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
