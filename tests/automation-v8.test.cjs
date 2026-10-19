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
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex);
    assert.notEqual(startIndex, -1, 'Missing start marker: ' + start);
    assert.notEqual(endIndex, -1, 'Missing end marker: ' + end);
    return source.slice(startIndex, endIndex);
}

test('v8.0.0 release references and optional feature preferences are wired', () => {
    assert.match(source, /@version\s+8\.0\.0/);
    assert.match(source, /version\.textContent = 'v8\.0\.0'/);
    assert.match(source, /Automation v8\.0\.0\] Loaded/);

    for (const name of [
        'autoHatching',
        'advancedHatching',
        'autoDungeon',
        'advancedDungeon',
        'autoFarm',
    ]) {
        assert.match(
            source,
            new RegExp(name + ": 'myFeature")
        );
    }

    assert.match(
        source,
        /advancedDungeon: readStoredFeature\(\s*'advancedDungeon',\s*false/
    );
    assert.match(source, /const hasLegacyHelperSettings =/);
    assert.match(source, /Advanced Dungeon Pathing/);
    assert.match(source, /Advanced Hatching Strategies/);
});

test('feature lifecycle stops disabled jobs and falls advanced dungeon runs back to Default Pathing', () => {
    const setter = functionSlice(
        '    function setFeatureEnabled(',
        '    function setHatchMode('
    );
    assert.match(
        setter,
        /name === 'autoDungeon'[\s\S]*stopForegroundJob\(\s*'Auto Dungeon was disabled\.'/
    );
    assert.match(
        setter,
        /name === 'autoFarm'[\s\S]*stopFarmer\(\s*'Auto Farm was disabled\.'/
    );
    assert.match(
        setter,
        /name === 'advancedDungeon'[\s\S]*foregroundJob\.navigationMode =\s*'default'/
    );
    assert.match(
        source,
        /if \(!featureSettings\.autoFarm\)[\s\S]*Enable Auto Farm in Optional Features/
    );
    assert.match(
        source,
        /if \(!featureSettings\.autoDungeon\)[\s\S]*Enable Auto Dungeon in Optional Features/
    );
});

test('Default Pathing explores an adjacent tile first and backtracks only through visited tiles', () => {
    const context = vm.createContext({
        GameConstants: {
            DungeonTileType: { enemy: 1 },
        },
    });
    vm.runInContext(
        functionSlice(
            '    function dungeonPointKey(',
            '    function getVisibleChestTier('
        ),
        context
    );
    vm.runInContext(
        "function tile(x, visited) { return { position: { x, y: 0, floor: 0 }, " +
        "isVisited: visited, isVisible: visited, type: () => 0 }; } " +
        "const directBoard = [[tile(0, true), tile(1, false)]]; " +
        "const directMap = { board: () => [directBoard], " +
        "playerPosition: () => ({ x: 0, y: 0, floor: 0 }) }; " +
        "const directJob = { unreachableObjectives: new Set(), failedMoves: new Map() }; " +
        "const backtrackBoard = [[tile(0, false), tile(1, true), tile(2, true)]]; " +
        "const backtrackMap = { board: () => [backtrackBoard], " +
        "playerPosition: () => ({ x: 2, y: 0, floor: 0 }) }; " +
        "const backtrackJob = { unreachableObjectives: new Set(), failedMoves: new Map() };",
        context
    );

    assert.equal(
        vm.runInContext(
            'JSON.stringify(findDefaultExplorationPath(directMap, directJob).map(p => [p.x, p.y]))',
            context
        ),
        '[[1,0]]'
    );
    assert.equal(
        vm.runInContext(
            'JSON.stringify(findDefaultExplorationPath(backtrackMap, backtrackJob).map(p => [p.x, p.y]))',
            context
        ),
        '[[1,0],[0,0]]'
    );
});

test('advanced objective selection prioritizes only visible selected-rarity chests', () => {
    const context = vm.createContext({
        GameConstants: {
            DungeonTileType: {
                empty: 0,
                enemy: 1,
                chest: 2,
                ladder: 3,
                boss: 4,
            },
        },
    });
    vm.runInContext(
        "let selectedDungeonChestRarities = ['legendary'];\n" +
        functionSlice(
            '    function dungeonPointKey(',
            '    function navigateAdvancedDungeon('
        ),
        context
    );
    vm.runInContext(
        "const start = { position: { x: 0, y: 0, floor: 0 }, isVisited: true, " +
        "isVisible: true, type: () => 0 }; " +
        "const hidden = { position: { x: 1, y: 0, floor: 0 }, isVisited: false, " +
        "isVisible: false, type: () => 2, " +
        "get metadata() { throw new Error('hidden chest metadata read'); } }; " +
        "const selected = { position: { x: 0, y: 1, floor: 0 }, isVisited: false, " +
        "isVisible: true, type: () => 2, metadata: { tier: 'legendary' } }; " +
        "const exit = { position: { x: 1, y: 1, floor: 0 }, isVisited: false, " +
        "isVisible: true, type: () => 4 }; " +
        "const board = [[start, hidden], [selected, exit]]; " +
        "const map = { board: () => [board], " +
        "playerPosition: () => ({ x: 0, y: 0, floor: 0 }) }; " +
        "const job = { navigationMode: 'boss', unreachableObjectives: new Set(), " +
        "failedMoves: new Map() };",
        context
    );

    assert.equal(
        vm.runInContext(
            "selectAdvancedDungeonObjective(map, job).kind",
            context
        ),
        'selected chest'
    );
    assert.equal(
        vm.runInContext(
            "selectAdvancedDungeonObjective(map, job).tile.metadata.tier",
            context
        ),
        'legendary'
    );
});

test('all-caught progress deduplicates forms and uses normal caught status', () => {
    const context = vm.createContext({
        console: { error() {} },
        App: {
            game: {
                party: {
                    alreadyCaughtPokemonByName:
                        name => name === 'Caught Form',
                },
            },
        },
    });
    vm.runInContext(
        functionSlice(
            '    function getDungeonPokemonProgress(',
            '    function formatDungeonCollectionProgress('
        ),
        context
    );

    const progress = vm.runInContext(
        "getDungeonPokemonProgress({ allAvailablePokemon: () => " +
        "['Caught Form', 'Missing Form', 'Missing Form'] })",
        context
    );
    assert.equal(progress.total, 2);
    assert.equal(progress.caught, 1);
    assert.deepEqual([...progress.missing], ['Missing Form']);
});

test('collection goal does not start when complete and finishes the active run safely', () => {
    const executor = functionSlice(
        '    function startAutoDungeon(',
        '    function runAutomationTick('
    );
    assert.match(
        executor,
        /collectionGoal &&\s*!initialCollection\s*\.missing\.length[\s\S]*completeForegroundStart/
    );
    assert.match(
        executor,
        /!progress\s*\.missing\.length &&\s*this\.runActive[\s\S]*this\.finishAfterRun =\s*true/
    );
    assert.match(
        executor,
        /this\.finishAfterRun \|\|[\s\S]*stopForegroundJob\([\s\S]*true/
    );
});

test('dungeon reward information uses live tables, conditions, quantities, and game probabilities', () => {
    const lootHelpers = functionSlice(
        '    function getAvailableDungeonLoot(',
        '    function navigateDefaultDungeon('
    );
    assert.match(lootHelpers, /loot\.requirement[\s\S]*isCompleted\(\)/);
    assert.match(lootHelpers, /item\.isAvailable\(\)/);
    assert.match(lootHelpers, /item\.isSoldOut\(\)/);
    assert.match(lootHelpers, /dungeon\.getLootChance/);

    const panel = functionSlice(
        '    function getSelectedDungeon(',
        '    // ============================================================\n    // Main button UI'
    );
    for (const tier of ['common', 'rare', 'epic', 'legendary', 'mythic']) {
        assert.ok(source.includes("'" + tier + "'"), 'Missing tier: ' + tier);
    }
    assert.match(panel, /item\.amount \?\?\s*1/);
    assert.match(panel, /selectedDungeonChestRarities/);
    assert.match(panel, /multiple = true/);
    assert.match(panel, /updateDungeonInformation\(\)/);
});

test('collapsing is visual-only and persisted independently', () => {
    const controls = functionSlice(
        '    function createControls() {',
        '    // ============================================================\n    // Start'
    );
    assert.match(controls, /COLLAPSED_SECTIONS_STORAGE_KEY/);
    assert.match(controls, /collapsedSections\[key\] =\s*collapsed/);
    assert.match(controls, /panel\.classList\s*\.toggle\(\s*'is-collapsed'/);
    assert.doesNotMatch(
        controls,
        /toggle\(\)[\s\S]{0,300}(stopForegroundJob|stopFarmer)/
    );
    assert.match(source, /pkh-card-state/);
    assert.match(source, /updateCardRunningState\(\s*'dungeon-runner'/);
});
