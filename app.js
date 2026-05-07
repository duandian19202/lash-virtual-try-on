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
const MAX_FIBERS_PER_EYE = 72;

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
    const hydratedStyles = await hydrateManufacturerAssets(normalizeManufacturerCatalog(catalog));
    lashStyles = hydratedStyles.filter(hasRealManufacturerAsset);
    state.selectedStyle = getDefaultManufacturerStyle(lashStyles);
    if (lashStyles.length === 0) {
      setStatus("真实睫毛素材库暂无可用素材");
    }
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
    asset: getPrimaryAssetPath(product),
    assetCandidates: getAssetCandidates(product),
    fiberAsset: getPrimaryFiberAssetPath(product),
    fiberAssetCandidates: getFiberAssetCandidates(product),
  }));
}

function getDefaultManufacturerStyle(styles) {
  return styles[0] ?? null;
}

function hasRealManufacturerAsset(style) {
  return Boolean(style.fiberImage || style.assetImage);
}

function getPrimaryAssetPath(product) {
  return (
    product.asset ??
    product.assets?.main ??
    product.assets?.single ??
    product.assets?.right ??
    product.assets?.left ??
    null
  );
}

function getAssetCandidates(product) {
  const skuMainPath = product.sku ? `assets/${product.sku}/main.png` : null;
  const skuSinglePath = product.sku ? `assets/${product.sku}/single.png` : null;
  return [
    product.asset,
    product.assets?.main,
    product.assets?.single,
    product.assets?.right,
    product.assets?.left,
    skuMainPath,
    skuSinglePath,
  ].filter(Boolean);
}

function getPrimaryFiberAssetPath(product) {
  return getFiberAssetCandidates(product)[0] ?? null;
}

function getFiberAssetCandidates(product) {
  const skuPath = product.sku ? `assets/${product.sku}/fiber.png` : null;
  return [
    product.assets?.fiber,
    product.assets?.singleFiber,
    product.assets?.fiberMain,
    product.fiber?.asset,
    product.fiber?.image,
    product.fiber?.main,
    skuPath,
  ].filter(Boolean);
}

async function hydrateManufacturerAssets(styles) {
  return Promise.all(
    styles.map(async (style) => {
      const stripAsset = await loadFirstLibraryImage(style.assetCandidates);
      const fiberAsset = await loadFirstLibraryImage(style.fiberAssetCandidates);
      return {
        ...style,
        asset: stripAsset?.path ?? style.asset,
        assetImage: stripAsset?.image ?? null,
        assetMetrics: stripAsset ? analyzeLashAsset(stripAsset.image) : null,
        fiberAsset: fiberAsset?.path ?? style.fiberAsset,
        fiberImage: fiberAsset?.image ?? null,
        fiberMetrics: fiberAsset ? analyzeLashAsset(fiberAsset.image) : null,
        renderMode: fiberAsset ? "fiber" : stripAsset ? "asset" : "asset-missing",
      };
    }),
  );
}

async function loadFirstLibraryImage(paths = []) {
  for (const assetPath of paths.filter(Boolean)) {
    try {
      return {
        path: assetPath,
        image: await loadImage(resolveLibraryAssetUrl(assetPath)),
      };
    } catch {
      // Try the next declared asset path.
    }
  }
  return null;
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
    empty.textContent = "真实睫毛素材库暂无匹配款式。";
    els.styleGrid.append(empty);
    return;
  }

  visibleStyles.forEach((style) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `lash-card ${style.id === state.selectedStyle?.id ? "active" : ""}`;
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
      setStatus(style.fiberImage ? `已选择单根排布：${style.sku}` : `已选择真实素材：${style.sku}`);
      renderStyleCards();
      renderSelectedProduct();
      renderLibraryCards();
      redraw();
    });
    els.styleGrid.append(card);
    if (style.fiberImage) {
      drawFiberLashSwatch(card.querySelector("canvas"), style);
    } else {
      drawImageLashSwatch(card.querySelector("canvas"), style.assetImage);
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
    <small>${style.sku} · ${style.series}${getRenderModeLabel(style)}</small>
    <div class="selected-specs">
      <span>${style.lengthMm}</span>
      <span>${style.curlGrade} 翘</span>
      <span>${style.thicknessMm}mm</span>
      <span class="color-chip" style="--chip-color: ${style.color}">${style.colorName}</span>
    </div>
  `;
}

function getRenderModeLabel(style) {
  if (style.fiberImage) return " · 单根排布";
  return style.assetImage ? " · 真实素材" : "";
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

function drawImageLashSwatch(canvas, image) {
  const swatchCtx = canvas.getContext("2d");
  swatchCtx.clearRect(0, 0, canvas.width, canvas.height);
  const width = canvas.width * 0.86;
  const height = Math.min(canvas.height * 0.78, width * (image.naturalHeight / image.naturalWidth));
  swatchCtx.drawImage(image, (canvas.width - width) / 2, canvas.height - height - 4, width, height);
}

function drawFiberLashSwatch(canvas, style) {
  const swatchCtx = canvas.getContext("2d");
  swatchCtx.clearRect(0, 0, canvas.width, canvas.height);
  const points = Array.from({ length: 9 }, (_, index) => {
    const t = index / 8;
    return {
      x: 18 + t * (canvas.width - 36),
      y: 42 - Math.sin(t * Math.PI) * 10,
    };
  });
  drawFiberLashSet(
    swatchCtx,
    points,
    style,
    {
      ...state.controls,
      length: 0.62,
      density: 0.72,
      curl: 0.9,
      thickness: 0.9,
      lift: 0,
      lashOpacity: 0.92,
      rootBlend: 0,
      shadow: 0,
    },
    false,
  );
}

function analyzeLashAsset(image) {
  const sampleWidth = 320;
  const sampleHeight = Math.max(64, Math.round(sampleWidth * (image.naturalHeight / image.naturalWidth)));
  const probe = document.createElement("canvas");
  probe.width = sampleWidth;
  probe.height = sampleHeight;
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });
  probeCtx.clearRect(0, 0, sampleWidth, sampleHeight);
  probeCtx.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const pixels = probeCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let bestRow = Math.round(sampleHeight * 0.82);
  let bestScore = 0;
  let contentTop = sampleHeight;
  let contentBottom = 0;

  for (let y = 0; y < sampleHeight; y += 1) {
    let rowScore = 0;
    for (let x = 0; x < sampleWidth; x += 1) {
      const offset = (y * sampleWidth + x) * 4;
      const alpha = pixels[offset + 3] / 255;
      if (alpha < 0.04) continue;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const darkness = 1 - Math.min(255, red * 0.299 + green * 0.587 + blue * 0.114) / 255;
      rowScore += alpha * (0.65 + darkness * 0.35);
    }
    if (rowScore > 0.35) {
      contentTop = Math.min(contentTop, y);
      contentBottom = Math.max(contentBottom, y);
    }
    if (rowScore > bestScore) {
      bestScore = rowScore;
      bestRow = y;
    }
  }

  return {
    rootY: clamp(bestRow / sampleHeight, 0.35, 0.94),
    contentTop: contentTop === sampleHeight ? 0 : contentTop / sampleHeight,
    contentBottom: contentBottom / sampleHeight,
  };
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
    assetMetrics: analyzeLashAsset(image),
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
  loaded.forEach((style) => {
    if (style.image && !style.assetMetrics) {
      style.assetMetrics = analyzeLashAsset(style.image);
    }
  });
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
    state.selectedStyle = getDefaultManufacturerStyle(lashStyles);
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
    drawImageLashSet(
      ctx,
      adjustedEyes.left,
      state.selectedStyle.image,
      state.controls,
      false,
      state.selectedStyle.assetMetrics,
    );
    drawImageLashSet(
      ctx,
      adjustedEyes.right,
      state.selectedStyle.image,
      state.controls,
      true,
      state.selectedStyle.assetMetrics,
    );
  } else if (state.selectedStyle.fiberImage) {
    drawFiberLashSet(ctx, adjustedEyes.left, state.selectedStyle, state.controls, false);
    drawFiberLashSet(ctx, adjustedEyes.right, state.selectedStyle, state.controls, true);
  } else if (state.selectedStyle.assetImage) {
    drawImageLashSet(
      ctx,
      adjustedEyes.left,
      state.selectedStyle.assetImage,
      state.controls,
      false,
      state.selectedStyle.assetMetrics,
    );
    drawImageLashSet(
      ctx,
      adjustedEyes.right,
      state.selectedStyle.assetImage,
      state.controls,
      true,
      state.selectedStyle.assetMetrics,
    );
  } else {
    drawEmptyEyeCloseup("等待真实素材");
    return;
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

function drawImageLashSet(targetCtx, points, image, controls, mirror, metrics = {}) {
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
  const rootY = clamp(Number(metrics.rootY ?? 0.82), 0.35, 0.94);

  drawLashShadow(targetCtx, lifted, eyeWidth, shadow);

  targetCtx.save();
  targetCtx.translate(center.x, center.y - renderHeight * (rootY - 0.5));
  targetCtx.rotate(angle);
  targetCtx.globalAlpha = Math.min(1, opacity * (0.82 + controls.density * 0.14));
  targetCtx.scale(mirror ? -1 : 1, 1);
  targetCtx.drawImage(image, -renderWidth / 2, -renderHeight / 2, renderWidth, renderHeight);
  targetCtx.restore();

  drawRootBlendLine(targetCtx, lifted, eyeWidth, rootBlend);
}

function drawFiberLashSet(targetCtx, points, style, controls, mirror) {
  const ordered = [...points].sort((a, b) => a.x - b.x);
  const lifted = ordered.map((point) => ({ ...point, y: point.y + controls.lift }));
  const start = lifted[0];
  const end = lifted[lifted.length - 1];
  const eyeWidth = Math.hypot(end.x - start.x, end.y - start.y);
  const baseCount = Number(style.layout?.baseCount ?? style.spikes ?? 42);
  const densityScale = getAverageSegmentDensity(style) * controls.density;
  const fiberCount = Math.min(
    MAX_FIBERS_PER_EYE,
    Math.max(10, Math.round(baseCount * densityScale)),
  );
  const render = style.render ?? {};
  const randomness = Number(style.layout?.randomness ?? render.randomness ?? 0.16);
  const opacity = Math.min(1, Number(render.opacity ?? controls.lashOpacity ?? 0.92));

  drawLashShadow(targetCtx, lifted, eyeWidth, controls.shadow ?? 0.35);

  targetCtx.save();
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";

  for (let index = 0; index < fiberCount; index += 1) {
    const rawT = fiberCount === 1 ? 0.5 : index / (fiberCount - 1);
    const spacingJitter = deterministicJitter(style.id, index, 1) * randomness * 0.34;
    const t = clamp(rawT + spacingJitter / Math.max(1, fiberCount), 0.018, 0.982);
    const productT = mirror ? 1 - t : t;
    const profile = sampleLayoutProfile(style, productT);
    const density = Math.max(0.1, Number(profile.density ?? 1));
    const skipChance = Math.max(0, 0.72 - density);
    if (skipChance > 0 && deterministicUnit(style.id, index, 2) < skipChance) {
      continue;
    }

    const base = pointAt(lifted, t);
    const tangent = tangentAt(lifted, t);
    const normal = normalize({ x: -tangent.y, y: tangent.x });
    const outward = normal.y > 0 ? { x: -normal.x, y: -normal.y } : normal;
    const profileLength = Number(profile.lengthMm || getLengthFromRange(style.lengthMm));
    const cluster = getClusterBoost(style, productT);
    const fiberHeight =
      eyeWidth *
      0.22 *
      (profileLength / 10) *
      controls.length *
      (0.88 + controls.curl * 0.18) *
      (0.92 + cluster * 0.24) *
      (0.94 + deterministicJitter(style.id, index, 3) * randomness * 0.42);
    const aspect = style.fiberImage.naturalWidth / style.fiberImage.naturalHeight;
    const fiberWidth =
      fiberHeight *
      aspect *
      controls.thickness *
      (0.92 + density * 0.08) *
      (0.94 + deterministicJitter(style.id, index, 4) * randomness * 0.32);
    const angleDeg =
      Number(profile.angleDeg ?? 0) +
      (productT - 0.5) * Number(style.layout?.fanSpread ?? render.fan ?? 0.18) * 34 +
      deterministicJitter(style.id, index, 5) * randomness * 18;
    const curlLift = eyeWidth * 0.012 * controls.curl * (profileLength / 10);
    const baseOffset = {
      x: outward.x * (eyeWidth * 0.006 * deterministicJitter(style.id, index, 6)),
      y: outward.y * curlLift + deterministicJitter(style.id, index, 7) * eyeWidth * 0.003,
    };
    const direction = rotateVector(outward, (angleDeg * Math.PI) / 180);
    const targetAngle = Math.atan2(direction.y, direction.x);
    const rootY = clamp(Number(style.fiberMetrics?.rootY ?? 0.86), 0.35, 0.96);

    drawSingleFiber(targetCtx, style.fiberImage, {
      x: base.x + baseOffset.x,
      y: base.y + baseOffset.y,
      width: fiberWidth,
      height: fiberHeight,
      rotation: targetAngle + Math.PI / 2,
      rootY,
      opacity: opacity * clamp(0.78 + density * 0.18 + deterministicJitter(style.id, index, 8) * 0.08, 0.5, 1),
      shadow: controls.shadow ?? 0.35,
    });
  }

  targetCtx.restore();
  drawRootBlendLine(targetCtx, lifted, eyeWidth, controls.rootBlend ?? 0.55);
}

function drawSingleFiber(targetCtx, image, options) {
  const shadowAlpha = Math.min(0.18, options.shadow * 0.14);
  if (shadowAlpha > 0) {
    targetCtx.save();
    targetCtx.translate(options.x + 0.8, options.y + 1.4);
    targetCtx.rotate(options.rotation);
    targetCtx.globalAlpha = shadowAlpha;
    targetCtx.filter = "blur(1.2px)";
    targetCtx.drawImage(
      image,
      -options.width / 2,
      -options.height * options.rootY,
      options.width,
      options.height,
    );
    targetCtx.restore();
  }

  targetCtx.save();
  targetCtx.translate(options.x, options.y);
  targetCtx.rotate(options.rotation);
  targetCtx.globalAlpha = options.opacity;
  targetCtx.drawImage(
    image,
    -options.width / 2,
    -options.height * options.rootY,
    options.width,
    options.height,
  );
  targetCtx.restore();
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

function sampleLayoutProfile(style, t) {
  const segments = style.layout?.segments ?? [];
  if (segments.length === 0) {
    return {
      lengthMm: getLengthFromRange(style.lengthMm),
      density: 1,
      angleDeg: 0,
    };
  }

  const positionedSegment = segments.find((segment) => {
    const range = segment.position ?? segment.range;
    return Array.isArray(range) && t >= Number(range[0]) && t <= Number(range[1]);
  });
  if (positionedSegment) {
    return positionedSegment;
  }

  const scaled = clamp(t, 0, 1) * (segments.length - 1);
  const index = Math.min(segments.length - 2, Math.floor(scaled));
  const localT = scaled - index;
  const current = segments[index];
  const next = segments[index + 1] ?? current;
  return {
    lengthMm: lerpNumber(Number(current.lengthMm), Number(next.lengthMm), localT),
    density: lerpNumber(Number(current.density ?? 1), Number(next.density ?? 1), localT),
    angleDeg: lerpNumber(Number(current.angleDeg ?? 0), Number(next.angleDeg ?? 0), localT),
  };
}

function getAverageSegmentDensity(style) {
  const segments = style.layout?.segments ?? [];
  if (segments.length === 0) return 1;
  return segments.reduce((sum, segment) => sum + Number(segment.density ?? 1), 0) / segments.length;
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

function getLengthFromRange(value) {
  const numbers = String(value).match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length === 0) return 10;
  return numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
}

function rotateVector(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
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
