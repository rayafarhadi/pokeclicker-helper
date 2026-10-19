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

test('v8.0.3 release references and optional feature preferences are wired', () => {
    assert.match(source, /@version\s+8\.0\.3/);
    assert.match(source, /version\.textContent = 'v8\.0\.3'/);
    assert.match(source, /Automation v8\.0\.3\] Loaded/);

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
        /if \(!featureSettings\.autoFarm\)[\s\S]*Enable Auto Farm in the Features tab/
    );
    assert.match(
        source,
        /if \(!featureSettings\.autoDungeon\)[\s\S]*Enable Auto Dungeon in the Features tab/
    );
});


test('Features is a first-class tab and section headings omit decorative letter icons', () => {
    const controls = functionSlice(
        '    function createControls() {',
        '    // ============================================================\n    // Start'
    );

    assert.match(
        source,
        /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/
    );
    assert.doesNotMatch(source, /\.pkh-card-icon/);
    assert.doesNotMatch(controls, /iconNode|decorateTitle\(title, icon\)/);
    assert.match(
        controls,
        /const tabNames = \[[\s\S]*'Breeding',[\s\S]*'Features'[\s\S]*\]/
    );
    assert.match(
        controls,
        /selectedTab === 'Optional Features'[\s\S]*selectedTab = 'Features'/
    );
    for (const label of ['Boss Rush', 'Chest Farm', 'Full Clear']) {
        assert.ok(source.includes("'" + label + "'"), 'Missing pathing label: ' + label);
        assert.ok(!source.includes("'Advanced " + label + "'"),
            'Pathing label should not use Advanced: ' + label);
    }
});

test('only owner switches from the Features tab can enable disabled features', () => {
    const calls = [];
    const makeButton = () => ({
        dataset: {},
        addEventListener(type, handler) {
            assert.equal(type, 'click');
            this.click = handler;
        },
    });
    const context = vm.createContext({
        document: { createElement: () => makeButton() },
        featureSettings: { autoHatching: false },
        featureToggleButtons: { autoHatching: [] },
        setFeatureEnabled: (...args) => calls.push(args),
    });

    vm.runInContext(
        functionSlice(
            '    function createFeatureToggleButton(',
            '    function getBreedingStrategyLabel('
        ),
        context
    );

    vm.runInContext(
        "globalThis.mirror = createFeatureToggleButton('autoHatching');" +
        "globalThis.owner = createFeatureToggleButton('autoHatching', true);",
        context
    );
    context.mirror.click();
    context.owner.click();

    assert.equal(context.mirror.dataset.featureOwner, 'false');
    assert.equal(context.owner.dataset.featureOwner, 'true');
    assert.deepEqual(calls, [
        ['autoHatching', true, false],
        ['autoHatching', true, true],
    ]);

    assert.match(
        source,
        /value &&\s*!featureSettings\[name\] &&\s*!allowEnable[\s\S]*return;/
    );
    assert.match(
        source,
        /const canChangeHere =\s*featureOwner \|\| featureSettings\[name\]/
    );
    assert.match(
        source,
        /button\.disabled = unavailable/
    );
    assert.match(
        source,
        /Enable this feature from the Features tab\./
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
            '    function getChestTier('
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

test('advanced modes use hidden objectives, requested priorities, and deferred exits', () => {
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
        DungeonRunner: {
            map: null,
            interactions: 0,
            handleInteraction() {
                this.interactions++;
            },
        },
    });
    vm.runInContext(
        "let selectedDungeonChestRarities = ['legendary'];\n" +
        functionSlice(
            '    function dungeonPointKey(',
            '    function navigateDungeon('
        ),
        context
    );
    vm.runInContext(
        "function tile(x, y, kind, options = {}) { return { " +
        "position: { x, y, floor: 0 }, kind, " +
        "isVisited: options.visited ?? false, " +
        "isVisible: options.visible ?? false, " +
        "metadata: options.tier ? { tier: options.tier } : {}, " +
        "type() { return this.kind; } }; } " +
        "function makeMap(board, x = 0, y = 0) { let position = { x, y, floor: 0 }; " +
        "return { board: () => [board], playerPosition: () => ({ ...position }), " +
        "currentTile: () => board[position.y][position.x], " +
        "moveToCoordinates(nx, ny, floor) { position = { x: nx, y: ny, floor }; }, " +
        "setPosition(nx, ny) { position = { x: nx, y: ny, floor: 0 }; } }; } " +
        "function makeJob(mode) { return { navigationMode: mode, " +
        "unreachableObjectives: new Set(), failedMoves: new Map() }; }",
        context
    );

    vm.runInContext(
        "const bossBoard = [[tile(0,0,0,{visited:true,visible:true}), " +
        "tile(1,0,0), tile(2,0,4)]]; " +
        "globalThis.bossMap = makeMap(bossBoard); " +
        "globalThis.bossObjective = selectAdvancedDungeonObjective(bossMap, makeJob('boss'));",
        context
    );
    assert.equal(context.bossObjective.kind, 'exit');
    assert.equal(context.bossObjective.tile.isVisible, false);
    assert.deepEqual(
        JSON.parse(JSON.stringify(context.bossObjective.path)),
        [
            { x: 1, y: 0, floor: 0 },
            { x: 2, y: 0, floor: 0 },
        ]
    );

    vm.runInContext(
        "const chestBoard = [" +
        "[tile(0,0,0,{visited:true,visible:true}), tile(1,0,1), tile(2,0,2)]," +
        "[tile(0,1,0), tile(1,1,1), tile(2,1,0)]," +
        "[tile(0,2,0), tile(1,2,1), tile(2,2,0)]," +
        "[tile(0,3,2), tile(1,3,1), tile(2,3,4)]]; " +
        "globalThis.chestMap = makeMap(chestBoard); " +
        "globalThis.chestObjective = selectAdvancedDungeonObjective(chestMap, makeJob('chest'));",
        context
    );
    assert.equal(context.chestObjective.kind, 'chest');
    assert.deepEqual(
        JSON.parse(JSON.stringify(context.chestObjective.tile.position)),
        { x: 0, y: 3, floor: 0 },
        'Chest Farm should prefer the longer zero-battle chest route'
    );
    assert.equal(context.chestObjective.battles, 0);

    vm.runInContext(
        "const fullStart = tile(0,0,0,{visited:true,visible:true}); " +
        "globalThis.commonChest = tile(1,0,2,{tier:'common'}); " +
        "globalThis.hiddenEnemy = tile(2,0,1); " +
        "globalThis.selectedChest = tile(3,0,2,{tier:'legendary'}); " +
        "globalThis.fullBoss = tile(4,0,4); " +
        "globalThis.fullMap = makeMap([[fullStart, commonChest, hiddenEnemy, selectedChest, fullBoss]]); " +
        "globalThis.fullJob = makeJob('full');",
        context
    );
    assert.equal(
        vm.runInContext("selectAdvancedDungeonObjective(fullMap, fullJob).kind", context),
        'selected chest'
    );
    context.selectedChest.kind = 0;
    assert.equal(
        vm.runInContext("selectAdvancedDungeonObjective(fullMap, fullJob).kind", context),
        'enemy'
    );
    context.hiddenEnemy.kind = 0;
    assert.equal(
        vm.runInContext("selectAdvancedDungeonObjective(fullMap, fullJob).kind", context),
        'chest'
    );
    context.commonChest.kind = 0;
    assert.equal(
        vm.runInContext("selectAdvancedDungeonObjective(fullMap, fullJob).kind", context),
        'exit'
    );

    vm.runInContext(
        "globalThis.passBoss = tile(0,0,4,{visited:true,visible:true}); " +
        "globalThis.remainingChest = tile(1,0,2); " +
        "globalThis.passMap = makeMap([[passBoss, remainingChest]]); " +
        "DungeonRunner.map = passMap; DungeonRunner.interactions = 0; " +
        "globalThis.passJob = makeJob('chest'); " +
        "navigateAdvancedDungeon(passJob);",
        context
    );
    assert.equal(context.DungeonRunner.interactions, 0);
    assert.equal(context.passMap.playerPosition().x, 1);

    context.remainingChest.kind = 0;
    context.passMap.setPosition(0, 0);
    vm.runInContext('navigateAdvancedDungeon(passJob);', context);
    assert.equal(
        context.DungeonRunner.interactions,
        1,
        'Boss interaction should start only after chest objectives are gone'
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

test('dungeon reward rows combine live rewards with persistent rarity checkboxes', () => {
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
    assert.match(panel, /for \(\s*const tier of\s*DUNGEON_CHEST_RARITIES/);
    assert.match(panel, /checkbox\.type = 'checkbox'/);
    assert.match(panel, /checkbox\.checked =\s*selectedDungeonChestRarities/);
    assert.match(panel, /setDungeonChestRaritySelected\(\s*tier,\s*checkbox\.checked/);
    assert.match(panel, /No currently available rewards\./);
    assert.match(panel, /item\.amount \?\?\s*1/);
    assert.match(panel, /updateDungeonInformation\(\)/);
    assert.doesNotMatch(panel, /multiple = true|selectedOptions/);

    const dungeonPanel = functionSlice(
        '    function createAutoDungeonPanel()',
        '    // ============================================================\n    // Main button UI'
    );
    assert.ok(
        dungeonPanel.indexOf("'Chest rewards and priorities'") <
            dungeonPanel.indexOf("'Goal'"),
        'reward checkboxes should appear above goal controls'
    );
    assert.doesNotMatch(
        source,
        /\.pkh-loot-info \{[\s\S]{0,150}(max-height|overflow-y)/
    );
});

test('rarity checkbox updates stay ordered and persist immediately', () => {
    const writes = [];
    const context = vm.createContext({
        DUNGEON_CHEST_RARITIES: [
            'common',
            'rare',
            'epic',
            'legendary',
            'mythic',
        ],
        DUNGEON_CHEST_RARITIES_STORAGE_KEY: 'rarities',
        selectedDungeonChestRarities: ['legendary', 'mythic'],
        localStorage: {
            setItem(key, value) {
                writes.push([key, value]);
            },
        },
    });

    vm.runInContext(
        functionSlice(
            '    function setDungeonChestRaritySelected(',
            '    function renderDungeonRewardInfo()'
        ),
        context
    );

    vm.runInContext(
        "setDungeonChestRaritySelected('rare', true);" +
        "setDungeonChestRaritySelected('legendary', false);" +
        "setDungeonChestRaritySelected('invalid', true);",
        context
    );

    assert.deepEqual(
        [...context.selectedDungeonChestRarities],
        ['rare', 'mythic']
    );
    assert.deepEqual(writes, [
        ['rarities', '["rare","legendary","mythic"]'],
        ['rarities', '["rare","mythic"]'],
    ]);
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
