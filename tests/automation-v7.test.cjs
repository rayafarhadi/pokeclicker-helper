const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'pokeclicker-automation.user.js'),
    'utf8'
);

function functionSlice(start, end) {
    return source.slice(source.indexOf(start), source.indexOf(end));
}

test('finite Farm Point Auto selection is target-aware', () => {
    const context = vm.createContext({
        App: {
            game: {
                farming: {
                    berryInventory: [() => 2, () => 2],
                    unlockedBerries: [() => true, () => true],
                    getGrowthMultiplier: () => 1,
                },
            },
        },
        BerryList: [
            { harvestAmount: 2, growthTime: [1, 2, 5, 10, 20], farmValue: 5 },
            { harvestAmount: 2, growthTime: [1, 2, 50, 100, 200], farmValue: 100 },
        ],
        PlotStage: { Bloom: 3 },
    });
    vm.runInContext(
        functionSlice('    function getFarmCandidate(', '    function stopFarmer('),
        context
    );
    assert.equal(
        vm.runInContext("chooseFarmBerry('auto', 'farmPoints', 10, 2).berry", context),
        0,
        'the quick berry should win a small finite target'
    );
    assert.equal(
        vm.runInContext("chooseFarmBerry('auto', 'indefinite', null, 2).berry", context),
        1,
        'the highest long-run FP rate should win indefinite mode'
    );
});

test('automation uses one shared tick and performs no startup optimizer scans', () => {
    const startBody = functionSlice('    function start() {',
        '    // Wait for PokéClicker');
    assert.match(startBody, /setInterval\(\s*runAutomationTick,/);
    assert.doesNotMatch(startBody, /scanDungeonTokenRoutes|scanGemFarms|scanTypeCatchRoutes|scanVitaminEfficiency/);
    assert.match(source, /getDungeonTokens\(\) - this\.baseline/);
    assert.match(source, /getCapturedCountByType\(this\.selectedType\) - this\.baseline/);
    assert.match(source, /getGemGainCount\(this\.gemType\) - this\.baseline/);
});

test('dungeon navigation never reads hidden chest metadata', () => {
    const dungeonAutomation = functionSlice(
        '    function getAvailableDungeons()',
        '    function styleCompactPanel('
    );
    assert.doesNotMatch(dungeonAutomation, /\.metadata|metadata\[/);
    assert.match(dungeonAutomation, /DungeonRunner\.fighting\(\) \|\|\s*DungeonBattle\.catching\(\)/);
    assert.match(dungeonAutomation, /DungeonTileType\.enemy/);
});

test('foreground transfer cleans up and restores Auto Click ownership', () => {
    const context = vm.createContext({
        console: { log() {}, error() {} },
    });
    const manager = functionSlice(
        '    function restoreJobAutoClick(',
        '    function isOnRoute('
    );
    vm.runInContext(
        "const executionViews = {}; let foregroundJob = null; " +
        "let foregroundLastStatus = 'Idle'; let autoClickEnabled = false; " +
        "let cleanups = 0; const clickStates = []; " +
        "function updateAutomationUI() {} " +
        "function setAutoClick(value) { autoClickEnabled = value; clickStates.push(value); }\n" +
        manager,
        context
    );
    vm.runInContext(
        "activateForegroundJob({ id: 'a', type: 'A', needsClicks: true, " +
        "start() {}, cleanup() { cleanups++; } });",
        context
    );
    assert.equal(vm.runInContext('autoClickEnabled', context), true);
    vm.runInContext(
        "activateForegroundJob({ id: 'b', type: 'B', needsClicks: true, " +
        "start() {}, cleanup() { cleanups++; } });",
        context
    );
    assert.equal(vm.runInContext('cleanups', context), 1);
    assert.equal(vm.runInContext('autoClickEnabled', context), true);
    vm.runInContext("stopForegroundJob('done')", context);
    assert.equal(vm.runInContext('cleanups', context), 2);
    assert.equal(vm.runInContext('autoClickEnabled', context), false);

    vm.runInContext('setAutoClick(true)', context);
    vm.runInContext(
        "activateForegroundJob({ id: 'c', type: 'C', needsClicks: true, start() {} });",
        context
    );
    vm.runInContext("stopForegroundJob('done')", context);
    assert.equal(vm.runInContext('autoClickEnabled', context), true);
});
