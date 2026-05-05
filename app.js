import {
  FaceLandmarker,
  FilesetResolver,
} from "./vendor/mediapipe/tasks-vision/vision_bundle.mjs";

const lashStyles = [
  {
    id: "natural-soft-black",
    sku: "LS-B-0810-005-BK",
    series: "Natural Line",
    name: "日常裸感",
    color: "#15110f",
    colorName: "黑",
    lengthMm: "8-10mm",
    curlGrade: "B",
    thicknessMm: "0.05",
    spikes: 22,
    length: 0.46,
    curve: 0.2,
    thickness: 1.2,
    fan: 0.88,
  },
  {
    id: "commute-mid-black",
    sku: "LS-C-0911-007-MBK",
    series: "Daily Line",
    name: "通勤自然",
    color: "#0b0a09",
    colorName: "中黑",
    lengthMm: "9-11mm",
    curlGrade: "C",
    thicknessMm: "0.07",
    spikes: 24,
    length: 0.5,
    curve: 0.32,
    thickness: 1.28,
    fan: 0.95,
  },
  {
    id: "cat-deep-black",
    sku: "LS-C-1013-010-DBK",
    series: "Cat Eye",
    name: "小猫眼",
    color: "#0d0b0a",
    colorName: "深黑",
    lengthMm: "10-13mm",
    curlGrade: "C",
    thicknessMm: "0.10",
    spikes: 25,
    length: 0.54,
    curve: 0.36,
    thickness: 1.35,
    fan: 1.15,
  },
  {
    id: "doll-deep-black",
    sku: "LS-D-1012-012-DBK",
    series: "Doll Eye",
    name: "甜娃娃",
    color: "#11100f",
    colorName: "深黑",
    lengthMm: "10-12mm",
    curlGrade: "D",
    thicknessMm: "0.12",
    spikes: 28,
    length: 0.6,
    curve: 0.48,
    thickness: 1.45,
    fan: 0.98,
  },
  {
    id: "volume-ink",
    sku: "LS-D-1114-015-DBK",
    series: "Volume",
    name: "浓密黑曜",
    color: "#090807",
    colorName: "深黑",
    lengthMm: "11-14mm",
    curlGrade: "D",
    thicknessMm: "0.15",
    spikes: 34,
    length: 0.66,
    curve: 0.58,
    thickness: 1.7,
    fan: 1.05,
  },
  {
    id: "brown-air",
    sku: "LS-C-0811-006-BR",
    series: "Soft Brown",
    name: "棕色空气感",
    color: "#4b3124",
    colorName: "棕色",
    lengthMm: "8-11mm",
    curlGrade: "C",
    thicknessMm: "0.06",
    spikes: 26,
    length: 0.5,
    curve: 0.34,
    thickness: 1.18,
    fan: 0.9,
  },
  {
    id: "gray-mist",
    sku: "LS-B-0912-007-GY",
    series: "Mist Color",
    name: "灰雾柔焦",
    color: "#3b3f42",
    colorName: "灰色",
    lengthMm: "9-12mm",
    curlGrade: "B",
    thicknessMm: "0.07",
    spikes: 25,
    length: 0.52,
    curve: 0.28,
    thickness: 1.16,
    fan: 0.9,
  },
  {
    id: "wispy-black",
    sku: "LS-L-0914-012-DBK",
    series: "Wispy",
    name: "漫画束感",
    color: "#080706",
    colorName: "深黑",
    lengthMm: "9-14mm",
    curlGrade: "L",
    thicknessMm: "0.12",
    spikes: 18,
    length: 0.72,
    curve: 0.62,
    thickness: 1.55,
    fan: 1.22,
  },
  {
    id: "wine-accent",
    sku: "LS-C-1013-010-WN",
    series: "Color Accent",
    name: "酒红点缀",
    color: "#5b1824",
    colorName: "酒红",
    lengthMm: "10-13mm",
    curlGrade: "C",
    thicknessMm: "0.10",
    spikes: 27,
    length: 0.58,
    curve: 0.42,
    thickness: 1.32,
    fan: 1.08,
  },
  {
    id: "navy-accent",
    sku: "LS-D-1012-010-NV",
    series: "Color Accent",
    name: "蓝黑微光",
    color: "#111f32",
    colorName: "蓝黑",
    lengthMm: "10-12mm",
    curlGrade: "D",
    thicknessMm: "0.10",
    spikes: 29,
    length: 0.57,
    curve: 0.52,
    thickness: 1.34,
    fan: 1.02,
  },
];

const STORAGE_KEY = "lash-studio-library-v1";

const eyeIndexes = {
  left: [33, 246, 161, 160, 159, 158, 157, 173, 133],
  right: [362, 398, 384, 385, 386, 387, 388, 466, 263],
};

const els = {
  canvas: document.querySelector("#canvas"),
  video: document.querySelector("#video"),
  photoInput: document.querySelector("#photoInput"),
  customLashInput: document.querySelector("#customLashInput"),
  uploadMode: document.querySelector("#uploadMode"),
  cameraMode: document.querySelector("#cameraMode"),
  cameraActions: document.querySelector("#cameraActions"),
  startCamera: document.querySelector("#startCamera"),
  captureFrame: document.querySelector("#captureFrame"),
  styleGrid: document.querySelector("#styleGrid"),
  selectedProduct: document.querySelector("#selectedProduct"),
  catalogCount: document.querySelector("#catalogCount"),
  lengthFilter: document.querySelector("#lengthFilter"),
  curlFilter: document.querySelector("#curlFilter"),
  thicknessFilter: document.querySelector("#thicknessFilter"),
  colorFilter: document.querySelector("#colorFilter"),
  clearFilters: document.querySelector("#clearFilters"),
  libraryGrid: document.querySelector("#libraryGrid"),
  libraryCount: document.querySelector("#libraryCount"),
  lengthRange: document.querySelector("#lengthRange"),
  densityRange: document.querySelector("#densityRange"),
  curlRange: document.querySelector("#curlRange"),
  thicknessRange: document.querySelector("#thicknessRange"),
  liftRange: document.querySelector("#liftRange"),
  concealRange: document.querySelector("#concealRange"),
  lengthValue: document.querySelector("#lengthValue"),
  densityValue: document.querySelector("#densityValue"),
  curlValue: document.querySelector("#curlValue"),
  thicknessValue: document.querySelector("#thicknessValue"),
  liftValue: document.querySelector("#liftValue"),
  concealValue: document.querySelector("#concealValue"),
  resetBtn: document.querySelector("#resetBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  toggleBefore: document.querySelector("#toggleBefore"),
  emptyState: document.querySelector("#emptyState"),
  statusBadge: document.querySelector("#statusBadge"),
};

const ctx = els.canvas.getContext("2d");
const detectionCanvas = document.createElement("canvas");
const detectionCtx = detectionCanvas.getContext("2d", { willReadFrequently: true });
const MOBILE_IMAGE_DETECTION_INTERVAL = 110;
const MOBILE_IMAGE_DETECTION_MAX_SIDE = 640;
const MOBILE_RECOVERY_DETECTION_INTERVAL = 180;
const MOBILE_RECOVERY_DETECTION_MAX_SIDE = 720;

const state = {
  mode: "upload",
  faceLandmarker: null,
  modelReady: false,
  modelError: false,
  source: null,
  sourceType: null,
  stream: null,
  lastLandmarks: null,
  smoothedLandmarks: null,
  selectedStyle: lashStyles[0],
  customStyles: [],
  showBefore: false,
  controls: {
    length: 1,
    density: 1,
    curl: 1,
    thickness: 1,
    lift: 0,
    conceal: 1,
  },
  filters: {
    length: "all",
    curl: "all",
    thickness: "all",
    color: "all",
  },
  animationId: null,
  lastDetectionAt: 0,
  missCount: 0,
  cameraDetectionMode: "IMAGE",
};

async function init() {
  await loadCustomLashLibrary();
  renderFilterOptions();
  renderStyleCards();
  renderSelectedProduct();
  renderLibraryCards();
  bindEvents();
  drawEmptyCanvas();
  initModel();
  if (window.lucide) {
    window.lucide.createIcons();
  } else {
    window.addEventListener("load", () => window.lucide?.createIcons());
  }
}

async function initModel() {
  setStatus("正在加载眼部识别模型");
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "./vendor/mediapipe/tasks-vision/wasm",
    );
    state.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "./models/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numFaces: 1,
    });
    state.modelReady = true;
    setStatus("模型已就绪");
    await refreshDetectionAfterModelReady();
  } catch (error) {
    state.modelError = true;
    setStatus("模型未加载，仍可查看款式效果");
    console.error(error);
  }
}

async function refreshDetectionAfterModelReady() {
  if (!state.source) return;

  if (state.sourceType === "image") {
    await switchModelMode("IMAGE");
    await detectImage(state.source);
    redraw();
    return;
  }

  if (state.sourceType === "video" && state.stream) {
    await switchModelMode(state.cameraDetectionMode);
    redraw();
  }
}

function bindEvents() {
  els.photoInput.addEventListener("change", handlePhotoUpload);
  els.customLashInput.addEventListener("change", handleCustomLashUpload);
  els.uploadMode.addEventListener("click", () => setMode("upload"));
  els.cameraMode.addEventListener("click", () => setMode("camera"));
  els.startCamera.addEventListener("click", startCamera);
  els.captureFrame.addEventListener("click", captureFrame);
  els.lengthRange.addEventListener("input", updateControls);
  els.densityRange.addEventListener("input", updateControls);
  els.curlRange.addEventListener("input", updateControls);
  els.thicknessRange.addEventListener("input", updateControls);
  els.liftRange.addEventListener("input", updateControls);
  els.concealRange.addEventListener("input", updateControls);
  els.lengthFilter.addEventListener("change", updateFilters);
  els.curlFilter.addEventListener("change", updateFilters);
  els.thicknessFilter.addEventListener("change", updateFilters);
  els.colorFilter.addEventListener("change", updateFilters);
  els.clearFilters.addEventListener("click", clearCatalogFilters);
  els.toggleBefore.addEventListener("click", () => {
    state.showBefore = !state.showBefore;
    els.toggleBefore.classList.toggle("active", state.showBefore);
    redraw();
  });
  els.resetBtn.addEventListener("click", resetAdjustments);
  els.downloadBtn.addEventListener("click", downloadPreview);
  window.addEventListener("resize", redraw);
}

function setMode(mode) {
  state.mode = mode;
  els.uploadMode.classList.toggle("active", mode === "upload");
  els.cameraMode.classList.toggle("active", mode === "camera");
  els.cameraActions.classList.toggle("hidden", mode !== "camera");
  if (mode === "upload") {
    stopCamera();
  }
}

function renderFilterOptions() {
  fillFilter(els.lengthFilter, getUniqueValues("lengthMm"));
  fillFilter(els.curlFilter, getUniqueValues("curlGrade"));
  fillFilter(els.thicknessFilter, getUniqueValues("thicknessMm"));
  fillFilter(els.colorFilter, getUniqueValues("colorName"));
}

function fillFilter(select, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function getUniqueValues(key) {
  return [...new Set(lashStyles.map((style) => style[key]))].sort((a, b) =>
    String(a).localeCompare(String(b), "zh-CN", { numeric: true }),
  );
}

function updateFilters() {
  state.filters = {
    length: els.lengthFilter.value,
    curl: els.curlFilter.value,
    thickness: els.thicknessFilter.value,
    color: els.colorFilter.value,
  };
  renderStyleCards();
}

function clearCatalogFilters() {
  els.lengthFilter.value = "all";
  els.curlFilter.value = "all";
  els.thicknessFilter.value = "all";
  els.colorFilter.value = "all";
  updateFilters();
}

function renderStyleCards() {
  els.styleGrid.innerHTML = "";
  const visibleStyles = lashStyles.filter(matchesCatalogFilters);
  els.catalogCount.value = `${visibleStyles.length} / ${lashStyles.length} 款`;

  if (visibleStyles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "catalog-empty";
    empty.textContent = "没有匹配的款式，请调整筛选条件。";
    els.styleGrid.append(empty);
    return;
  }

  visibleStyles.forEach((style) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `lash-card ${style.id === state.selectedStyle.id ? "active" : ""}`;
    card.innerHTML = `
      <canvas class="lash-preview" width="220" height="58" aria-hidden="true"></canvas>
      <span class="lash-sku">${style.sku}</span>
      <strong>${style.name}</strong>
      <small>${style.series}</small>
      <div class="lash-meta">
        <span>${style.lengthMm}</span>
        <span>${style.curlGrade} 翘</span>
        <span>${style.thicknessMm}mm</span>
        <span class="color-chip" style="--chip-color: ${style.color}">${style.colorName}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      state.selectedStyle = style;
      renderStyleCards();
      renderSelectedProduct();
      renderLibraryCards();
      redraw();
    });
    els.styleGrid.append(card);
    drawLashSwatch(card.querySelector("canvas"), style);
  });
}

function matchesCatalogFilters(style) {
  return (
    (state.filters.length === "all" || style.lengthMm === state.filters.length) &&
    (state.filters.curl === "all" || style.curlGrade === state.filters.curl) &&
    (state.filters.thickness === "all" || style.thicknessMm === state.filters.thickness) &&
    (state.filters.color === "all" || style.colorName === state.filters.color)
  );
}

function renderSelectedProduct() {
  const style = state.selectedStyle;
  if (style.type === "image") {
    els.selectedProduct.innerHTML = `
      <span>当前选择</span>
      <strong>${escapeHtml(style.name)}</strong>
      <small>个人上传素材</small>
    `;
    return;
  }

  els.selectedProduct.innerHTML = `
    <span>当前选择</span>
    <strong>${style.name}</strong>
    <small>${style.sku} · ${style.series}</small>
    <div class="selected-specs">
      <span>${style.lengthMm}</span>
      <span>${style.curlGrade} 翘</span>
      <span>${style.thicknessMm}mm</span>
      <span class="color-chip" style="--chip-color: ${style.color}">${style.colorName}</span>
    </div>
  `;
}

function renderLibraryCards() {
  els.libraryGrid.innerHTML = "";
  els.libraryCount.value = `${state.customStyles.length} 款`;

  if (state.customStyles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "library-empty";
    empty.textContent = "还没有个人素材。上传透明 PNG 或 WebP 后，会自动加入这里。";
    els.libraryGrid.append(empty);
    return;
  }

  state.customStyles.forEach((style) => {
    const card = document.createElement("div");
    card.className = `library-card ${style.id === state.selectedStyle.id ? "active" : ""}`;
    const safeName = escapeHtml(style.name);
    card.innerHTML = `
      <button class="library-select" type="button">
        <canvas class="library-preview" width="172" height="76" aria-hidden="true"></canvas>
        <span class="library-name" title="${safeName}">${safeName}</span>
      </button>
      <button class="delete-lash" type="button" title="删除素材" aria-label="删除 ${safeName}">
        <i data-lucide="trash-2" aria-hidden="true"></i>
      </button>
    `;

    card.querySelector(".library-select").addEventListener("click", () => {
      state.selectedStyle = style;
      renderStyleCards();
      renderSelectedProduct();
      renderLibraryCards();
      redraw();
    });

    card.querySelector(".delete-lash").addEventListener("click", () => {
      deleteCustomStyle(style.id);
    });

    els.libraryGrid.append(card);
    drawImageLashSwatch(card.querySelector("canvas"), style.image);
  });

  window.lucide?.createIcons();
}

function drawLashSwatch(canvas, style) {
  const swatchCtx = canvas.getContext("2d");
  swatchCtx.clearRect(0, 0, canvas.width, canvas.height);
  const points = Array.from({ length: 9 }, (_, index) => ({
    x: 18 + index * 23,
    y: 36 - Math.sin((index / 8) * Math.PI) * 14,
  }));
  drawLashSet(swatchCtx, points, style, {
    length: 0.75,
    density: 0.85,
    curl: 1,
    thickness: 1,
    lift: 0,
    opacity: 1,
  });
}

function drawImageLashSwatch(canvas, image) {
  const swatchCtx = canvas.getContext("2d");
  swatchCtx.clearRect(0, 0, canvas.width, canvas.height);
  const width = canvas.width * 0.86;
  const height = Math.min(canvas.height * 0.78, width * (image.naturalHeight / image.naturalWidth));
  swatchCtx.drawImage(image, (canvas.width - width) / 2, canvas.height - height - 4, width, height);
}

function updateControls() {
  state.controls.length = Number(els.lengthRange.value) / 100;
  state.controls.density = Number(els.densityRange.value) / 100;
  state.controls.curl = Number(els.curlRange.value) / 100;
  state.controls.thickness = Number(els.thicknessRange.value) / 100;
  state.controls.lift = Number(els.liftRange.value);
  state.controls.conceal = Number(els.concealRange.value) / 100;
  els.lengthValue.value = `${els.lengthRange.value}%`;
  els.densityValue.value = `${els.densityRange.value}%`;
  els.curlValue.value = `${els.curlRange.value}%`;
  els.thicknessValue.value = `${els.thicknessRange.value}%`;
  els.liftValue.value = els.liftRange.value;
  els.concealValue.value = `${els.concealRange.value}%`;
  redraw();
}

function resetAdjustments() {
  els.lengthRange.value = 100;
  els.densityRange.value = 100;
  els.curlRange.value = 100;
  els.thicknessRange.value = 100;
  els.liftRange.value = 0;
  els.concealRange.value = 100;
  state.showBefore = false;
  els.toggleBefore.classList.remove("active");
  updateControls();
}

async function handlePhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  stopCamera();
  const image = new Image();
  image.decoding = "async";
  image.onload = async () => {
    state.source = image;
    state.sourceType = "image";
    fitCanvasToSource(image.naturalWidth, image.naturalHeight);
    els.emptyState.style.display = "none";
    els.downloadBtn.disabled = false;
    await detectImage(image);
    redraw();
  };
  image.src = URL.createObjectURL(file);
}

async function handleCustomLashUpload(event) {
  const files = Array.from(event.target.files ?? []);
  if (files.length === 0) return;

  try {
    const importedStyles = await Promise.all(files.map(importCustomLashFile));
    state.customStyles = [...importedStyles, ...state.customStyles];
    state.selectedStyle = importedStyles[0];
    saveCustomLashLibrary();
    renderStyleCards();
    renderSelectedProduct();
    renderLibraryCards();
    redraw();
    setStatus(`已加入 ${importedStyles.length} 款睫毛素材`);
  } catch (error) {
    setStatus("素材导入失败");
    console.error(error);
  } finally {
    event.target.value = "";
  }
}

async function importCustomLashFile(file) {
  const src = await readFileAsDataUrl(file);
  const image = await loadImage(src);
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name.replace(/\.[^.]+$/, "") || "我的款式",
    type: "image",
    src,
    image,
  };
}

async function loadCustomLashLibrary() {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
    console.error(error);
  }
  const loaded = await Promise.all(
    saved.map(async (item) => ({
      ...item,
      type: "image",
      image: await loadImage(item.src),
    })),
  );
  state.customStyles = loaded.filter((style) => style.image);
}

function saveCustomLashLibrary() {
  const items = state.customStyles.map(({ id, name, src }) => ({ id, name, src }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    setStatus("浏览器存储空间不足，素材只在本次打开期间可用");
    console.error(error);
  }
}

function deleteCustomStyle(id) {
  state.customStyles = state.customStyles.filter((style) => style.id !== id);
  if (state.selectedStyle.id === id) {
    state.selectedStyle = lashStyles[0];
  }
  saveCustomLashLibrary();
  renderStyleCards();
  renderSelectedProduct();
  renderLibraryCards();
  redraw();
  setStatus("已删除素材");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function detectImage(image) {
  if (!state.modelReady) {
    state.lastLandmarks = null;
    setStatus(state.modelError ? "模型未加载，显示示意贴合" : "模型加载中");
    return;
  }
  const result = state.faceLandmarker.detect(image);
  state.lastLandmarks = result.faceLandmarks?.[0] ?? null;
  setStatus(state.lastLandmarks ? "已识别眼部位置" : "未识别到人脸");
}

async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 960 },
      },
      audio: false,
    });
    els.video.srcObject = state.stream;
    await els.video.play();
    await waitForVideoFrame();
    els.captureFrame.disabled = false;
    els.emptyState.style.display = "none";
    els.downloadBtn.disabled = false;
    state.source = els.video;
    state.sourceType = "video";
    fitCanvasToSource(els.video.videoWidth, els.video.videoHeight);
    state.cameraDetectionMode = "IMAGE";
    await switchModelMode(state.cameraDetectionMode);
    cameraLoop();
  } catch (error) {
    setStatus("无法打开摄像头");
    console.error(error);
  }
}

function stopCamera() {
  cancelAnimationFrame(state.animationId);
  state.animationId = null;
  state.lastDetectionAt = 0;
  state.missCount = 0;
  state.smoothedLandmarks = null;
  state.cameraDetectionMode = "IMAGE";
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  els.captureFrame.disabled = true;
}

async function switchModelMode(runningMode) {
  if (!state.modelReady) return;
  await state.faceLandmarker.setOptions({ runningMode });
}

function cameraLoop() {
  if (!state.stream) return;

  syncCanvasToVideo();

  const now = performance.now();
  if (
    state.modelReady &&
    els.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    now - state.lastDetectionAt > getCameraDetectionInterval()
  ) {
    detectCameraFrame(now);
  }

  redraw();
  setStatus(getCameraStatus());
  state.animationId = requestAnimationFrame(cameraLoop);
}

function detectCameraFrame(now) {
  if (state.cameraDetectionMode === "IMAGE") {
    detectCameraFrameAsImage(now);
    return;
  }

  try {
    const result = state.faceLandmarker.detectForVideo(els.video, now);
    updateCameraLandmarks(result.faceLandmarks?.[0] ?? null);
    state.lastDetectionAt = now;
  } catch (error) {
    state.lastLandmarks = null;
    state.smoothedLandmarks = null;
    state.missCount += 1;
    state.lastDetectionAt = now;
    console.error(error);
  }
}

function detectCameraFrameAsImage(now) {
  try {
    const maxSide =
      state.missCount > 8 ? MOBILE_RECOVERY_DETECTION_MAX_SIDE : MOBILE_IMAGE_DETECTION_MAX_SIDE;
    const ratio = Math.min(1, maxSide / Math.max(els.video.videoWidth, els.video.videoHeight));
    const width = Math.max(1, Math.round(els.video.videoWidth * ratio));
    const height = Math.max(1, Math.round(els.video.videoHeight * ratio));

    if (detectionCanvas.width !== width || detectionCanvas.height !== height) {
      detectionCanvas.width = width;
      detectionCanvas.height = height;
    }

    detectionCtx.drawImage(els.video, 0, 0, width, height);
    const result = state.faceLandmarker.detect(detectionCanvas);
    updateCameraLandmarks(result.faceLandmarks?.[0] ?? null);
    state.lastDetectionAt = now;
  } catch (error) {
    state.lastLandmarks = null;
    state.smoothedLandmarks = null;
    state.missCount += 1;
    state.lastDetectionAt = now;
    console.error(error);
  }
}

function getCameraDetectionInterval() {
  if (state.cameraDetectionMode !== "IMAGE") return 80;
  return state.missCount > 8 ? MOBILE_RECOVERY_DETECTION_INTERVAL : MOBILE_IMAGE_DETECTION_INTERVAL;
}

function updateCameraLandmarks(nextLandmarks) {
  if (!nextLandmarks) {
    state.missCount += 1;
    if (state.missCount > 5) {
      state.lastLandmarks = null;
      state.smoothedLandmarks = null;
    }
    return;
  }

  state.smoothedLandmarks = smoothLandmarks(state.smoothedLandmarks, nextLandmarks);
  state.lastLandmarks = state.smoothedLandmarks;
  state.missCount = 0;
}

function smoothLandmarks(previous, next) {
  if (!previous || previous.length !== next.length) return next.map((point) => ({ ...point }));

  const movement = getAverageLandmarkMovement(previous, next);
  const alpha = movement > 0.018 ? 0.82 : 0.62;

  return next.map((point, index) => ({
    x: previous[index].x + (point.x - previous[index].x) * alpha,
    y: previous[index].y + (point.y - previous[index].y) * alpha,
    z:
      (previous[index].z ?? 0) +
      ((point.z ?? 0) - (previous[index].z ?? 0)) * alpha,
    visibility: point.visibility,
  }));
}

function getAverageLandmarkMovement(previous, next) {
  let total = 0;
  for (let index = 0; index < next.length; index += 1) {
    total += Math.hypot(next[index].x - previous[index].x, next[index].y - previous[index].y);
  }
  return total / next.length;
}

function getCameraStatus() {
  if (state.lastLandmarks) return "实时试戴中";
  if (!state.modelReady) return "模型加载中";
  if (state.missCount > 12) return "未识别到人脸，请靠近并正对镜头";
  return "正在识别人脸";
}

function waitForVideoFrame() {
  if (els.video.videoWidth && els.video.videoHeight) return Promise.resolve();

  return new Promise((resolve) => {
    const handleLoadedMetadata = () => {
      els.video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      resolve();
    };
    els.video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
  });
}

function syncCanvasToVideo() {
  if (state.sourceType !== "video" || !els.video.videoWidth || !els.video.videoHeight) return;

  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(els.video.videoWidth, els.video.videoHeight));
  const width = Math.round(els.video.videoWidth * ratio);
  const height = Math.round(els.video.videoHeight * ratio);

  if (els.canvas.width !== width || els.canvas.height !== height) {
    els.canvas.width = width;
    els.canvas.height = height;
  }
}

async function captureFrame() {
  if (!state.source || state.sourceType !== "video") return;
  const frame = document.createElement("canvas");
  frame.width = els.video.videoWidth;
  frame.height = els.video.videoHeight;
  frame.getContext("2d").drawImage(els.video, 0, 0, frame.width, frame.height);

  const image = new Image();
  image.onload = async () => {
    stopCamera();
    state.source = image;
    state.sourceType = "image";
    fitCanvasToSource(image.naturalWidth, image.naturalHeight);
    await switchModelMode("IMAGE");
    await detectImage(image);
    redraw();
  };
  image.src = frame.toDataURL("image/png");
}

function fitCanvasToSource(width, height) {
  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(width, height));
  els.canvas.width = Math.round(width * ratio);
  els.canvas.height = Math.round(height * ratio);
}

function redraw() {
  if (!state.source) {
    drawEmptyCanvas();
    return;
  }
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.drawImage(state.source, 0, 0, els.canvas.width, els.canvas.height);
  if (state.showBefore) return;

  const eyes = getEyeCurves();
  if (!eyes) return;
  concealNaturalLashes(ctx, eyes.left, state.controls);
  concealNaturalLashes(ctx, eyes.right, state.controls);
  if (state.selectedStyle.type === "image") {
    drawImageLashSet(ctx, eyes.left, state.selectedStyle.image, state.controls, false);
    drawImageLashSet(ctx, eyes.right, state.selectedStyle.image, state.controls, true);
  } else {
    drawLashSet(ctx, eyes.left, state.selectedStyle, state.controls);
    drawLashSet(ctx, eyes.right, state.selectedStyle, state.controls);
  }
}

function drawEmptyCanvas() {
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, els.canvas.width, els.canvas.height);
  gradient.addColorStop(0, "#172123");
  gradient.addColorStop(1, "#263436");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);
}

function getEyeCurves() {
  if (!state.lastLandmarks) {
    if (!state.source) return null;
    if (state.sourceType === "video") return null;
    return fallbackEyes();
  }

  return {
    left: eyeIndexes.left.map((index) => scalePoint(state.lastLandmarks[index])),
    right: eyeIndexes.right.map((index) => scalePoint(state.lastLandmarks[index])),
  };
}

function fallbackEyes() {
  const w = els.canvas.width;
  const h = els.canvas.height;
  return {
    left: makeFallbackEye(w * 0.34, h * 0.42, w * 0.17),
    right: makeFallbackEye(w * 0.66, h * 0.42, w * 0.17),
  };
}

function makeFallbackEye(centerX, centerY, width) {
  return Array.from({ length: 9 }, (_, index) => {
    const t = index / 8;
    return {
      x: centerX - width / 2 + t * width,
      y: centerY - Math.sin(t * Math.PI) * width * 0.17,
    };
  });
}

function scalePoint(point) {
  return {
    x: point.x * els.canvas.width,
    y: point.y * els.canvas.height,
  };
}

function concealNaturalLashes(targetCtx, points, controls) {
  if (controls.conceal <= 0) return;

  const ordered = [...points].sort((a, b) => a.x - b.x);
  const start = ordered[0];
  const end = ordered[ordered.length - 1];
  const eyeWidth = Math.hypot(end.x - start.x, end.y - start.y);
  const coverWidth = Math.max(12, eyeWidth * 0.11) * controls.conceal;
  const lift = Math.max(7, eyeWidth * 0.052);
  const skinColor = sampleSkinColor(ordered, eyeWidth);

  targetCtx.save();
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.filter = `blur(${Math.max(2.5, eyeWidth * 0.014)}px)`;
  targetCtx.globalAlpha = Math.min(0.96, 0.76 + controls.conceal * 0.18);
  targetCtx.strokeStyle = skinColor;
  targetCtx.lineWidth = coverWidth;
  drawOffsetEyeStroke(targetCtx, ordered, -lift);
  targetCtx.globalAlpha = Math.min(0.72, 0.38 + controls.conceal * 0.2);
  targetCtx.lineWidth = coverWidth * 0.72;
  drawOffsetEyeStroke(targetCtx, ordered, -lift * 1.7);
  targetCtx.restore();

  targetCtx.save();
  targetCtx.globalAlpha = Math.min(0.42, 0.18 + controls.conceal * 0.12);
  targetCtx.strokeStyle = skinColor;
  targetCtx.lineWidth = Math.max(3, eyeWidth * 0.025);
  drawOffsetEyeStroke(targetCtx, ordered, -lift * 0.28);
  targetCtx.restore();
}

function drawOffsetEyeStroke(targetCtx, points, yOffset) {
  targetCtx.beginPath();
  points.forEach((point, index) => {
    const x = point.x;
    const y = point.y + yOffset;
    if (index === 0) {
      targetCtx.moveTo(x, y);
    } else {
      const previous = points[index - 1];
      targetCtx.quadraticCurveTo(previous.x, previous.y + yOffset, x, y);
    }
  });
  targetCtx.stroke();
}

function sampleSkinColor(points, eyeWidth) {
  const samples = [];
  const sampleRadius = Math.max(3, Math.round(eyeWidth * 0.025));
  const yOffsets = [eyeWidth * 0.08, eyeWidth * 0.12, -eyeWidth * 0.16];

  for (let index = 1; index < points.length - 1; index += 1) {
    for (const offset of yOffsets) {
      const x = Math.round(points[index].x);
      const y = Math.round(points[index].y + offset);
      if (
        x - sampleRadius < 0 ||
        y - sampleRadius < 0 ||
        x + sampleRadius >= els.canvas.width ||
        y + sampleRadius >= els.canvas.height
      ) {
        continue;
      }

      const { data } = ctx.getImageData(
        x - sampleRadius,
        y - sampleRadius,
        sampleRadius * 2 + 1,
        sampleRadius * 2 + 1,
      );
      for (let pixel = 0; pixel < data.length; pixel += 4) {
        const red = data[pixel];
        const green = data[pixel + 1];
        const blue = data[pixel + 2];
        const luma = red * 0.299 + green * 0.587 + blue * 0.114;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const saturation = max === 0 ? 0 : (max - min) / max;
        if (luma > 58 && luma < 235 && saturation < 0.55) {
          samples.push([red, green, blue]);
        }
      }
    }
  }

  if (samples.length === 0) return "rgba(218, 190, 170, 0.86)";

  samples.sort((a, b) => getLuma(a) - getLuma(b));
  const middle = samples.slice(Math.floor(samples.length * 0.25), Math.ceil(samples.length * 0.75));
  const sum = middle.reduce(
    (acc, color) => {
      acc[0] += color[0];
      acc[1] += color[1];
      acc[2] += color[2];
      return acc;
    },
    [0, 0, 0],
  );
  const count = middle.length || 1;
  return `rgba(${Math.round(sum[0] / count)}, ${Math.round(sum[1] / count)}, ${Math.round(
    sum[2] / count,
  )}, 0.9)`;
}

function getLuma([red, green, blue]) {
  return red * 0.299 + green * 0.587 + blue * 0.114;
}

function drawImageLashSet(targetCtx, points, image, controls, mirror) {
  const ordered = [...points].sort((a, b) => a.x - b.x);
  const lifted = ordered.map((point) => ({ ...point, y: point.y + controls.lift }));
  const start = lifted[0];
  const end = lifted[lifted.length - 1];
  const center = pointAt(lifted, 0.5);
  const eyeWidth = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const renderWidth = eyeWidth * 1.45 * controls.length;
  const aspect = image.naturalHeight / image.naturalWidth;
  const renderHeight =
    renderWidth * aspect * (0.7 + controls.density * 0.18 + controls.curl * 0.12);

  targetCtx.save();
  targetCtx.translate(center.x, center.y - renderHeight * 0.42);
  targetCtx.rotate(angle);
  targetCtx.globalAlpha = Math.min(1, 0.72 + controls.density * 0.2);
  targetCtx.scale(mirror ? -1 : 1, 1);
  targetCtx.drawImage(image, -renderWidth / 2, -renderHeight / 2, renderWidth, renderHeight);
  targetCtx.restore();
}

function drawLashSet(targetCtx, points, style, controls) {
  const ordered = [...points].sort((a, b) => a.x - b.x);
  const lifted = ordered.map((point) => ({ ...point, y: point.y + controls.lift }));
  const totalWidth = lifted[lifted.length - 1].x - lifted[0].x;
  const spikeCount = Math.max(8, Math.round(style.spikes * controls.density));

  targetCtx.save();
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.globalAlpha = controls.opacity ?? 0.92;

  drawBaseLine(targetCtx, lifted, style, controls);

  for (let index = 0; index < spikeCount; index += 1) {
    const t = spikeCount === 1 ? 0.5 : index / (spikeCount - 1);
    const base = pointAt(lifted, t);
    const tangent = tangentAt(lifted, t);
    const normal = normalize({ x: -tangent.y, y: tangent.x });
    const outward = normal.y > 0 ? { x: -normal.x, y: -normal.y } : normal;
    const edgeBoost = style.fan * (0.6 + Math.abs(t - 0.5) * 0.72);
    const centerBoost = 1 + Math.sin(t * Math.PI) * style.curve;
    const curl = style.curve * controls.curl;
    const length = totalWidth * style.length * 0.18 * controls.length * edgeBoost * centerBoost;
    const lean = (t - 0.5) * totalWidth * 0.055 * style.fan;
    const tip = {
      x: base.x + outward.x * length + lean,
      y: base.y + outward.y * length - length * (0.4 + curl * 0.55),
    };

    targetCtx.strokeStyle = style.color;
    targetCtx.lineWidth = style.thickness * controls.thickness * (0.85 + controls.density * 0.35);
    drawCurvedLash(targetCtx, base, tip, tangent, curl);

    if (style.id.includes("volume") && index % 2 === 0) {
      const sideTip = {
        x: tip.x + tangent.x * totalWidth * 0.018,
        y: tip.y + tangent.y * totalWidth * 0.018,
      };
      targetCtx.globalAlpha = 0.55;
      targetCtx.lineWidth = style.thickness * controls.thickness * 0.72;
      drawCurvedLash(targetCtx, base, sideTip, tangent, curl * 0.8);
      targetCtx.globalAlpha = controls.opacity ?? 0.92;
    }
  }

  targetCtx.restore();
}

function drawBaseLine(targetCtx, points, style, controls) {
  targetCtx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      targetCtx.moveTo(point.x, point.y);
    } else {
      const previous = points[index - 1];
      targetCtx.quadraticCurveTo(previous.x, previous.y, point.x, point.y);
    }
  });
  targetCtx.strokeStyle = style.color;
  targetCtx.lineWidth = Math.max(1, style.thickness * controls.thickness * 1.15);
  targetCtx.globalAlpha = 0.72;
  targetCtx.stroke();
  targetCtx.globalAlpha = 0.92;
}

function drawCurvedLash(targetCtx, base, tip, tangent, curve) {
  const control = {
    x: base.x + (tip.x - base.x) * 0.45 + tangent.x * 12 * curve,
    y: base.y + (tip.y - base.y) * 0.35 - 10 * curve,
  };
  targetCtx.beginPath();
  targetCtx.moveTo(base.x, base.y);
  targetCtx.quadraticCurveTo(control.x, control.y, tip.x, tip.y);
  targetCtx.stroke();
}

function pointAt(points, t) {
  const scaled = t * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const localT = scaled - index;
  return lerpPoint(points[index], points[index + 1], localT);
}

function tangentAt(points, t) {
  const delta = 0.02;
  const a = pointAt(points, Math.max(0, t - delta));
  const b = pointAt(points, Math.min(1, t + delta));
  return normalize({ x: b.x - a.x, y: b.y - a.y });
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function downloadPreview() {
  const link = document.createElement("a");
  link.href = els.canvas.toDataURL("image/png");
  link.download = "lash-try-on-preview.png";
  link.click();
}

function setStatus(message) {
  els.statusBadge.textContent = message;
}

init();
