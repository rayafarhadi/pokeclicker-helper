const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'pokeclicker-automation.user.js'),
    'utf8'
);

function sourceSlice(start, end) {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex);
    assert.notEqual(startIndex, -1, 'Missing source marker: ' + start);
    assert.notEqual(endIndex, -1, 'Missing source marker: ' + end);
    return source.slice(startIndex, endIndex);
}

const combatSimulator = sourceSlice(
    '    function simulateCombatSequence(',
    '    function getCombatDamage('
);

function createCombatContext() {
    const context = vm.createContext({ CLICK_INTERVAL: 50 });
    vm.runInContext(combatSimulator, context);
    return context;
}

function simulate(context, opponents, options = {}) {
    context.testOpponents = opponents;
    context.testOptions = options;
    return vm.runInContext(
        'simulateCombatSequence(testOpponents, testOptions)',
        context
    );
}

test('discrete combat handles click, Pokémon, combined, and invalid damage cases', () => {
    const context = createCombatContext();

    assert.equal(simulate(context, [
        { health: 10, clickAttack: 10, pokemonAttack: 0 },
    ]), 50, 'one-click kill');
    assert.equal(simulate(context, [
        { health: 30, clickAttack: 10, pokemonAttack: 0 },
    ]), 150, 'multiple clicks before one second');
    assert.equal(simulate(context, [
        { health: 100, clickAttack: 0, pokemonAttack: 100 },
    ]), 1000, 'one automatic attack kill');
    assert.equal(simulate(context, [
        { health: 250, clickAttack: 0, pokemonAttack: 100 },
    ]), 3000, 'multiple automatic attacks');
    assert.equal(simulate(context, [
        { health: 250, clickAttack: 5, pokemonAttack: 150 },
    ]), 1000, 'simultaneous click and automatic attack combine at one second');
    assert.equal(simulate(context, [
        { health: 100, clickAttack: 30, pokemonAttack: 40 },
    ], {
        clickIntervalMs: 700,
        clickOriginMs: 700,
        pokemonIntervalMs: 1000,
    }), 1400, 'automatic attack can arrive between click events');

    assert.equal(simulate(context, [
        { health: 100, clickAttack: 0, pokemonAttack: 100 },
    ]), 1000, 'disabled or zero click attack is supported');
    assert.equal(simulate(context, [
        { health: 100, clickAttack: 100, pokemonAttack: 0 },
    ]), 50, 'zero Pokémon attack is supported');
    assert.equal(simulate(context, [
        { health: 100, clickAttack: 0, pokemonAttack: 0 },
    ]), Infinity, 'zero total damage cannot finish');
    assert.equal(simulate(context, [
        { health: NaN, clickAttack: 1, pokemonAttack: 1 },
    ]), Infinity, 'invalid HP is rejected');
    assert.equal(simulate(context, [
        { health: 1e9, clickAttack: 1, pokemonAttack: 0 },
    ]), 50e9, 'large HP uses bounded mathematical search');
});

test('sequence combat resets Pokémon timing and preserves the global click schedule', () => {
    const context = createCombatContext();

    assert.equal(simulate(context, [
        { health: 10, clickAttack: 10, pokemonAttack: 0 },
        { health: 10, clickAttack: 10, pokemonAttack: 0 },
    ]), 100, 'click schedule continues into the next opponent');

    assert.equal(simulate(context, [
        { health: 100, clickAttack: 0, pokemonAttack: 100 },
        { health: 100, clickAttack: 0, pokemonAttack: 100 },
    ]), 2000, 'each new opponent waits for a fresh Pokémon attack tick');

    assert.equal(simulate(context, [
        { health: 20, clickAttack: 10, pokemonAttack: 0 },
        { health: 10, clickAttack: 10, pokemonAttack: 0 },
        { health: 20, clickAttack: 10, pokemonAttack: 0 },
        { health: 10, clickAttack: 10, pokemonAttack: 0 },
    ]), 300, 'click timing continues across repeated Gym clears');
});

test('click damage lookup is read-only and respects the no-click challenge', () => {
    let argument;
    const context = vm.createContext({
        App: {
            game: {
                challenges: {
                    list: {
                        disableClickAttack: { active: () => false },
                    },
                },
                party: {
                    calculateClickAttack(value) {
                        argument = value;
                        return 42;
                    },
                },
            },
        },
        player: { regionStarters: [] },
        GameConstants: {
            Region: { kanto: 0 },
            Starter: { None: -1 },
        },
    });
    vm.runInContext(sourceSlice(
        '    function isClickAttackAvailable()',
        '    function getPokemonAttackDamage('
    ), context);

    assert.equal(vm.runInContext('getClickAttackDamage()', context), 42);
    assert.equal(argument, false, 'estimation must not mark a click bonus as used');

    context.App.game.challenges.list.disableClickAttack.active = () => true;
    context.player.regionStarters[0] = () => 1;
    assert.equal(vm.runInContext('getClickAttackDamage()', context), 0);
});

function createCaptureHarness(selectedBall = 0, magicBonus = 5) {
    let filterCalls = 0;
    let bonusCalls = 0;
    const quantities = [100, 100, 0, 0, 0, 0, 0, 0, 5];
    const Pokeball = {
        None: -1,
        Pokeball: 0,
        Greatball: 1,
        Ultraball: 2,
        Luxuryball: 8,
        '-1': 'None',
        0: 'Pokeball',
        1: 'Greatball',
        2: 'Ultraball',
        8: 'Luxuryball',
    };
    const context = vm.createContext({
        App: {
            game: {
                oakItems: {
                    calculateBonus() {
                        bonusCalls++;
                        return magicBonus;
                    },
                },
                pokeballs: {
                    calculatePokeballToUse(id, shiny, shadow, encounter) {
                        filterCalls++;
                        assert.equal(id, 25);
                        assert.equal(shiny, false);
                        assert.equal(shadow, false);
                        assert.equal(encounter, 'route');
                        return selectedBall;
                    },
                    calculateCatchTime(ball) {
                        return [1250, 1000, 750, 0, 0, 0, 0, 0, 1250][ball];
                    },
                    getBallQuantity(ball) {
                        return quantities[ball] ?? 0;
                    },
                },
            },
        },
        PokemonFactory: { catchRateHelper: () => 20 },
        GameConstants: {
            Pokeball,
            Currency: { dungeonToken: 2 },
            LuxuryBallCurrencyRate: { 2: 15000 },
            clipNumber: (value, min, max) => Math.min(max, Math.max(min, value)),
        },
        EncounterType: { route: 'route' },
        OakItemType: { Magic_Ball: 3 },
        getBallBonusForRoute(ball) {
            return ball === 1 ? 5 : ball === 2 ? 10 : 0;
        },
    });
    vm.runInContext(sourceSlice(
        '    const CAPTURE_STRATEGIES =',
        '    // Auto Clicker'
    ), context);
    return {
        context,
        pokemon: { id: 25, name: 'Pikachu', catchRate: 100 },
        route: { routeName: 'Route 1' },
        get filterCalls() { return filterCalls; },
        get bonusCalls() { return bonusCalls; },
        quantities,
    };
}

test('capture evaluation preserves filters, adds Magic Ball, caps chance, and charges delay on attempts', () => {
    const harness = createCaptureHarness(1, 5);
    harness.context.route = harness.route;
    harness.context.pokemon = harness.pokemon;
    let result = vm.runInContext(
        "evaluateRouteCapture(route, pokemon, CAPTURE_STRATEGIES.currentSettings)",
        harness.context
    );
    assert.equal(result.ballType, 1);
    assert.equal(result.catchChance, 0.30);
    assert.equal(result.catchTime, 1);
    assert.equal(result.throws, 1);
    assert.equal(harness.filterCalls, 1);
    assert.equal(harness.bonusCalls, 1);

    const inactive = createCaptureHarness(0, 0);
    inactive.context.route = inactive.route;
    inactive.context.pokemon = inactive.pokemon;
    const standard = vm.runInContext(
        "evaluateRouteCapture(route, pokemon, CAPTURE_STRATEGIES.currentSettings)",
        inactive.context
    );
    assert.equal(standard.ballType, 0);
    assert.equal(standard.catchChance, 0.20,
        'inactive Magic Ball contributes zero bonus');
    assert.equal(standard.catchTime, 1.25);

    harness.context.App.game.oakItems.calculateBonus = () => 100;
    result = vm.runInContext(
        "evaluateRouteCapture(route, pokemon, CAPTURE_STRATEGIES.ultraAll)",
        harness.context
    );
    assert.equal(result.ballType, 2, 'hypothetical Ultra Ball ignores zero inventory');
    assert.equal(result.catchChance, 1, 'catch chance is capped at 100%');
    assert.equal(result.catchTime, 0.75);

    result = vm.runInContext(
        "evaluateRouteCapture(route, pokemon, CAPTURE_STRATEGIES.ultraTargetOnly, false)",
        harness.context
    );
    assert.equal(result.ballType, -1);
    assert.equal(result.catchChance, 0);
    assert.equal(result.catchTime, 0);
    assert.equal(result.throws, 0);
});

test('no selected ball has no catch delay and Luxury Ball pays one-sixth expected Dungeon Tokens', () => {
    const none = createCaptureHarness(-1, 10);
    none.context.route = none.route;
    none.context.pokemon = none.pokemon;
    const noThrow = vm.runInContext(
        "evaluateRouteCapture(route, pokemon, CAPTURE_STRATEGIES.currentSettings)",
        none.context
    );
    assert.equal(noThrow.catchChance, 0);
    assert.equal(noThrow.catchTime, 0);
    assert.equal(none.bonusCalls, 0, 'no-ball evaluation does not query or use Magic Ball');

    assert.equal(
        vm.runInContext('getExpectedDungeonTokensPerCatch(101.2, 0)', none.context),
        102
    );
    assert.equal(
        vm.runInContext('getExpectedDungeonTokensPerCatch(101.2, 8)', none.context),
        17
    );
});

function routeData() {
    return {
        TargetPrimary: {
            id: 1, name: 'TargetPrimary', hitpoints: 100,
            catchRate: 100, type1: 1, type2: -1,
        },
        TargetSecondary: {
            id: 2, name: 'TargetSecondary', hitpoints: 100,
            catchRate: 100, type1: 2, type2: 1,
        },
        Other: {
            id: 3, name: 'Other', hitpoints: 100,
            catchRate: 100, type1: 2, type2: -1,
        },
    };
}

function createTypeScoreContext(names = ['TargetPrimary', 'Other']) {
    const data = routeData();
    const context = vm.createContext({
        CAPTURE_STRATEGIES: {
            currentSettings: 'currentSettings',
            ultraAll: 'ultraAll',
            ultraTargetOnly: 'ultraTargetOnly',
        },
        RouteHelper: {
            getAvailablePokemonList: () => names,
            getAvailablePokemonWeightList: () => names.map(() => 1),
        },
        PokemonFactory: { routeHealth: () => 100 },
        PokemonHelper: { getPokemonByName: name => data[name] },
        estimateKillTime: () => 1,
        evaluateRouteCapture(route, pokemon, strategy, matchesTarget) {
            if (strategy === 'ultraTargetOnly' && !matchesTarget) {
                return { ballType: -1, catchChance: 0, catchTime: 0, throws: 0 };
            }
            if (strategy === 'currentSettings') {
                return { ballType: 0, catchChance: matchesTarget ? 0.5 : 0.25, catchTime: 1, throws: 1 };
            }
            return { ballType: 2, catchChance: 1, catchTime: 1, throws: 1 };
        },
        addExpectedBallUse(totals, ballType, amount) {
            if (ballType >= 0) totals[ballType] = (totals[ballType] ?? 0) + amount;
        },
        console: { warn() {} },
    });
    vm.runInContext(sourceSlice(
        '    function scoreRouteForTypeCatches(',
        '    function scanTypeCatchRoutes()'
    ), context);
    return context;
}

test('Type Farm scenarios count target catches while retaining all combat and applicable capture delays', () => {
    const context = createTypeScoreContext();
    context.route = { isUnlocked: () => true, number: 1, region: 0, subRegion: 0, routeName: 'Mixed Route' };

    const current = vm.runInContext(
        "scoreRouteForTypeCatches(route, 1, 'currentSettings')",
        context
    );
    const ultraAll = vm.runInContext(
        "scoreRouteForTypeCatches(route, 1, 'ultraAll')",
        context
    );
    const targetOnly = vm.runInContext(
        "scoreRouteForTypeCatches(route, 1, 'ultraTargetOnly')",
        context
    );

    assert.equal(current.catchesPerMinute, 7.5);
    assert.equal(ultraAll.catchesPerMinute, 15);
    assert.equal(targetOnly.catchesPerMinute, 20);
    assert.equal(targetOnly.expectedTimePerEncounter, 1.5,
        'non-target combat remains while target-only skips non-target capture delay');
    assert.equal(targetOnly.ballUsagePerEncounter[2], 0.5);
});

test('Type matching accepts secondary types and zero-yield current routes are excluded', () => {
    const context = createTypeScoreContext(['TargetSecondary']);
    context.route = { isUnlocked: () => true, number: 1, region: 0, routeName: 'Secondary Route' };
    assert.ok(vm.runInContext(
        "scoreRouteForTypeCatches(route, 1, 'currentSettings')",
        context
    ));

    context.evaluateRouteCapture = () => ({
        ballType: -1, catchChance: 0, catchTime: 0, throws: 0,
    });
    assert.equal(vm.runInContext(
        "scoreRouteForTypeCatches(route, 1, 'currentSettings')",
        context
    ), null);
});

test('Dungeon Token strategies differ and apply Luxury Ball expected value', () => {
    const pokemon = routeData().TargetPrimary;
    const context = vm.createContext({
        CAPTURE_STRATEGIES: { currentSettings: 'currentSettings', ultraAll: 'ultraAll' },
        RouteHelper: {
            getAvailablePokemonList: () => ['TargetPrimary'],
            getAvailablePokemonWeightList: () => [1],
        },
        PokemonFactory: {
            routeDungeonTokens: () => 120,
            routeHealth: () => 100,
        },
        PokemonHelper: { getPokemonByName: () => pokemon },
        estimateKillTime: () => 1,
        evaluateRouteCapture(route, data, strategy) {
            return strategy === 'currentSettings'
                ? { ballType: 8, catchChance: 0.5, catchTime: 1, throws: 1 }
                : { ballType: 2, catchChance: 1, catchTime: 0.5, throws: 1 };
        },
        getExpectedDungeonTokensPerCatch(reward, ball) {
            return ball === 8 ? Math.ceil(reward) / 6 : Math.ceil(reward);
        },
        addExpectedBallUse(totals, ball, amount) {
            totals[ball] = (totals[ball] ?? 0) + amount;
        },
        console: { warn() {} },
    });
    vm.runInContext(sourceSlice(
        '    function calculateRouteDTScore(',
        '    function scanDungeonTokenRoutes()'
    ), context);
    context.route = { isUnlocked: () => true, number: 1, region: 0, routeName: 'Route 1' };

    const current = vm.runInContext(
        "calculateRouteDTScore(route, 'currentSettings')",
        context
    );
    const ultra = vm.runInContext(
        "calculateRouteDTScore(route, 'ultraAll')",
        context
    );
    assert.equal(current.expectedRewardPerEncounter, 10);
    assert.equal(current.estimatedDTPerMinute, 300);
    assert.equal(ultra.expectedRewardPerEncounter, 120);
    assert.equal(ultra.estimatedDTPerMinute, 4800);
});

test('Blackthorn City Gym regression preserves HP, Gem rewards, timing, and timer eligibility', () => {
    const PokemonType = { None: -1, Dragon: 1, Water: 2 };
    const makePokemon = (name, maxHealth, type1, type2) => ({
        name,
        maxHealth,
        getBaseData: () => ({ type1, type2 }),
    });
    const team = [
        makePokemon('Dragonair', 205000, PokemonType.Dragon, PokemonType.None),
        makePokemon('Dragonair', 205000, PokemonType.Dragon, PokemonType.None),
        makePokemon('Dragonair', 218000, PokemonType.Dragon, PokemonType.None),
        makePokemon('Kingdra', 220000, PokemonType.Water, PokemonType.Dragon),
    ];
    const context = vm.createContext({
        PokemonType,
        GameConstants: {
            GYM_GEMS: 5,
            GYM_TIME: 30000,
            getGymRegion: () => 1,
            FluteItemType: { Time_Flute: 0 },
        },
        TownList: { 'Blackthorn City': { subRegion: 0 } },
        GymRunner: { timeBonus: () => 1 },
        getCombatDamage: () => ({ clickAttack: 50000, pokemonAttack: 0 }),
        simulateCombatSequence(opponents) {
            context.testOpponents = opponents;
            return vm.runInContext(
                'simulateCombatSequence(testOpponents)',
                context
            );
        },
        console: { warn() {} },
    });
    vm.runInContext('const CLICK_INTERVAL = 50;\n' + combatSimulator, context);
    vm.runInContext(sourceSlice(
        '    function getGymHostTown(gym) {',
        '    function getGymClearCount(gym) {'
    ), context);
    vm.runInContext(sourceSlice(
        '    function getGemRewardForPokemon(',
        '    function scoreRouteForGems('
    ), context);
    context.gym = {
        town: 'Blackthorn City',
        leaderName: 'Clair',
        isUnlocked: () => true,
        getPokemonList: () => team,
    };

    assert.deepEqual(team.map(p => [p.name, p.maxHealth]), [
        ['Dragonair', 205000],
        ['Dragonair', 205000],
        ['Dragonair', 218000],
        ['Kingdra', 220000],
    ]);

    const dragon = vm.runInContext(
        "scoreGymForGems('Blackthorn City', gym, PokemonType.Dragon)",
        context
    );
    const water = vm.runInContext(
        "scoreGymForGems('Blackthorn City', gym, PokemonType.Water)",
        context
    );
    assert.equal(dragon.totalGems, 35);
    assert.equal(water.totalGems, 5);
    assert.equal(dragon.combatTime, 1);
    assert.equal(dragon.gemsPerMinute, 35 * 60 / dragon.combatTime);
    assert.equal(water.gemsPerMinute, 5 * 60 / water.combatTime);
    assert.equal(dragon.timeLimit, 30);

    context.getCombatDamage = () => ({ clickAttack: 0, pokemonAttack: 10000 });
    assert.equal(vm.runInContext(
        "scoreGymForGems('Blackthorn City', gym, PokemonType.Dragon)",
        context
    ), null, 'a Gym exceeding the timer is not viable');
});

const preflightHelpers = sourceSlice(
    '    function estimateBallRequirements(',
    '    function startDungeonTokenAutomation('
);

function createPreflightContext(confirmResult = false) {
    let confirmations = 0;
    const quantities = { 0: 100, 1: 10 };
    const context = vm.createContext({
        getBallQuantity: ball => quantities[ball] ?? 0,
        getBallName: ball => ball === '0' ? 'Poké Ball' : 'Great Ball',
        formatNumber: value => String(value),
        confirm() {
            confirmations++;
            return confirmResult;
        },
    });
    vm.runInContext(preflightHelpers, context);
    return {
        context,
        quantities,
        get confirmations() { return confirmations; },
    };
}

test('inventory preflight handles sufficient, insufficient, mixed, cancellation, continuation, and zero yield', () => {
    const sufficient = createPreflightContext(false);
    sufficient.context.result = {
        route: { routeName: 'Route 1' },
        expectedRewardPerEncounter: 10,
        ballUsagePerEncounter: { 0: 0.5, 1: 0.25 },
    };
    let outcome = vm.runInContext(
        "confirmBallInventoryPreflight('DT Farm', 'Gain 100 DT', 100, result)",
        sufficient.context
    );
    assert.equal(outcome.canStart, true);
    assert.equal(sufficient.confirmations, 0);

    const cancelled = createPreflightContext(false);
    cancelled.context.result = sufficient.context.result;
    cancelled.quantities[0] = 1;
    cancelled.quantities[1] = 0;
    outcome = vm.runInContext(
        "confirmBallInventoryPreflight('DT Farm', 'Gain 100 DT', 100, result)",
        cancelled.context
    );
    assert.equal(outcome.canStart, false);
    assert.equal(outcome.cancelled, true);
    assert.equal(outcome.estimate.shortages.length, 2);
    assert.equal(cancelled.confirmations, 1);

    const continued = createPreflightContext(true);
    continued.context.result = sufficient.context.result;
    continued.quantities[0] = 0;
    continued.quantities[1] = 0;
    outcome = vm.runInContext(
        "confirmBallInventoryPreflight('Type Farm', 'Catch 100 Fire Pokémon', 100, result)",
        continued.context
    );
    assert.equal(outcome.canStart, true);
    assert.equal(continued.confirmations, 1);

    continued.context.result = {
        route: { routeName: 'Zero Route' },
        expectedRewardPerEncounter: 0,
        ballUsagePerEncounter: {},
    };
    outcome = vm.runInContext(
        "confirmBallInventoryPreflight('DT Farm', 'Gain 100 DT', 100, result)",
        continued.context
    );
    assert.equal(outcome.canStart, false);
    assert.match(outcome.error, /zero expected reward/);
});

test('finite start resolves inventory confirmation before replacing or activating a job', () => {
    let tokens = 50;
    let activated = 0;
    let preflightCalls = 0;
    let lastRemaining = null;
    let failed = null;
    const best = {
        route: { routeName: 'Route 1', number: 1, region: 0 },
        estimatedDTPerMinute: 60,
        expectedRewardPerEncounter: 10,
        ballUsagePerEncounter: { 0: 1 },
    };
    const context = vm.createContext({
        requireFiniteTarget: (mode, value) => mode === 'indefinite' ? null : Number(value),
        getDungeonTokens: () => tokens,
        completeForegroundStart() {},
        failForegroundStart(id, reason) { failed = { id, reason }; },
        formatNumber: String,
        scanDungeonTokenRoutes: () => [best],
        confirmBallInventoryPreflight(label, goal, remaining) {
            preflightCalls++;
            lastRemaining = remaining;
            return { canStart: false, cancelled: true };
        },
        activateForegroundJob() { activated++; },
        isOwnedTargetMode: mode => mode === 'owned',
        makeProgressText: () => '',
        stopForegroundJob() {},
        MapHelper: { moveToRoute() {} },
        isOnRoute: () => true,
    });
    vm.runInContext(sourceSlice(
        '    function startDungeonTokenAutomation(',
        '    function startTypeFarmAutomation('
    ), context);

    vm.runInContext("startDungeonTokenAutomation('owned', 100)", context);
    assert.equal(lastRemaining, 50);
    assert.equal(preflightCalls, 1);
    assert.equal(activated, 0, 'cancellation must not activate or replace a job');
    assert.match(failed.reason, /Cancelled/);

    failed = null;
    vm.runInContext("startDungeonTokenAutomation('indefinite', 0)", context);
    assert.equal(preflightCalls, 1, 'indefinite mode skips inventory warning');
    assert.equal(activated, 1);
});
test('ranking and release wiring preserve current execution and label hypothetical strategies', () => {
    assert.match(source, /@version\s+7\.4\.2/);
    assert.match(source, /version\.textContent = 'v7\.4\.2'/);
    assert.match(source, /Automation v7\.4\.2/);
    assert.ok(source.includes("'Ultra Ball — Catch All (comparison)'"));
    assert.ok(source.includes("'Ultra Ball — Target Only (comparison)'"));
    assert.ok(source.includes('theoreticalResults =\n                scenarios.currentSettings'));
    assert.ok(source.includes('typeFarmResults =\n                scenarios.currentSettings'));
    assert.doesNotMatch(source, /gainPokeballs\(|usePokeball\(|pokeballFilters\.(?:add|remove|push)/);
});