const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = ['package.json', 'backend/package.json', 'frontend/package.json'];
const versions = files.map((file) => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  return { file, version: packageJson.version };
});

const distinct = [...new Set(versions.map((entry) => entry.version))];
if (distinct.length !== 1) {
  console.error('Versions désalignées :');
  for (const entry of versions) console.error(`- ${entry.file}: ${entry.version}`);
  process.exit(1);
}

console.log(`Version alignée : ${distinct[0]}`);
