// Writes a .gz and a .zst next to every text asset in the build output. The
// server picks one by Accept-Encoding, so nothing is compressed per request.
//
// Usage: node scripts/precompress.ts <build output directory>
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";

const gzip = promisify(zlib.gzip);
const zstd = promisify(zlib.zstdCompress);

const compressible = new Set([".js", ".css", ".html", ".svg", ".json", ".webmanifest", ".txt"]);

const encoders = [
  {
    suffix: ".gz",
    encode: (data: Buffer) => gzip(data, { level: zlib.constants.Z_BEST_COMPRESSION }),
  },
  {
    suffix: ".zst",
    encode: (data: Buffer) =>
      zstd(data, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } }),
  },
];

const kB = (bytes: number) => `${(bytes / 1024).toFixed(2)} kB`;

async function main(outDir: string | undefined): Promise<void> {
  if (!outDir) throw new Error("usage: node scripts/precompress.ts <build output directory>");

  const entries = await fs.readdir(outDir, { recursive: true, withFileTypes: true });
  const rows: Record<string, string>[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !compressible.has(path.extname(entry.name))) continue;
    const filePath = path.join(entry.parentPath, entry.name);
    const data = await fs.readFile(filePath);
    const row: Record<string, string> = {
      file: path.relative(outDir, filePath).split(path.sep).join("/"),
      size: kB(data.length),
    };
    for (const { suffix, encode } of encoders) {
      const compressed = await encode(data);
      // The server serves a variant whenever it exists, so a variant that is
      // no smaller than the original would only cost bytes.
      if (compressed.length >= data.length) {
        row[suffix] = "skipped";
        continue;
      }
      await fs.writeFile(filePath + suffix, compressed);
      row[suffix] = kB(compressed.length);
    }
    rows.push(row);
  }

  console.table(rows);
}

main(process.argv[2]).catch((err) => {
  console.error(err);
  process.exit(1);
});
