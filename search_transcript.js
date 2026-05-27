const fs = require('fs');
const path = require('path');

const logPath = 'C:/Users/boxxt/.gemini/antigravity/brain/3a2ea739-cce3-4d9b-bc75-0948b2b4b287/.system_generated/logs/transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.log('Log file does not exist at:', logPath);
  process.exit(0);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

console.log(`Total lines in transcript: ${lines.length}`);

// Print lines containing "2025"
let found = 0;
lines.forEach((line, idx) => {
  if (line.includes('2025')) {
    found++;
    if (found <= 30) {
      console.log(`Line ${idx}: ${line.substring(0, 300)}...`);
    }
  }
});

console.log(`Found ${found} lines containing "2025".`);
