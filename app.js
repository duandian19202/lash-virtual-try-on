import {
  FaceLandmarker,
  FilesetResolver,
} from "./vendor/mediapipe/tasks-vision/vision_bundle.mjs";

const MANUFACTURER_LIBRARY_URL = "./lash-library/catalog.json";
const STORAGE_KEY = "lash-studio-library-v1";
let lashStyles = [];

const eyeIndexes = {
  left: [33, 246, 161, 160, 159, 158, 157, 173, 133],
  right: [362, 398, 384, 385, 386, 387, 388, 466, 263],
};

const els = {
  canvas: document.querySelector("#canvas"),
  eyeZoomCanvas: document.querySelector("#eyeZoomCanvas"),
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
  leftXRange: document.querySelector("#leftXRange"),
  leftYRange: document.querySelector("#leftYRange"),
  leftScaleRange: document.querySelector("#leftScaleRange"),
  leftRotateRange: document.querySelector("#leftRotateRange"),
  rightXRange: document.querySelector("#rightXRange"),
  rightYRange: document.querySelector("#rightYRange"),
  rightScaleRange: document.querySelector("#rightScaleRange"),
  rightRotateRange: document.querySelector("#rightRotateRange"),
  lashOpacityRange: document.querySelector("#lashOpacityRange"),
  rootBlendRange: document.querySelector("#rootBlendRange"),
  shadowRange: document.querySelector("#shadowRange"),
  concealSoftnessRange: document.querySelector("#concealSoftnessRange"),
  lengthValue: document.querySelector("#lengthValue"),
  densityValue: document.querySelector("#densityValue"),
  curlValue: document.querySelector("#curlValue"),
  thicknessValue: document.querySelector("#thicknessValue"),
  liftValue: document.querySelector("#liftValue"),
  concealValue: document.querySelector("#concealValue"),
  leftXValue: document.querySelector("#leftXValue"),
  leftYValue: document.querySelector("#leftYValue"),
  leftScaleValue: document.querySelector("#leftScaleValue"),
  leftRotateValue: document.querySelector("#leftRotateValue"),
  rightXValue: document.querySelector("#rightXValue"),
  rightYValue: document.querySelector("#rightYValue"),
  rightScaleValue: document.querySelector("#rightScaleValue"),
  rightRotateValue: document.querySelector("#rightRotateValue"),
  lashOpacityValue: document.querySelector("#lashOpacityValue"),
  rootBlendValue: document.querySelector("#rootBlendValue"),
  shadowValue: document.querySelector("#shadowValue"),
  concealSoftnessValue: document.querySelector("#concealSoftnessValue"),
  resetBtn: document.querySelector("#resetBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  toggleBefore: document.querySelector("#toggleBefore"),
  emptyState: document.querySelector("#emptyState"),
  statusBadge: document.querySelector("#statusBadge"),
};

const ctx = els.canvas.getContext("2d");
const zoomCtx = els.eyeZoomCanvas.getContext("2d");
const detectionCanvas = document.createElement("canvas");
const detectionCtx = detectionCanvas.getContext("2d", { willReadFrequently: true });
const MOBILE_IMAGE_DETECTION_INTERVAL = 110;
const MOBILE_IMAGE_DETECTION_MAX_SIDE = 640;
const MOBILE_RECOVERY_DETECTION_INTERVAL = 180;
const MOBILE_RECOVERY_DETECTION_MAX_SIDE = 720;
const MAX_RENDER_FIBERS_PER_EYE = 64;

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
  selectedStyle: null,
  customStyles: [],
  showBefore: false,
  controls: {
    length: 1,
    density: 1,
    curl: 1,
    thickness: 1,
    lift: 0,
    conceal: 1,
    concealSoftness: 1,
    lashOpacity: 0.92,
    rootBlend: 0.55,
    shadow: 0.35,
    eyeAdjustments: {
      left: { x: 0, y: 0, scale: 1, rotate: 0 },
      right: { x: 0, y: 0, scale: 1, rotate: 0 },
    },
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
  await loadManufacturerLashLibrary();
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

async function loadManufacturerLashLibrary() {
  try {
    const response = await fetch(MANUFACTURER_LIBRARY_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${MANUFACTURER_LIBRARY_URL}: ${response.status}`);
    }
    const catalog = await response.json();
    lashStyles = await hydrateManufacturerAssets(normalizeManufacturerCatalog(catalog));
    state.selectedStyle = lashStyles[0] ?? null;
  } catch (error) {
    lashStyles = [];
    state.selectedStyle = null;
    setStatus("厂家睫毛库加载失败");
    console.error(error);
  }
}

function normalizeManufacturerCatalog(catalog) {
  const products = Array.isArray(catalog) ? catalog : catalog.products;
  if (!Array.isArray(products)) return [];

  return products.map((product) => ({
    ...product,
    name: product.name ?? product.nameZh,
    curlGrade: product.curlGrade ?? product.curl,
    spikes: Number(product.spikes ?? 24),
    length: Number(product.render?.length ?? product.length ?? 0.52),
    curve: Number(product.render?.curve ?? product.curve ?? 0.34),
    thickness: Number(product.render?.thickness ?? product.thickness ?? 1.25),
    fan: Number(product.render?.fan ?? product.fan ?? 1),
  }));
}

async function hydrateManufacturerAssets(styles) {
  return Promise.all(
    styles.map(async (style) => {
      if (!style.asset) return style;

      try {
        const image = await loadImage(resolveLibraryAssetUrl(style.asset));
        return {
          ...style,
          assetImage: image,
          renderMode: "asset",
        };
      } catch {
        return {
          ...style,
          renderMode: "asset-missing",
        };
      }
    }),
  );
}

function resolveLibraryAssetUrl(assetPath) {
  if (/^(https?:|data:|blob:)/.test(assetPath)) return assetPath;
  return `./lash-library/${assetPath.replace(/^\.?\//, "")}`;
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
  els.leftXRange?.addEventListener("input", updateControls);
  els.leftYRange?.addEventListener("input", updateControls);
  els.leftScaleRange?.addEventListener("input", updateControls);
  els.leftRotateRange?.addEventListener("input", updateControls);
  els.rightXRange?.addEventListener("input", updateControls);
  els.rightYRange?.addEventListener("input", updateControls);
  els.rightScaleRange?.addEventListener("input", updateControls);
  els.rightRotateRange?.addEventListener("input", updateControls);
  els.lashOpacityRange.addEventListener("input", updateControls);
  els.rootBlendRange.addEventListener("input", updateControls);
  els.shadowRange.addEventListener("input", updateControls);
  els.concealSoftnessRange.addEventListener("input", updateControls);
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
      if (!style.assetImage) {
        setStatus(`缺少真实素材：${style.asset}`);
      }
      renderStyleCards();
      renderSelectedProduct();
      renderLibraryCards();
      redraw();
    });
    els.styleGrid.append(card);
    if (style.assetImage) {
      drawImageLashSwatch(card.querySelector("canvas"), style.assetImage);
    } else {
      drawMissingAssetSwatch(card.querySelector("canvas"));
    }
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
  if (!style) {
    els.selectedProduct.innerHTML = `
      <span>当前选择</span>
      <strong>未载入款式</strong>
      <small>请检查 lash-library/catalog.json</small>
    `;
    return;
  }

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
    <small>${style.sku} · ${style.series}${style.assetImage ? " · 真实素材" : " · 缺少真实素材"}</small>
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

function drawMissingAssetSwatch(canvas) {
  const swatchCtx = canvas.getContext("2d");
  swatchCtx.clearRect(0, 0, canvas.width, canvas.height);
  swatchCtx.fillStyle = "#f4f6f3";
  swatchCtx.fillRect(0, 0, canvas.width, canvas.height);
  swatchCtx.strokeStyle = "#cfd6d2";
  swatchCtx.setLineDash([6, 5]);
  swatchCtx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  swatchCtx.setLineDash([]);
  swatchCtx.fillStyle = "#68737a";
  swatchCtx.font = "700 20px system-ui, sans-serif";
  swatchCtx.textAlign = "center";
  swatchCtx.textBaseline = "middle";
  swatchCtx.fillText("待上传真实素材", canvas.width / 2, canvas.height / 2);
}

function updateControls() {
  state.controls.length = Number(els.lengthRange.value) / 100;
  state.controls.density = Number(els.densityRange.value) / 100;
  state.controls.curl = Number(els.curlRange.value) / 100;
  state.controls.thickness = Number(els.thicknessRange.value) / 100;
  state.controls.lift = Number(els.liftRange.value);
  state.controls.conceal = Number(els.concealRange.value) / 100;
  state.controls.concealSoftness = Number(els.concealSoftnessRange.value) / 100;
  state.controls.lashOpacity = Number(els.lashOpacityRange.value) / 100;
  state.controls.rootBlend = Number(els.rootBlendRange.value) / 100;
  state.controls.shadow = Number(els.shadowRange.value) / 100;
  state.controls.eyeAdjustments.left = {
    x: Number(els.leftXRange?.value ?? 0),
    y: Number(els.leftYRange?.value ?? 0),
    scale: Number(els.leftScaleRange?.value ?? 100) / 100,
    rotate: Number(els.leftRotateRange?.value ?? 0),
  };
  state.controls.eyeAdjustments.right = {
    x: Number(els.rightXRange?.value ?? 0),
    y: Number(els.rightYRange?.value ?? 0),
    scale: Number(els.rightScaleRange?.value ?? 100) / 100,
    rotate: Number(els.rightRotateRange?.value ?? 0),
  };
  els.lengthValue.value = `${els.lengthRange.value}%`;
  els.densityValue.value = `${els.densityRange.value}%`;
  els.curlValue.value = `${els.curlRange.value}%`;
  els.thicknessValue.value = `${els.thicknessRange.value}%`;
  els.liftValue.value = els.liftRange.value;
  els.concealValue.value = `${els.concealRange.value}%`;
  els.concealSoftnessValue.value = `${els.concealSoftnessRange.value}%`;
  els.lashOpacityValue.value = `${els.lashOpacityRange.value}%`;
  els.rootBlendValue.value = `${els.rootBlendRange.value}%`;
  els.shadowValue.value = `${els.shadowRange.value}%`;
  if (els.leftXValue) els.leftXValue.value = els.leftXRange?.value ?? 0;
  if (els.leftYValue) els.leftYValue.value = els.leftYRange?.value ?? 0;
  if (els.leftScaleValue) els.leftScaleValue.value = `${els.leftScaleRange?.value ?? 100}%`;
  if (els.leftRotateValue) els.leftRotateValue.value = `${els.leftRotateRange?.value ?? 0}°`;
  if (els.rightXValue) els.rightXValue.value = els.rightXRange?.value ?? 0;
  if (els.rightYValue) els.rightYValue.value = els.rightYRange?.value ?? 0;
  if (els.rightScaleValue) els.rightScaleValue.value = `${els.rightScaleRange?.value ?? 100}%`;
  if (els.rightRotateValue) els.rightRotateValue.value = `${els.rightRotateRange?.value ?? 0}°`;
  redraw();
}

function resetAdjustments() {
  els.lengthRange.value = 100;
  els.densityRange.value = 100;
  els.curlRange.value = 100;
  els.thicknessRange.value = 100;
  els.liftRange.value = 0;
  els.concealRange.value = 100;
  els.concealSoftnessRange.value = 100;
  els.lashOpacityRange.value = 92;
  els.rootBlendRange.value = 55;
  els.shadowRange.value = 35;
  if (els.leftXRange) els.leftXRange.value = 0;
  if (els.leftYRange) els.leftYRange.value = 0;
  if (els.leftScaleRange) els.leftScaleRange.value = 100;
  if (els.leftRotateRange) els.leftRotateRange.value = 0;
  if (els.rightXRange) els.rightXRange.value = 0;
  if (els.rightYRange) els.rightYRange.value = 0;
  if (els.rightScaleRange) els.rightScaleRange.value = 100;
  if (els.rightRotateRange) els.rightRotateRange.value = 0;
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
  if (state.selectedStyle?.id === id) {
    state.selectedStyle = lashStyles[0] ?? null;
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
    drawEmptyEyeCloseup("等待图片");
    return;
  }
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.drawImage(state.source, 0, 0, els.canvas.width, els.canvas.height);

  const eyes = getEyeCurves();
  if (state.showBefore) {
    if (eyes) {
      updateEyeCloseup(eyes);
    } else {
      drawEmptyEyeCloseup("等待识别眼部");
    }
    return;
  }

  if (!eyes || !state.selectedStyle) {
    drawEmptyEyeCloseup("等待识别眼部");
    return;
  }

  concealNaturalLashes(ctx, eyes.left, state.controls);
  concealNaturalLashes(ctx, eyes.right, state.controls);
  const adjustedEyes = {
    left: adjustEyeCurve(eyes.left, state.controls.eyeAdjustments.left),
    right: adjustEyeCurve(eyes.right, state.controls.eyeAdjustments.right),
  };
  if (state.selectedStyle.type === "image") {
    drawImageLashSet(ctx, adjustedEyes.left, state.selectedStyle.image, state.controls, false);
    drawImageLashSet(ctx, adjustedEyes.right, state.selectedStyle.image, state.controls, true);
  } else if (state.selectedStyle.assetImage) {
    drawImageLashSet(ctx, adjustedEyes.left, state.selectedStyle.assetImage, state.controls, false);
    drawImageLashSet(ctx, adjustedEyes.right, state.selectedStyle.assetImage, state.controls, true);
  } else {
    setStatus(`缺少真实素材：${state.selectedStyle.asset}`);
  }

  updateEyeCloseup(adjustedEyes);
}

function drawEmptyCanvas() {
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, els.canvas.width, els.canvas.height);
  gradient.addColorStop(0, "#172123");
  gradient.addColorStop(1, "#263436");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);
}

function drawEmptyEyeCloseup(message) {
  zoomCtx.clearRect(0, 0, els.eyeZoomCanvas.width, els.eyeZoomCanvas.height);
  const gradient = zoomCtx.createLinearGradient(0, 0, els.eyeZoomCanvas.width, els.eyeZoomCanvas.height);
  gradient.addColorStop(0, "#101517");
  gradient.addColorStop(1, "#1d292b");
  zoomCtx.fillStyle = gradient;
  zoomCtx.fillRect(0, 0, els.eyeZoomCanvas.width, els.eyeZoomCanvas.height);
  zoomCtx.fillStyle = "rgba(255, 255, 255, 0.78)";
  zoomCtx.font = "700 34px system-ui, sans-serif";
  zoomCtx.textAlign = "center";
  zoomCtx.textBaseline = "middle";
  zoomCtx.fillText(message, els.eyeZoomCanvas.width / 2, els.eyeZoomCanvas.height / 2);
}

function updateEyeCloseup(eyes) {
  const crop = getEyeCrop(eyes);
  if (!crop) {
    drawEmptyEyeCloseup("等待识别眼部");
    return;
  }

  zoomCtx.clearRect(0, 0, els.eyeZoomCanvas.width, els.eyeZoomCanvas.height);
  zoomCtx.fillStyle = "#101517";
  zoomCtx.fillRect(0, 0, els.eyeZoomCanvas.width, els.eyeZoomCanvas.height);
  zoomCtx.imageSmoothingEnabled = true;
  zoomCtx.imageSmoothingQuality = "high";
  zoomCtx.drawImage(
    els.canvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    els.eyeZoomCanvas.width,
    els.eyeZoomCanvas.height,
  );
}

function getEyeCrop(eyes) {
  const focusEye = getFocusEyeForCloseup(eyes);
  if (!focusEye) return null;

  const points = [...focusEye];
  const sorted = [...focusEye].sort((a, b) => a.x - b.x);
  const eyeCenter = pointAt(sorted, 0.5);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const eyeWidth = Math.max(1, maxX - minX);
  const eyeHeight = Math.max(1, maxY - minY);
  const cropSize = Math.min(
    Math.max(eyeWidth * 2.45, eyeHeight * 7.2, els.canvas.width * 0.085),
    Math.min(els.canvas.width, els.canvas.height) * 0.28,
  );
  const x = eyeCenter.x - cropSize * 0.46;
  const y = eyeCenter.y - cropSize * 0.34;

  return clampSquareCrop(x, y, cropSize);
}

function getFocusEyeForCloseup(eyes) {
  if (!eyes?.left?.length && !eyes?.right?.length) return null;
  if (!eyes?.left?.length) return eyes.right;
  if (!eyes?.right?.length) return eyes.left;
  return eyes.left;
}

function clampSquareCrop(x, y, size) {
  const safeSize = Math.min(size, els.canvas.width, els.canvas.height);
  return {
    x: Math.max(0, Math.min(x, els.canvas.width - safeSize)),
    y: Math.max(0, Math.min(y, els.canvas.height - safeSize)),
    width: safeSize,
    height: safeSize,
  };
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

function adjustEyeCurve(points, adjustment) {
  if (!adjustment) return points;
  const center = pointAt([...points].sort((a, b) => a.x - b.x), 0.5);
  const rotation = (adjustment.rotate * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return points.map((point) => {
    const dx = (point.x - center.x) * adjustment.scale;
    const dy = (point.y - center.y) * adjustment.scale;
    return {
      x: center.x + dx * cos - dy * sin + adjustment.x,
      y: center.y + dx * sin + dy * cos + adjustment.y,
    };
  });
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
  const softness = controls.concealSoftness ?? 1;

  targetCtx.save();
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.filter = `blur(${Math.max(2.5, eyeWidth * 0.014 * softness)}px)`;
  targetCtx.globalAlpha = Math.min(0.94, 0.66 + controls.conceal * 0.17);
  targetCtx.strokeStyle = skinColor;
  targetCtx.lineWidth = coverWidth;
  drawOffsetEyeStroke(targetCtx, ordered, -lift);
  targetCtx.globalAlpha = Math.min(0.68, 0.34 + controls.conceal * 0.18);
  targetCtx.lineWidth = coverWidth * (0.62 + softness * 0.12);
  drawOffsetEyeStroke(targetCtx, ordered, -lift * 1.7);
  targetCtx.restore();

  targetCtx.save();
  targetCtx.globalAlpha = Math.min(0.36, 0.14 + controls.conceal * 0.1);
  targetCtx.strokeStyle = skinColor;
  targetCtx.lineWidth = Math.max(3, eyeWidth * 0.022 * softness);
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
  const rootBlend = controls.rootBlend ?? 0.55;
  const shadow = controls.shadow ?? 0.35;
  const opacity = controls.lashOpacity ?? 0.92;

  drawLashShadow(targetCtx, lifted, eyeWidth, shadow);

  targetCtx.save();
  targetCtx.translate(center.x, center.y - renderHeight * 0.42);
  targetCtx.rotate(angle);
  targetCtx.globalAlpha = Math.min(1, opacity * (0.82 + controls.density * 0.14));
  targetCtx.scale(mirror ? -1 : 1, 1);
  targetCtx.drawImage(image, -renderWidth / 2, -renderHeight / 2, renderWidth, renderHeight);
  targetCtx.restore();

  drawRootBlendLine(targetCtx, lifted, eyeWidth, rootBlend);
}

function drawLashSet(targetCtx, points, style, controls) {
  if (style.layout?.segments?.length) {
    try {
      drawProductionLashSet(targetCtx, points, style, controls);
      return;
    } catch (error) {
      console.warn("Production lash render failed, using fallback renderer.", error);
    }
  }

  drawBasicLashSet(targetCtx, points, style, controls);
}

function drawBasicLashSet(targetCtx, points, style, controls) {
  const ordered = [...points].sort((a, b) => a.x - b.x);
  const lifted = ordered.map((point) => ({ ...point, y: point.y + controls.lift }));
  const totalWidth = lifted[lifted.length - 1].x - lifted[0].x;
  const spikeCount = Math.max(8, Math.round(style.spikes * controls.density));

  drawLashShadow(targetCtx, lifted, totalWidth, controls.shadow ?? 0.35);

  targetCtx.save();
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.globalAlpha = controls.opacity ?? (controls.lashOpacity ?? 0.92);

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
  drawRootBlendLine(targetCtx, lifted, totalWidth, controls.rootBlend ?? 0.55);
}

function drawProductionLashSet(targetCtx, points, style, controls) {
  const ordered = [...points].sort((a, b) => a.x - b.x);
  const lifted = ordered.map((point) => ({ ...point, y: point.y + controls.lift }));
  const totalWidth = lifted[lifted.length - 1].x - lifted[0].x;
  const viewerLeftEye = pointAt(lifted, 0.5).x < els.canvas.width / 2;
  const render = style.render ?? {};
  const fiber = style.fiber ?? {};
  const curlProfile = style.curlProfile ?? {};
  const baseCount = Math.max(14, Number(style.spikes ?? 36));
  const densityScale = controls.density * getAverageSegmentDensity(style);
  const lashCount = Math.min(
    MAX_RENDER_FIBERS_PER_EYE,
    Math.max(10, Math.round(baseCount * densityScale)),
  );
  const curl = Number(curlProfile.curveStrength ?? style.curve ?? 0.36) * controls.curl;
  const rootBand = Number(render.rootBand ?? 0.5);
  const randomness = Number(render.randomness ?? 0.16);
  const opacity = Math.min(1, Number(render.opacity ?? controls.lashOpacity ?? 0.92));
  const thicknessBase = productionThicknessToLineWidth(
    Number(fiber.thicknessMm ?? style.thicknessMm ?? 0.1),
    style,
  );
  const finish = fiber.finish ?? "semi-matte";
  const layoutStyle = getLashLayoutStyle(style);

  drawLashShadow(targetCtx, lifted, totalWidth, controls.shadow ?? 0.35);

  targetCtx.save();
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.globalAlpha = opacity;

  drawBaseLine(targetCtx, lifted, style, {
    ...controls,
    thickness: controls.thickness * (0.72 + rootBand * 0.56),
  });

  const fibers = [];
  for (let index = 0; index < lashCount; index += 1) {
    const rawT = lashCount === 1 ? 0.5 : index / (lashCount - 1);
    const spacingJitter = deterministicJitter(style.id, index, 1) * randomness * 0.42;
    const t = clamp(rawT + spacingJitter / Math.max(1, lashCount), 0.015, 0.985);
    const productionT = viewerLeftEye ? 1 - t : t;
    const profile = sampleLayoutProfile(style, productionT);
    const skipChance = Math.max(0, 0.74 - profile.density);
    if (skipChance > 0 && deterministicUnit(style.id, index, 2) < skipChance) {
      continue;
    }

    const base = pointAt(lifted, t);
    const tangent = tangentAt(lifted, t);
    const normal = normalize({ x: -tangent.y, y: tangent.x });
    const outward = normal.y > 0 ? { x: -normal.x, y: -normal.y } : normal;
    const depth = deterministicJitter(style.id, index, 8);
    const layerOffset = totalWidth * 0.006 * depth;
    const layeredBase = {
      x: base.x + outward.x * layerOffset + tangent.x * deterministicJitter(style.id, index, 9) * totalWidth * 0.003,
      y: base.y + outward.y * layerOffset + depth * totalWidth * 0.004,
    };
    const zoneLength = Number(profile.lengthMm || getLengthFromRange(style.lengthMm));
    const lengthRatio = zoneLength / 10;
    const cluster = getClusterBoost(style, productionT);
    const edgeLean = (productionT - 0.5) * totalWidth * 0.035 * Number(render.fan ?? style.fan ?? 1);
    const densityLean = deterministicJitter(style.id, index, 3) * totalWidth * randomness * 0.018;
    const lashLength =
      totalWidth *
      0.108 *
      lengthRatio *
      controls.length *
      (0.82 + profile.density * 0.18) *
      (0.92 + cluster * 0.22);
    const curlLift = lashLength * (0.36 + curl * 0.62);
    const tip = {
      x: layeredBase.x + outward.x * lashLength + edgeLean + densityLean,
      y: layeredBase.y + outward.y * lashLength - curlLift * (0.94 + depth * 0.08),
    };
    const lineWidth =
      thicknessBase *
      controls.thickness *
      (0.74 + profile.density * 0.26) *
      (0.88 + cluster * 0.18);

    const mainFiber = {
      base: layeredBase,
      tip,
      tangent,
      curl,
      lineWidth,
      color: style.color,
      finish,
      depth,
      profile,
      cluster,
      index,
      kind: "main",
    };
    fibers.push(mainFiber);

    if (layoutStyle === "spike-cluster" && cluster > 0.38) {
      fibers.push(makeSideFiber(mainFiber, -1));
      fibers.push(makeSideFiber(mainFiber, 1));
    }

    if (layoutStyle === "full-volume" && index % 3 === 0) {
      fibers.push(makeSideFiber(mainFiber, 1, 0.76));
    }
  }

  fibers
    .sort((a, b) => a.depth - b.depth)
    .slice(0, MAX_RENDER_FIBERS_PER_EYE)
    .forEach((fiber) => drawSpatialFiber(targetCtx, fiber, opacity));

  targetCtx.restore();
  drawRootBlendLine(targetCtx, lifted, totalWidth, (controls.rootBlend ?? 0.55) * (0.82 + rootBand * 0.28));
}

function makeSideFiber(fiber, direction, scale = 0.62) {
  const offset = {
    x: fiber.tangent.x * 7 * direction,
    y: fiber.tangent.y * 7 * direction,
  };
  return {
    ...fiber,
    tip: {
      x: fiber.tip.x + offset.x,
      y: fiber.tip.y + offset.y,
    },
    lineWidth: fiber.lineWidth * scale,
    curl: fiber.curl * 0.86,
    depth: fiber.depth - 0.18,
    kind: "side",
  };
}

function drawSpatialFiber(targetCtx, fiber, baseOpacity) {
  const depthAlpha = clamp(0.66 + fiber.depth * 0.22, 0.46, 0.98);
  const shadowOffset = {
    x: 0.9 + fiber.depth * 0.35,
    y: 1.5 + Math.abs(fiber.depth) * 1.2,
  };

  drawFastFiberShadow(targetCtx, fiber, shadowOffset, baseOpacity * depthAlpha);

  targetCtx.save();
  targetCtx.globalAlpha = baseOpacity * depthAlpha;
  targetCtx.filter = "none";
  drawTaperedLash(targetCtx, fiber.base, fiber.tip, fiber.tangent, fiber.curl, fiber.lineWidth, fiber.color, fiber.finish, {
    highlight: fiber.depth > -0.25 ? 1 : 0.55,
    tipFade: 1,
  });
  targetCtx.restore();
}

function drawFastFiberShadow(targetCtx, fiber, offset, alpha) {
  const base = addPoint(fiber.base, offset);
  const tip = addPoint(fiber.tip, offset);
  const control = {
    x: base.x + (tip.x - base.x) * 0.42 + fiber.tangent.x * 18 * fiber.curl,
    y: base.y + (tip.y - base.y) * 0.34 - 14 * fiber.curl,
  };

  targetCtx.save();
  targetCtx.globalAlpha = alpha * 0.18;
  targetCtx.strokeStyle = "rgba(10, 7, 5, 0.55)";
  targetCtx.lineWidth = fiber.lineWidth * 0.9;
  targetCtx.beginPath();
  targetCtx.moveTo(base.x, base.y);
  targetCtx.quadraticCurveTo(control.x, control.y, tip.x, tip.y);
  targetCtx.stroke();
  targetCtx.restore();
}

function getAverageSegmentDensity(style) {
  const segments = style.layout?.segments ?? [];
  if (segments.length === 0) return 1;
  return segments.reduce((sum, segment) => sum + Number(segment.density ?? 1), 0) / segments.length;
}

function sampleLayoutProfile(style, t) {
  const segments = style.layout?.segments ?? [];
  if (segments.length === 0) {
    return {
      lengthMm: getLengthFromRange(style.lengthMm),
      density: 1,
    };
  }

  const scaled = clamp(t, 0, 1) * (segments.length - 1);
  const index = Math.min(segments.length - 2, Math.floor(scaled));
  const localT = scaled - index;
  const current = segments[index];
  const next = segments[index + 1] ?? current;

  return {
    lengthMm: lerpNumber(Number(current.lengthMm), Number(next.lengthMm), localT),
    density: lerpNumber(Number(current.density ?? 1), Number(next.density ?? 1), localT),
  };
}

function getClusterBoost(style, t) {
  const clusters = style.layout?.clusters ?? [];
  if (clusters.length === 0) return 0;
  return clusters.reduce((maxBoost, cluster) => {
    const distance = Math.abs(t - Number(cluster.position));
    const width = Number(cluster.width ?? 0.055);
    const boost = Math.max(0, 1 - distance / width) * Number(cluster.strength ?? 0);
    return Math.max(maxBoost, boost);
  }, 0);
}

function getLashLayoutStyle(style) {
  return style.layout?.style ?? style.layout?.type ?? "";
}

function productionThicknessToLineWidth(thicknessMm, style) {
  const fallback = Number(style.thickness ?? 1.25);
  if (!Number.isFinite(thicknessMm)) return fallback;
  return clamp(0.72 + thicknessMm * 7.4, 0.9, 2.15);
}

function getLengthFromRange(value) {
  const numbers = String(value).match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length === 0) return 10;
  return numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
}

function drawTaperedLash(targetCtx, base, tip, tangent, curve, lineWidth, color, finish, options = {}) {
  const control = {
    x: base.x + (tip.x - base.x) * 0.42 + tangent.x * 18 * curve,
    y: base.y + (tip.y - base.y) * 0.34 - 14 * curve,
  };
  const mid = quadraticPoint(base, control, tip, 0.54);
  const nearTip = quadraticPoint(base, control, tip, 0.82);
  const tipFade = options.tipFade ?? 1;
  const highlightScale = options.highlight ?? 1;
  const highlightAlpha = (finish === "gloss" ? 0.2 : finish === "satin" ? 0.13 : 0.06) * highlightScale;

  targetCtx.save();
  targetCtx.strokeStyle = adjustColor(color, -16, 0.92);
  strokeQuadraticSegment(targetCtx, base, control, mid, lineWidth * 1.18);
  targetCtx.strokeStyle = color;
  strokeQuadraticSegment(targetCtx, base, control, mid, lineWidth);
  targetCtx.globalAlpha *= 0.82;
  strokeQuadraticSegment(targetCtx, mid, control, nearTip, lineWidth * 0.52);
  targetCtx.globalAlpha *= 0.78 * tipFade;
  strokeQuadraticSegment(targetCtx, nearTip, control, tip, Math.max(0.2, lineWidth * 0.16));

  if (highlightAlpha > 0) {
    targetCtx.save();
    targetCtx.globalAlpha = highlightAlpha;
    targetCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    const highlightStart = quadraticPoint(base, control, tip, 0.12);
    const highlightEnd = quadraticPoint(base, control, tip, 0.48);
    strokeQuadraticSegment(targetCtx, highlightStart, control, highlightEnd, Math.max(0.2, lineWidth * 0.14));
    targetCtx.restore();
  }
  targetCtx.restore();
}

function drawClusterSideLash(targetCtx, base, tip, tangent, curl, lineWidth, color, direction) {
  const offset = {
    x: tangent.x * 7 * direction,
    y: tangent.y * 7 * direction,
  };
  const sideTip = {
    x: tip.x + offset.x,
    y: tip.y + offset.y,
  };
  targetCtx.save();
  targetCtx.globalAlpha *= 0.58;
  drawTaperedLash(targetCtx, base, sideTip, tangent, curl * 0.86, lineWidth * 0.56, color, "semi-matte");
  targetCtx.restore();
}

function strokeQuadraticSegment(targetCtx, start, control, end, lineWidth) {
  targetCtx.beginPath();
  targetCtx.moveTo(start.x, start.y);
  targetCtx.quadraticCurveTo(control.x, control.y, end.x, end.y);
  targetCtx.lineWidth = lineWidth;
  targetCtx.stroke();
}

function quadraticPoint(start, control, end, t) {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x,
    y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y,
  };
}

function addPoint(point, offset) {
  return {
    x: point.x + offset.x,
    y: point.y + offset.y,
  };
}

function adjustColor(color, amount, alpha = 1) {
  if (!String(color).startsWith("#")) return color;
  const value = color.slice(1);
  const red = clamp(parseInt(value.slice(0, 2), 16) + amount, 0, 255);
  const green = clamp(parseInt(value.slice(2, 4), 16) + amount, 0, 255);
  const blue = clamp(parseInt(value.slice(4, 6), 16) + amount, 0, 255);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawLashShadow(targetCtx, points, eyeWidth, amount) {
  if (amount <= 0) return;

  targetCtx.save();
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.filter = `blur(${Math.max(1.5, eyeWidth * 0.012)}px)`;
  targetCtx.strokeStyle = "rgba(24, 18, 16, 0.55)";
  targetCtx.globalAlpha = Math.min(0.32, amount * 0.32);
  targetCtx.lineWidth = Math.max(3, eyeWidth * 0.032);
  drawOffsetEyeStroke(targetCtx, points, Math.max(1, eyeWidth * 0.015));
  targetCtx.restore();
}

function drawRootBlendLine(targetCtx, points, eyeWidth, amount) {
  if (amount <= 0) return;

  targetCtx.save();
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.strokeStyle = "rgba(16, 12, 10, 0.86)";
  targetCtx.globalAlpha = Math.min(0.72, amount * 0.72);
  targetCtx.lineWidth = Math.max(1.1, eyeWidth * 0.012);
  drawOffsetEyeStroke(targetCtx, points, -Math.max(1, eyeWidth * 0.004));
  targetCtx.filter = `blur(${Math.max(0.5, eyeWidth * 0.003)}px)`;
  targetCtx.globalAlpha = Math.min(0.36, amount * 0.36);
  targetCtx.lineWidth = Math.max(2.2, eyeWidth * 0.02);
  drawOffsetEyeStroke(targetCtx, points, -Math.max(1, eyeWidth * 0.004));
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

function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function deterministicUnit(seed, index, salt) {
  let hash = 2166136261;
  const input = `${seed}:${index}:${salt}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function deterministicJitter(seed, index, salt) {
  return deterministicUnit(seed, index, salt) * 2 - 1;
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
