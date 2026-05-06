import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryRoot = path.resolve(__dirname, "..");
const catalogPath = path.join(libraryRoot, "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const strictAssets = process.argv.includes("--strict-assets");

const requiredProductFields = [
  "id",
  "sku",
  "series",
  "category",
  "nameZh",
  "color",
  "colorName",
  "lengthMm",
  "curl",
  "thicknessMm",
  "asset",
  "spikes",
  "render",
];

const requiredRenderFields = ["length", "curve", "thickness", "fan"];
const errors = [];

if (!catalog.version) errors.push("Missing catalog.version");
if (!catalog.brand) errors.push("Missing catalog.brand");
if (!Array.isArray(catalog.products)) errors.push("catalog.products must be an array");

const products = Array.isArray(catalog.products) ? catalog.products : [];
const ids = new Set();
const skus = new Set();

products.forEach((product, index) => {
  const label = product.sku || product.id || `product at index ${index}`;

  requiredProductFields.forEach((field) => {
    if (product[field] === undefined || product[field] === "") {
      errors.push(`${label}: missing ${field}`);
    }
  });

  if (product.id && ids.has(product.id)) errors.push(`${label}: duplicate id ${product.id}`);
  if (product.sku && skus.has(product.sku)) errors.push(`${label}: duplicate sku ${product.sku}`);
  if (product.id) ids.add(product.id);
  if (product.sku) skus.add(product.sku);

  if (product.color && !/^#[0-9a-fA-F]{6}$/.test(product.color)) {
    errors.push(`${label}: color must be a 6-digit hex value`);
  }

  requiredRenderFields.forEach((field) => {
    if (typeof product.render?.[field] !== "number") {
      errors.push(`${label}: render.${field} must be a number`);
    }
  });

  if (strictAssets && product.asset) {
    const assetPath = path.join(libraryRoot, product.asset);
    if (!fs.existsSync(assetPath)) {
      errors.push(`${label}: missing asset file ${product.asset}`);
    }
  }
});

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Catalog OK: ${products.length} products`);
