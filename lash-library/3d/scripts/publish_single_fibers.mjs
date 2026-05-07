import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const configsDir = path.join(projectRoot, "lash-library/3d/production/single-fibers/configs");
const rendersDir = path.join(projectRoot, "lash-library/3d/production/single-fibers/renders");
const assetsDir = path.join(projectRoot, "lash-library/assets");

async function publish(configPath) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const sku = config.fiberId;
  const renderDir = path.join(rendersDir, sku);
  const assetDir = path.join(assetsDir, sku);
  const sourceImage = path.join(renderDir, "main.png");
  const sourceMetadata = path.join(renderDir, "metadata.json");

  const metadata = JSON.parse(await readFile(sourceMetadata, "utf8"));
  const params = {
    sku,
    assetType: "single-fiber",
    files: {
      fiber: "fiber.png",
      sourceRender: `../../3d/production/single-fibers/renders/${sku}/main.png`,
      sourceConfig: `../../3d/production/single-fibers/configs/${sku}.json`,
      sourceMetadata: `../../3d/production/single-fibers/renders/${sku}/metadata.json`
    },
    product: {
      name: config.name,
      curl: config.curl,
      lengthMm: config.lengthMm,
      thicknessMm: config.thicknessMm,
      color: config.color,
      material: config.material
    },
    anchors: metadata.render,
    compositionDefaults: {
      rootFusion: "soft-mask",
      opacity: 0.92,
      scale: 1,
      shadow: 0.18,
      defaultDensity: "natural",
      placement: "website-dynamic"
    }
  };

  await mkdir(assetDir, { recursive: true });
  await copyFile(sourceImage, path.join(assetDir, "fiber.png"));
  await writeFile(path.join(assetDir, "params.json"), `${JSON.stringify(params, null, 2)}\n`);
  console.log(`Published ${sku}`);
}

const requested = process.argv.slice(2);
if (requested.length === 0) {
  console.error("Usage: node lash-library/3d/scripts/publish_single_fibers.mjs <SKU...|--all>");
  process.exit(1);
}

let configPaths;
if (requested.includes("--all")) {
  const { readdir } = await import("node:fs/promises");
  configPaths = (await readdir(configsDir))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(configsDir, file));
} else {
  configPaths = requested.map((sku) => path.join(configsDir, `${sku}.json`));
}

for (const configPath of configPaths) {
  await publish(configPath);
}
