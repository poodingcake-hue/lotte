const fs = require('fs');
const content = fs.readFileSync('c:/Users/SERAT/Desktop/새 폴더 (2)/lotte/index.html', 'utf8');
const scriptMatches = [...content.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
scriptMatches.forEach((m, i) => {
    fs.writeFileSync(`temp_script_${i}.js`, m[1]);
});
console.log(`Extracted ${scriptMatches.length} scripts.`);
