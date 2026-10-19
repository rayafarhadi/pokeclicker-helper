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

test('helper UI uses one polished launcher, five persistent tabs, and collapsible cards', () => {
    const controls = functionSlice(
        '    function createControls() {',
        '    // ============================================================\n    // Start'
    );
    for (const tab of [
        'Dashboard',
        'Farms',
        'Dungeon',
        'Breeding',
        'Features',
    ]) {
        assert.ok(controls.includes("'" + tab + "'"), 'Missing tab: ' + tab);
    }
    assert.match(controls, /localStorage\.getItem\(HELPER_TAB_STORAGE_KEY\)/);
    assert.match(controls, /localStorage\.setItem\(HELPER_TAB_STORAGE_KEY, tabName\)/);
    assert.match(source, /COLLAPSED_SECTIONS_STORAGE_KEY/);
    assert.match(controls, /className =\s*'pkh-card-content'/);
    assert.match(controls, /collapsedSections\[key\]/);
    assert.match(source, /width: min\(420px, calc\(100vw - 28px\)\)/);
    assert.match(source, /max-height: calc\(100vh - 86px\)/);
    assert.match(controls, /container\.id = 'pkh-root'/);
    assert.match(controls, /container\.appendChild\(helperLauncherButton\)/);

    for (const sectionKey of [
        'farms-dungeon-tokens',
        'farms-gems',
        'farms-type',
        'farms-auto-farmer',
        'dungeon-runner',
        'breeding-hatch-settings',
        'breeding-vitamin-tracker',
        'features-hatching',
        'features-dungeons',
        'features-farming',
    ]) {
        assert.ok(controls.includes("'" + sectionKey + "'"),
            'Missing collapsible section: ' + sectionKey);
    }
});

test('polished theme includes segmented tabs, cards, switch, and status indicators', () => {
    for (const className of [
        'pkh-brand-ball',
        'pkh-status-dot',
        'pkh-tab.is-active',
        'pkh-card-title',
        'pkh-toggle.is-on',
        'pkh-button-primary',
        'pkh-button-danger',
        'pkh-vitamin-table',
    ]) {
        assert.ok(source.includes(className), 'Missing polished style: ' + className);
    }
});

test('Vitamin Tracker is embedded without viewport positioning', () => {
    const controls = functionSlice(
        '    function createControls() {',
        '    // ============================================================\n    // Start'
    );
    assert.match(controls, /position: 'static'/);
    assert.doesNotMatch(source, /function positionVitaminPanel\(/);
    const vitaminPanel = functionSlice(
        '    function createVitaminPanel() {',
        '    // ============================================================\n    // Settings setters'
    );
    assert.doesNotMatch(
        vitaminPanel,
        /getBoundingClientRect|window\.innerWidth|window\.innerHeight/
    );
    assert.match(source, /const positionPopup = \(\) =>/);
});

test('automation uses one shared tick and performs no startup optimizer scans', () => {
    const startBody = functionSlice('    function start() {',
        '    // Wait for PokéClicker');
    assert.ok(startBody.includes('setInterval('));
    assert.ok(startBody.includes('runAutomationTick'));
    assert.doesNotMatch(startBody, /scanDungeonTokenRoutes|scanGemFarms|scanTypeCatchRoutes|scanVitaminEfficiency/);
    assert.ok(source.includes('getResourceGoalProgress('));
    assert.ok(source.includes('getCapturedCountByType(this.selectedType) - this.baseline'));
    assert.ok(source.includes("this.mode === 'owned'"));
    assert.ok(source.includes('getGemBalance(this.gemType)'));
});

test('dungeon movement uses normal moveToCoordinates and starts the game timer', () => {
    const context = vm.createContext({});
    const movement = functionSlice(
        '    function dungeonPointKey(',
        '    function getChestTier('
    );
    vm.runInContext(movement, context);
    vm.runInContext(
        "let position = { x: 0, y: 0, floor: 0 }; let timerStarted = false; " +
        "const map = { playerPosition: () => position, " +
        "moveToCoordinates(x, y, floor) { position = { x, y, floor }; timerStarted = true; } }; " +
        "const job = { failedMoves: new Map(), unreachableObjectives: new Set() };",
        context
    );
    assert.equal(
        vm.runInContext(
            "moveDungeonAlongPath(map, job, [{ x: 1, y: 0, floor: 0 }], " +
            "{ x: 1, y: 0, floor: 0 })",
            context
        ),
        true
    );
    assert.equal(vm.runInContext('timerStarted', context), true);
});

test('dungeon routing reads generated chest metadata before tile visibility', () => {
    const context = vm.createContext({
        GameConstants: {
            DungeonTileType: { empty: 0, chest: 1 },
        },
    });
    vm.runInContext(
        functionSlice(
            '    function getChestTier(',
            '    function getDungeonPokemonProgress('
        ),
        context
    );

    assert.equal(
        vm.runInContext(
            "getChestTier({ isVisible: false, type() { return 1; }, " +
            "metadata: { tier: 'legendary' } })",
            context
        ),
        'legendary'
    );
    assert.equal(
        vm.runInContext(
            "getChestTier({ isVisible: false, type() { return 0; }, " +
            "get metadata() { throw new Error('non-chest metadata read'); } })",
            context
        ),
        null
    );

    const selector = functionSlice(
        '    function selectAdvancedDungeonObjective(',
        '    function navigateAdvancedDungeon('
    );
    assert.match(selector, /getDungeonTilesByType/);
    assert.match(selector, /getChestTier/);
    assert.match(selector, /allowUnknownTraversal: true/);
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

test('Auto Dungeon completes exactly the requested number of managed runs', () => {
    const context = vm.createContext({
        console: { log() {}, error() {} },
    });
    const executor = functionSlice(
        '    function startAutoDungeon(',
        '    function runAutomationTick('
    );
    vm.runInContext(
        "let clears = 10; let attempts = 0; let activeJob = null; " +
        "let lastJob = null; let stopped = null; const featureSettings = { autoDungeon: true, advancedDungeon: true }; " +
        "const dungeon = { name: 'Test Dungeon', tokenCost: 1, " +
        "isUnlocked: () => true, hasUnlockedBoss: () => true }; " +
        "const TownList = { 'Test Dungeon': { dungeon, isUnlocked: () => true } }; " +
        "const DungeonGuides = { hired: () => null }; " +
        "const GameConstants = { GameState: { dungeon: 'dungeon', town: 'town' } }; " +
        "const App = { game: { gameState: GameConstants.GameState.town } }; " +
        "function requireFiniteTarget(mode, value) { return mode === 'indefinite' ? null : Number(value); } " +
        "function getDungeonClearCount() { return clears; } " +
        "function makeProgressText(label, value, target) { return label + value + '/' + target; } " +
        "function formatNumber(value) { return String(value); } function getDungeonPokemonProgress() { return { total: 1, caught: 0, missing: ['X'] }; } function formatDungeonCollectionProgress() { return ''; } function completeForegroundStart() {} " +
        "function failForegroundStart(id, reason) { throw new Error(reason); } " +
        "function navigateDungeon() {} " +
        "function startDungeonAttempt(job) { attempts++; job.runStartClears = clears; " +
        "job.runActive = true; App.game.gameState = GameConstants.GameState.dungeon; } " +
        "function stopForegroundJob(reason, completed = false) { " +
        "if (activeJob) { stopped = { reason, completed }; activeJob = null; } } " +
        "function activateForegroundJob(job) { activeJob = job; lastJob = job; job.start(); }\n" +
        executor,
        context
    );

    vm.runInContext(
        "startAutoDungeon('Test Dungeon', 'boss', 'finite', 4, 0)",
        context
    );
    assert.equal(vm.runInContext('attempts', context), 1);

    for (let completed = 1; completed <= 4; completed++) {
        vm.runInContext(
            "clears++; App.game.gameState = GameConstants.GameState.town; activeJob.tick()",
            context
        );
        if (completed < 4) {
            assert.equal(vm.runInContext('attempts', context), completed + 1);
            assert.equal(vm.runInContext('activeJob !== null', context), true);
        }
    }

    assert.equal(vm.runInContext('attempts', context), 4);
    assert.equal(vm.runInContext('lastJob.completedClears', context), 4);
    assert.equal(vm.runInContext('stopped.completed', context), true);

    vm.runInContext(
        "stopped = null; startAutoDungeon('Test Dungeon', 'boss', 'finite', 2, 0); " +
        "App.game.gameState = GameConstants.GameState.town; activeJob.tick()",
        context
    );
    assert.equal(vm.runInContext('activeJob', context), null);
    assert.equal(vm.runInContext('attempts', context), 5);
    assert.match(
        vm.runInContext('stopped.reason', context),
        /lost or interrupted/
    );
});
