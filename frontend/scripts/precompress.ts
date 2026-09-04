import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import zlib from "node:zlib";

type Row = {
  file: string;
  size: string;
  gzip: string;
  gzipPct: string;
  zstd: string;
  zstdPct: string;
};

const gzip = promisify(zlib.gzip);
const zstdCompress = promisify(zlib.zstdCompress);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, "../../backend/web/dist");
const compressExts = new Set([".js", ".css", ".html", ".svg", ".json", ".webmanifest", ".txt"]);

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function shouldCompress(filePath: string): boolean {
  const ext = path.extname(filePath);
  if (ext === ".gz" || ext === ".zst") {
    return false;
  }
  return compressExts.has(ext);
}

async function isFresh(targetPath: string, sourceStat: { mtimeMs: number }): Promise<boolean> {
  try {
    const targetStat = await fs.stat(targetPath);
    return targetStat.mtimeMs >= sourceStat.mtimeMs;
  } catch {
    return false;
  }
}

function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

function formatReduction(original: number, compressed: number): string {
  if (original === 0) {
    return "0.0%";
  }
  const reduction = (1 - compressed / original) * 100;
  return `${reduction.toFixed(1)}%`;
}

function printTable(rows: Row[]): void {
  const headers = {
    file: "File",
    size: "Size",
    gzip: "gzip",
    gzipPct: "gzip%",
    zstd: "zstd",
    zstdPct: "zstd%",
  };

  const widths = {
    file: headers.file.length,
    size: headers.size.length,
    gzip: headers.gzip.length,
    gzipPct: headers.gzipPct.length,
    zstd: headers.zstd.length,
    zstdPct: headers.zstdPct.length,
  };

  for (const row of rows) {
    widths.file = Math.max(widths.file, row.file.length);
    widths.size = Math.max(widths.size, row.size.length);
    widths.gzip = Math.max(widths.gzip, row.gzip.length);
    widths.gzipPct = Math.max(widths.gzipPct, row.gzipPct.length);
    widths.zstd = Math.max(widths.zstd, row.zstd.length);
    widths.zstdPct = Math.max(widths.zstdPct, row.zstdPct.length);
  }

  const headerLine =
    `${headers.file.padEnd(widths.file)}  ` +
    `${headers.size.padStart(widths.size)}  ` +
    `${headers.gzip.padStart(widths.gzip)}  ` +
    `${headers.gzipPct.padStart(widths.gzipPct)}  ` +
    `${headers.zstd.padStart(widths.zstd)}  ` +
    `${headers.zstdPct.padStart(widths.zstdPct)}`;
  const separatorLine =
    `${"-".repeat(widths.file)}  ` +
    `${"-".repeat(widths.size)}  ` +
    `${"-".repeat(widths.gzip)}  ` +
    `${"-".repeat(widths.gzipPct)}  ` +
    `${"-".repeat(widths.zstd)}  ` +
    `${"-".repeat(widths.zstdPct)}`;

  console.log(headerLine);
  console.log(separatorLine);
  for (const row of rows) {
    const line =
      `${row.file.padEnd(widths.file)}  ` +
      `${row.size.padStart(widths.size)}  ` +
      `${row.gzip.padStart(widths.gzip)}  ` +
      `${row.gzipPct.padStart(widths.gzipPct)}  ` +
      `${row.zstd.padStart(widths.zstd)}  ` +
      `${row.zstdPct.padStart(widths.zstdPct)}`;
    console.log(line);
  }
}

async function ensureGzip(
  filePath: string,
  data: Buffer,
  sourceStat: { mtimeMs: number },
): Promise<number> {
  const targetPath = filePath + ".gz";
  if (await isFresh(targetPath, sourceStat)) {
    const targetStat = await fs.stat(targetPath);
    return targetStat.size;
  }
  const compressed = await gzip(data, { level: 9 });
  await fs.writeFile(targetPath, compressed);
  return compressed.length;
}

async function ensureZstd(
  filePath: string,
  data: Buffer,
  sourceStat: { mtimeMs: number },
): Promise<number> {
  const targetPath = filePath + ".zst";
  if (await isFresh(targetPath, sourceStat)) {
    const targetStat = await fs.stat(targetPath);
    return targetStat.size;
  }
  const compressed = await zstdCompress(data);
  await fs.writeFile(targetPath, compressed);
  return compressed.length;
}

async function main(): Promise<void> {
  const distStat = await fs.stat(distDir).catch(() => null);
  if (!distStat || !distStat.isDirectory()) {
    throw new Error(`Missing dist directory at ${distDir}`);
  }

  const files = await listFiles(distDir);
  const rows: Row[] = [];

  for (const filePath of files) {
    if (!shouldCompress(filePath)) {
      continue;
    }
    const data = await fs.readFile(filePath);
    const sourceStat = await fs.stat(filePath);
    const gzipSize = await ensureGzip(filePath, data, sourceStat);
    const zstdSize = await ensureZstd(filePath, data, sourceStat);
    const relative = path.relative(distDir, filePath).split(path.sep).join("/");
    rows.push({
      file: relative,
      size: formatKB(sourceStat.size),
      gzip: formatKB(gzipSize),
      gzipPct: formatReduction(sourceStat.size, gzipSize),
      zstd: formatKB(zstdSize),
      zstdPct: formatReduction(sourceStat.size, zstdSize),
    });
  }

  if (rows.length > 0) {
    printTable(rows);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
