const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const root = path.resolve(__dirname, '..');
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(p);
    } else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
}
['src', 'app'].forEach((d) => walk(path.join(root, d)));
let fail = 0;
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  try {
    parser.parse(code, { sourceType: 'module', plugins: ['typescript', ...(f.endsWith('.tsx') ? ['jsx'] : []), 'classProperties'] });
  } catch (err) {
    fail++;
    console.log('PARSE FAIL:', path.relative(root, f), '->', err.message);
  }
}
console.log(`Checked ${files.length} files, ${fail} failures.`);
