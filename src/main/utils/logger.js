const fs = require('fs');
const path = require('path');
let enabled = true;
let logFilePath = null;

function setEnabled(flag) {
  enabled = !!flag;
}

function setFileDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    logFilePath = path.join(dirPath, 'web-viewer.log');
  } catch (e) {
    logFilePath = null;
  }
}

function log(...args) {
  if (enabled) {
    const line = `[web-viewer] ${args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ')}`;
    console.log(line);
    if (logFilePath) {
      try {
        fs.appendFileSync(logFilePath, line + '\n');
      } catch {}
    }
  }
}

module.exports = {
  setEnabled,
  setFileDir,
  log
};
