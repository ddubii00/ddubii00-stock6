const fs = require('fs');
let code = fs.readFileSync('patch_index.js', 'utf8');

// The issue in patch_index.js is that it replaces oldRenderSummary with newRenderSummary,
// but newRenderSummary contains lots of code ABOVE renderSummary(), causing duplication
// if it's run multiple times. We can just add a simple check in patch_index.js to remove
// the previously added block before inserting the new one.

const fixStr = `
// First, remove the previously injected block if it exists
html = html.replace(/        const lwChartInstances = {};[\\s\\S]*?(?=    function renderSummary\\(\\) \\{)/, '');

const oldRenderSummary = html.match(/function renderSummary\\(\\) \\{[\\s\\S]*?\\n    \\}/)[0];
`;

code = code.replace("const oldRenderSummary = html.match(/function renderSummary\\(\\)", fixStr.trim() + "\\nconst oldRenderSummary = html.match(/function renderSummary\\(\\)");

fs.writeFileSync('patch_index.js', code);
