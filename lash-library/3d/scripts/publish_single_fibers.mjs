import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const configsDir = path.join(projectRoot, "lash-library/3d/production/single-fibers/configs");
const assetsDir = path.join(projectRoot, "lash-library/assets");

function slashPath(value) {
  return value.split(path.sep).join("/");
}

function paramsRelative(assetDir, targetPath) {
  return slashPath(path.relative(assetDir, targetPath));
}

async function collectConfigPaths(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectConfigPaths(entryPath);
      if (entry.isFile() && entry.name.endsWith(".json")) return [entryPath];
      return [];
    })
  );
  return paths.flat().sort();
}

async function loadRecord(configPath) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const sku = config.sku || config.productSku || config.fiberId;
  const variantId = config.variantId || "fiber";
  const sourceImage = path.resolve(projectRoot, config.render.output);
  const sourceMetadata = path.join(path.dirname(sourceImage), "metadata.json");

  const metadata = JSON.parse(await readFile(sourceMetadata, "utf8"));
  return {
    sku,
    variantId,
    config,
    configPath,
    sourceImage,
    sourceMetadata,
    metadata,
    sortOrder: config.variantSort ?? config.variantOrder ?? 999,
    isDefault: config.isDefault === true
  };
}

function productFromConfig(config) {
  return {
    name: config.name,
    curl: config.curl,
    lengthMm: config.lengthMm,
    thicknessMm: config.thicknessMm,
    color: config.color,
    material: config.material
  };
}

async function publishGroup(sku, records) {
  const assetDir = path.join(assetsDir, sku);
  const variantDir = path.join(assetDir, "variants");
  const sorted = [...records].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.variantId.localeCompare(b.variantId);
  });
  const defaultRecord = sorted.find((record) => record.isDefault)
    || sorted.find((record) => record.variantId === "fiber-01")
    || sorted[0];
  const hasVariants = sorted.length > 1 || defaultRecord.variantId !== "fiber";

  await mkdir(assetDir, { recursive: true });
  if (hasVariants) await mkdir(variantDir, { recursive: true });

  if (hasVariants) {
    for (const record of sorted) {
      await copyFile(record.sourceImage, path.join(variantDir, `${record.variantId}.png`));
    }
  }
  await copyFile(defaultRecord.sourceImage, path.join(assetDir, "fiber.png"));

  const params = {
    sku,
    assetType: "single-fiber",
    files: {
      fiber: "fiber.png",
      variantsDir: hasVariants ? "variants" : undefined,
      sourceRender: paramsRelative(assetDir, defaultRecord.sourceImage),
      sourceConfig: paramsRelative(assetDir, defaultRecord.configPath),
      sourceMetadata: paramsRelative(assetDir, defaultRecord.sourceMetadata)
    },
    product: productFromConfig(defaultRecord.config),
    anchors: defaultRecord.metadata.render,
    variants: sorted.map((record) => ({
      id: record.variantId,
      file: hasVariants ? `variants/${record.variantId}.png` : "fiber.png",
      isDefault: record === defaultRecord,
      anchors: record.metadata.render,
      product: productFromConfig(record.config),
      source: {
        render: paramsRelative(assetDir, record.sourceImage),
        config: paramsRelative(assetDir, record.configPath),
        metadata: paramsRelative(assetDir, record.sourceMetadata)
      }
    })),
    compositionDefaults: {
      rootFusion: "soft-mask",
      opacity: 0.92,
      scale: 1,
      shadow: 0.18,
      defaultDensity: "natural",
      placement: "website-dynamic"
    }
  };

  await writeFile(path.join(assetDir, "params.json"), `${JSON.stringify(params, null, 2)}\n`);
  console.log(`Published ${sku}: ${sorted.length} fiber variant${sorted.length === 1 ? "" : "s"}`);
}

const requested = process.argv.slice(2);
if (requested.length === 0) {
  console.error("Usage: node lash-library/3d/scripts/publish_single_fibers.mjs <SKU...|--all>");
  process.exit(1);
}

let configPaths;
if (requested.includes("--all")) {
  configPaths = await collectConfigPaths(configsDir);
} else {
  const collected = await Promise.all(
    requested.map(async (value) => {
      const directPath = path.isAbsolute(value) ? value : path.join(projectRoot, value);
      if (existsSync(directPath) && directPath.endsWith(".json")) return [directPath];
      const legacyPath = path.join(configsDir, `${value}.json`);
      const skuDir = path.join(configsDir, value);
      const paths = [];
      if (existsSync(legacyPath)) paths.push(legacyPath);
      if (existsSync(skuDir)) paths.push(...await collectConfigPaths(skuDir));
      return paths;
    })
  );
  configPaths = collected.flat().sort();
}

if (configPaths.length === 0) {
  console.error(`No configs found for ${requested.join(", ")}`);
  process.exit(1);
}

const records = await Promise.all(configPaths.map((configPath) => loadRecord(configPath)));
const groups = new Map();
for (const record of records) {
  if (!groups.has(record.sku)) groups.set(record.sku, []);
  groups.get(record.sku).push(record);
}

for (const [sku, skuRecords] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  await publishGroup(sku, skuRecords);
}
