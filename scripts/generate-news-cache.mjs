import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNewsCacheFile } from '../lib/news-scraper.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'data', 'news-cache.json');

async function main() {
  console.log('Fetching news from Naver Finance...');
  const data = await buildNewsCacheFile();
  const total = data.domestic.length + data.overseas.length + data.main.length;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Generated news cache: ${total} items (domestic: ${data.domestic.length}, overseas: ${data.overseas.length}, main: ${data.main.length}) at ${data.generatedAt}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
