// ==UserScript==
// @name         My PokéClicker Automation
// @namespace    raya-pokeclicker
// @version      7.0.1
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
    GymRunner,
    DungeonBattle,
    DungeonRunner,
    DungeonGuides,
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
    BerryList,
    BerryType,
    PlotStage,
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
    const AUTOMATION_INTERVAL = 250;

    const CLICK_STORAGE_KEY = 'myAutoClickEnabled';
    const HATCH_MODE_STORAGE_KEY = 'myAutoHatchMode';
    const TYPE_FARM_STORAGE_KEY = 'myTypeFarmType';
    const GEM_FARM_STORAGE_KEY = 'myGemFarmType';
    const VITAMIN_REGION_STORAGE_KEY = 'myVitaminTargetRegion';
    const AUTO_FARMER_BERRY_STORAGE_KEY = 'myAutoFarmerBerry';
    const AUTO_FARMER_MODE_STORAGE_KEY = 'myAutoFarmerMode';
    const AUTO_FARMER_TARGET_STORAGE_KEY = 'myAutoFarmerTarget';
    const AUTO_DUNGEON_STORAGE_KEY = 'myAutoDungeon';
    const AUTO_DUNGEON_MODE_STORAGE_KEY = 'myAutoDungeonMode';
    const AUTO_DUNGEON_GOAL_STORAGE_KEY = 'myAutoDungeonGoal';
    const AUTO_DUNGEON_TARGET_STORAGE_KEY = 'myAutoDungeonTarget';
    const AUTO_DUNGEON_RESERVE_STORAGE_KEY = 'myAutoDungeonReserve';

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
    let vitaminScanId = 0;

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
                gym,
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
                route,
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

    function createVitaminBECalculator(pokemon, targetRegion) {
        const baseAttack = getVitaminBaseAttack(pokemon);
        const baseEggSteps = getBaseEggSteps(pokemon);
        const eggCycleMultiplier = GameConstants.EGG_CYCLE_MULTIPLIER ?? 40;
        const breedingAttackBonus = GameConstants.BREEDING_ATTACK_BONUS ?? 25;
        const multiplier = getPokemonAttackModifier(pokemon) *
            getRegionalAttackMultiplier(pokemon, targetRegion) *
            eggCycleMultiplier;

        return (protein, calcium, carbos) => {
            const attackGain = baseAttack *
                (breedingAttackBonus + calcium) / 100 + protein;
            const stepsBeforeCarbos = baseEggSteps +
                (protein + calcium) / 2 * eggCycleMultiplier;
            const eggSteps = stepsBeforeCarbos <= 300 ? stepsBeforeCarbos :
                Math.round(((stepsBeforeCarbos / 300) ** (1 - carbos / 70)) * 300);
            return attackGain * multiplier / Math.max(1, eggSteps);
        };
    }

    function analyzeVitaminSetups(pokemon, targetRegion, current = null) {
        const cap = getVitaminCap();
        const available = {
            protein: isVitaminAvailable('Protein'),
            calcium: isVitaminAvailable('Calcium'),
            carbos: isVitaminAvailable('Carbos')
        };
        const calculateBE = createVitaminBECalculator(pokemon, targetRegion);
        const currentUsed = current ?
            current.protein + current.calcium + current.carbos : 0;
        const currentBE = current ?
            calculateBE(current.protein, current.calcium, current.carbos) : null;
        let optimal = null;
        let investment = null;
        let bestInvestmentScore = -Infinity;

        for (let protein = 0; protein <= (available.protein ? cap : 0); protein++) {
            for (let calcium = 0; calcium <= (available.calcium ? cap - protein : 0); calcium++) {
                for (let carbos = 0; carbos <= (available.carbos ? cap - protein - calcium : 0); carbos++) {
                    const used = protein + calcium + carbos;
                    const be = calculateBE(protein, calcium, carbos);
                    if (!optimal || be > optimal.be ||
                        (be === optimal.be && used < optimal.protein + optimal.calcium + optimal.carbos)) {
                        optimal = { protein, calcium, carbos, be };
                    }

                    if (current && protein >= current.protein &&
                        calcium >= current.calcium && carbos >= current.carbos) {
                        const added = used - currentUsed;
                        const score = added > 0 ? (be - currentBE) / added : 0;
                        if (score > bestInvestmentScore) {
                            investment = { protein, calcium, carbos, be };
                            bestInvestmentScore = score;
                        }
                    }
                }
            }
        }
        return { optimal, investment, currentBE, bestInvestmentScore };
    }

    function optimizeVitaminSetup(pokemon, targetRegion) {
        return analyzeVitaminSetups(pokemon, targetRegion).optimal;
    }

    function getVitaminInvestmentRecommendation(pokemon, targetRegion) {
        const current = getCurrentVitaminCounts(pokemon);
        const used = current.protein + current.calcium + current.carbos;
        if (used >= getVitaminCap()) {
            return null;
        }
        const analysis = analyzeVitaminSetups(pokemon, targetRegion, current);
        if (!analysis.investment || analysis.bestInvestmentScore <= 1e-12) {
            return null;
        }
        return {
            current,
            currentBE: analysis.currentBE,
            gain: analysis.bestInvestmentScore,
            nextBE: analysis.investment.be,
            optimal: analysis.optimal
        };
    }

    async function scanVitaminEfficiency() {
        const scanId = ++vitaminScanId;
        const targetRegion = selectedVitaminRegion;
        const results = [];
        const pokemonList = App.game.party.caughtPokemon;

        for (let index = 0; index < pokemonList.length; index++) {
            const pokemon = pokemonList[index];
            try {
                const next = getVitaminInvestmentRecommendation(
                    pokemon,
                    targetRegion
                );

                if (next) {
                    results.push({
                        pokemon,
                        name: pokemon.name,
                        nativeRegion: getPokemonNativeRegion(pokemon),
                        current: next.current,
                        currentBE: next.currentBE,
                        nextGain: next.gain,
                        nextBE: next.nextBE,
                        optimal: next.optimal
                    });
                }
            } catch (error) {
                console.warn(
                    `[Vitamin Tracker] Skipping ${pokemon.name} after its calculation failed.`,
                    error
                );
            }

            // Carbos adds a third search dimension at Unova. Yield in batches
            // so a manual scan cannot freeze the game UI.
            if ((index + 1) % 20 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
                if (scanId !== vitaminScanId) {
                    return vitaminResults;
                }
            }
        }

        results.sort(
            (a, b) =>
                b.currentBE -
                a.currentBE
        );

        if (scanId !== vitaminScanId) {
            return vitaminResults;
        }
        vitaminResults = results;
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
    // Automation manager and executors
    // ============================================================

    const executionViews = {};
    let foregroundJob = null;
    let foregroundLastStatus = 'Idle';
    let farmerJob = null;
    let farmerLastStatus = 'Idle';
    let automationStatusText = null;
    let automationStopButton = null;
    let farmerStatusText = null;
    let farmerHeaderButton = null;
    let dungeonHeaderButton = null;
    let dungeonSelect = null;

    function readObservable(value) {
        return typeof value === 'function' ? value() : Number(value);
    }

    function getCurrencyAmount(currencyType) {
        return Number(readObservable(App.game.wallet.currencies[currencyType]));
    }

    function getFarmPoints() {
        return getCurrencyAmount(GameConstants.Currency.farmPoint);
    }

    function getGemGainCount(type) {
        return Number(readObservable(App.game.statistics.gemsGained[type]));
    }

    function getCapturedCountByType(type) {
        let total = 0;
        for (const [id, observable] of Object.entries(App.game.statistics.pokemonCaptured)) {
            if (id === 'highestID' || typeof observable !== 'function') {
                continue;
            }
            try {
                const pokemon = PokemonHelper.getPokemonById(Number(id));
                if (pokemon && (pokemon.type1 === type || pokemon.type2 === type)) {
                    total += Number(observable());
                }
            } catch {
                // Ignore obsolete save entries that have no current Pokemon data.
            }
        }
        return total;
    }

    function formatDuration(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) {
            return '';
        }
        if (seconds < 60) {
            return Math.ceil(seconds) + 's';
        }
        if (seconds < 3600) {
            return Math.ceil(seconds / 60) + 'm';
        }
        return (seconds / 3600).toFixed(1) + 'h';
    }

    function makeProgressText(label, progress, target, rate = 0) {
        const value = Math.max(0, Math.floor(progress));
        if (target === null) {
            return label + ': ' + formatNumber(value) + ' / Indefinite';
        }
        let text = label + ': ' + formatNumber(value) + ' / ' + formatNumber(target);
        if (rate > 0 && value < target) {
            text += ' (ETA ' + formatDuration((target - value) / rate * 60) + ')';
        }
        return text;
    }

    function updateAutomationUI() {
        if (automationStatusText) {
            automationStatusText.textContent = foregroundJob
                ? 'Automation: ' + foregroundJob.type + '\n' + foregroundJob.detail
                : 'Automation: Idle\n' + foregroundLastStatus;
        }
        if (automationStopButton) {
            automationStopButton.disabled = !foregroundJob;
        }
        for (const [id, view] of Object.entries(executionViews)) {
            if (view.status) {
                view.status.textContent = foregroundJob?.id === id
                    ? foregroundJob.detail
                    : view.lastStatus;
            }
        }
        if (farmerStatusText) {
            farmerStatusText.textContent = farmerJob ? farmerJob.detail : farmerLastStatus;
        }
        if (farmerHeaderButton) {
            farmerHeaderButton.textContent = farmerJob
                ? 'Auto Farmer: ' + BerryType[farmerJob.berry] + ' (Running) \u25be'
                : 'Auto Farmer \u25be';
        }
        if (dungeonHeaderButton) {
            dungeonHeaderButton.textContent = foregroundJob?.id === 'dungeon'
                ? 'Auto Dungeon: ' + foregroundJob.dungeon.name + ' \u25be'
                : 'Auto Dungeon \u25be';
        }
    }

    function restoreJobAutoClick(job) {
        if (job?.autoClickChanged && autoClickEnabled !== job.autoClickBefore) {
            setAutoClick(job.autoClickBefore);
        }
    }

    function stopForegroundJob(reason = 'Stopped by user', completed = false) {
        const job = foregroundJob;
        if (!job) {
            foregroundLastStatus = reason;
            updateAutomationUI();
            return;
        }
        foregroundJob = null;
        try {
            job.cleanup?.();
        } catch (error) {
            console.error('[Automation] Cleanup failed', error);
        }
        restoreJobAutoClick(job);
        foregroundLastStatus = (completed ? 'Complete: ' : 'Stopped: ') + reason;
        if (executionViews[job.id]) {
            executionViews[job.id].lastStatus = foregroundLastStatus;
        }
        console.log('[Automation] ' + job.type + ': ' + foregroundLastStatus);
        updateAutomationUI();
    }

    function failForegroundStart(id, reason) {
        foregroundLastStatus = 'Could not start: ' + reason;
        if (executionViews[id]) {
            executionViews[id].lastStatus = foregroundLastStatus;
        }
        console.error('[Automation]', reason);
        updateAutomationUI();
    }

    function activateForegroundJob(job) {
        if (foregroundJob) {
            stopForegroundJob('Replaced by ' + job.type);
        }
        job.startedAt = Date.now();
        job.autoClickBefore = autoClickEnabled;
        job.autoClickChanged = Boolean(job.needsClicks && !autoClickEnabled);
        foregroundJob = job;
        if (job.autoClickChanged) {
            setAutoClick(true);
        }
        try {
            job.start?.();
            updateAutomationUI();
        } catch (error) {
            console.error('[Automation] ' + job.type, error);
            stopForegroundJob(error?.message ?? 'Start failed');
        }
    }

    function isOnRoute(route) {
        return App.game.gameState === GameConstants.GameState.fighting &&
            player.region === route.region &&
            player.route === route.number;
    }

    function requireFiniteTarget(mode, target) {
        if (mode === 'indefinite') {
            return null;
        }
        const parsed = Math.floor(Number(target));
        if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error('Enter a target greater than zero.');
        }
        return parsed;
    }

    function startDungeonTokenAutomation(mode, rawTarget) {
        stopForegroundJob('Replaced by Dungeon Token Farm');
        let target;
        try {
            target = requireFiniteTarget(mode, rawTarget);
        } catch (error) {
            failForegroundStart('dt', error.message);
            return;
        }
        const best = scanDungeonTokenRoutes()[0];
        if (!best) {
            failForegroundStart('dt', 'No unlocked route was found.');
            return;
        }
        const baseline = getDungeonTokens();
        if (!Number.isFinite(baseline)) {
            failForegroundStart('dt', 'Dungeon Token balance is unavailable.');
            return;
        }
        const job = {
            id: 'dt',
            type: 'Dungeon Token Farm',
            needsClicks: true,
            route: best.route,
            target,
            baseline,
            detail: '',
            start() {
                MapHelper.moveToRoute(this.route.number, this.route.region);
                if (!isOnRoute(this.route)) {
                    throw new Error('Could not move to ' + this.route.routeName + '.');
                }
                this.tick();
            },
            tick() {
                if (!isOnRoute(this.route)) {
                    stopForegroundJob('Player left the selected route.');
                    return;
                }
                const progress = Math.max(0, getDungeonTokens() - this.baseline);
                this.detail = this.route.routeName + '\n' +
                    makeProgressText('DT gained', progress, this.target, best.estimatedDTPerMinute);
                if (this.target !== null && progress >= this.target) {
                    stopForegroundJob('Gained ' + formatNumber(progress) + ' DT.', true);
                }
            }
        };
        activateForegroundJob(job);
    }

    function startTypeFarmAutomation(mode, rawTarget) {
        stopForegroundJob('Replaced by Type Farm');
        let target;
        try {
            target = requireFiniteTarget(mode, rawTarget);
        } catch (error) {
            failForegroundStart('type', error.message);
            return;
        }
        const selectedType = typeFarmType;
        const typeName = PokemonType[selectedType];
        const best = scanTypeCatchRoutes()[0];
        if (!best) {
            failForegroundStart('type', 'No route can farm ' + typeName + '.');
            return;
        }
        const baseline = getCapturedCountByType(selectedType);
        const job = {
            id: 'type',
            type: 'Type Farm',
            needsClicks: true,
            selectedType,
            typeName,
            route: best.route,
            target,
            baseline,
            detail: '',
            start() {
                MapHelper.moveToRoute(this.route.number, this.route.region);
                if (!isOnRoute(this.route)) {
                    throw new Error('Could not move to ' + this.route.routeName + '.');
                }
                this.tick();
            },
            tick() {
                if (!isOnRoute(this.route)) {
                    stopForegroundJob('Player left the selected route.');
                    return;
                }
                const progress = Math.max(0,
                    getCapturedCountByType(this.selectedType) - this.baseline);
                this.detail = this.route.routeName + '\n' +
                    makeProgressText(this.typeName + ' catches', progress,
                        this.target, best.catchesPerMinute);
                if (this.target !== null && progress >= this.target) {
                    stopForegroundJob('Caught ' + formatNumber(progress) + ' ' +
                        this.typeName + ' Pokemon.', true);
                }
            }
        };
        activateForegroundJob(job);
    }

    function getGymClearCount(gym) {
        const index = GameConstants.getGymIndex(gym.town);
        return Number(readObservable(App.game.statistics.gymsDefeated[index]));
    }

    function startGemFarmAutomation(mode, rawTarget) {
        stopForegroundJob('Replaced by Gem Farm');
        let target;
        try {
            target = requireFiniteTarget(mode, rawTarget);
        } catch (error) {
            failForegroundStart('gem', error.message);
            return;
        }
        const gemName = selectedGemType;
        const gemType = PokemonType[gemName];
        const best = scanGemFarms()[0];
        if (!best) {
            failForegroundStart('gem', 'No farm can produce ' + gemName + ' gems.');
            return;
        }
        const baseline = getGemGainCount(gemType);
        const job = {
            id: 'gem',
            type: 'Gem Farm',
            needsClicks: true,
            gemName,
            gemType,
            result: best,
            target,
            baseline,
            detail: '',
            gymRunningSeen: false,
            lastGymClears: 0,
            start() {
                if (this.result.kind === 'Route') {
                    MapHelper.moveToRoute(this.result.route.number, this.result.route.region);
                    if (!isOnRoute(this.result.route)) {
                        throw new Error('Could not move to ' + this.result.location + '.');
                    }
                } else {
                    const gym = this.result.gym;
                    if (!gym?.isUnlocked?.()) {
                        throw new Error('The selected gym is unavailable.');
                    }
                    MapHelper.moveToTown(gym.town);
                    if (player.town?.name !== gym.town) {
                        throw new Error('Could not move to ' + gym.town + '.');
                    }
                    this.lastGymClears = getGymClearCount(gym);
                    GymRunner.startGym(gym, false, true);
                    this.gymRunningSeen = GymRunner.running();
                }
                this.tick();
            },
            cleanup() {
                GymRunner.autoRestart(false);
            },
            tick() {
                const progress = Math.max(0, getGemGainCount(this.gemType) - this.baseline);
                this.detail = this.result.kind + ': ' + this.result.location + '\n' +
                    makeProgressText(this.gemName + ' gems', progress,
                        this.target, this.result.gemsPerMinute);
                if (this.target !== null && progress >= this.target) {
                    stopForegroundJob('Gained ' + formatNumber(progress) + ' ' +
                        this.gemName + ' gems.', true);
                    return;
                }
                if (this.result.kind === 'Route') {
                    if (!isOnRoute(this.result.route)) {
                        stopForegroundJob('Player left the selected route.');
                    }
                    return;
                }
                const gym = this.result.gym;
                if (GymRunner.running() ||
                    App.game.gameState === GameConstants.GameState.gym) {
                    this.gymRunningSeen = true;
                    return;
                }
                if (!this.gymRunningSeen) {
                    stopForegroundJob('The gym did not start.');
                    return;
                }
                const clears = getGymClearCount(gym);
                if (clears <= this.lastGymClears) {
                    stopForegroundJob('The gym battle was lost or interrupted.');
                    return;
                }
                if (!gym.isUnlocked()) {
                    stopForegroundJob('The selected gym is no longer available.');
                    return;
                }
                this.lastGymClears = clears;
                this.gymRunningSeen = false;
                GymRunner.startGym(gym, false, false);
                this.gymRunningSeen = GymRunner.running();
                if (!this.gymRunningSeen) {
                    stopForegroundJob('The gym could not be restarted.');
                }
            }
        };
        activateForegroundJob(job);
    }

    function getFarmCandidate(berry, availablePlots, finiteTarget = null) {
        const farming = App.game.farming;
        const data = BerryList[berry];
        const inventory = Math.floor(farming.berryInventory[berry]());
        if (!data || !farming.unlockedBerries[berry]() ||
            inventory <= 0 || data.harvestAmount < 1) {
            return null;
        }
        const plotCount = Math.min(availablePlots, inventory);
        if (!plotCount) {
            return null;
        }
        const multiplier = Math.max(0.0001, farming.getGrowthMultiplier());
        const growthSeconds = data.growthTime[PlotStage.Bloom] / multiplier;
        const fpPerCycle = plotCount * data.farmValue;
        return {
            berry,
            plotCount,
            completionSeconds: finiteTarget === null
                ? Infinity
                : Math.ceil(finiteTarget / fpPerCycle) * growthSeconds,
            longRunRate: fpPerCycle / growthSeconds
        };
    }

    function chooseFarmBerry(selection, mode, target, availablePlots) {
        if (selection !== 'auto') {
            const candidate = getFarmCandidate(Number(selection), availablePlots,
                mode === 'farmPoints' ? target : null);
            if (mode === 'berries' && candidate &&
                BerryList[candidate.berry].harvestAmount <= 1) {
                return null;
            }
            return candidate;
        }
        if (mode === 'berries') {
            return null;
        }
        const candidates = [];
        BerryList.forEach((berry, berryType) => {
            const candidate = getFarmCandidate(berryType, availablePlots,
                mode === 'farmPoints' ? target : null);
            if (candidate) {
                candidates.push(candidate);
            }
        });
        candidates.sort(mode === 'farmPoints'
            ? (a, b) => a.completionSeconds - b.completionSeconds ||
                b.longRunRate - a.longRunRate
            : (a, b) => b.longRunRate - a.longRunRate);
        return candidates[0] ?? null;
    }

    function stopFarmer(reason = 'Stopped by user', completed = false) {
        farmerJob = null;
        farmerLastStatus = (completed ? 'Complete: ' : 'Stopped: ') + reason;
        console.log('[Auto Farmer]', farmerLastStatus);
        updateAutomationUI();
    }

    function getFarmerProgress(job) {
        if (job.mode === 'berries') {
            return Math.max(0,
                App.game.farming.berryInventory[job.berry]() - job.baseline);
        }
        return Math.max(0, getFarmPoints() - job.baseline);
    }

    function updateFarmerDetail(job) {
        const progress = getFarmerProgress(job);
        const label = job.mode === 'berries'
            ? BerryType[job.berry] + ' berries'
            : 'Farm Points';
        job.detail = BerryType[job.berry] + ' on ' + job.owned.size +
            ' managed plots\n' + makeProgressText(label, progress, job.target);
        return progress;
    }

    function startAutoFarmer(selection, mode, rawTarget) {
        if (farmerJob) {
            stopFarmer('Replaced by a new farm run.');
        }
        let target = null;
        if (mode !== 'indefinite') {
            target = Math.floor(Number(rawTarget));
            if (!Number.isFinite(target) || target <= 0) {
                farmerLastStatus = 'Could not start: Enter a target greater than zero.';
                updateAutomationUI();
                return;
            }
        }
        if (mode === 'berries' && selection === 'auto') {
            farmerLastStatus =
                'Could not start: Select a concrete berry for a berry goal.';
            updateAutomationUI();
            return;
        }
        const farming = App.game.farming;
        const eligible = [];
        farming.plotList.forEach((plot, index) => {
            if (plot.isUnlocked && plot.isEmpty() && !plot.isSafeLocked) {
                eligible.push(index);
            }
        });
        if (!eligible.length) {
            farmerLastStatus =
                'Could not start: No unlocked empty plots are available.';
            updateAutomationUI();
            return;
        }
        const candidate = chooseFarmBerry(selection, mode, target, eligible.length);
        if (!candidate) {
            farmerLastStatus =
                'Could not start: No unlocked berry has enough sustainable seed stock.';
            updateAutomationUI();
            return;
        }
        const owned = new Set(eligible.slice(0, candidate.plotCount));
        const job = {
            mode,
            target,
            berry: candidate.berry,
            owned,
            baseline: mode === 'berries'
                ? farming.berryInventory[candidate.berry]()
                : getFarmPoints(),
            detail: ''
        };
        for (const index of [...owned]) {
            farming.plant(index, job.berry);
            if (farming.plotList[index].berry !== job.berry) {
                owned.delete(index);
            }
        }
        if (!owned.size) {
            farmerLastStatus =
                'Could not start: The selected berry could not be planted.';
            updateAutomationUI();
            return;
        }
        farmerJob = job;
        farmerLastStatus = 'Running';
        updateFarmerDetail(job);
        updateAutomationUI();
    }

    function runAutoFarmerTick() {
        const job = farmerJob;
        if (!job) {
            return;
        }
        const farming = App.game.farming;
        for (const index of [...job.owned]) {
            const plot = farming.plotList[index];
            if (!plot || plot.isSafeLocked || plot.berry !== job.berry) {
                job.owned.delete(index);
                continue;
            }
            if (plot.stage() !== PlotStage.Berry) {
                continue;
            }
            farming.harvest(index);
            if (!plot.isEmpty()) {
                job.owned.delete(index);
                continue;
            }
            const progress = updateFarmerDetail(job);
            if (job.target !== null && progress >= job.target) {
                const goal = job.mode === 'berries'
                    ? BerryType[job.berry] + ' berry'
                    : 'Farm Point';
                stopFarmer(goal + ' goal reached.', true);
                return;
            }
            farming.plant(index, job.berry);
            if (plot.berry !== job.berry) {
                job.owned.delete(index);
            }
        }
        if (!farmerJob) {
            return;
        }
        if (!job.owned.size) {
            stopFarmer('No managed plots remain or the required seeds ran out.');
            return;
        }
        updateFarmerDetail(job);
    }

    function getAvailableDungeons() {
        return Object.values(TownList)
            .filter(town => town?.dungeon && town.isUnlocked?.() &&
                town.dungeon.isUnlocked?.() && town.dungeon.hasUnlockedBoss?.())
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    function getDungeonClearCount(dungeon) {
        const index = GameConstants.getDungeonIndex(dungeon.name);
        return Number(readObservable(App.game.statistics.dungeonsCleared[index]));
    }

    function getValidDungeonPath(map, start, target, avoidTypes = []) {
        const path = map.findShortestPath(start, target, avoidTypes);
        if (!path?.length) {
            return null;
        }
        const first = path[0];
        if (first.floor !== start.floor ||
            Math.abs(first.x - start.x) + Math.abs(first.y - start.y) !== 1) {
            return null;
        }
        return path;
    }

    function findClosestDungeonPath(map, tiles, avoidTypes = []) {
        const start = map.playerPosition();
        const paths = tiles
            .map(tile => getValidDungeonPath(map, start, tile.position, avoidTypes))
            .filter(Boolean)
            .sort((a, b) => a.length - b.length);
        return paths[0] ?? null;
    }

    function getDungeonTilesByType(map, type) {
        const position = map.playerPosition();
        return map.board()[position.floor].flat().filter(tile => tile.type() === type);
    }

    function moveDungeonToward(map, tiles, avoidEnemies = false) {
        let path = null;
        if (avoidEnemies) {
            path = findClosestDungeonPath(map, tiles,
                [GameConstants.DungeonTileType.enemy]);
        }
        path ??= findClosestDungeonPath(map, tiles);
        return path ? map.moveToTile(path[0]) : false;
    }

    function navigateDungeon(job) {
        if (DungeonRunner.fighting() || DungeonBattle.catching()) {
            return;
        }
        const map = DungeonRunner.map;
        if (!map?.board?.()?.length) {
            throw new Error('Dungeon map is unavailable.');
        }
        const currentType = map.currentTile().type();
        const tileTypes = GameConstants.DungeonTileType;
        if (currentType === tileTypes.chest ||
            currentType === tileTypes.ladder ||
            currentType === tileTypes.boss) {
            DungeonRunner.handleInteraction();
            return;
        }
        const chests = getDungeonTilesByType(map, tileTypes.chest);
        if (job.navigationMode !== 'boss' && chests.length &&
            moveDungeonToward(map, chests)) {
            return;
        }
        if (job.navigationMode === 'full') {
            const enemies = getDungeonTilesByType(map, tileTypes.enemy);
            if (enemies.length && moveDungeonToward(map, enemies)) {
                return;
            }
        }
        const objectives = [
            ...getDungeonTilesByType(map, tileTypes.ladder),
            ...getDungeonTilesByType(map, tileTypes.boss)
        ];
        if (objectives.length &&
            moveDungeonToward(map, objectives, job.navigationMode === 'boss')) {
            return;
        }
        throw new Error('No usable path to the next dungeon objective.');
    }

    function startDungeonAttempt(job) {
        const tokens = getDungeonTokens();
        const cost = Number(job.dungeon.tokenCost);
        if (!Number.isFinite(tokens) || tokens < cost) {
            throw new Error('Insufficient Dungeon Tokens.');
        }
        if (tokens - cost < job.reserve) {
            throw new Error('Starting another run would use the ' +
                formatNumber(job.reserve) + ' DT reserve.');
        }
        if (!DungeonRunner.canStartDungeon(job.dungeon)) {
            throw new Error('The selected dungeon can no longer be entered.');
        }
        MapHelper.moveToTown(job.dungeon.name);
        if (player.town?.name !== job.dungeon.name) {
            throw new Error('Could not move to ' + job.dungeon.name + '.');
        }
        const started = DungeonRunner.initializeDungeon(job.dungeon);
        if (started === false ||
            App.game.gameState !== GameConstants.GameState.dungeon) {
            throw new Error('The dungeon could not be started.');
        }
        job.runStartClears = getDungeonClearCount(job.dungeon);
        job.runActive = true;
    }

    function startAutoDungeon(dungeonName, navigationMode, goalMode,
        rawTarget, rawReserve) {
        stopForegroundJob('Replaced by Auto Dungeon');
        let target;
        try {
            target = requireFiniteTarget(goalMode, rawTarget);
        } catch (error) {
            failForegroundStart('dungeon', error.message);
            return;
        }
        const reserve = Math.max(0, Math.floor(Number(rawReserve) || 0));
        const town = TownList[dungeonName];
        const dungeon = town?.dungeon;
        if (!dungeon || !town.isUnlocked?.() || !dungeon.isUnlocked?.() ||
            !dungeon.hasUnlockedBoss?.()) {
            failForegroundStart('dungeon', 'Select an unlocked dungeon.');
            return;
        }
        if (typeof DungeonGuides !== 'undefined' && DungeonGuides.hired?.()) {
            failForegroundStart('dungeon',
                'Dismiss the active Dungeon Guide so normal entry costs are used.');
            return;
        }
        const initialClears = getDungeonClearCount(dungeon);
        const job = {
            id: 'dungeon',
            type: 'Auto Dungeon',
            needsClicks: true,
            dungeon,
            navigationMode,
            target,
            reserve,
            completedClears: 0,
            runStartClears: initialClears,
            runActive: false,
            detail: '',
            updateDetail() {
                const modeName = {
                    boss: 'Boss Rush',
                    chest: 'Chest Farm',
                    full: 'Full Clear'
                }[this.navigationMode];
                this.detail = this.dungeon.name + ' (' + modeName + ')\n' +
                    makeProgressText('Clears', this.completedClears, this.target);
            },
            start() {
                startDungeonAttempt(this);
                this.tick();
            },
            tick() {
                const clears = getDungeonClearCount(this.dungeon);
                if (App.game.gameState === GameConstants.GameState.dungeon) {
                    this.runActive = true;
                    this.updateDetail();
                    navigateDungeon(this);
                    return;
                }
                if (this.runActive) {
                    if (clears <= this.runStartClears) {
                        stopForegroundJob('The dungeon was lost or interrupted.');
                        return;
                    }
                    this.completedClears++;
                    this.runActive = false;
                }
                this.updateDetail();
                if (this.target !== null && this.completedClears >= this.target) {
                    stopForegroundJob('Cleared ' + this.dungeon.name + ' ' +
                        formatNumber(this.completedClears) + ' times.', true);
                    return;
                }
                startDungeonAttempt(this);
            }
        };
        activateForegroundJob(job);
    }

    function runAutomationTick() {
        try {
            runAutoFarmerTick();
        } catch (error) {
            console.error('[Auto Farmer]', error);
            stopFarmer(error?.message ?? 'Unexpected farming error.');
        }
        const job = foregroundJob;
        if (job) {
            try {
                job.tick();
            } catch (error) {
                console.error('[Automation] ' + job.type, error);
                stopForegroundJob(error?.message ?? 'Unexpected automation error.');
            }
        }
        updateAutomationUI();
    }

    function styleCompactPanel(panel, width = '250px') {
        Object.assign(panel.style, {
            display: 'none',
            background: 'rgba(25,25,25,0.96)',
            color: 'white',
            borderRadius: '6px',
            padding: '10px',
            width,
            maxWidth: 'calc(100vw - 30px)',
            maxHeight: 'calc(100vh - 30px)',
            overflowY: 'auto',
            fontSize: '12px',
            lineHeight: '1.35',
            boxShadow: '0 2px 8px rgba(0,0,0,0.45)'
        });
    }

    function styleCompactButton(button, color = '') {
        Object.assign(button.style, {
            flex: '1',
            border: 'none',
            borderRadius: '4px',
            padding: '6px',
            cursor: 'pointer'
        });
        if (color) {
            button.style.background = color;
            button.style.color = 'white';
        }
    }

    function createFieldLabel(text, control) {
        const label = document.createElement('label');
        label.textContent = text;
        label.style.display = 'block';
        label.style.marginTop = '7px';
        label.style.marginBottom = '2px';
        Object.assign(control.style, {
            width: '100%',
            boxSizing: 'border-box'
        });
        const wrapper = document.createElement('div');
        wrapper.appendChild(label);
        wrapper.appendChild(control);
        return wrapper;
    }

    function createNumberInput(value = '100') {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.step = '1';
        input.value = value;
        return input;
    }

    function addGoalExecutionControls(panel, config) {
        const storagePrefix = 'myAutomation' + config.id;
        const divider = document.createElement('div');
        divider.style.borderTop = '1px solid rgba(255,255,255,0.2)';
        divider.style.marginTop = '10px';
        divider.style.paddingTop = '5px';
        const mode = document.createElement('select');
        for (const [value, label] of [
            ['finite', config.finiteLabel],
            ['indefinite', 'Run indefinitely']
        ]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            mode.appendChild(option);
        }
        mode.value = localStorage.getItem(storagePrefix + 'Mode') ?? 'finite';
        const target = createNumberInput(
            localStorage.getItem(storagePrefix + 'Target') ?? config.defaultTarget);
        const status = createTextLine();
        status.style.whiteSpace = 'pre-line';
        status.style.marginTop = '8px';
        status.textContent = 'Idle';
        const buttonRow = document.createElement('div');
        Object.assign(buttonRow.style, {
            display: 'flex',
            gap: '5px',
            marginTop: '8px'
        });
        const startButton = document.createElement('button');
        startButton.textContent = 'Start Farming';
        styleCompactButton(startButton, '#198754');
        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        styleCompactButton(stopButton, '#dc3545');
        const syncMode = () => {
            target.disabled = mode.value === 'indefinite';
            localStorage.setItem(storagePrefix + 'Mode', mode.value);
        };
        mode.addEventListener('change', syncMode);
        target.addEventListener('change', () =>
            localStorage.setItem(storagePrefix + 'Target', target.value));
        startButton.addEventListener('click', event => {
            event.stopPropagation();
            config.start(mode.value, target.value);
        });
        stopButton.addEventListener('click', event => {
            event.stopPropagation();
            if (foregroundJob?.id === config.id) {
                stopForegroundJob();
            }
        });
        buttonRow.appendChild(startButton);
        buttonRow.appendChild(stopButton);
        divider.appendChild(createFieldLabel('Mode', mode));
        divider.appendChild(createFieldLabel('Target', target));
        divider.appendChild(status);
        divider.appendChild(buttonRow);
        panel.appendChild(divider);
        executionViews[config.id] = { status, lastStatus: 'Idle' };
        syncMode();
    }

    function createAutomationStatusPanel() {
        const panel = document.createElement('div');
        Object.assign(panel.style, {
            width: '250px',
            maxWidth: 'calc(100vw - 30px)',
            boxSizing: 'border-box',
            background: 'rgba(25,25,25,0.96)',
            color: 'white',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.45)'
        });
        automationStatusText = document.createElement('div');
        automationStatusText.style.whiteSpace = 'pre-line';
        automationStopButton = document.createElement('button');
        automationStopButton.textContent = 'Stop Foreground';
        automationStopButton.style.width = '100%';
        automationStopButton.style.marginTop = '6px';
        styleCompactButton(automationStopButton, '#dc3545');
        automationStopButton.addEventListener('click', () => stopForegroundJob());
        panel.appendChild(automationStatusText);
        panel.appendChild(automationStopButton);
        return panel;
    }

    function populateBerrySelect(select) {
        const current = select.value ||
            localStorage.getItem(AUTO_FARMER_BERRY_STORAGE_KEY) || 'auto';
        select.replaceChildren();
        const auto = document.createElement('option');
        auto.value = 'auto';
        auto.textContent = 'Auto - fastest FP';
        select.appendChild(auto);
        BerryList.forEach((berry, berryType) => {
            if (!berry || !App.game.farming.unlockedBerries[berryType]()) {
                return;
            }
            const option = document.createElement('option');
            option.value = String(berryType);
            option.textContent = BerryType[berryType] + ' (' +
                formatNumber(App.game.farming.berryInventory[berryType]()) + ')';
            select.appendChild(option);
        });
        select.value = [...select.options].some(option => option.value === current)
            ? current
            : 'auto';
    }

    function createAutoFarmerPanel() {
        farmerHeaderButton = document.createElement('button');
        styleMainButton(farmerHeaderButton);
        farmerHeaderButton.style.background = '#198754';
        const panel = document.createElement('div');
        styleCompactPanel(panel);
        const title = document.createElement('div');
        title.textContent = 'Auto Farmer';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '14px';
        const berry = document.createElement('select');
        populateBerrySelect(berry);
        const goal = document.createElement('select');
        for (const [value, label] of [
            ['farmPoints', 'Gain Farm Points'],
            ['berries', 'Gain Berries'],
            ['indefinite', 'Run indefinitely']
        ]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            goal.appendChild(option);
        }
        goal.value = localStorage.getItem(AUTO_FARMER_MODE_STORAGE_KEY) ??
            'farmPoints';
        const target = createNumberInput(
            localStorage.getItem(AUTO_FARMER_TARGET_STORAGE_KEY) ?? '5000');
        farmerStatusText = createTextLine();
        farmerStatusText.style.whiteSpace = 'pre-line';
        farmerStatusText.style.marginTop = '8px';
        const buttons = document.createElement('div');
        Object.assign(buttons.style, {
            display: 'flex',
            gap: '5px',
            marginTop: '8px'
        });
        const startButton = document.createElement('button');
        startButton.textContent = 'Start';
        styleCompactButton(startButton, '#198754');
        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        styleCompactButton(stopButton, '#dc3545');
        const syncGoal = () => {
            target.disabled = goal.value === 'indefinite';
            localStorage.setItem(AUTO_FARMER_MODE_STORAGE_KEY, goal.value);
        };
        berry.addEventListener('change', () =>
            localStorage.setItem(AUTO_FARMER_BERRY_STORAGE_KEY, berry.value));
        goal.addEventListener('change', syncGoal);
        target.addEventListener('change', () =>
            localStorage.setItem(AUTO_FARMER_TARGET_STORAGE_KEY, target.value));
        startButton.addEventListener('click', event => {
            event.stopPropagation();
            startAutoFarmer(berry.value, goal.value, target.value);
        });
        stopButton.addEventListener('click', event => {
            event.stopPropagation();
            stopFarmer();
        });
        buttons.appendChild(startButton);
        buttons.appendChild(stopButton);
        panel.appendChild(title);
        panel.appendChild(createFieldLabel('Berry', berry));
        panel.appendChild(createFieldLabel('Goal', goal));
        panel.appendChild(createFieldLabel('Target', target));
        panel.appendChild(farmerStatusText);
        panel.appendChild(buttons);
        farmerHeaderButton.addEventListener('click', () => {
            populateBerrySelect(berry);
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        syncGoal();
        updateAutomationUI();
        return { header: farmerHeaderButton, panel };
    }

    function populateDungeonSelect() {
        if (!dungeonSelect) {
            return;
        }
        const current = dungeonSelect.value ||
            localStorage.getItem(AUTO_DUNGEON_STORAGE_KEY) || '';
        dungeonSelect.replaceChildren();
        for (const town of getAvailableDungeons()) {
            const option = document.createElement('option');
            option.value = town.name;
            option.textContent = town.name + ' (' +
                formatNumber(town.dungeon.tokenCost) + ' DT)';
            dungeonSelect.appendChild(option);
        }
        if ([...dungeonSelect.options].some(option => option.value === current)) {
            dungeonSelect.value = current;
        }
    }

    function createAutoDungeonPanel() {
        dungeonHeaderButton = document.createElement('button');
        styleMainButton(dungeonHeaderButton);
        dungeonHeaderButton.style.background = '#795548';
        const panel = document.createElement('div');
        styleCompactPanel(panel);
        const title = document.createElement('div');
        title.textContent = 'Auto Dungeon';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '14px';
        dungeonSelect = document.createElement('select');
        populateDungeonSelect();
        const navigation = document.createElement('select');
        for (const [value, label] of [
            ['boss', 'Boss Rush'],
            ['chest', 'Chest Farm'],
            ['full', 'Full Clear']
        ]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            navigation.appendChild(option);
        }
        navigation.value = localStorage.getItem(AUTO_DUNGEON_MODE_STORAGE_KEY) ??
            'boss';
        const goal = document.createElement('select');
        for (const [value, label] of [
            ['finite', 'Clear X times'],
            ['indefinite', 'Run indefinitely']
        ]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            goal.appendChild(option);
        }
        goal.value = localStorage.getItem(AUTO_DUNGEON_GOAL_STORAGE_KEY) ??
            'finite';
        const target = createNumberInput(
            localStorage.getItem(AUTO_DUNGEON_TARGET_STORAGE_KEY) ?? '1');
        const reserve = createNumberInput(
            localStorage.getItem(AUTO_DUNGEON_RESERVE_STORAGE_KEY) ?? '0');
        reserve.min = '0';
        const status = createTextLine();
        status.style.whiteSpace = 'pre-line';
        status.style.marginTop = '8px';
        status.textContent = 'Idle';
        executionViews.dungeon = { status, lastStatus: 'Idle' };
        const buttons = document.createElement('div');
        Object.assign(buttons.style, {
            display: 'flex',
            gap: '5px',
            marginTop: '8px'
        });
        const startButton = document.createElement('button');
        startButton.textContent = 'Start';
        styleCompactButton(startButton, '#198754');
        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        styleCompactButton(stopButton, '#dc3545');
        const syncGoal = () => {
            target.disabled = goal.value === 'indefinite';
            localStorage.setItem(AUTO_DUNGEON_GOAL_STORAGE_KEY, goal.value);
        };
        dungeonSelect.addEventListener('change', () =>
            localStorage.setItem(AUTO_DUNGEON_STORAGE_KEY, dungeonSelect.value));
        navigation.addEventListener('change', () =>
            localStorage.setItem(AUTO_DUNGEON_MODE_STORAGE_KEY, navigation.value));
        goal.addEventListener('change', syncGoal);
        target.addEventListener('change', () =>
            localStorage.setItem(AUTO_DUNGEON_TARGET_STORAGE_KEY, target.value));
        reserve.addEventListener('change', () =>
            localStorage.setItem(AUTO_DUNGEON_RESERVE_STORAGE_KEY, reserve.value));
        startButton.addEventListener('click', event => {
            event.stopPropagation();
            startAutoDungeon(dungeonSelect.value, navigation.value, goal.value,
                target.value, reserve.value);
        });
        stopButton.addEventListener('click', event => {
            event.stopPropagation();
            if (foregroundJob?.id === 'dungeon') {
                stopForegroundJob();
            }
        });
        buttons.appendChild(startButton);
        buttons.appendChild(stopButton);
        panel.appendChild(title);
        panel.appendChild(createFieldLabel('Dungeon', dungeonSelect));
        panel.appendChild(createFieldLabel('Navigation', navigation));
        panel.appendChild(createFieldLabel('Goal', goal));
        panel.appendChild(createFieldLabel('Target', target));
        panel.appendChild(createFieldLabel('Minimum DT reserve', reserve));
        panel.appendChild(status);
        panel.appendChild(buttons);
        dungeonHeaderButton.addEventListener('click', () => {
            populateDungeonSelect();
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        syncGoal();
        updateAutomationUI();
        return { header: dungeonHeaderButton, panel };
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

                vitaminScanId++;
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

        const farmerControls =
            createAutoFarmerPanel();

        const dungeonControls =
            createAutoDungeonPanel();

        addGoalExecutionControls(
            dtControls.panel,
            {
                id: 'dt',
                finiteLabel: 'Gain X DT',
                defaultTarget: '1000',
                start: startDungeonTokenAutomation
            }
        );

        addGoalExecutionControls(
            gemControls.panel,
            {
                id: 'gem',
                finiteLabel: 'Gain X selected gems',
                defaultTarget: '1000',
                start: startGemFarmAutomation
            }
        );

        addGoalExecutionControls(
            typeFarmControls.panel,
            {
                id: 'type',
                finiteLabel: 'Catch X selected-type Pokemon',
                defaultTarget: '500',
                start: startTypeFarmAutomation
            }
        );

        const automationStatusPanel =
            createAutomationStatusPanel();

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
            farmerControls.panel
        );

        container.appendChild(
            farmerControls.header
        );

        container.appendChild(
            dungeonControls.panel
        );

        container.appendChild(
            dungeonControls.header
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
            automationStatusPanel
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
        updateAutomationUI();
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

        setInterval(
            runAutomationTick,
            AUTOMATION_INTERVAL
        );

        if (
            hatchMode !== 'off'
        ) {
            runAutoHatch();
        }

        console.log(
            '[My PokéClicker Automation v7.0.1] Loaded'
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

                        App.game?.farming &&

                        App.game?.statistics &&

                        typeof Battle !==
                        'undefined' &&

                        typeof GymBattle !==
                        'undefined' &&

                        typeof DungeonBattle !==
                        'undefined' &&

                        typeof DungeonRunner !==
                        'undefined' &&

                        typeof DungeonGuides !==
                        'undefined' &&

                        typeof GymRunner !==
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

                        typeof MapHelper !==
                        'undefined' &&

                        typeof BerryList !==
                        'undefined' &&

                        typeof BerryType !==
                        'undefined' &&

                        typeof PlotStage !==
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