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
    assert.notEqual(startIndex, -1, 'Missing source marker: ' + start);
    assert.notEqual(endIndex, -1, 'Missing source marker: ' + end);
    return source.slice(startIndex, endIndex);
}

const resourceHelpers = functionSlice(
    '    function getGemGainCount(type) {',
    '    function getCapturedCountByType(type) {'
);

test('owned goals use live balances while gain goals retain baseline semantics', () => {
    let walletGems = 125;
    let gainedGems = 400;
    const context = vm.createContext({
        App: {
            game: {
                gems: { gemWallet: [() => walletGems] },
                statistics: { gemsGained: [() => gainedGems] },
            },
        },
        readObservable: value => typeof value === 'function' ? value() : value,
    });
    vm.runInContext(resourceHelpers, context);

    assert.equal(vm.runInContext('getGemBalance(0)', context), 125);
    assert.equal(vm.runInContext('getGemGainCount(0)', context), 400);
    assert.equal(
        vm.runInContext("getResourceGoalProgress('finite', 140, 100)", context),
        40
    );
    assert.equal(
        vm.runInContext("getResourceGoalProgress('owned', 140, 100)", context),
        140
    );
    assert.equal(
        vm.runInContext("getResourceGoalRemaining('owned', 150, 140, 100)", context),
        10
    );

    walletGems = 117;
    assert.equal(vm.runInContext('getGemBalance(0)', context), 117);
    assert.equal(
        vm.runInContext("getResourceGoalRemaining('owned', 150, 117, 100)", context),
        33,
        'spending the resource must increase remaining owned-target work'
    );
});

test('Dungeon Token owned goals complete before scanning or moving and watch the live balance', () => {
    let tokens = 125;
    let scans = 0;
    let moves = 0;
    let activeJob = null;
    let completion = null;
    const route = { number: 1, region: 0, routeName: 'Test Route' };
    const context = vm.createContext({
        console: { log() {}, error() {} },
        stopForegroundJob(reason, completed = false) {
            completion = { reason, completed };
            activeJob = null;
        },
        requireFiniteTarget(mode, value) {
            return mode === 'indefinite' ? null : Number(value);
        },
        getDungeonTokens: () => tokens,
        completeForegroundStart(id, reason) {
            completion = { id, reason, completed: true };
        },
        failForegroundStart(id, reason) {
            throw new Error(id + ': ' + reason);
        },
        formatNumber: value => String(value),
        scanDungeonTokenRoutes() {
            scans++;
            return [{ route, estimatedDTPerMinute: 60 }];
        },
        activateForegroundJob(job) {
            activeJob = job;
            job.start();
        },
        MapHelper: {
            moveToRoute() {
                moves++;
            },
        },
        isOnRoute: () => true,
        makeProgressText: (label, value, target) =>
            label + ': ' + value + ' / ' + target,
    });
    vm.runInContext(
        resourceHelpers +
            functionSlice(
                '    function startDungeonTokenAutomation(mode, rawTarget) {',
                '    function startTypeFarmAutomation(mode, rawTarget) {'
            ),
        context
    );

    vm.runInContext("startDungeonTokenAutomation('owned', 100)", context);
    assert.equal(scans, 0);
    assert.equal(moves, 0);
    assert.equal(completion.completed, true);

    completion = null;
    vm.runInContext("startDungeonTokenAutomation('owned', 150)", context);
    assert.equal(scans, 1);
    assert.equal(moves, 1);
    assert.ok(activeJob.detail.includes('DT owned: 125 / 150'));

    tokens = 110;
    activeJob.tick();
    assert.ok(activeJob.detail.includes('DT owned: 110 / 150'));

    tokens = 150;
    activeJob.tick();
    assert.equal(activeJob, null);
    assert.equal(completion.completed, true);

    completion = null;
    tokens = 200;
    vm.runInContext("startDungeonTokenAutomation('finite', 20)", context);
    tokens = 219;
    activeJob.tick();
    assert.notEqual(activeJob, null);
    assert.ok(activeJob.detail.includes('DT gained: 19 / 20'));
    tokens = 220;
    activeJob.tick();
    assert.equal(activeJob, null);
    assert.equal(completion.completed, true);
});

test('Gem owned goals use gemWallet, complete before scanning, and preserve Gain X statistics', () => {
    let walletGems = 125;
    let gainedGems = 500;
    let scans = 0;
    let routeMoves = 0;
    let activeJob = null;
    let completion = null;
    const route = { number: 1, region: 0 };
    const best = {
        kind: 'Route',
        name: 'Test Route',
        location: 'Test Route',
        route,
        gemsPerMinute: 60,
    };
    const context = vm.createContext({
        console: { log() {}, error() {} },
        selectedGemType: 'Water',
        PokemonType: { Water: 0 },
        stopForegroundJob(reason, completed = false) {
            if (activeJob) {
                activeJob.cleanup && activeJob.cleanup();
            }
            completion = { reason, completed };
            activeJob = null;
        },
        requireFiniteTarget(mode, value) {
            return mode === 'indefinite' ? null : Number(value);
        },
        getGemBalance: () => walletGems,
        getGemGainCount: () => gainedGems,
        completeForegroundStart(id, reason) {
            completion = { id, reason, completed: true };
        },
        failForegroundStart(id, reason) {
            throw new Error(id + ': ' + reason);
        },
        formatNumber: value => String(value),
        scanGemFarms() {
            scans++;
            return [best];
        },
        activateForegroundJob(job) {
            activeJob = job;
            job.start();
        },
        MapHelper: {
            moveToRoute() {
                routeMoves++;
            },
        },
        isOnRoute: () => true,
        makeProgressText: (label, value, target) =>
            label + ': ' + value + ' / ' + target,
        GymRunner: { autoRestart() {} },
    });
    vm.runInContext(
        functionSlice(
            '    function isOwnedTargetMode(mode) {',
            '    function getCapturedCountByType(type) {'
        ) +
        functionSlice(
            '    function startGemFarmAutomation(mode, rawTarget) {',
            '    function getFarmCandidate(berry, availablePlots, finiteTarget = null) {'
        ),
        context
    );

    vm.runInContext("startGemFarmAutomation('owned', 100)", context);
    assert.equal(scans, 0);
    assert.equal(routeMoves, 0);

    completion = null;
    vm.runInContext("startGemFarmAutomation('owned', 150)", context);
    assert.equal(scans, 1);
    assert.ok(activeJob.detail.includes('Water gems owned: 125 / 150'));

    walletGems = 140;
    activeJob.tick();
    assert.ok(activeJob.detail.includes('Water gems owned: 140 / 150'));
    walletGems = 117;
    activeJob.tick();
    assert.ok(activeJob.detail.includes('Water gems owned: 117 / 150'));
    walletGems = 150;
    activeJob.tick();
    assert.equal(activeJob, null);
    assert.equal(completion.completed, true);

    completion = null;
    walletGems = 9999;
    gainedGems = 500;
    vm.runInContext("startGemFarmAutomation('finite', 20)", context);
    gainedGems = 519;
    activeJob.tick();
    assert.notEqual(activeJob, null);
    assert.ok(activeJob.detail.includes('Water gems gained: 19 / 20'));
    gainedGems = 520;
    activeJob.tick();
    assert.equal(activeJob, null);
    assert.equal(completion.completed, true);
});

test('Auto Farmer owned goals complete immediately and optimize only remaining Farm Points', () => {
    let farmPoints = 80;
    const inventories = [2, 2];
    let plants = 0;
    const plots = [0, 1].map(() => ({
        isUnlocked: true,
        isSafeLocked: false,
        berry: null,
        isEmpty() {
            return this.berry === null;
        },
        stage: () => 0,
    }));
    const farming = {
        berryInventory: inventories.map((value, index) => () => inventories[index]),
        unlockedBerries: [() => true, () => true],
        getGrowthMultiplier: () => 1,
        plotList: plots,
        plant(index, berry) {
            plants++;
            plots[index].berry = berry;
        },
        harvest() {},
    };
    const context = vm.createContext({
        console: { log() {}, error() {} },
        App: { game: { farming } },
        BerryList: [
            { harvestAmount: 2, growthTime: [1, 2, 5, 10, 20], farmValue: 5 },
            { harvestAmount: 2, growthTime: [1, 2, 50, 100, 200], farmValue: 100 },
        ],
        BerryType: ['Quick', 'Slow'],
        PlotStage: { Bloom: 3, Berry: 4 },
        getFarmPoints: () => farmPoints,
        formatNumber: value => String(value),
        makeProgressText: (label, value, target) =>
            label + ': ' + value + ' / ' + target,
        updateAutomationUI() {},
        farmerJob: null,
        farmerLastStatus: 'Idle',
    });
    vm.runInContext(
        functionSlice(
            '    function isOwnedTargetMode(mode) {',
            '    function getCapturedCountByType(type) {'
        ) +
        functionSlice(
            '    function getFarmCandidate(berry, availablePlots, finiteTarget = null) {',
            '    function getAvailableDungeons() {'
        ),
        context
    );

    farmPoints = 100;
    vm.runInContext("startAutoFarmer('auto', 'farmPointsOwned', 100)", context);
    assert.equal(plants, 0);
    assert.match(context.farmerLastStatus, /^Complete:/);

    inventories[0] = 50;
    vm.runInContext("startAutoFarmer('0', 'berriesOwned', 40)", context);
    assert.equal(plants, 0);
    assert.match(context.farmerLastStatus, /^Complete:/);

    inventories[0] = 2;
    farmPoints = 80;
    vm.runInContext("startAutoFarmer('auto', 'farmPointsOwned', 100)", context);
    assert.equal(context.farmerJob.berry, 0,
        '20 remaining FP should select the fast finite berry');
    assert.ok(context.farmerJob.detail.includes('Farm Points owned: 80 / 100'));

    farmPoints = 95;
    vm.runInContext('runAutoFarmerTick()', context);
    assert.notEqual(context.farmerJob, null);
    farmPoints = 85;
    vm.runInContext('runAutoFarmerTick()', context);
    assert.ok(context.farmerJob.detail.includes('Farm Points owned: 85 / 100'));
    farmPoints = 100;
    vm.runInContext('runAutoFarmerTick()', context);
    assert.equal(context.farmerJob, null);

    inventories[0] = 12;
    assert.equal(
        vm.runInContext(
            "getFarmerProgress({ mode: 'berries', resource: 'berries', berry: 0, baseline: 2 })",
            context
        ),
        10
    );
    assert.equal(
        vm.runInContext(
            "getFarmerProgress({ mode: 'berriesOwned', resource: 'berries', berry: 0, baseline: 2 })",
            context
        ),
        12
    );

    farmPoints = 95;
    assert.equal(
        vm.runInContext(
            "getFarmerProgress({ mode: 'farmPoints', resource: 'farmPoints', berry: 0, baseline: 80 })",
            context
        ),
        15
    );
    assert.equal(
        vm.runInContext(
            "getFarmerProgress({ mode: 'farmPointsOwned', resource: 'farmPoints', berry: 0, baseline: 80 })",
            context
        ),
        95
    );
});

function createGymHarness(initialClears, allowPaid, resultKind = 'Gym') {
    let clears = initialClears;
    let money = 1000;
    let gemsGained = 0;
    let running = false;
    let activeGym = null;
    let autoRestart = false;
    let activeJob = null;
    let stopped = null;
    let routeMoves = 0;
    const startCalls = [];
    const gym = {
        town: 'Test Town',
        moneyReward: 100,
        isUnlocked: () => true,
    };
    const route = { number: 1, region: 0 };
    const result = resultKind === 'Gym'
        ? {
            kind: 'Gym',
            name: 'Leader',
            location: 'Test Town',
            gym,
            gemsPerMinute: 60,
        }
        : {
            kind: 'Route',
            name: 'Test Route',
            location: 'Test Route',
            route,
            gemsPerMinute: 60,
        };
    const GameConstants = {
        GameState: { town: 'town', gym: 'gym', fighting: 'fighting' },
        Currency: { money: 0 },
        getGymIndex: () => 0,
    };
    const App = {
        game: {
            gameState: GameConstants.GameState.town,
            statistics: {
                gymsDefeated: [() => clears],
            },
        },
    };
    const GymRunner = {
        running: () => running,
        gymObservable: () => activeGym,
        autoRestart(value) {
            if (arguments.length) {
                autoRestart = value;
            }
            return autoRestart;
        },
        startGym(selectedGym, useAutoRestart, initialRun) {
            startCalls.push({ useAutoRestart, initialRun });
            activeGym = selectedGym;
            autoRestart = useAutoRestart;
            running = true;
            App.game.gameState = GameConstants.GameState.gym;
        },
    };
    const context = vm.createContext({
        console: { log() {}, error() {} },
        gym,
        App,
        GameConstants,
        GymRunner,
        GymBattle: { gym: null },
        MapHelper: {
            moveToTown() {},
            moveToRoute() {
                routeMoves++;
            },
        },
        player: { town: { name: gym.town } },
        PokemonType: { Water: 0 },
        selectedGemType: 'Water',
        gemFarmAllowPaidGymAutorun: allowPaid,
        readObservable: value => typeof value === 'function' ? value() : value,
        getCurrencyAmount: () => money,
        getGemGainCount: () => gemsGained,
        getGemBalance: () => 0,
        requireFiniteTarget(mode, value) {
            return mode === 'indefinite' ? null : Number(value);
        },
        formatNumber: value => String(value),
        makeProgressText: (label, value, target) =>
            label + ': ' + value + ' / ' + target,
        scanGemFarms: () => [result],
        isOnRoute: () => true,
        completeForegroundStart() {},
        failForegroundStart(id, reason) {
            throw new Error(id + ': ' + reason);
        },
        activateForegroundJob(job) {
            activeJob = job;
            job.start();
        },
        stopForegroundJob(reason, completed = false) {
            const job = activeJob;
            activeJob = null;
            if (job) {
                job.cleanup && job.cleanup();
            }
            stopped = { reason, completed };
        },
        updateGemUI() {},
    });
    vm.runInContext(
        functionSlice(
            '    function isOwnedTargetMode(mode) {',
            '    function getCapturedCountByType(type) {'
        ) +
        functionSlice(
            '    function getGymClearCount(gym) {',
            '    function getFarmCandidate(berry, availablePlots, finiteTarget = null) {'
        ),
        context
    );
    return {
        context,
        gym,
        App,
        startCalls,
        get job() { return activeJob; },
        get stopped() { return stopped; },
        get autoRestart() { return autoRestart; },
        get routeMoves() { return routeMoves; },
        set clears(value) { clears = value; },
        set money(value) { money = value; },
        set gems(value) { gemsGained = value; },
        set running(value) { running = value; },
        set activeGym(value) { activeGym = value; },
        set autoRestart(value) { autoRestart = value; },
    };
}

test('gym autorun state respects 10 and 100 clear thresholds', () => {
    const harness = createGymHarness(9, true);
    assert.equal(
        vm.runInContext('getGymAutoRepeatState(gym, true).mode', harness.context),
        'locked'
    );

    harness.clears = 10;
    assert.equal(
        vm.runInContext('getGymAutoRepeatState(gym, false).mode', harness.context),
        'manual'
    );
    assert.equal(
        vm.runInContext('getGymAutoRepeatState(gym, true).mode', harness.context),
        'paid'
    );
    assert.equal(
        vm.runInContext('getGymAutoRepeatState(gym, true).cost', harness.context),
        200
    );

    harness.clears = 99;
    assert.equal(
        vm.runInContext('getGymAutoRepeatState(gym, true).useBuiltIn', harness.context),
        true
    );
    harness.clears = 100;
    assert.equal(
        vm.runInContext('getGymAutoRepeatState(gym, false).mode', harness.context),
        'free'
    );
    assert.equal(
        vm.runInContext('getGymAutoRepeatState(gym, false).useBuiltIn', harness.context),
        true
    );
});

test('Gem gym execution transitions thresholds, falls back when unpaid, and cleans up', () => {
    const harness = createGymHarness(9, true);
    vm.runInContext("startGemFarmAutomation('indefinite', 0)", harness.context);
    assert.equal(harness.startCalls[0].useAutoRestart, false);

    harness.running = false;
    harness.App.game.gameState = harness.context.GameConstants.GameState.town;
    harness.autoRestart = false;
    harness.clears = 10;
    harness.job.tick();
    assert.equal(harness.startCalls.at(-1).useAutoRestart, true,
        'crossing 10 clears should enable paid built-in repeat');

    harness.running = false;
    harness.App.game.gameState = harness.context.GameConstants.GameState.town;
    harness.autoRestart = true;
    harness.money = 0;
    harness.clears = 11;
    harness.job.tick();
    assert.equal(harness.startCalls.at(-1).useAutoRestart, false,
        'an unaffordable paid repeat must fall back to manual restart');
    assert.notEqual(harness.job, null);

    harness.running = false;
    harness.App.game.gameState = harness.context.GameConstants.GameState.town;
    harness.autoRestart = false;
    harness.clears = 12;
    harness.job.tick();
    assert.equal(harness.startCalls.at(-1).useAutoRestart, false,
        'manual restart should continue while the repeat remains unaffordable');

    harness.running = false;
    harness.App.game.gameState = harness.context.GameConstants.GameState.town;
    harness.autoRestart = false;
    harness.money = 200;
    harness.clears = 13;
    harness.job.tick();
    assert.equal(harness.startCalls.at(-1).useAutoRestart, true,
        'paid repeat should be retried after it becomes affordable');

    const startsBeforeFreeTransition = harness.startCalls.length;
    harness.running = true;
    harness.App.game.gameState = harness.context.GameConstants.GameState.gym;
    harness.activeGym = harness.gym;
    harness.autoRestart = true;
    harness.clears = 100;
    harness.job.tick();
    assert.equal(harness.startCalls.length, startsBeforeFreeTransition,
        'an already-running built-in repeat must not also be manually restarted');
    assert.equal(harness.autoRestart, true);

    harness.job.mode = 'finite';
    harness.job.target = 5;
    harness.job.baseline = 0;
    harness.gems = 5;
    harness.running = true;
    harness.App.game.gameState = harness.context.GameConstants.GameState.gym;
    harness.activeGym = harness.gym;
    harness.autoRestart = true;
    const startsBeforeCompletion = harness.startCalls.length;
    harness.job.tick();
    assert.equal(harness.job, null);
    assert.equal(harness.stopped.completed, true);
    assert.equal(harness.autoRestart, false,
        'normal completion cleanup must disable future auto-repeat');
    assert.equal(harness.startCalls.length, startsBeforeCompletion,
        'completion must not deliberately start another gym');
});

test('route Gem Farm does not use gym auto-repeat', () => {
    const harness = createGymHarness(0, true, 'Route');
    vm.runInContext("startGemFarmAutomation('indefinite', 0)", harness.context);
    assert.equal(harness.routeMoves, 1);
    assert.equal(harness.startCalls.length, 0);
    assert.notEqual(harness.job, null);
});

test('owned goal labels persist separately and Type Farm has no owned mode', () => {
    assert.ok(source.includes("'myGemFarmAllowPaidGymAutorun'"));
    assert.ok(source.includes("'Allow paid gym autorun'"));
    assert.ok(source.includes("['owned', 'Reach X DT owned']"));
    assert.ok(source.includes("['owned', 'Reach X selected gems owned']"));
    assert.ok(source.includes("['farmPointsOwned', 'Reach X Farm Points owned']"));
    assert.ok(source.includes("['berriesOwned', 'Reach X selected berry inventory']"));

    const typeConfig = functionSlice(
        "                id: 'type',",
        '        const decorateTitle ='
    );
    assert.ok(typeConfig.includes("finiteLabel: 'Catch X selected-type"));
    assert.equal(typeConfig.includes("'owned'"), false);
});