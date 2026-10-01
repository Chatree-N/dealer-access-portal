/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const terms = ['openchat.example' + '/rooms', 'line' + '.me'];
const sampleRequesters = [
  'anong.siriwat',
  'preecha.r',
  'malee.chaiyo',
  'somsri',
  'kanda'
];
const allTerms = [...terms, ...sampleRequesters];

const dir = path.join(__dirname, '../.next/static');
if (!fs.existsSync(dir)) {
  console.log('No .next/static dir found');
  process.exit(0);
}

try {
  // Use grep -r to find terms
  for (const term of allTerms) {
    try {
      const result = execSync(`grep -rlF "${term}" ${dir}`, { encoding: 'utf8' });
      if (result.trim()) {
        console.error(`ERROR: Found restricted term "${term}" in bundle:`);
        console.error(result);
        process.exit(1);
      }
    } catch (e) {
      // grep returns 1 if not found, which is what we want!
    }
  }
  console.log('Bundle check passed: No restricted terms found in client bundle.');
} catch (e) {
  console.error('Error running check', e);
  process.exit(1);
}
