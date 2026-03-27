import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAnalystCacheFile } from '../lib/analyst-report-source.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'data', 'analyst-reports-cache.json');

async function main() {
  const cacheFile = await buildAnalystCacheFile(30);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(cacheFile, null, 2)}\n`, 'utf8');

  console.log(
    `Generated analyst cache: ${cacheFile.reports.length} reports at ${cacheFile.generatedAt}`
  );
}

main().catch((error) => {
  console.error('Failed to generate analyst cache:', error);
  process.exitCode = 1;
});
