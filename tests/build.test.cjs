const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function sourceOrder() {
    const manifest = read('src/main.js');
    return [...manifest.matchAll(/'((?:src\/)[^']+\.js)'/g)]
        .map(match => match[1])
        .filter(file => file !== 'src/metadata.js' && file !== 'src/globals.js');
}

test('generated userscript begins with complete Tampermonkey metadata', () => {
    const output = read('pokeclicker-automation.user.js');
    assert.ok(output.startsWith('// ==UserScript==\n'));
    assert.equal((output.match(/\/\/ ==UserScript==/g) || []).length, 1);
    assert.equal((output.match(/\/\/ ==\/UserScript==/g) || []).length, 1);
    assert.ok(output.indexOf('// ==/UserScript==') < output.indexOf('(() => {'));
});

test('source manifest lists existing modules in generated order', () => {
    const output = read('pokeclicker-automation.user.js');
    const files = sourceOrder();
    assert.ok(files.length >= 20, 'Expected meaningful source modules');

    let previousIndex = -1;
    for (const file of files) {
        const moduleSource = read(file).trim();
        assert.ok(moduleSource, `Empty source module: ${file}`);
        const marker = moduleSource.split('\n').find(line => line.trim())?.trim();
        const index = output.indexOf(marker, previousIndex + 1);
        assert.notEqual(index, -1, `Generated output is missing ${file}`);
        assert.ok(index > previousIndex, `${file} is out of order`);
        previousIndex = index;
    }
});

test('generated userscript is one self-contained parseable file', () => {
    const output = read('pokeclicker-automation.user.js');
    assert.doesNotMatch(output, /^\s*(?:import|export)\s/m);
    assert.doesNotMatch(output, /from ['"]\.\//);
    new vm.Script(output);
});

test('storage keys and startup guards remain in generated output', () => {
    const output = read('pokeclicker-automation.user.js');
    for (const key of [
        'myAutoClickEnabled',
        'myAutoHatchMode',
        'myAutoDungeon',
        'myBreedingPriorityV8',
        'myAutoDungeonChestRaritiesV8',
        'myHelperCollapsedSectionsV8',
    ]) {
        assert.ok(output.includes(key), `Missing persisted setting: ${key}`);
    }
    assert.match(output, /typeof App !==\s*'undefined'/);
    assert.match(output, /App\.game\?\.breeding/);
    assert.match(output, /clearInterval\(\s*waitForGame/);
});
