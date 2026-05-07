import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scrapeIpoList } from '../lib/ipo-scraper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, '..', 'data', 'ipo-cache.json');

async function main() {
  console.log('Scraping 38.co.kr IPO list...');
  const data = await scrapeIpoList();
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Generated IPO cache: ${data.totalCount} deals at ${data.fetchedAt}`);
}

main().catch((err) => {
  console.error('IPO cache generation failed:', err);
  process.exit(1);
});
