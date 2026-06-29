import { readFile } from 'node:fs/promises';

const host = 'instantviewer.online';
const key = '78c6e17352c140e5be2f07b16029a38c';
const keyLocation = `https://${host}/${key}.txt`;
const sitemap = await readFile('sitemap.xml', 'utf8');
const urlList = [...sitemap.matchAll(/<loc>(https:\/\/instantviewer\.online\/[^<]*)<\/loc>/g)].map((match) => match[1]);

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation, urlList }),
});

if (!response.ok && response.status !== 202) {
  throw new Error(`IndexNow submission failed: ${response.status} ${await response.text()}`);
}

console.log(`IndexNow accepted ${urlList.length} URL(s) with status ${response.status}.`);
