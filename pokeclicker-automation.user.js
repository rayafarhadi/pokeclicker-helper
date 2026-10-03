// ==UserScript==
// @name         My PokéClicker Automation
// @namespace    raya-pokeclicker
// @version      6.0.3
// @description  PokéClicker automation and optimization helpers.
// @match        https://www.pokeclicker.com/*
// @match        https://pokeclicker.com/*
// @grant        none
// @sandbox      raw
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/rayafarhadi/pokeclicker-helper/refs/heads/main/pokeclicker-automation.user.js
// @downloadURL  https://raw.githubusercontent.com/rayafarhadi/pokeclicker-helper/refs/heads/main/pokeclicker-automation.user.js
// @homepageURL  https://github.com/rayafarhadi/pokeclicker-helper
// ==/UserScript==

/* global
    App,
    GameConstants,
    Battle,
    GymBattle,
    DungeonBattle,
    TemporaryBattleBattle,
    BreedingController,
    RouteHelper,
    Routes,
    PokemonFactory,
    PokemonHelper,
    player,
    ko,
    EncounterType,
    MapHelper,
    CaughtStatus,
    GymList,
    TownList,
    PokemonType,
*/

(() => {
    'use strict';

    // ============================================================
    // Settings
    // ============================================================

    const CLICK_INTERVAL = 50;
    const HATCH_INTERVAL = 250;
    const DT_SAMPLE_INTERVAL = 1000;
    const DT_STABLE_SECONDS = 60;

    const CLICK_STORAGE_KEY = 'myAutoClickEnabled';
    const HATCH_MODE_STORAGE_KEY = 'myAutoHatchMode';
    const TYPE_FARM_STORAGE_KEY = 'myTypeFarmType';
    const GEM_FARM_STORAGE_KEY = 'myGemFarmType';
    const VITAMIN_REGION_STORAGE_KEY = 'myVitaminTargetRegion';

    let autoClickEnabled =
        localStorage.getItem(CLICK_STORAGE_KEY) === 'true';

    const HATCH_MODES = [
        'default',
        'pokerus',
        'off'
    ];

    let hatchMode =
        localStorage.getItem(HATCH_MODE_STORAGE_KEY);

    if (!HATCH_MODES.includes(hatchMode)) {
        const oldSetting =
            localStorage.getItem('myAutoHatchEnabled');

        hatchMode =
            oldSetting === 'false'
                ? 'off'
                : 'default';
    }

    const TYPE_FARM_TYPES = [
        PokemonType.Normal,
        PokemonType.Fire,
        PokemonType.Water,
        PokemonType.Electric,
        PokemonType.Grass,
        PokemonType.Ice,
        PokemonType.Fighting,
        PokemonType.Poison,
        PokemonType.Ground,
        PokemonType.Flying,
        PokemonType.Psychic,
        PokemonType.Bug,
        PokemonType.Rock,
        PokemonType.Ghost,
        PokemonType.Dragon,
        PokemonType.Dark,
        PokemonType.Steel,
        PokemonType.Fairy,
    ];

    let typeFarmType = Number(
        localStorage.getItem(TYPE_FARM_STORAGE_KEY) ??
        PokemonType.Fairy
    );

    if (!TYPE_FARM_TYPES.includes(typeFarmType)) {
        typeFarmType = PokemonType.Fairy;
    }

    const GEM_TYPES = [
        'Normal',
        'Fire',
        'Water',
        'Electric',
        'Grass',
        'Ice',
        'Fighting',
        'Poison',
        'Ground',
        'Flying',
        'Psychic',
        'Bug',
        'Rock',
        'Ghost',
        'Dragon',
        'Dark',
        'Steel',
        'Fairy'
    ];

    let selectedGemType =
        localStorage.getItem(GEM_FARM_STORAGE_KEY) ?? 'Rock';

    let selectedVitaminRegion = Number(
        localStorage.getItem(VITAMIN_REGION_STORAGE_KEY) ??
        player?.region ??
        0
    );

    // ============================================================
    // UI references
    // ============================================================

    let clickButton = null;
    let hatchButton = null;

    let dtHeaderButton = null;
    let dtPanel = null;
    let dtSuggestedText = null;
    let dtCurrentText = null;
    let dtRateText = null;
    let dtBestText = null;
    let dtSampleText = null;

    let gemHeaderButton = null;
    let gemPanel = null;
    let gemTypeSelect = null;
    let gemBestText = null;
    let gemTopText = null;

    let typeFarmHeaderButton = null;
    let typeFarmPanel = null;
    let typeFarmTypeSelect = null;
    let typeFarmBestText = null;
    let typeFarmTopText = null;

    let vitaminHeaderButton = null;
    let vitaminPanel = null;
    let vitaminRegionSelect = null;
    let vitaminSummaryText = null;
    let vitaminResultsText = null;

    // ============================================================
    // State
    // ============================================================

    let theoreticalResults = [];
    let gemResults = [];
    let typeFarmResults = [];
    let vitaminResults = [];
    let vitaminHasScanned = false;

    let dtHistory = [];
    let currentMeasuredRouteKey = null;
    let currentMeasuredRouteName = null;

    let bestMeasuredRate = 0;
    let bestMeasuredRoute = null;

    // ============================================================
    // Helpers
    // ============================================================

    function formatNumber(value) {
        if (!Number.isFinite(value)) {
            return '—';
        }

        if (value >= 1_000_000) {
            return `${(value / 1_000_000).toFixed(2)}m`;
        }

        if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}k`;
        }

        return value.toFixed(0);
    }

    function capitalize(value) {
        if (!value) {
            return value;
        }

        return (
            value.charAt(0).toUpperCase() +
            value.slice(1)
        );
    }

    function getRegionName(region) {
        try {
            return capitalize(
                GameConstants.Region[region]
            );
        } catch {
            return `Region ${region}`;
        }
    }

    function getCurrentRouteInfo() {
        try {
            const region =
                player.region;

            const routeNumber =
                player.route;

            const route =
                Routes.getRoute(
                    region,
                    routeNumber
                );

            if (!route) {
                return null;
            }

            return {
                region,
                routeNumber,
                route,
                key:
                    `${region}:${routeNumber}`,
                name:
                    route.routeName
            };

        } catch {
            console.error(
                '[DT Benchmark] Could not determine current route'
            );

            return null;
        }
    }

    function getDungeonTokens() {
        try {
            let index = 2;

            if (
                GameConstants.Currency &&
                GameConstants.Currency.dungeonTokens !== undefined
            ) {
                index =
                    GameConstants.Currency.dungeonTokens;
            } else if (
                GameConstants.Currency &&
                GameConstants.Currency.dungeonToken !== undefined
            ) {
                index =
                    GameConstants.Currency.dungeonToken;
            }

            const currency =
                App.game.wallet.currencies[index];

            if (typeof currency === 'function') {
                return currency();
            }

            if (
                typeof ko !== 'undefined'
            ) {
                return ko.unwrap(currency);
            }

            return Number(currency);

        } catch (error) {
            console.error(
                '[DT Benchmark] Could not read Dungeon Tokens',
                error
            );

            return NaN;
        }
    }

    function estimateKillTime(
        health,
        type1,
        type2,
        region,
        subRegion = 0
    ) {
        const pokemonAttack =
            App.game.party.calculatePokemonAttack(
                type1,
                type2,
                false,
                region,
                false,
                false,
                undefined,
                false,
                true,
                subRegion
            );

        const clickAttack =
            App.game.party.calculateClickAttack();

        const clickDPS =
            clickAttack *
            (
                1000 /
                CLICK_INTERVAL
            );

        const totalDPS =
            Math.max(
                1,
                pokemonAttack +
                clickDPS
            );

        return Math.max(
            CLICK_INTERVAL / 1000,
            health / totalDPS
        );
    }

    function getRouteKills(route) {
        const stats =
            App.game.statistics.routeKills;

        const value =
            stats?.[route.region]?.[route.number] ??
            stats?.[
            GameConstants.Region[route.region]
            ]?.[route.number];

        return typeof value === 'function'
            ? value()
            : Number(value ?? 0);
    }

    function getBallBonusForRoute(
        ballType,
        route,
        pokemon
    ) {
        const ball =
            App.game.pokeballs
                .pokeballs[ballType];

        const options = {
            pokemon: pokemon.name,
            encounterType: EncounterType.route
        };

        switch (ballType) {

            case GameConstants.Pokeball.Quickball: {
                const kills =
                    getRouteKills(route);

                return Math.min(
                    15,
                    Math.max(
                        0,
                        Math.pow(
                            16,
                            1 -
                            Math.pow(
                                Math.max(
                                    0,
                                    kills - 10
                                ),
                                0.6
                            ) / 145
                        ) - 1
                    )
                );
            }

            case GameConstants.Pokeball.Timerball: {
                const kills =
                    getRouteKills(route);

                return Math.min(
                    15,
                    Math.max(
                        0,
                        Math.pow(
                            16,
                            Math.pow(
                                kills,
                                0.6
                            ) / 250
                        ) - 1
                    )
                );
            }

            case GameConstants.Pokeball.Diveball: {
                const environments =
                    MapHelper.getEnvironments(
                        route.number,
                        route.region
                    );

                return environments.includes(
                    'Water'
                )
                    ? 15
                    : 0;
            }

            case GameConstants.Pokeball.Lureball: {
                const routeData =
                    Routes.getRoute(
                        route.region,
                        route.number
                    );

                const hasLandPokemon =
                    routeData.pokemon.land.length >
                    0;

                const isWaterPokemon =
                    routeData.pokemon.water.includes(
                        pokemon.name
                    );

                return (
                    hasLandPokemon &&
                    isWaterPokemon
                )
                    ? 15
                    : 0;
            }

            case GameConstants.Pokeball.Nestball: {
                const highestRegion =
                    player.highestRegion();

                const routes =
                    Routes.getRoutesByRegion(
                        highestRegion
                    );

                const maxRoute =
                    MapHelper.normalizeRoute(
                        routes[
                            routes.length - 1
                        ].number,
                        highestRegion
                    );

                const candidateRoute =
                    MapHelper.normalizeRoute(
                        route.number,
                        route.region
                    );

                return Math.min(
                    15,
                    Math.max(
                        1,
                        highestRegion
                    ) *
                    Math.max(
                        1,
                        maxRoute /
                        candidateRoute
                    )
                );
            }

            default:
                return ball.catchBonus(options);
        }
    }

    // ============================================================
    // Auto Clicker
    // ============================================================

    function attackIfAlive(battleClass) {
        const enemy =
            battleClass.enemyPokemon?.();

        if (
            enemy &&
            enemy.health() > 0
        ) {
            battleClass.clickAttack();
        }
    }

    function runAutoClick() {
        if (!autoClickEnabled) {
            return;
        }

        try {
            switch (App.game.gameState) {

                case GameConstants.GameState.fighting:
                    attackIfAlive(Battle);
                    break;

                case GameConstants.GameState.gym:
                    attackIfAlive(GymBattle);
                    break;

                case GameConstants.GameState.dungeon:
                    attackIfAlive(DungeonBattle);
                    break;

                case GameConstants.GameState.temporaryBattle:
                    attackIfAlive(
                        TemporaryBattleBattle
                    );
                    break;
            }

        } catch (error) {
            console.error(
                '[My Auto Clicker]',
                error
            );
        }
    }

    // ============================================================
    // Auto Hatchery
    // ============================================================

    function tryUncaughtTypeEgg() {
        const eggTypes = [
            GameConstants.EggItemType.Fire_egg,
            GameConstants.EggItemType.Water_egg,
            GameConstants.EggItemType.Grass_egg,
            GameConstants.EggItemType.Fighting_egg,
            GameConstants.EggItemType.Electric_egg,
            GameConstants.EggItemType.Dragon_egg
        ];

        for (const eggType of eggTypes) {
            const eggName =
                GameConstants.EggItemType[
                eggType
                ];

            const amount =
                player.itemList[
                    eggName
                ]?.() ?? 0;

            if (amount <= 0) {
                continue;
            }

            const status =
                App.game.breeding
                    .getTypeCaughtStatus(
                        eggType
                    );

            if (
                status ===
                CaughtStatus.NotCaught
            ) {
                return (
                    App.game.breeding
                        .addEggItemToHatchery(
                            eggType
                        )
                );
            }
        }

        return false;
    }

    function getPokemonTypes(pokemon) {
        const data =
            PokemonHelper.getPokemonByName(
                pokemon.name
            );

        return [
            data.type1,
            data.type2
        ].filter(
            type =>
                type !==
                PokemonType.None &&
                type !== undefined
        );
    }

    function getFreeActiveEggSlots() {
        let free = 0;

        const breeding =
            App.game.breeding;

        const helpers =
            breeding.hatcheryHelpers.hired();

        for (
            let i = 0;
            i < breeding.eggSlots;
            i++
        ) {
            if (
                !helpers[i] &&
                breeding.eggList[i]().isNone()
            ) {
                free++;
            }
        }

        return free;
    }

    function getActiveContagiousTypes() {
        const types =
            new Set();

        const breeding =
            App.game.breeding;

        const helpers =
            breeding.hatcheryHelpers.hired();

        for (
            let i = 0;
            i < breeding.eggSlots;
            i++
        ) {
            if (helpers[i]) {
                continue;
            }

            const egg =
                breeding.eggList[i]();

            if (
                egg.isNone() ||
                egg.canHatch()
            ) {
                continue;
            }

            const pokemon =
                egg.partyPokemon();

            if (
                pokemon &&
                pokemon.pokerus >=
                GameConstants.Pokerus
                    .Contagious
            ) {
                for (
                    const type of
                    getPokemonTypes(pokemon)
                ) {
                    types.add(type);
                }
            }
        }

        return types;
    }

    function getAllContagiousTypes() {
        const types =
            new Set();

        for (
            const pokemon of
            App.game.party.caughtPokemon
        ) {
            if (
                pokemon.pokerus >=
                GameConstants.Pokerus
                    .Contagious
            ) {
                for (
                    const type of
                    getPokemonTypes(pokemon)
                ) {
                    types.add(type);
                }
            }
        }

        return types;
    }

    function findBestPokerusTarget(
        usableTypes
    ) {
        const contagiousTypes =
            getAllContagiousTypes();

        let best = null;
        let bestScore = -1;

        for (
            const pokemon of
            App.game.party.caughtPokemon
        ) {
            if (
                pokemon.breeding ||
                pokemon.level < 100 ||
                pokemon.pokerus !==
                GameConstants.Pokerus
                    .Uninfected
            ) {
                continue;
            }

            const types =
                getPokemonTypes(pokemon);

            const sharesType =
                types.some(
                    type =>
                        usableTypes.has(type)
                );

            if (!sharesType) {
                continue;
            }

            let score = 0;

            if (types.length === 2) {
                score += 100;
            }

            if (
                types.some(
                    type =>
                        !contagiousTypes
                            .has(type)
                )
            ) {
                score += 1000;
            }

            if (score > bestScore) {
                best = pokemon;
                bestScore = score;
            }
        }

        return best;
    }

    function findBestPokerusPair() {
        const seedsByType =
            new Map();

        for (
            const pokemon of
            App.game.party.caughtPokemon
        ) {
            if (
                pokemon.breeding ||
                pokemon.level < 100 ||
                pokemon.pokerus <
                GameConstants.Pokerus
                    .Contagious
            ) {
                continue;
            }

            for (
                const type of
                getPokemonTypes(pokemon)
            ) {
                if (
                    !seedsByType.has(type)
                ) {
                    seedsByType.set(
                        type,
                        pokemon
                    );
                }
            }
        }

        const usableTypes =
            new Set(
                seedsByType.keys()
            );

        const target =
            findBestPokerusTarget(
                usableTypes
            );

        if (!target) {
            return null;
        }

        const targetTypes =
            getPokemonTypes(target);

        const sharedType =
            targetTypes.find(
                type =>
                    seedsByType
                        .has(type)
            );

        if (
            sharedType === undefined
        ) {
            return null;
        }

        return {
            seed:
                seedsByType.get(
                    sharedType
                ),

            target
        };
    }

    function tryPokerusSpread() {
        const freeSlots =
            getFreeActiveEggSlots();

        if (freeSlots <= 0) {
            return 'wait';
        }

        const activeTypes =
            getActiveContagiousTypes();

        if (activeTypes.size) {
            const target =
                findBestPokerusTarget(
                    activeTypes
                );

            if (target) {
                return (
                    App.game.breeding
                        .addPokemonToHatchery(
                            target
                        )
                        ? 'added'
                        : 'none'
                );
            }
        }

        const pair =
            findBestPokerusPair();

        if (!pair) {
            return 'none';
        }

        if (freeSlots < 2) {
            return 'wait';
        }

        const seedAdded =
            App.game.breeding
                .addPokemonToHatchery(
                    pair.seed
                );

        if (!seedAdded) {
            return 'none';
        }

        const targetAdded =
            App.game.breeding
                .addPokemonToHatchery(
                    pair.target
                );

        return targetAdded
            ? 'added'
            : 'none';
    }

    function runAutoHatch() {
        if (hatchMode === 'off') {
            return;
        }

        try {
            for (
                let i =
                    App.game.breeding
                        .eggSlots - 1;
                i >= 0;
                i--
            ) {
                App.game.breeding
                    .hatchPokemonEgg(i);
            }

            while (
                App.game.breeding
                    .hasFreeEggSlot()
            ) {
                if (
                    hatchMode ===
                    'pokerus'
                ) {
                    const result =
                        tryPokerusSpread();

                    if (
                        result ===
                        'added'
                    ) {
                        continue;
                    }

                    if (
                        result ===
                        'wait'
                    ) {
                        break;
                    }
                }

                if (
                    tryUncaughtTypeEgg()
                ) {
                    continue;
                }

                const pokemon =
                    BreedingController
                        .hatcherySortedFilteredList()
                        .find(
                            p =>
                                p.isHatchable()
                        );

                if (!pokemon) {
                    break;
                }

                const success =
                    App.game.breeding
                        .addPokemonToHatchery(
                            pokemon
                        );

                if (!success) {
                    break;
                }
            }

        } catch {
            console.error(
                '[My Auto Hatchery] Error'
            );
        }
    }

    // ============================================================
    // Dungeon Token optimizer
    // ============================================================

    function calculateRouteDTScore(route) {
        try {
            const pokemonNames =
                RouteHelper
                    .getAvailablePokemonList(
                        route.number,
                        route.region
                    );

            const weights =
                RouteHelper
                    .getAvailablePokemonWeightList(
                        route.number,
                        route.region
                    );

            if (
                !pokemonNames?.length
            ) {
                return null;
            }

            const totalWeight =
                weights.reduce(
                    (sum, weight) =>
                        sum + weight,
                    0
                );

            if (!totalWeight) {
                return null;
            }

            const tokenReward =
                PokemonFactory
                    .routeDungeonTokens(
                        route.number,
                        route.region
                    );

            const routeBaseHealth =
                PokemonFactory.routeHealth(
                    route.number,
                    route.region
                );

            const avgBaseHP =
                pokemonNames.reduce(
                    (
                        sum,
                        name,
                        index
                    ) => {
                        const data =
                            PokemonHelper
                                .getPokemonByName(
                                    name
                                );

                        return (
                            sum +
                            data.hitpoints *
                            weights[index]
                        );
                    },
                    0
                ) / totalWeight;

            let expectedTokens = 0;
            let expectedTime = 0;

            let weightedCatchability = 0;
            let weightedKillTime = 0;
            let weightedCatchTime = 0;

            for (
                let i = 0;
                i < pokemonNames.length;
                i++
            ) {
                const name =
                    pokemonNames[i];

                const encounterWeight =
                    weights[i] /
                    totalWeight;

                const pokemon =
                    PokemonHelper
                        .getPokemonByName(
                            name
                        );

                const health =
                    routeBaseHealth *
                    (
                        0.9 +
                        (
                            pokemon.hitpoints /
                            avgBaseHP
                        ) / 10
                    );

                const killTime =
                    estimateKillTime(
                        health,
                        pokemon.type1,
                        pokemon.type2,
                        route.region,
                        route.subRegion ?? 0
                    );

                const ballType =
                    App.game.pokeballs
                        .calculatePokeballToUse(
                            pokemon.id,
                            false,
                            false,
                            EncounterType.route
                        );

                let catchChance = 0;
                let catchTime = 0;

                if (
                    ballType !==
                    GameConstants.Pokeball.None
                ) {
                    const baseCatchChance =
                        PokemonFactory
                            .catchRateHelper(
                                pokemon.catchRate,
                                true
                            );

                    const ballBonus =
                        getBallBonusForRoute(
                            ballType,
                            route,
                            pokemon
                        );

                    catchChance =
                        GameConstants
                            .clipNumber(
                                baseCatchChance +
                                ballBonus,
                                0,
                                100
                            ) / 100;

                    catchTime =
                        App.game.pokeballs
                            .calculateCatchTime(
                                ballType
                            ) / 1000;
                }

                expectedTokens +=
                    encounterWeight *
                    tokenReward *
                    catchChance;

                expectedTime +=
                    encounterWeight *
                    (
                        killTime +
                        catchTime
                    );

                weightedCatchability +=
                    encounterWeight *
                    catchChance;

                weightedKillTime +=
                    encounterWeight *
                    killTime;

                weightedCatchTime +=
                    encounterWeight *
                    catchTime;
            }

            const score =
                expectedTime > 0
                    ? expectedTokens /
                    expectedTime
                    : 0;

            return {
                route,
                score,

                estimatedDTPerMinute:
                    score * 60,

                tokens:
                    tokenReward,

                catchability:
                    weightedCatchability,

                killTime:
                    weightedKillTime,

                catchTime:
                    weightedCatchTime
            };

        } catch {
            console.warn(
                '[DT Optimizer] Could not score route',
                route?.routeName
            );

            return null;
        }
    }

    function scanDungeonTokenRoutes() {
        try {
            const results = [];

            const highestRegion =
                player.highestRegion();

            for (
                let region = 0;
                region <= highestRegion;
                region++
            ) {
                const routes =
                    Routes.getRoutesByRegion(
                        region
                    );

                for (
                    const route of routes
                ) {
                    if (
                        !route.isUnlocked()
                    ) {
                        continue;
                    }

                    const result =
                        calculateRouteDTScore(
                            route
                        );

                    if (result) {
                        results.push(result);
                    }
                }
            }

            results.sort(
                (a, b) =>
                    b.score - a.score
            );

            theoreticalResults =
                results;

            updateDungeonTokenUI();

            console.table(
                results
                    .slice(0, 10)
                    .map(
                        (
                            result,
                            index
                        ) => ({
                            Rank:
                                index + 1,

                            Route:
                                result.route
                                    .routeName,

                            'Est. DT/min':
                                result
                                    .estimatedDTPerMinute
                                    .toFixed(1),

                            'Catchability':
                                `${(
                                    result
                                        .catchability *
                                    100
                                ).toFixed(1)
                                }%`,

                            'Kill time':
                                `${result
                                    .killTime
                                    .toFixed(3)
                                }s`
                        })
                    )
            );

            return results;

        } catch (error) {
            console.error(
                '[DT Optimizer]',
                error
            );

            return [];
        }
    }

    // ============================================================
    // Dungeon Token live benchmark
    // ============================================================

    function resetCurrentDTSample() {
        dtHistory = [];
        currentMeasuredRouteKey =
            null;
        currentMeasuredRouteName =
            null;
    }

    function updateDungeonTokenBenchmark() {
        try {
            if (
                App.game.gameState !==
                GameConstants.GameState
                    .fighting
            ) {
                resetCurrentDTSample();
                updateDungeonTokenUI();
                return;
            }

            const routeInfo =
                getCurrentRouteInfo();

            if (!routeInfo) {
                resetCurrentDTSample();
                updateDungeonTokenUI();
                return;
            }

            const tokens =
                getDungeonTokens();

            if (
                !Number.isFinite(tokens)
            ) {
                return;
            }

            const now =
                performance.now();

            if (
                currentMeasuredRouteKey !==
                routeInfo.key
            ) {
                dtHistory = [];

                currentMeasuredRouteKey =
                    routeInfo.key;

                currentMeasuredRouteName =
                    routeInfo.name;
            }

            if (
                dtHistory.length &&
                tokens <
                dtHistory[
                    dtHistory.length - 1
                ].tokens
            ) {
                dtHistory = [];
            }

            dtHistory.push({
                time: now,
                tokens
            });

            const cutoff =
                now -
                (
                    DT_STABLE_SECONDS +
                    5
                ) *
                1000;

            dtHistory =
                dtHistory.filter(
                    sample =>
                        sample.time >=
                        cutoff
                );

            if (
                dtHistory.length > 1
            ) {
                const targetTime =
                    now -
                    DT_STABLE_SECONDS *
                    1000;

                let startSample =
                    dtHistory[0];

                for (
                    const sample of
                    dtHistory
                ) {
                    if (
                        sample.time >=
                        targetTime
                    ) {
                        startSample =
                            sample;
                        break;
                    }
                }

                const elapsedMs =
                    now -
                    startSample.time;

                const gained =
                    tokens -
                    startSample.tokens;

                if (
                    elapsedMs > 0 &&
                    gained >= 0
                ) {
                    const rate =
                        gained *
                        (
                            60000 /
                            elapsedMs
                        );

                    const elapsedSeconds =
                        elapsedMs /
                        1000;

                    if (
                        elapsedSeconds >=
                        DT_STABLE_SECONDS -
                        1 &&
                        rate >
                        bestMeasuredRate
                    ) {
                        bestMeasuredRate =
                            rate;

                        bestMeasuredRoute =
                            currentMeasuredRouteName;
                    }
                }
            }

            updateDungeonTokenUI();

        } catch (error) {
            console.error(
                '[DT Benchmark]',
                error
            );
        }
    }

    function getCurrentDTRate() {
        if (
            dtHistory.length < 2
        ) {
            return {
                rate: 0,
                seconds: 0
            };
        }

        const newest =
            dtHistory[
            dtHistory.length - 1
            ];

        const targetTime =
            newest.time -
            DT_STABLE_SECONDS *
            1000;

        let oldest =
            dtHistory[0];

        for (
            const sample of
            dtHistory
        ) {
            if (
                sample.time >=
                targetTime
            ) {
                oldest = sample;
                break;
            }
        }

        const elapsedMs =
            newest.time -
            oldest.time;

        if (elapsedMs <= 0) {
            return {
                rate: 0,
                seconds: 0
            };
        }

        return {
            rate:
                (
                    newest.tokens -
                    oldest.tokens
                ) *
                60000 /
                elapsedMs,

            seconds:
                elapsedMs /
                1000
        };
    }

    // ============================================================
    // Gem Farm
    // ============================================================

    function getGemRewardForPokemon(
        type1,
        type2,
        targetType,
        baseGems
    ) {
        if (
            type1 !== targetType &&
            type2 !== targetType
        ) {
            return 0;
        }

        if (
            type1 === targetType &&
            (
                type2 ===
                PokemonType.None ||
                type2 === undefined ||
                type2 === null
            )
        ) {
            return (
                baseGems * 2
            );
        }

        return baseGems;
    }

    function scoreGymForGems(
        gymName,
        gym,
        targetType
    ) {
        try {
            if (!gym.isUnlocked()) {
                return null;
            }

            const region =
                GameConstants
                    .getGymRegion(
                        gymName
                    );

            const subRegion =
                TownList[
                    gym.town
                ]?.subRegion ?? 0;

            const pokemonList =
                gym.getPokemonList();

            let totalGems = 0;
            let totalTime = 0;

            for (
                const gymPokemon of
                pokemonList
            ) {
                const data =
                    gymPokemon
                        .getBaseData();

                totalGems +=
                    getGemRewardForPokemon(
                        data.type1,
                        data.type2,
                        targetType,
                        GameConstants.GYM_GEMS
                    );

                totalTime +=
                    estimateKillTime(
                        gymPokemon.maxHealth,
                        data.type1,
                        data.type2,
                        region,
                        subRegion
                    );
            }

            if (
                totalGems <= 0
            ) {
                return null;
            }

            const score =
                totalGems /
                Math.max(
                    0.05,
                    totalTime
                );

            const leader =
                gym.leaderName ??
                gymName;

            return {
                kind: 'Gym',
                name: leader,
                location: gymName,
                score,
                gemsPerMinute:
                    score * 60
            };

        } catch {
            return null;
        }
    }

    function scoreRouteForGems(
        route,
        targetType
    ) {
        try {
            if (!route.isUnlocked()) {
                return null;
            }

            const names =
                RouteHelper
                    .getAvailablePokemonList(
                        route.number,
                        route.region
                    );

            const weights =
                RouteHelper
                    .getAvailablePokemonWeightList(
                        route.number,
                        route.region
                    );

            if (!names?.length) {
                return null;
            }

            const totalWeight =
                weights.reduce(
                    (sum, weight) =>
                        sum + weight,
                    0
                );

            if (!totalWeight) {
                return null;
            }

            const routeHealth =
                PokemonFactory
                    .routeHealth(
                        route.number,
                        route.region
                    );

            const avgBaseHP =
                names.reduce(
                    (
                        sum,
                        name,
                        index
                    ) => {
                        const data =
                            PokemonHelper
                                .getPokemonByName(
                                    name
                                );

                        return (
                            sum +
                            data.hitpoints *
                            weights[index]
                        );
                    },
                    0
                ) /
                totalWeight;

            let expectedGems = 0;
            let expectedTime = 0;

            for (
                let i = 0;
                i < names.length;
                i++
            ) {
                const data =
                    PokemonHelper
                        .getPokemonByName(
                            names[i]
                        );

                const weight =
                    weights[i] /
                    totalWeight;

                const health =
                    routeHealth *
                    (
                        0.9 +
                        (
                            data.hitpoints /
                            avgBaseHP
                        ) / 10
                    );

                const gems =
                    getGemRewardForPokemon(
                        data.type1,
                        data.type2,
                        targetType,
                        1
                    );

                const time =
                    estimateKillTime(
                        health,
                        data.type1,
                        data.type2,
                        route.region,
                        route.subRegion ?? 0
                    );

                expectedGems +=
                    weight *
                    gems;

                expectedTime +=
                    weight *
                    time;
            }

            if (
                expectedGems <= 0
            ) {
                return null;
            }

            const score =
                expectedGems /
                expectedTime;

            return {
                kind: 'Route',
                name:
                    route.routeName,
                location:
                    route.routeName,
                score,
                gemsPerMinute:
                    score * 60
            };

        } catch {
            return null;
        }
    }

    function scanGemFarms() {
        const targetType =
            PokemonType[
            selectedGemType
            ];

        const results = [];

        for (
            const [
                gymName,
                gym
            ] of
            Object.entries(GymList)
        ) {
            const result =
                scoreGymForGems(
                    gymName,
                    gym,
                    targetType
                );

            if (result) {
                results.push(result);
            }
        }

        const highestRegion =
            player.highestRegion();

        for (
            let region = 0;
            region <= highestRegion;
            region++
        ) {
            for (
                const route of
                Routes.getRoutesByRegion(
                    region
                )
            ) {
                const result =
                    scoreRouteForGems(
                        route,
                        targetType
                    );

                if (result) {
                    results.push(result);
                }
            }
        }

        results.sort(
            (a, b) =>
                b.score - a.score
        );

        gemResults = results;

        updateGemUI();

        return results;
    }

    // ============================================================
    // Type Farm optimizer
    // ============================================================

    function getTypeFarmTypeName() {
        return (
            PokemonType[
            typeFarmType
            ] ??
            'Unknown'
        );
    }

    function scoreRouteForTypeCatches(
        route,
        targetType
    ) {
        try {
            if (!route.isUnlocked()) {
                return null;
            }

            const names =
                RouteHelper
                    .getAvailablePokemonList(
                        route.number,
                        route.region
                    );

            const weights =
                RouteHelper
                    .getAvailablePokemonWeightList(
                        route.number,
                        route.region
                    );

            if (!names?.length) {
                return null;
            }

            const totalWeight =
                weights.reduce(
                    (sum, weight) =>
                        sum + weight,
                    0
                );

            if (!totalWeight) {
                return null;
            }

            const routeHealth =
                PokemonFactory
                    .routeHealth(
                        route.number,
                        route.region
                    );

            const avgBaseHP =
                names.reduce(
                    (
                        sum,
                        name,
                        index
                    ) => {
                        const data =
                            PokemonHelper
                                .getPokemonByName(
                                    name
                                );

                        return (
                            sum +
                            data.hitpoints *
                            weights[index]
                        );
                    },
                    0
                ) /
                totalWeight;

            let expectedCatches = 0;
            let expectedTime = 0;
            let targetEncounterRate = 0;
            let weightedTargetCatchChance = 0;

            for (
                let i = 0;
                i < names.length;
                i++
            ) {
                const data =
                    PokemonHelper
                        .getPokemonByName(
                            names[i]
                        );

                const encounterWeight =
                    weights[i] /
                    totalWeight;

                const health =
                    routeHealth *
                    (
                        0.9 +
                        (
                            data.hitpoints /
                            avgBaseHP
                        ) / 10
                    );

                const killTime =
                    estimateKillTime(
                        health,
                        data.type1,
                        data.type2,
                        route.region,
                        route.subRegion ?? 0
                    );

                const ballType =
                    App.game.pokeballs
                        .calculatePokeballToUse(
                            data.id,
                            false,
                            false,
                            EncounterType.route
                        );

                let catchChance = 0;
                let catchTime = 0;

                if (
                    ballType !==
                    GameConstants.Pokeball.None
                ) {
                    const baseCatchChance =
                        PokemonFactory
                            .catchRateHelper(
                                data.catchRate,
                                true
                            );

                    const ballBonus =
                        getBallBonusForRoute(
                            ballType,
                            route,
                            data
                        );

                    catchChance =
                        GameConstants
                            .clipNumber(
                                baseCatchChance +
                                ballBonus,
                                0,
                                100
                            ) / 100;

                    catchTime =
                        App.game.pokeballs
                            .calculateCatchTime(
                                ballType
                            ) /
                        1000;
                }

                const matchesTarget =
                    data.type1 === targetType ||
                    data.type2 === targetType;

                if (matchesTarget) {
                    targetEncounterRate +=
                        encounterWeight;

                    expectedCatches +=
                        encounterWeight *
                        catchChance;

                    weightedTargetCatchChance +=
                        encounterWeight *
                        catchChance;
                }

                expectedTime +=
                    encounterWeight *
                    (
                        killTime +
                        catchTime
                    );
            }

            if (
                targetEncounterRate <= 0
            ) {
                return null;
            }

            const catchesPerSecond =
                expectedTime > 0
                    ? expectedCatches /
                    expectedTime
                    : 0;

            return {
                route,

                score:
                    catchesPerSecond,

                catchesPerMinute:
                    catchesPerSecond *
                    60,

                targetEncounterRate,

                targetCatchChance:
                    weightedTargetCatchChance /
                    targetEncounterRate
            };

        } catch {
            console.warn(
                '[Type Farm Optimizer] Could not score route',
                route?.routeName
            );

            return null;
        }
    }

    function scanTypeCatchRoutes() {
        try {
            const results = [];

            const highestRegion =
                player.highestRegion();

            for (
                let region = 0;
                region <= highestRegion;
                region++
            ) {
                for (
                    const route of
                    Routes.getRoutesByRegion(
                        region
                    )
                ) {
                    const result =
                        scoreRouteForTypeCatches(
                            route,
                            typeFarmType
                        );

                    if (result) {
                        results.push(result);
                    }
                }
            }

            results.sort(
                (a, b) =>
                    b.score - a.score
            );

            typeFarmResults =
                results;

            updateTypeFarmUI();

            return results;

        } catch (error) {
            console.error(
                '[Type Catch Optimizer]',
                error
            );

            return [];
        }
    }

    // ============================================================
    // Vitamin Tracker
    // ============================================================

    function getVitaminCap() {
        try {
            if (
                typeof App.game.breeding
                    .maxVitamins ===
                'function'
            ) {
                return (
                    App.game.breeding
                        .maxVitamins()
                );
            }
        } catch {
            // fall through
        }

        return (
            (
                player.highestRegion() +
                1
            ) *
            5
        );
    }

    function getCurrentVitaminCounts(pokemon) {
        const vitamins = pokemon.vitamins ?? {};
        const readCount = (name) => {
            const value = pokemon.vitaminsUsed?.[GameConstants.VitaminType[name]] ??
                vitamins[name] ?? vitamins[name.toLowerCase()] ??
                pokemon[name.toLowerCase()] ?? 0;
            return Number(typeof value === 'function' ? value() : value);
        };

        return {
            protein: readCount('Protein'),
            calcium: readCount('Calcium'),
            carbos: readCount('Carbos')
        };
    }

    function getVitaminBaseAttack(
        pokemon
    ) {
        const data =
            PokemonHelper
                .getPokemonByName(
                    pokemon.name
                );

        return Number(
            data.attack ??
            pokemon.baseAttack ??
            pokemon.attack ??
            0
        );
    }

    function getBaseEggSteps(pokemon) {
        const data = PokemonHelper.getPokemonByName(pokemon.name);
        const cycles = pokemon.eggCycles ?? data.eggCycles;
        if (typeof App.game.breeding.getSteps === 'function') {
            return App.game.breeding.getSteps(cycles);
        }
        return cycles === undefined ? 500 :
            cycles * (GameConstants.EGG_CYCLE_MULTIPLIER ?? 40);
    }

    function calculateVitaminEggSteps(pokemon, protein, calcium, carbos) {
        // Mirror PartyPokemon.getEggSteps for hypothetical counts without changing the save.
        const steps = getBaseEggSteps(pokemon) +
            (protein + calcium) / 2 * (GameConstants.EGG_CYCLE_MULTIPLIER ?? 40);
        return steps <= 300 ? steps :
            Math.round(((steps / 300) ** (1 - carbos / 70)) * 300);
    }

    function calculateVitaminAttackGain(pokemon, protein, calcium) {
        // Mirror PartyPokemon.getBreedingAttackBonus for hypothetical counts.
        return getVitaminBaseAttack(pokemon) *
            ((GameConstants.BREEDING_ATTACK_BONUS ?? 25) + calcium) / 100 + protein;
    }

    const vitaminTrackerWarnings = new Set();

    function warnVitaminTrackerOnce(key, message) {
        if (!vitaminTrackerWarnings.has(key)) {
            vitaminTrackerWarnings.add(key);
            console.warn(`[Vitamin Tracker] ${message}`);
        }
    }

    function getPokemonNativeRegion(pokemon) {
        try {
            // Same helper used by Party.calculatePokemonAttack, including alternate forms.
            const region = typeof PokemonHelper.calcNativeRegion === 'function'
                ? PokemonHelper.calcNativeRegion(pokemon.name)
                : PokemonHelper.getPokemonByName(pokemon.name)?.nativeRegion;

            if (Number.isInteger(region) &&
                (region === GameConstants.Region.none ||
                    (region >= 0 && typeof GameConstants.Region[region] === 'string'))) {
                return region;
            }
        } catch {
            // Treat unresolved data explicitly instead of assigning Kanto.
        }

        warnVitaminTrackerOnce(`region:${pokemon.name}`,
            `Cannot resolve native region for ${pokemon.name}; using the non-native multiplier.`);
        return null;
    }

    function isVitaminAvailable(name) {
        try {
            if (App.game.challenges?.list?.disableVitamins?.active()) {
                return false;
            }
            // Item availability evaluates the game's progression requirements, not inventory.
            const item = ItemList[name];
            if (typeof item?.isAvailable === 'function') {
                return Boolean(item.isAvailable());
            }
        } catch {
            // Unknown availability must not produce an unusable recommendation.
        }

        warnVitaminTrackerOnce(`vitamin:${name}`,
            `Cannot resolve availability for ${name}; excluding it from recommendations.`);
        return false;
    }

    function isRegionalDebuffActive() {
        try {
            const challenge =
                App.game.challenges
                    ?.list
                    ?.regionalAttackDebuff;

            if (
                challenge &&
                typeof challenge.active ===
                'function'
            ) {
                return challenge.active();
            }

            if (
                challenge?.active !==
                undefined
            ) {
                return Boolean(
                    challenge.active
                );
            }
        } catch {
            // ignored
        }

        return true;
    }

    function getRegionalAttackMultiplier(
        pokemon,
        targetRegion
    ) {
        if (
            !isRegionalDebuffActive()
        ) {
            return 1;
        }

        const nativeRegion =
            getPokemonNativeRegion(
                pokemon
            );

        if (
            nativeRegion === targetRegion ||
            nativeRegion === GameConstants.Region.none
        ) {
            return 1;
        }

        return getNonNativeAttackMultiplier();
    }

    function getNonNativeAttackMultiplier() {
        if (!isRegionalDebuffActive()) {
            return 1;
        }
        if (typeof App.game.party.getRegionAttackMultiplier === 'function') {
            return App.game.party.getRegionAttackMultiplier();
        }
        return Math.min(1, Math.max(0.2, 0.1 + player.highestRegion() / 10));
    }

    function getPokemonAttackModifier(pokemon) {
        let modifier = 1;
        // Retain modified BE, using the current runtime names with legacy aliases.
        for (const [current, legacy] of [
            ['calculateEVAttackBonus', 'getEVAttackBonus'],
            ['heldItemAttackBonus', 'getHeldItemAttackBonus'],
            ['shadowAttackBonus', 'getPurifiedAttackBonus']
        ]) {
            try {
                const getBonus = pokemon[current] ?? pokemon[legacy];
                if (typeof getBonus === 'function') {
                    modifier *= getBonus.call(pokemon);
                }
            } catch {
                // Preserve the existing fallback when a modifier cannot be read.
            }
        }
        return modifier;
    }

    function calculateRegionalBE(
        pokemon,
        protein,
        calcium,
        carbos,
        targetRegion
    ) {
        const attackGain =
            calculateVitaminAttackGain(
                pokemon,
                protein,
                calcium
            );

        const eggSteps =
            calculateVitaminEggSteps(
                pokemon,
                protein,
                calcium,
                carbos
            );

        const attackModifier =
            getPokemonAttackModifier(
                pokemon
            );

        const regionalMultiplier =
            getRegionalAttackMultiplier(
                pokemon,
                targetRegion
            );

        return (
            attackGain *
            attackModifier *
            regionalMultiplier *
            (GameConstants.EGG_CYCLE_MULTIPLIER ?? 40) /
            Math.max(
                1,
                eggSteps
            )
        );
    }

    function optimizeVitaminSetup(pokemon, targetRegion, minimum = null, currentBE = null) {
        const cap = getVitaminCap();
        const available = {
            protein: isVitaminAvailable('Protein'),
            calcium: isVitaminAvailable('Calcium'),
            carbos: isVitaminAvailable('Carbos')
        };
        const start = minimum ?? { protein: 0, calcium: 0, carbos: 0 };
        const currentUsed = start.protein + start.calcium + start.carbos;
        let best = null;
        let bestScore = -Infinity;

        for (let protein = start.protein; protein <= (available.protein ? cap : start.protein); protein++) {
            for (let calcium = start.calcium; calcium <= (available.calcium ? cap - protein : start.calcium); calcium++) {
                for (let carbos = start.carbos; carbos <= (available.carbos ? cap - protein - calcium : start.carbos); carbos++) {
                    const used = protein + calcium + carbos;
                    if (used > cap) {
                        continue;
                    }
                    const be = calculateRegionalBE(pokemon, protein, calcium, carbos, targetRegion);
                    // The global optimum maximizes BE. Investment ranking maximizes gain per
                    // added vitamin, including batches that overcome egg-step rounding plateaus.
                    const added = used - currentUsed;
                    const score = currentBE === null ? be :
                        (added > 0 ? (be - currentBE) / added : 0);
                    if (!best || score > bestScore ||
                        (score === bestScore && used < best.protein + best.calcium + best.carbos)) {
                        best = { protein, calcium, carbos, be };
                        bestScore = score;
                    }
                }
            }
        }
        return best;
    }

    function getVitaminInvestmentRecommendation(pokemon, targetRegion) {
        const current = getCurrentVitaminCounts(pokemon);
        const used = current.protein + current.calcium + current.carbos;
        if (used >= getVitaminCap()) {
            return null;
        }
        const currentBE = calculateRegionalBE(pokemon,
            current.protein, current.calcium, current.carbos, targetRegion);
        const investment = optimizeVitaminSetup(pokemon, targetRegion, current, currentBE);
        if (!investment) {
            return null;
        }
        const added = investment.protein + investment.calcium + investment.carbos - used;
        const gain = added > 0 ? (investment.be - currentBE) / added : 0;
        if (gain <= 1e-12) {
            return null;
        }
        return { current, currentBE, gain, nextBE: investment.be };
    }

    function scanVitaminEfficiency() {
        const results = [];

        for (
            const pokemon of
            App.game.party.caughtPokemon
        ) {
            const next =
                getVitaminInvestmentRecommendation(
                    pokemon,
                    selectedVitaminRegion
                );

            if (!next) {
                continue;
            }

            const optimal =
                optimizeVitaminSetup(
                    pokemon,
                    selectedVitaminRegion
                );

            results.push({
                pokemon,
                name:
                    pokemon.name,

                nativeRegion:
                    getPokemonNativeRegion(
                        pokemon
                    ),

                current:
                    next.current,

                currentBE:
                    next.currentBE,

                nextGain:
                    next.gain,

                nextBE:
                    next.nextBE,

                optimal
            });
        }

        results.sort(
            (a, b) =>
                b.nextGain -
                a.nextGain
        );

        vitaminResults =
            results;
        vitaminHasScanned = true;

        updateVitaminUI();

        console.table(
            results
                .slice(0, 20)
                .map(
                    (
                        result,
                        index
                    ) => ({
                        Rank:
                            index + 1,

                        Pokemon:
                            result.name,

                        Native:
                            result.nativeRegion === null ? 'Unknown' :
                                getRegionName(result.nativeRegion),

                        'Regional BE Gain':
                            result
                                .nextGain
                                .toFixed(6),

                        Current:
                            `${result.current.protein}P / ${result.current.calcium}Ca / ${result.current.carbos}Cb`,

                        Optimal:
                            `${result.optimal.protein}P / ${result.optimal.calcium}Ca / ${result.optimal.carbos}Cb`
                    })
                )
        );

        return results;
    }

    // ============================================================
    // UI helpers
    // ============================================================

    function styleMainButton(button) {
        Object.assign(
            button.style,
            {
                border: 'none',
                borderRadius: '6px',
                padding: '10px 14px',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
                minWidth: '180px',
                boxShadow:
                    '0 2px 6px rgba(0,0,0,0.35)'
            }
        );
    }

    function createTextLine() {
        const div =
            document.createElement(
                'div'
            );

        div.style.marginBottom =
            '5px';

        return div;
    }

    // ============================================================
    // Main button UI
    // ============================================================

    function updateClickButton() {
        clickButton.textContent =
            `Auto Click: ${autoClickEnabled
                ? 'ON'
                : 'OFF'
            }`;

        clickButton.style.background =
            autoClickEnabled
                ? '#198754'
                : '#dc3545';
    }

    function updateHatchButton() {
        if (!hatchButton) {
            return;
        }

        switch (hatchMode) {

            case 'default':
                hatchButton.textContent =
                    'Hatch: Default';

                hatchButton.style.background =
                    '#198754';

                break;

            case 'pokerus':
                hatchButton.textContent =
                    'Hatch: Pokérus';

                hatchButton.style.background =
                    '#6f42c1';

                break;

            default:
                hatchButton.textContent =
                    'Hatch: OFF';

                hatchButton.style.background =
                    '#dc3545';
        }
    }

    // ============================================================
    // DT UI
    // ============================================================

    function updateDungeonTokenUI() {
        if (!dtHeaderButton) {
            return;
        }

        const bestSuggestion =
            theoreticalResults[0];

        const suggestedName =
            bestSuggestion
                ? bestSuggestion.route
                    .routeName
                : 'Not scanned';

        dtHeaderButton.textContent =
            `DT Farm: ${suggestedName} ▾`;

        dtSuggestedText.textContent =
            `Suggested: ${suggestedName}`;

        dtCurrentText.textContent =
            `Current: ${currentMeasuredRouteName ??
            'Not farming a route'
            }`;

        const current =
            getCurrentDTRate();

        if (
            current.seconds >= 2
        ) {
            dtRateText.textContent =
                `DT/min: ${formatNumber(
                    current.rate
                )
                }`;
        } else {
            dtRateText.textContent =
                'DT/min: —';
        }

        if (
            current.seconds >=
            DT_STABLE_SECONDS - 1
        ) {
            dtSampleText.textContent =
                'Sample: Stable';
        } else if (
            current.seconds > 0
        ) {
            dtSampleText.textContent =
                `Sample: ${Math.floor(
                    current.seconds
                )
                }s / ${DT_STABLE_SECONDS
                }s`;
        } else {
            dtSampleText.textContent =
                'Sample: Waiting';
        }

        if (
            bestMeasuredRoute &&
            bestMeasuredRate > 0
        ) {
            dtBestText.innerHTML =
                `Best seen: <strong>${formatNumber(
                    bestMeasuredRate
                )
                } DT/min</strong><br>` +
                bestMeasuredRoute;
        } else {
            dtBestText.innerHTML =
                'Best seen: —';
        }
    }

    function createDungeonTokenPanel() {
        dtHeaderButton =
            document.createElement(
                'button'
            );

        styleMainButton(
            dtHeaderButton
        );

        dtHeaderButton.style.background =
            '#0d6efd';

        dtHeaderButton.textContent =
            'DT Farm: Not scanned ▾';

        dtPanel =
            document.createElement(
                'div'
            );

        Object.assign(
            dtPanel.style,
            {
                display: 'none',
                background:
                    'rgba(25,25,25,0.96)',
                color: 'white',
                borderRadius: '6px',
                padding: '10px',
                width: '220px',
                fontSize: '12px',
                lineHeight: '1.35',
                boxShadow:
                    '0 2px 8px rgba(0,0,0,0.45)'
            }
        );

        const title =
            document.createElement(
                'div'
            );

        title.textContent =
            'Dungeon Token Farm';

        Object.assign(
            title.style,
            {
                fontWeight: 'bold',
                fontSize: '14px',
                marginBottom: '8px'
            }
        );

        dtSuggestedText =
            createTextLine();

        dtCurrentText =
            createTextLine();

        dtRateText =
            createTextLine();

        dtRateText.style.fontSize =
            '15px';

        dtRateText.style.fontWeight =
            'bold';

        dtSampleText =
            createTextLine();

        dtBestText =
            createTextLine();

        dtBestText.style.marginTop =
            '8px';

        dtBestText.style.paddingTop =
            '8px';

        dtBestText.style.borderTop =
            '1px solid rgba(255,255,255,0.2)';

        const buttonRow =
            document.createElement(
                'div'
            );

        Object.assign(
            buttonRow.style,
            {
                display: 'flex',
                gap: '5px',
                marginTop: '10px'
            }
        );

        const resetButton =
            document.createElement(
                'button'
            );

        resetButton.textContent =
            'Reset Best';

        const rescanButton =
            document.createElement(
                'button'
            );

        rescanButton.textContent =
            'Rescan';

        for (
            const button of [
                resetButton,
                rescanButton
            ]
        ) {
            Object.assign(
                button.style,
                {
                    flex: '1',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px',
                    cursor: 'pointer'
                }
            );
        }

        resetButton.addEventListener(
            'click',
            event => {
                event.stopPropagation();

                bestMeasuredRate = 0;
                bestMeasuredRoute = null;

                updateDungeonTokenUI();
            }
        );

        rescanButton.addEventListener(
            'click',
            event => {
                event.stopPropagation();

                dtSuggestedText.textContent =
                    'Suggested: Scanning...';

                setTimeout(
                    scanDungeonTokenRoutes,
                    0
                );
            }
        );

        buttonRow.appendChild(
            resetButton
        );

        buttonRow.appendChild(
            rescanButton
        );

        dtPanel.appendChild(title);
        dtPanel.appendChild(
            dtSuggestedText
        );
        dtPanel.appendChild(
            dtCurrentText
        );
        dtPanel.appendChild(
            dtRateText
        );
        dtPanel.appendChild(
            dtSampleText
        );
        dtPanel.appendChild(
            dtBestText
        );
        dtPanel.appendChild(
            buttonRow
        );

        dtHeaderButton.addEventListener(
            'click',
            () => {
                const opening =
                    dtPanel.style.display ===
                    'none';

                dtPanel.style.display =
                    opening
                        ? 'block'
                        : 'none';
            }
        );

        return {
            header:
                dtHeaderButton,
            panel:
                dtPanel
        };
    }

    // ============================================================
    // Gem UI
    // ============================================================

    function updateGemUI() {
        if (!gemHeaderButton) {
            return;
        }

        const best =
            gemResults[0];

        if (!best) {
            gemHeaderButton.textContent =
                `Gem Farm: ${selectedGemType} — Not scanned ▾`;

            gemBestText.textContent =
                'Press Rescan';

            gemTopText.innerHTML = '';

            return;
        }

        const bestName =
            best.kind === 'Gym'
                ? `${best.name} — ${best.location}`
                : best.location;

        gemHeaderButton.textContent =
            `Gem Farm: ${selectedGemType} → ${best.name} ▾`;

        gemBestText.innerHTML =
            `<strong>Best:</strong><br>` +
            `${bestName}<br>` +
            `Est. ${formatNumber(
                best.gemsPerMinute
            )
            } gems/min`;

        gemTopText.innerHTML =
            gemResults
                .slice(1, 5)
                .map(
                    (
                        result,
                        index
                    ) => {
                        const name =
                            result.kind ===
                                'Gym'
                                ? `${result.name} — ${result.location}`
                                : result.location;

                        return (
                            `${index + 2}. ${name}` +
                            ` — ${formatNumber(
                                result
                                    .gemsPerMinute
                            )
                            }/min`
                        );
                    }
                )
                .join('<br>');
    }

    function createGemPanel() {
        gemHeaderButton =
            document.createElement(
                'button'
            );

        styleMainButton(
            gemHeaderButton
        );

        gemHeaderButton.style.background =
            '#6f42c1';

        gemPanel =
            document.createElement(
                'div'
            );

        Object.assign(
            gemPanel.style,
            {
                display: 'none',
                background:
                    'rgba(25,25,25,0.96)',
                color: 'white',
                borderRadius: '6px',
                padding: '10px',
                width: '250px',
                fontSize: '12px',
                boxShadow:
                    '0 2px 8px rgba(0,0,0,0.45)'
            }
        );

        const title =
            document.createElement(
                'div'
            );

        title.textContent =
            'Gem Farm';

        title.style.fontWeight =
            'bold';

        title.style.fontSize =
            '14px';

        title.style.marginBottom =
            '8px';

        gemTypeSelect =
            document.createElement(
                'select'
            );

        Object.assign(
            gemTypeSelect.style,
            {
                width: '100%',
                marginBottom: '10px'
            }
        );

        for (
            const type of GEM_TYPES
        ) {
            const option =
                document.createElement(
                    'option'
                );

            option.value =
                type;

            option.textContent =
                type;

            gemTypeSelect
                .appendChild(option);
        }

        gemTypeSelect.value =
            selectedGemType;

        gemTypeSelect
            .addEventListener(
                'change',
                () => {
                    selectedGemType =
                        gemTypeSelect.value;

                    localStorage.setItem(
                        GEM_FARM_STORAGE_KEY,
                        selectedGemType
                    );

                    gemResults = [];
                    updateGemUI();
                }
            );

        gemBestText =
            document.createElement(
                'div'
            );

        gemBestText.style.marginBottom =
            '8px';

        gemTopText =
            document.createElement(
                'div'
            );

        gemTopText.style.opacity =
            '0.85';

        const rescanButton =
            document.createElement(
                'button'
            );

        rescanButton.textContent =
            'Rescan';

        Object.assign(
            rescanButton.style,
            {
                width: '100%',
                border: 'none',
                borderRadius: '4px',
                padding: '6px',
                marginTop: '10px',
                cursor: 'pointer'
            }
        );

        rescanButton.addEventListener(
            'click',
            event => {
                event.stopPropagation();

                gemBestText.textContent =
                    'Scanning...';

                setTimeout(
                    scanGemFarms,
                    0
                );
            }
        );

        gemPanel.appendChild(title);
        gemPanel.appendChild(
            gemTypeSelect
        );
        gemPanel.appendChild(
            gemBestText
        );
        gemPanel.appendChild(
            gemTopText
        );
        gemPanel.appendChild(
            rescanButton
        );

        gemHeaderButton.addEventListener(
            'click',
            () => {
                const opening =
                    gemPanel.style.display ===
                    'none';

                gemPanel.style.display =
                    opening
                        ? 'block'
                        : 'none';
            }
        );

        updateGemUI();

        return {
            header:
                gemHeaderButton,
            panel:
                gemPanel
        };
    }

    // ============================================================
    // Type Farm UI
    // ============================================================

    function updateTypeFarmUI() {
        if (!typeFarmHeaderButton) {
            return;
        }

        const typeName =
            getTypeFarmTypeName();

        const best =
            typeFarmResults[0];

        if (!best) {
            typeFarmHeaderButton.textContent =
                `Type Farm: ${typeName} — Not scanned ▾`;

            typeFarmBestText.textContent =
                'Press Rescan';

            typeFarmTopText.innerHTML = '';

            return;
        }

        typeFarmHeaderButton.textContent =
            `Type Farm: ${typeName} → ${best.route.routeName} ▾`;

        typeFarmBestText.innerHTML =
            `<strong>Best:</strong><br>` +
            `${best.route.routeName}<br>` +
            `Est. ${best.catchesPerMinute
                .toFixed(2)
            } catches/min<br>` +
            `Target encounters: ${(
                best.targetEncounterRate *
                100
            ).toFixed(1)
            }%<br>` +
            `Target catch chance: ${(
                best.targetCatchChance *
                100
            ).toFixed(1)
            }%`;

        typeFarmTopText.innerHTML =
            typeFarmResults
                .slice(1, 5)
                .map(
                    (
                        result,
                        index
                    ) =>
                        `${index + 2}. ${result.route.routeName}` +
                        ` — ${result
                            .catchesPerMinute
                            .toFixed(2)
                        }/min`
                )
                .join('<br>');
    }

    function createTypeFarmPanel() {
        typeFarmHeaderButton =
            document.createElement(
                'button'
            );

        styleMainButton(
            typeFarmHeaderButton
        );

        typeFarmHeaderButton.style.background =
            '#fd7e14';

        typeFarmHeaderButton.textContent =
            `Type Farm: ${getTypeFarmTypeName()} — Not scanned ▾`;

        typeFarmPanel =
            document.createElement(
                'div'
            );

        Object.assign(
            typeFarmPanel.style,
            {
                display: 'none',
                background:
                    'rgba(25,25,25,0.96)',
                color: 'white',
                borderRadius: '6px',
                padding: '10px',
                width: '250px',
                fontSize: '12px',
                lineHeight: '1.35',
                boxShadow:
                    '0 2px 8px rgba(0,0,0,0.45)'
            }
        );

        const title =
            document.createElement(
                'div'
            );

        title.textContent =
            'Type Farm';

        title.style.fontWeight =
            'bold';

        title.style.fontSize =
            '14px';

        title.style.marginBottom =
            '8px';

        typeFarmTypeSelect =
            document.createElement(
                'select'
            );

        Object.assign(
            typeFarmTypeSelect.style,
            {
                width: '100%',
                marginBottom: '10px'
            }
        );

        for (
            const type of
            TYPE_FARM_TYPES
        ) {
            const option =
                document.createElement(
                    'option'
                );

            option.value =
                String(type);

            option.textContent =
                PokemonType[type];

            typeFarmTypeSelect
                .appendChild(option);
        }

        typeFarmTypeSelect.value =
            String(typeFarmType);

        typeFarmTypeSelect.addEventListener(
            'change',
            () => {
                typeFarmType =
                    Number(
                        typeFarmTypeSelect
                            .value
                    );

                localStorage.setItem(
                    TYPE_FARM_STORAGE_KEY,
                    String(
                        typeFarmType
                    )
                );

                typeFarmResults = [];

                updateTypeFarmUI();
            }
        );

        typeFarmBestText =
            document.createElement(
                'div'
            );

        typeFarmBestText.style.marginBottom =
            '8px';

        typeFarmTopText =
            document.createElement(
                'div'
            );

        typeFarmTopText.style.opacity =
            '0.85';

        const note =
            document.createElement(
                'div'
            );

        note.textContent =
            'Uses route encounters, current Poké Ball filters, catch odds and battle speed.';

        Object.assign(
            note.style,
            {
                marginTop: '8px',
                paddingTop: '8px',
                borderTop:
                    '1px solid rgba(255,255,255,0.2)',
                opacity: '0.7'
            }
        );

        const rescanButton =
            document.createElement(
                'button'
            );

        rescanButton.textContent =
            'Rescan';

        Object.assign(
            rescanButton.style,
            {
                width: '100%',
                border: 'none',
                borderRadius: '4px',
                padding: '6px',
                marginTop: '10px',
                cursor: 'pointer'
            }
        );

        rescanButton.addEventListener(
            'click',
            event => {
                event.stopPropagation();

                typeFarmBestText.textContent =
                    'Scanning...';

                setTimeout(
                    scanTypeCatchRoutes,
                    0
                );
            }
        );

        typeFarmPanel.appendChild(
            title
        );

        typeFarmPanel.appendChild(
            typeFarmTypeSelect
        );

        typeFarmPanel.appendChild(
            typeFarmBestText
        );

        typeFarmPanel.appendChild(
            typeFarmTopText
        );

        typeFarmPanel.appendChild(
            note
        );

        typeFarmPanel.appendChild(
            rescanButton
        );

        typeFarmHeaderButton.addEventListener(
            'click',
            () => {
                const opening =
                    typeFarmPanel.style.display ===
                    'none';

                typeFarmPanel.style.display =
                    opening
                        ? 'block'
                        : 'none';
            }
        );

        updateTypeFarmUI();

        return {
            header:
                typeFarmHeaderButton,
            panel:
                typeFarmPanel
        };
    }

    // ============================================================
    // Vitamin UI
    // ============================================================

    function positionVitaminPanel() {
        if (!vitaminPanel || vitaminPanel.style.display === 'none') {
            return;
        }
        const margin = 8;
        const anchor = vitaminHeaderButton.getBoundingClientRect();
        const panel = vitaminPanel.getBoundingClientRect();
        const left = Math.max(margin,
            Math.min(anchor.right - panel.width, window.innerWidth - panel.width - margin));
        const top = Math.max(margin,
            Math.min(anchor.top - panel.height - 6, window.innerHeight - panel.height - margin));
        vitaminPanel.style.left = `${left}px`;
        vitaminPanel.style.top = `${top}px`;
    }

    function updateVitaminUI() {
        if (!vitaminHeaderButton) {
            return;
        }

        const regionName =
            getRegionName(
                selectedVitaminRegion
            );

        const best =
            vitaminResults[0];

        const multiplier = getNonNativeAttackMultiplier();
        vitaminSummaryText.innerHTML =
            `Target: <strong>${regionName}</strong><br>` +
            `Regional debuff: ${isRegionalDebuffActive() ? 'ON' : 'OFF'}<br>` +
            `Non-native multiplier: ×${multiplier.toFixed(2)}<br>` +
            `Vitamin cap: ${getVitaminCap()} per Pokémon`;

        if (!best) {
            vitaminHeaderButton.textContent =
                `Vitamins: ${regionName} — ${vitaminHasScanned ? 'No beneficial targets' : 'Not scanned'} ▾`;
            vitaminResultsText.innerHTML = vitaminHasScanned
                ? 'No beneficial vitamin investments with currently unlocked vitamins.'
                : 'Press Refresh';
            positionVitaminPanel();
            return;
        }

        vitaminHeaderButton.textContent =
            `Vitamins: ${regionName} → ${best.name} ▾`;

        vitaminResultsText.innerHTML =
            vitaminResults
                .slice(0, 10)
                .map(
                    (
                        result,
                        index
                    ) => {
                        const current =
                            result.current;

                        const optimal =
                            result.optimal;

                        return (
                            `<div style="margin-bottom:10px;">` +
                            `<strong>${index + 1}. ${result.name}</strong><br>` +
                            `+${(Math.floor(result.nextGain * 1000) / 1000).toFixed(3)} regional BE / vitamin<br>` +
                            `Native: ${result.nativeRegion === null ? 'Unknown' : getRegionName(result.nativeRegion)}<br>` +
                            `Current: ${current.protein}P / ${current.calcium}Ca / ${current.carbos}Cb<br>` +
                            `Optimal: ${optimal.protein}P / ${optimal.calcium}Ca / ${optimal.carbos}Cb` +
                            `</div>`
                        );
                    }
                )
                .join('');
        positionVitaminPanel();
    }

    function createVitaminPanel() {
        vitaminHeaderButton =
            document.createElement(
                'button'
            );

        styleMainButton(
            vitaminHeaderButton
        );

        vitaminHeaderButton.style.background =
            '#20c997';

        vitaminHeaderButton.textContent =
            `Vitamins: ${getRegionName(selectedVitaminRegion)} — Not scanned ▾`;

        vitaminPanel =
            document.createElement(
                'div'
            );

        Object.assign(
            vitaminPanel.style,
            {
                display: 'none',
                background:
                    'rgba(25,25,25,0.97)',
                color: 'white',
                borderRadius: '6px',
                padding: '10px',
                position: 'fixed',
                boxSizing: 'border-box',
                width: '310px',
                maxWidth: 'calc(100vw - 16px)',
                maxHeight: 'min(70vh, calc(100vh - 16px))',
                overflowWrap: 'anywhere',
                overflowY: 'auto',
                fontSize: '12px',
                lineHeight: '1.35',
                boxShadow:
                    '0 2px 8px rgba(0,0,0,0.45)'
            }
        );

        const title =
            document.createElement(
                'div'
            );

        title.textContent =
            'Vitamin Tracker';

        title.style.fontWeight =
            'bold';

        title.style.fontSize =
            '14px';

        title.style.marginBottom =
            '8px';

        vitaminRegionSelect =
            document.createElement(
                'select'
            );

        Object.assign(
            vitaminRegionSelect.style,
            {
                width: '100%',
                marginBottom: '10px'
            }
        );

        const highestRegion =
            player.highestRegion();

        for (
            let region = 0;
            region <= highestRegion;
            region++
        ) {
            const option =
                document.createElement(
                    'option'
                );

            option.value =
                String(region);

            option.textContent =
                getRegionName(region);

            vitaminRegionSelect
                .appendChild(option);
        }

        if (
            selectedVitaminRegion >
            highestRegion
        ) {
            selectedVitaminRegion =
                highestRegion;
        }

        vitaminRegionSelect.value =
            String(
                selectedVitaminRegion
            );

        vitaminRegionSelect.addEventListener(
            'change',
            () => {
                selectedVitaminRegion =
                    Number(
                        vitaminRegionSelect
                            .value
                    );

                localStorage.setItem(
                    VITAMIN_REGION_STORAGE_KEY,
                    String(
                        selectedVitaminRegion
                    )
                );

                vitaminResults = [];
                vitaminHasScanned = false;

                updateVitaminUI();
            }
        );

        vitaminSummaryText =
            document.createElement(
                'div'
            );

        Object.assign(
            vitaminSummaryText.style,
            {
                marginBottom: '10px',
                paddingBottom: '8px',
                borderBottom:
                    '1px solid rgba(255,255,255,0.2)'
            }
        );

        vitaminResultsText =
            document.createElement(
                'div'
            );

        const refreshButton =
            document.createElement(
                'button'
            );

        refreshButton.textContent =
            'Refresh';

        Object.assign(
            refreshButton.style,
            {
                width: '100%',
                border: 'none',
                borderRadius: '4px',
                padding: '7px',
                marginTop: '8px',
                cursor: 'pointer'
            }
        );

        refreshButton.addEventListener(
            'click',
            event => {
                event.stopPropagation();

                vitaminResultsText.textContent =
                    'Calculating...';

                setTimeout(
                    scanVitaminEfficiency,
                    0
                );
            }
        );

        vitaminPanel.appendChild(
            title
        );

        vitaminPanel.appendChild(
            vitaminRegionSelect
        );

        vitaminPanel.appendChild(
            vitaminSummaryText
        );

        vitaminPanel.appendChild(
            vitaminResultsText
        );

        vitaminPanel.appendChild(
            refreshButton
        );

        vitaminHeaderButton.addEventListener(
            'click',
            () => {
                const opening =
                    vitaminPanel.style.display ===
                    'none';

                vitaminPanel.style.display =
                    opening
                        ? 'block'
                        : 'none';
                positionVitaminPanel();
            }
        );

        window.addEventListener('resize', positionVitaminPanel);
        updateVitaminUI();

        return {
            header:
                vitaminHeaderButton,
            panel:
                vitaminPanel
        };
    }

    // ============================================================
    // Settings setters
    // ============================================================

    function setAutoClick(value) {
        autoClickEnabled =
            value;

        localStorage.setItem(
            CLICK_STORAGE_KEY,
            String(value)
        );

        updateClickButton();
    }

    function setHatchMode(mode) {
        hatchMode =
            mode;

        localStorage.setItem(
            HATCH_MODE_STORAGE_KEY,
            hatchMode
        );

        updateHatchButton();

        if (
            hatchMode !== 'off'
        ) {
            runAutoHatch();
        }
    }

    function cycleHatchMode() {
        const index =
            HATCH_MODES.indexOf(
                hatchMode
            );

        const nextIndex =
            (
                index + 1
            ) %
            HATCH_MODES.length;

        setHatchMode(
            HATCH_MODES[
            nextIndex
            ]
        );
    }

    // ============================================================
    // Controls
    // ============================================================

    function createControls() {
        const container =
            document.createElement(
                'div'
            );

        Object.assign(
            container.style,
            {
                position: 'fixed',
                right: '15px',
                bottom: '15px',
                zIndex: '99999',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                alignItems: 'flex-end'
            }
        );

        const vitaminControls =
            createVitaminPanel();

        const typeFarmControls =
            createTypeFarmPanel();

        const gemControls =
            createGemPanel();

        const dtControls =
            createDungeonTokenPanel();

        clickButton =
            document.createElement(
                'button'
            );

        hatchButton =
            document.createElement(
                'button'
            );

        styleMainButton(
            clickButton
        );

        styleMainButton(
            hatchButton
        );

        clickButton.addEventListener(
            'click',
            () => {
                setAutoClick(
                    !autoClickEnabled
                );
            }
        );

        hatchButton.addEventListener(
            'click',
            () => {
                cycleHatchMode();
            }
        );

        container.appendChild(
            vitaminControls.panel
        );

        container.appendChild(
            vitaminControls.header
        );

        container.appendChild(
            typeFarmControls.panel
        );

        container.appendChild(
            typeFarmControls.header
        );

        container.appendChild(
            gemControls.panel
        );

        container.appendChild(
            gemControls.header
        );

        container.appendChild(
            dtControls.panel
        );

        container.appendChild(
            dtControls.header
        );

        container.appendChild(
            clickButton
        );

        container.appendChild(
            hatchButton
        );

        document.body.appendChild(
            container
        );

        updateClickButton();
        updateHatchButton();
        updateDungeonTokenUI();
        updateGemUI();
        updateTypeFarmUI();
        updateVitaminUI();
    }

    // ============================================================
    // Start
    // ============================================================

    function start() {
        createControls();

        setInterval(
            runAutoClick,
            CLICK_INTERVAL
        );

        setInterval(
            runAutoHatch,
            HATCH_INTERVAL
        );

        setInterval(
            updateDungeonTokenBenchmark,
            DT_SAMPLE_INTERVAL
        );

        if (
            hatchMode !== 'off'
        ) {
            runAutoHatch();
        }

        console.log(
            '[My PokéClicker Automation v6.0.3] Loaded'
        );
    }

    // ============================================================
    // Wait for PokéClicker
    // ============================================================

    const waitForGame =
        setInterval(
            () => {
                try {
                    if (
                        typeof App !==
                        'undefined' &&

                        App.game?.breeding &&

                        typeof Battle !==
                        'undefined' &&

                        typeof GymBattle !==
                        'undefined' &&

                        typeof DungeonBattle !==
                        'undefined' &&

                        typeof TemporaryBattleBattle !==
                        'undefined' &&

                        typeof BreedingController !==
                        'undefined' &&

                        typeof RouteHelper !==
                        'undefined' &&

                        typeof Routes !==
                        'undefined' &&

                        typeof PokemonFactory !==
                        'undefined' &&

                        typeof PokemonHelper !==
                        'undefined' &&

                        typeof player !==
                        'undefined'
                    ) {
                        clearInterval(
                            waitForGame
                        );

                        start();
                    }
                } catch {
                    // Game isn't ready yet.
                }
            },
            500
        );

})();