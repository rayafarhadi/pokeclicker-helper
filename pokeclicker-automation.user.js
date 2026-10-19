// ==UserScript==
// @name         My PokéClicker Automation
// @namespace    raya-pokeclicker
// @version      8.0.1
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
    OakItemType,
    FluteEffectRunner,
    BerryList,
    BerryType,
    ItemList,
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
    const GEM_FARM_PAID_AUTORUN_STORAGE_KEY =
        'myGemFarmAllowPaidGymAutorun';
    const VITAMIN_REGION_STORAGE_KEY = 'myVitaminTargetRegion';
    const AUTO_FARMER_BERRY_STORAGE_KEY = 'myAutoFarmerBerry';
    const AUTO_FARMER_MODE_STORAGE_KEY = 'myAutoFarmerMode';
    const AUTO_FARMER_TARGET_STORAGE_KEY = 'myAutoFarmerTarget';
    const AUTO_DUNGEON_STORAGE_KEY = 'myAutoDungeon';
    const AUTO_DUNGEON_MODE_STORAGE_KEY = 'myAutoDungeonMode';
    const AUTO_DUNGEON_GOAL_STORAGE_KEY = 'myAutoDungeonGoal';
    const AUTO_DUNGEON_TARGET_STORAGE_KEY = 'myAutoDungeonTarget';
    const AUTO_DUNGEON_RESERVE_STORAGE_KEY = 'myAutoDungeonReserve';
    const HELPER_TAB_STORAGE_KEY = 'myHelperSelectedTab';
    const BREEDING_PRIORITY_STORAGE_KEY = 'myBreedingPriorityV8';
    const DUNGEON_CHEST_RARITIES_STORAGE_KEY =
        'myAutoDungeonChestRaritiesV8';
    const COLLAPSED_SECTIONS_STORAGE_KEY =
        'myHelperCollapsedSectionsV8';
    const FEATURE_STORAGE_KEYS = {
        autoHatching: 'myFeatureAutoHatchingV8',
        advancedHatching: 'myFeatureAdvancedHatchingV8',
        autoDungeon: 'myFeatureAutoDungeonV8',
        advancedDungeon: 'myFeatureAdvancedDungeonV8',
        autoFarm: 'myFeatureAutoFarmV8'
    };

    let autoClickEnabled =
        localStorage.getItem(CLICK_STORAGE_KEY) === 'true';

    const HATCH_MODES = [
        'off',
        'pokerus',
        'mega',
        'default'
    ];
    const BREEDING_STRATEGIES = [
        'pokerus',
        'mega',
        'default',
        'off'
    ];
    const DEFAULT_BREEDING_PRIORITY = [...BREEDING_STRATEGIES];
    const DUNGEON_CHEST_RARITIES = [
        'common',
        'rare',
        'epic',
        'legendary',
        'mythic'
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

    const hasLegacyHelperSettings = [
        HELPER_TAB_STORAGE_KEY,
        HATCH_MODE_STORAGE_KEY,
        'myAutoHatchEnabled',
        AUTO_DUNGEON_STORAGE_KEY,
        AUTO_DUNGEON_MODE_STORAGE_KEY,
        AUTO_FARMER_BERRY_STORAGE_KEY,
        AUTO_FARMER_MODE_STORAGE_KEY,
        CLICK_STORAGE_KEY
    ].some(key => localStorage.getItem(key) !== null);

    function readStoredFeature(name, fallback) {
        const stored =
            localStorage.getItem(
                FEATURE_STORAGE_KEYS[name]
            );

        if (stored === null) {
            localStorage.setItem(
                FEATURE_STORAGE_KEYS[name],
                String(fallback)
            );
            return fallback;
        }

        return stored === 'true';
    }

    const featureSettings = {
        autoHatching: readStoredFeature(
            'autoHatching',
            hasLegacyHelperSettings &&
                hatchMode !== 'off'
        ),
        advancedHatching: readStoredFeature(
            'advancedHatching',
            hasLegacyHelperSettings &&
                (
                    hatchMode === 'pokerus' ||
                    hatchMode === 'mega'
                )
        ),
        autoDungeon: readStoredFeature(
            'autoDungeon',
            hasLegacyHelperSettings
        ),
        advancedDungeon: readStoredFeature(
            'advancedDungeon',
            false
        ),
        autoFarm: readStoredFeature(
            'autoFarm',
            hasLegacyHelperSettings
        )
    };

    function readBreedingPriority() {
        try {
            const parsed = JSON.parse(
                localStorage.getItem(
                    BREEDING_PRIORITY_STORAGE_KEY
                ) ?? 'null'
            );

            if (
                Array.isArray(parsed) &&
                parsed.length ===
                    BREEDING_STRATEGIES.length &&
                BREEDING_STRATEGIES.every(
                    strategy =>
                        parsed.includes(strategy)
                ) &&
                parsed[parsed.length - 1] ===
                    'off'
            ) {
                return parsed;
            }
        } catch {
            // Fall back to the original effective priority.
        }

        return [
            ...DEFAULT_BREEDING_PRIORITY
        ];
    }

    function readDungeonChestRarities() {
        try {
            const parsed = JSON.parse(
                localStorage.getItem(
                    DUNGEON_CHEST_RARITIES_STORAGE_KEY
                ) ?? 'null'
            );

            if (Array.isArray(parsed)) {
                return [
                    ...new Set(
                        parsed.filter(rarity =>
                            DUNGEON_CHEST_RARITIES
                                .includes(rarity)
                        )
                    )
                ];
            }
        } catch {
            // Fall back to the recommended rare chest targets.
        }

        return [
            'legendary',
            'mythic'
        ];
    }

    function readCollapsedSections() {
        try {
            const parsed = JSON.parse(
                localStorage.getItem(
                    COLLAPSED_SECTIONS_STORAGE_KEY
                ) ?? '{}'
            );

            return parsed &&
                typeof parsed === 'object' &&
                !Array.isArray(parsed)
                ? parsed
                : {};
        } catch {
            return {};
        }
    }

    let breedingPriority =
        readBreedingPriority();
    let selectedDungeonChestRarities =
        readDungeonChestRarities();
    const collapsedSections =
        readCollapsedSections();

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

    let gemFarmAllowPaidGymAutorun =
        localStorage.getItem(
            GEM_FARM_PAID_AUTORUN_STORAGE_KEY
        ) === 'true';

    let selectedVitaminRegion = Number(
        localStorage.getItem(VITAMIN_REGION_STORAGE_KEY) ??
        player?.region ??
        0
    );

    // ============================================================
    // UI references
    // ============================================================

    let clickButton = null;
    const featureToggleButtons = {
        autoHatching: [],
        advancedHatching: [],
        autoDungeon: [],
        advancedDungeon: [],
        autoFarm: []
    };
    const breedingPriorityViews = [];
    const collapsibleCardHeaders = {};
    let helperLauncherButton = null;
    let dungeonNavigationSelect = null;
    let dungeonChestRaritySelect = null;
    let dungeonAdvancedControls = null;
    let dungeonRewardInfo = null;
    let dungeonCollectionInfo = null;
    let dungeonStartButton = null;
    let farmerStartButton = null;

    let dtHeaderButton = null;
    let dtPanel = null;
    let dtSuggestedText = null;
    let dtCurrentText = null;
    let dtRateText = null;
    let dtBestText = null;
    let dtSampleText = null;
    let dtStrategyText = null;

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
    let vitaminPokemonSelect = null;
    let vitaminPokemonDetailsText = null;
    let selectedVitaminPokemon = null;
    let vitaminPokemonByValue = new Map();
    let vitaminSummaryText = null;
    let vitaminResultsText = null;

    // ============================================================
    // State
    // ============================================================

    let theoreticalResults = [];
    let dtScenarioResults = {
        currentSettings: [],
        ultraAll: []
    };
    let dtHasScanned = false;
    let gemResults = [];
    let typeFarmResults = [];
    let typeFarmScenarioResults = {
        currentSettings: [],
        ultraAll: [],
        ultraTargetOnly: []
    };
    let typeFarmHasScanned = false;
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

    function isClickAttackAvailable() {
        try {
            const challenge =
                App.game.challenges?.list
                    ?.disableClickAttack;

            if (!challenge?.active?.()) {
                return true;
            }

            const starter =
                player.regionStarters?.[
                    GameConstants.Region.kanto
                ];

            const selected =
                typeof starter === 'function'
                    ? starter()
                    : starter;

            return selected ===
                GameConstants.Starter.None;

        } catch {
            return true;
        }
    }

    function getClickAttackDamage() {
        if (!isClickAttackAvailable()) {
            return 0;
        }

        // false includes active bonuses without recording item use.
        return Math.max(
            0,
            Number(
                App.game.party
                    .calculateClickAttack(false)
            ) || 0
        );
    }

    function getPokemonAttackDamage(
        type1,
        type2,
        region,
        subRegion = 0
    ) {
        return Math.max(
            0,
            Number(
                App.game.party
                    .calculatePokemonAttack(
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
                    )
            ) || 0
        );
    }

    function simulateCombatSequence(
        opponents,
        options = {}
    ) {
        const clickIntervalMs =
            Number(options.clickIntervalMs ??
                CLICK_INTERVAL);

        const pokemonIntervalMs =
            Number(options.pokemonIntervalMs ??
                1000);

        const startTimeMs =
            Number(options.startTimeMs ?? 0);

        const clickOriginMs =
            Number(options.clickOriginMs ??
                clickIntervalMs);

        if (
            !Array.isArray(opponents) ||
            !opponents.length ||
            !Number.isFinite(clickIntervalMs) ||
            clickIntervalMs <= 0 ||
            !Number.isFinite(pokemonIntervalMs) ||
            pokemonIntervalMs <= 0 ||
            !Number.isFinite(startTimeMs) ||
            !Number.isFinite(clickOriginMs)
        ) {
            return Infinity;
        }

        let currentTime = startTimeMs;

        for (const opponent of opponents) {
            const health =
                Number(opponent?.health);

            const clickAttack =
                Math.max(
                    0,
                    Number(opponent?.clickAttack) || 0
                );

            const pokemonAttack =
                Math.max(
                    0,
                    Number(opponent?.pokemonAttack) || 0
                );

            if (
                !Number.isFinite(health) ||
                health <= 0 ||
                !Number.isFinite(clickAttack) ||
                !Number.isFinite(pokemonAttack) ||
                (
                    clickAttack <= 0 &&
                    pokemonAttack <= 0
                )
            ) {
                return Infinity;
            }

            const firstClickAt =
                clickAttack > 0
                    ? (
                        currentTime < clickOriginMs
                            ? clickOriginMs
                            : clickOriginMs +
                                (
                                    Math.floor(
                                        (
                                            currentTime -
                                            clickOriginMs
                                        ) /
                                        clickIntervalMs
                                    ) + 1
                                ) *
                                clickIntervalMs
                    )
                    : Infinity;

            const firstPokemonAt =
                pokemonAttack > 0
                    ? currentTime +
                        pokemonIntervalMs
                    : Infinity;

            const damageAt = time => {
                const clicks =
                    time >= firstClickAt
                        ? Math.floor(
                            (
                                time -
                                firstClickAt
                            ) /
                            clickIntervalMs
                        ) + 1
                        : 0;

                const pokemonAttacks =
                    time >= firstPokemonAt
                        ? Math.floor(
                            (
                                time -
                                firstPokemonAt
                            ) /
                            pokemonIntervalMs
                        ) + 1
                        : 0;

                // When both events share a timestamp, click damage is
                // conceptually applied first. The defeat timestamp is the
                // same either way, and neither event carries to the next foe.
                return clicks * clickAttack +
                    pokemonAttacks * pokemonAttack;
            };

            let low = Math.floor(currentTime);
            let high = Math.ceil(
                Math.min(
                    firstClickAt,
                    firstPokemonAt
                )
            );

            let span = Math.max(
                1,
                high - low
            );

            let expansions = 0;
            while (
                damageAt(high) < health &&
                expansions < 128
            ) {
                span *= 2;
                high = Math.ceil(
                    currentTime + span
                );
                expansions++;

                if (!Number.isSafeInteger(high)) {
                    return Infinity;
                }
            }

            if (damageAt(high) < health) {
                return Infinity;
            }

            while (low + 1 < high) {
                const middle =
                    Math.floor(
                        (low + high) / 2
                    );

                if (damageAt(middle) >= health) {
                    high = middle;
                } else {
                    low = middle;
                }
            }

            currentTime = high;
        }

        return currentTime - startTimeMs;
    }

    function getCombatDamage(
        type1,
        type2,
        region,
        subRegion = 0
    ) {
        return {
            pokemonAttack:
                getPokemonAttackDamage(
                    type1,
                    type2,
                    region,
                    subRegion
                ),
            clickAttack:
                getClickAttackDamage()
        };
    }

    function estimateKillTime(
        health,
        type1,
        type2,
        region,
        subRegion = 0,
        cache = null
    ) {
        const cacheKey =
            `${health}:${type1}:${type2}:` +
            `${region}:${subRegion}`;

        if (cache?.has(cacheKey)) {
            return cache.get(cacheKey);
        }

        const damage =
            getCombatDamage(
                type1,
                type2,
                region,
                subRegion
            );

        const result =
            simulateCombatSequence([
                {
                    health,
                    ...damage
                }
            ]) /
            1000;

        cache?.set(cacheKey, result);
        return result;
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

    const CAPTURE_STRATEGIES = {
        currentSettings: 'currentSettings',
        ultraAll: 'ultraAll',
        ultraTargetOnly: 'ultraTargetOnly'
    };

    function getMagicBallBonus() {
        try {
            return Math.max(
                0,
                Number(
                    App.game.oakItems
                        .calculateBonus(
                            OakItemType.Magic_Ball
                        )
                ) || 0
            );
        } catch {
            return 0;
        }
    }

    function getCaptureBall(
        strategy,
        pokemon,
        matchesTarget = true
    ) {
        if (
            strategy ===
                CAPTURE_STRATEGIES.ultraTargetOnly &&
            !matchesTarget
        ) {
            return GameConstants.Pokeball.None;
        }

        if (
            strategy === CAPTURE_STRATEGIES.ultraAll ||
            strategy === CAPTURE_STRATEGIES.ultraTargetOnly
        ) {
            return GameConstants.Pokeball.Ultraball;
        }

        return App.game.pokeballs
            .calculatePokeballToUse(
                pokemon.id,
                false,
                false,
                EncounterType.route
            );
    }

    function evaluateRouteCapture(
        route,
        pokemon,
        strategy = CAPTURE_STRATEGIES.currentSettings,
        matchesTarget = true
    ) {
        const ballType =
            getCaptureBall(
                strategy,
                pokemon,
                matchesTarget
            );

        if (
            ballType ===
                GameConstants.Pokeball.None ||
            ballType === undefined ||
            ballType === null
        ) {
            return {
                ballType:
                    GameConstants.Pokeball.None,
                catchChance: 0,
                catchTime: 0,
                throws: 0
            };
        }

        const baseCatchChance =
            PokemonFactory.catchRateHelper(
                pokemon.catchRate,
                true
            );

        const ballBonus =
            getBallBonusForRoute(
                ballType,
                route,
                pokemon
            );

        const catchChance =
            GameConstants.clipNumber(
                baseCatchChance +
                    ballBonus +
                    getMagicBallBonus(),
                0,
                100
            ) / 100;

        return {
            ballType,
            catchChance,
            catchTime:
                App.game.pokeballs
                    .calculateCatchTime(
                        ballType
                    ) /
                1000,
            throws: 1
        };
    }

    function getExpectedDungeonTokensPerCatch(
        tokenReward,
        ballType
    ) {
        const currency =
            GameConstants.Currency
                .dungeonToken ??
            GameConstants.Currency
                .dungeonTokens;

        const rate =
            Number(
                GameConstants
                    .LuxuryBallCurrencyRate?.[
                        currency
                    ]
            ) || 1;

        const dungeonTokens =
            Math.ceil(
                (
                    Number(tokenReward) /
                    rate
                ) *
                rate
            );

        return ballType ===
            GameConstants.Pokeball.Luxuryball
            ? dungeonTokens / 6
            : dungeonTokens;
    }

    function addExpectedBallUse(
        totals,
        ballType,
        amount
    ) {
        if (
            ballType ===
                GameConstants.Pokeball.None ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return;
        }

        totals[ballType] =
            (totals[ballType] ?? 0) +
            amount;
    }

    function getBallName(ballType) {
        const raw =
            GameConstants.Pokeball[ballType] ??
            `Ball ${ballType}`;

        return String(raw)
            .replace(/ball$/i, ' Ball')
            .replace(/^Pok[eé] Ball$/i, 'Poké Ball');
    }

    function getBallQuantity(ballType) {
        const pokeballs =
            App.game.pokeballs;

        if (
            typeof pokeballs.getBallQuantity ===
            'function'
        ) {
            return Number(
                pokeballs.getBallQuantity(
                    Number(ballType)
                )
            ) || 0;
        }

        const quantity =
            pokeballs.pokeballs?.[
                Number(ballType)
            ]?.quantity;

        return Number(
            typeof quantity === 'function'
                ? quantity()
                : quantity
        ) || 0;
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

    function findBestMegaCandidate() {
        let best = null;
        let bestHasOwnedStone = false;
        let bestProgress = -1;

        for (const pokemon of App.game.party.caughtPokemon) {
            if (
                pokemon.breeding ||
                pokemon.level < 100 ||
                !pokemon.isHatchable() ||
                !PokemonHelper.hasMegaEvolution(pokemon.name)
            ) {
                continue;
            }

            const requiredAttack =
                pokemon.baseAttack *
                GameConstants.MEGA_REQUIRED_ATTACK_MULTIPLIER;

            if (
                requiredAttack <= 0 ||
                pokemon.attack >= requiredAttack
            ) {
                continue;
            }

            const hasOwnedStone =
                PokemonHelper
                    .getMegaStones(pokemon.name)
                    .some(stone =>
                        player.hasMegaStone(stone.megaStone)
                    );

            const progress =
                pokemon.attack /
                requiredAttack;

            if (
                !best ||
                (
                    hasOwnedStone &&
                    !bestHasOwnedStone
                ) ||
                (
                    hasOwnedStone === bestHasOwnedStone &&
                    progress > bestProgress
                )
            ) {
                best = pokemon;
                bestHasOwnedStone = hasOwnedStone;
                bestProgress = progress;
            }
        }

        return best;
    }

    function getEffectiveBreedingPriority() {
        if (!featureSettings.autoHatching) {
            return [];
        }

        const allowed = featureSettings.advancedHatching
            ? new Set(BREEDING_STRATEGIES)
            : new Set(['default', 'off']);

        return breedingPriority.filter(
            strategy => allowed.has(strategy)
        );
    }

    function tryCustomBreeding() {
        const pokemon =
            BreedingController
                .hatcherySortedFilteredList()
                .find(
                    candidate =>
                        candidate.isHatchable()
                );

        if (!pokemon) {
            return 'none';
        }

        return App.game.breeding
            .addPokemonToHatchery(
                pokemon
            )
            ? 'added'
            : 'none';
    }

    function tryBreedingStrategy(strategy) {
        if (strategy === 'pokerus') {
            return tryPokerusSpread();
        }

        if (strategy === 'mega') {
            const megaCandidate =
                findBestMegaCandidate();

            return megaCandidate &&
                App.game.breeding
                    .addPokemonToHatchery(
                        megaCandidate
                    )
                ? 'added'
                : 'none';
        }

        if (strategy === 'default') {
            return tryCustomBreeding();
        }

        return 'stop';
    }

    function runAutoHatch() {
        if (!featureSettings.autoHatching) {
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
                // Uncaught Type Eggs always take every available slot first.
                if (
                    tryUncaughtTypeEgg()
                ) {
                    continue;
                }

                let added = false;
                let shouldWait = false;

                for (
                    const strategy of
                    getEffectiveBreedingPriority()
                ) {
                    const result =
                        tryBreedingStrategy(
                            strategy
                        );

                    if (result === 'added') {
                        added = true;
                        break;
                    }

                    if (
                        result === 'wait' ||
                        result === 'stop'
                    ) {
                        shouldWait = true;
                        break;
                    }
                }

                if (added) {
                    continue;
                }

                if (shouldWait || !added) {
                    break;
                }
            }

        } catch (error) {
            console.error(
                '[My Auto Hatchery] Error',
                error
            );
        }
    }

    // ============================================================
    // Dungeon Token optimizer
    // ============================================================

    function calculateRouteDTScore(
        route,
        strategy = CAPTURE_STRATEGIES.currentSettings,
        killTimeCache = null
    ) {
        try {
            if (!route.isUnlocked()) {
                return null;
            }

            const pokemonNames =
                RouteHelper.getAvailablePokemonList(
                    route.number,
                    route.region
                );

            const weights =
                RouteHelper.getAvailablePokemonWeightList(
                    route.number,
                    route.region
                );

            if (!pokemonNames?.length) {
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
                PokemonFactory.routeDungeonTokens(
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
                    (sum, name, index) => {
                        const data =
                            PokemonHelper
                                .getPokemonByName(name);

                        return sum +
                            data.hitpoints *
                            weights[index];
                    },
                    0
                ) / totalWeight;

            let expectedTokens = 0;
            let expectedTime = 0;
            let weightedCatchability = 0;
            let weightedKillTime = 0;
            let weightedCatchTime = 0;
            const ballUsagePerEncounter = {};

            for (
                let i = 0;
                i < pokemonNames.length;
                i++
            ) {
                const encounterWeight =
                    weights[i] /
                    totalWeight;

                const pokemon =
                    PokemonHelper.getPokemonByName(
                        pokemonNames[i]
                    );

                const health =
                    Math.round(
                        routeBaseHealth *
                        (
                            0.9 +
                            (
                                pokemon.hitpoints /
                                avgBaseHP
                            ) / 10
                        )
                    );

                const killTime =
                    estimateKillTime(
                        health,
                        pokemon.type1,
                        pokemon.type2,
                        route.region,
                        route.subRegion ?? 0,
                        killTimeCache
                    );

                const capture =
                    evaluateRouteCapture(
                        route,
                        pokemon,
                        strategy
                    );

                const tokensPerCatch =
                    getExpectedDungeonTokensPerCatch(
                        tokenReward,
                        capture.ballType
                    );

                expectedTokens +=
                    encounterWeight *
                    capture.catchChance *
                    tokensPerCatch;

                expectedTime +=
                    encounterWeight *
                    (
                        killTime +
                        capture.catchTime
                    );

                weightedCatchability +=
                    encounterWeight *
                    capture.catchChance;

                weightedKillTime +=
                    encounterWeight *
                    killTime;

                weightedCatchTime +=
                    encounterWeight *
                    capture.catchTime;

                addExpectedBallUse(
                    ballUsagePerEncounter,
                    capture.ballType,
                    encounterWeight *
                        capture.throws
                );
            }

            if (
                expectedTokens <= 0 ||
                !Number.isFinite(expectedTime) ||
                expectedTime <= 0
            ) {
                return null;
            }

            const score =
                expectedTokens /
                expectedTime;

            const ballsPerMinute = {};
            for (
                const [ballType, uses] of
                Object.entries(
                    ballUsagePerEncounter
                )
            ) {
                ballsPerMinute[ballType] =
                    uses /
                    expectedTime *
                    60;
            }

            return {
                route,
                strategy,
                score,
                estimatedDTPerMinute:
                    score * 60,
                tokens:
                    Math.ceil(tokenReward),
                catchability:
                    weightedCatchability,
                killTime:
                    weightedKillTime,
                catchTime:
                    weightedCatchTime,
                expectedRewardPerEncounter:
                    expectedTokens,
                expectedTimePerEncounter:
                    expectedTime,
                ballUsagePerEncounter,
                ballsPerMinute
            };

        } catch (error) {
            console.warn(
                '[DT Optimizer] Could not score route',
                route?.routeName,
                error
            );

            return null;
        }
    }

    function scanDungeonTokenRoutes() {
        try {
            const scenarios = {
                currentSettings: [],
                ultraAll: []
            };
            const killTimeCache = new Map();

            const highestRegion =
                player.highestRegion();

            for (
                let region = 0;
                region <= highestRegion;
                region++
            ) {
                const routes =
                    Routes.getRoutesByRegion(region);

                for (const route of routes) {
                    if (!route.isUnlocked()) {
                        continue;
                    }

                    for (const strategy of [
                        CAPTURE_STRATEGIES.currentSettings,
                        CAPTURE_STRATEGIES.ultraAll
                    ]) {
                        const result =
                            calculateRouteDTScore(
                                route,
                                strategy,
                                killTimeCache
                            );

                        if (result) {
                            scenarios[strategy]
                                .push(result);
                        }
                    }
                }
            }

            for (
                const results of
                Object.values(scenarios)
            ) {
                results.sort(
                    (a, b) =>
                        b.score - a.score
                );
            }

            dtScenarioResults = scenarios;
            dtHasScanned = true;
            theoreticalResults =
                scenarios.currentSettings;

            updateDungeonTokenUI();

            console.table(
                theoreticalResults
                    .slice(0, 10)
                    .map((result, index) => ({
                        Rank: index + 1,
                        Route:
                            result.route.routeName,
                        'Est. DT/min':
                            result
                                .estimatedDTPerMinute
                                .toFixed(1),
                        Catchability:
                            `${(
                                result.catchability * 100
                            ).toFixed(1)}%`,
                        'Kill time':
                            `${result.killTime
                                .toFixed(3)}s`
                    }))
            );

            return theoreticalResults;

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

    function getGymTimeLimitSeconds() {
        const baseSeconds =
            Number(GameConstants.GYM_TIME) /
            1000;

        let multiplier = 1;

        try {
            if (
                typeof FluteEffectRunner !==
                    'undefined' &&
                typeof FluteEffectRunner
                    .getFluteMultiplier ===
                    'function'
            ) {
                multiplier = Number(
                    FluteEffectRunner
                        .getFluteMultiplier(
                            GameConstants
                                .FluteItemType
                                .Time_Flute
                        )
                ) || 1;
            } else if (
                typeof GymRunner
                    ?.timeBonus === 'function'
            ) {
                multiplier = Number(
                    GymRunner.timeBonus()
                ) || 1;
            }
        } catch {
            multiplier = 1;
        }

        return baseSeconds * multiplier;
    }

    function scoreGymForGems(
        gymName,
        gym,
        targetType
    ) {
        try {
            const town = getGymHostTown(gym);
            if (!gym.isUnlocked() ||
                !town ||
                town.isUnlocked?.() === false) {
                return null;
            }

            const region =
                GameConstants.getGymRegion(
                    gymName
                );

            const subRegion =
                town.subRegion ?? 0;

            const pokemonList =
                gym.getPokemonList();

            let totalGems = 0;
            const opponents = [];

            for (const gymPokemon of pokemonList) {
                const data =
                    gymPokemon.getBaseData();

                totalGems +=
                    getGemRewardForPokemon(
                        data.type1,
                        data.type2,
                        targetType,
                        GameConstants.GYM_GEMS
                    );

                opponents.push({
                    health:
                        gymPokemon.maxHealth,
                    ...getCombatDamage(
                        data.type1,
                        data.type2,
                        region,
                        subRegion
                    )
                });
            }

            if (totalGems <= 0) {
                return null;
            }

            const totalTime =
                simulateCombatSequence(
                    opponents
                ) /
                1000;

            const timeLimit =
                getGymTimeLimitSeconds();

            if (
                !Number.isFinite(totalTime) ||
                totalTime <= 0 ||
                !Number.isFinite(timeLimit) ||
                totalTime > timeLimit
            ) {
                return null;
            }

            const score =
                totalGems /
                totalTime;

            const leader =
                gym.leaderName ??
                gymName;

            return {
                kind: 'Gym',
                name: leader,
                location: gymName,
                gym,
                town,
                score,
                totalGems,
                combatTime: totalTime,
                timeLimit,
                gemsPerMinute:
                    score * 60
            };

        } catch (error) {
            console.warn(
                '[Gem Optimizer] Could not score gym',
                gymName,
                error
            );
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
                    Math.round(
                        routeHealth *
                        (
                            0.9 +
                            (
                                data.hitpoints /
                                avgBaseHP
                            ) / 10
                        )
                    );

                const gems =
                    getGemRewardForPokemon(
                        data.type1,
                        data.type2,
                        targetType,
                        1
                    );

                const capture =
                    evaluateRouteCapture(
                        route,
                        data,
                        CAPTURE_STRATEGIES
                            .currentSettings
                    );

                const time =
                    estimateKillTime(
                        health,
                        data.type1,
                        data.type2,
                        route.region,
                        route.subRegion ?? 0
                    ) +
                    capture.catchTime;
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
        targetType,
        strategy = CAPTURE_STRATEGIES.currentSettings,
        killTimeCache = null
    ) {
        try {
            if (!route.isUnlocked()) {
                return null;
            }

            const names =
                RouteHelper.getAvailablePokemonList(
                    route.number,
                    route.region
                );

            const weights =
                RouteHelper.getAvailablePokemonWeightList(
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
                PokemonFactory.routeHealth(
                    route.number,
                    route.region
                );

            const avgBaseHP =
                names.reduce(
                    (sum, name, index) => {
                        const data =
                            PokemonHelper
                                .getPokemonByName(name);

                        return sum +
                            data.hitpoints *
                            weights[index];
                    },
                    0
                ) / totalWeight;

            let expectedCatches = 0;
            let expectedTime = 0;
            let targetEncounterRate = 0;
            let weightedTargetCatchChance = 0;
            const ballUsagePerEncounter = {};

            for (
                let i = 0;
                i < names.length;
                i++
            ) {
                const data =
                    PokemonHelper.getPokemonByName(
                        names[i]
                    );

                const encounterWeight =
                    weights[i] /
                    totalWeight;

                const health =
                    Math.round(
                        routeHealth *
                        (
                            0.9 +
                            (
                                data.hitpoints /
                                avgBaseHP
                            ) / 10
                        )
                    );

                const killTime =
                    estimateKillTime(
                        health,
                        data.type1,
                        data.type2,
                        route.region,
                        route.subRegion ?? 0,
                        killTimeCache
                    );

                const matchesTarget =
                    data.type1 === targetType ||
                    data.type2 === targetType;

                const capture =
                    evaluateRouteCapture(
                        route,
                        data,
                        strategy,
                        matchesTarget
                    );

                if (matchesTarget) {
                    targetEncounterRate +=
                        encounterWeight;

                    expectedCatches +=
                        encounterWeight *
                        capture.catchChance;

                    weightedTargetCatchChance +=
                        encounterWeight *
                        capture.catchChance;
                }

                expectedTime +=
                    encounterWeight *
                    (
                        killTime +
                        capture.catchTime
                    );

                addExpectedBallUse(
                    ballUsagePerEncounter,
                    capture.ballType,
                    encounterWeight *
                        capture.throws
                );
            }

            if (
                targetEncounterRate <= 0 ||
                expectedCatches <= 0 ||
                !Number.isFinite(expectedTime) ||
                expectedTime <= 0
            ) {
                return null;
            }

            const catchesPerSecond =
                expectedCatches /
                expectedTime;

            const ballsPerMinute = {};
            for (
                const [ballType, uses] of
                Object.entries(
                    ballUsagePerEncounter
                )
            ) {
                ballsPerMinute[ballType] =
                    uses /
                    expectedTime *
                    60;
            }

            return {
                route,
                strategy,
                score:
                    catchesPerSecond,
                catchesPerMinute:
                    catchesPerSecond * 60,
                targetEncounterRate,
                targetCatchChance:
                    weightedTargetCatchChance /
                    targetEncounterRate,
                expectedRewardPerEncounter:
                    expectedCatches,
                expectedTimePerEncounter:
                    expectedTime,
                ballUsagePerEncounter,
                ballsPerMinute
            };

        } catch (error) {
            console.warn(
                '[Type Farm Optimizer] Could not score route',
                route?.routeName,
                error
            );

            return null;
        }
    }

    function scanTypeCatchRoutes() {
        try {
            const scenarios = {
                currentSettings: [],
                ultraAll: [],
                ultraTargetOnly: []
            };
            const killTimeCache = new Map();

            const highestRegion =
                player.highestRegion();

            for (
                let region = 0;
                region <= highestRegion;
                region++
            ) {
                for (
                    const route of
                    Routes.getRoutesByRegion(region)
                ) {
                    for (const strategy of [
                        CAPTURE_STRATEGIES.currentSettings,
                        CAPTURE_STRATEGIES.ultraAll,
                        CAPTURE_STRATEGIES.ultraTargetOnly
                    ]) {
                        const result =
                            scoreRouteForTypeCatches(
                                route,
                                typeFarmType,
                                strategy,
                                killTimeCache
                            );

                        if (result) {
                            scenarios[strategy]
                                .push(result);
                        }
                    }
                }
            }

            for (
                const results of
                Object.values(scenarios)
            ) {
                results.sort(
                    (a, b) =>
                        b.score - a.score
                );
            }

            typeFarmScenarioResults =
                scenarios;
            typeFarmHasScanned = true;
            typeFarmResults =
                scenarios.currentSettings;

            updateTypeFarmUI();

            return typeFarmResults;

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

    function buildVitaminRecommendation(current, optimal) {
        const labels = [
            ['protein', 'Protein'],
            ['calcium', 'Calcium'],
            ['carbos', 'Carbos']
        ];
        const changes = labels.flatMap(([key, label]) => {
            const delta = optimal[key] - current[key];
            if (delta > 0) {
                return ['Add ' + delta + ' ' + label];
            }
            if (delta < 0) {
                return ['Remove ' + Math.abs(delta) + ' ' + label];
            }
            return [];
        });
        return changes.length ? changes.join(', ') : 'No vitamin changes needed';
    }

    function analyzeIndividualVitaminPokemon(pokemon, targetRegion) {
        const current = getCurrentVitaminCounts(pokemon);
        const analysis = analyzeVitaminSetups(pokemon, targetRegion, current);
        const optimal = analysis.optimal;
        const currentTotal = current.protein + current.calcium + current.carbos;
        const optimalTotal = optimal.protein + optimal.calcium + optimal.carbos;
        const improvement = optimal.be - analysis.currentBE;
        return {
            pokemon,
            name: pokemon.name,
            nativeRegion: getPokemonNativeRegion(pokemon),
            targetRegion,
            cap: getVitaminCap(),
            current,
            currentTotal,
            currentBE: analysis.currentBE,
            currentEggSteps: calculateVitaminEggSteps(
                pokemon, current.protein, current.calcium, current.carbos),
            currentAttackGain: calculateVitaminAttackGain(
                pokemon, current.protein, current.calcium),
            optimal,
            optimalTotal,
            optimalBE: optimal.be,
            optimalEggSteps: calculateVitaminEggSteps(
                pokemon, optimal.protein, optimal.calcium, optimal.carbos),
            optimalAttackGain: calculateVitaminAttackGain(
                pokemon, optimal.protein, optimal.calcium),
            improvement,
            improvementPercent: analysis.currentBE > 0
                ? improvement / analysis.currentBE * 100
                : (improvement > 0 ? Infinity : 0),
            guidance: buildVitaminRecommendation(current, optimal),
            inHatchery: Boolean(pokemon.breeding)
        };
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

    const HELPER_STYLES = `
#pkh-root,
#pkh-root * {
    box-sizing: border-box;
}
#pkh-root {
    position: fixed;
    right: 14px;
    bottom: 14px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 9px;
    color: #eef6ff;
    font: 12px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
#pkh-root button,
#pkh-root select,
#pkh-root input {
    font: inherit;
}
#pkh-root .pkh-shell {
    width: min(420px, calc(100vw - 28px));
    max-height: calc(100vh - 86px);
    flex-direction: column;
    overflow: hidden;
    color: #eaf4ff;
    background:
        radial-gradient(circle at 100% 0, rgba(31, 137, 255, .12), transparent 38%),
        linear-gradient(180deg, rgba(17, 31, 46, .985), rgba(10, 21, 33, .985));
    border: 1px solid #294158;
    border-radius: 15px;
    box-shadow: 0 18px 52px rgba(0, 0, 0, .58), 0 0 0 1px rgba(7, 15, 24, .65);
    backdrop-filter: blur(12px);
}
#pkh-root .pkh-header {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 48px;
    padding: 10px 12px;
    flex: 0 0 auto;
    background: linear-gradient(180deg, rgba(28, 46, 65, .96), rgba(16, 29, 43, .96));
    border-bottom: 1px solid rgba(108, 153, 194, .18);
}
#pkh-root .pkh-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    flex: 1;
    font-size: 16px;
    font-weight: 750;
    letter-spacing: -.2px;
    color: #f7fbff;
}
#pkh-root .pkh-brand-ball {
    position: relative;
    display: inline-block;
    width: 23px;
    height: 23px;
    flex: 0 0 23px;
    overflow: hidden;
    border: 2px solid #08111a;
    border-radius: 50%;
    background: linear-gradient(#f04450 0 46%, #111923 47% 55%, #f5f7fa 56% 100%);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, .16), 0 2px 6px rgba(0, 0, 0, .35);
}
#pkh-root .pkh-brand-ball::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 6px;
    height: 6px;
    transform: translate(-50%, -50%);
    border: 2px solid #0b1118;
    border-radius: 50%;
    background: #eef3f7;
}
#pkh-root .pkh-version {
    color: #7f93a7;
    font-size: 11px;
    font-weight: 600;
}
#pkh-root .pkh-close {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #d9e5ef;
    cursor: pointer;
    font-size: 22px;
    line-height: 28px;
}
#pkh-root .pkh-close:hover {
    background: rgba(255, 255, 255, .08);
    color: white;
}
#pkh-root .pkh-status-strip {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 8px 10px 0;
    padding: 8px 9px;
    flex: 0 0 auto;
    min-height: 43px;
    overflow: hidden;
    background: rgba(8, 18, 29, .76);
    border: 1px solid #263c51;
    border-radius: 9px;
}
#pkh-root .pkh-status-dot {
    width: 11px;
    height: 11px;
    flex: 0 0 11px;
    border-radius: 50%;
    background: #6e7f90;
    box-shadow: 0 0 0 3px rgba(110, 127, 144, .12);
}
#pkh-root .pkh-status-dot.is-active {
    background: #38dc78;
    box-shadow: 0 0 0 3px rgba(56, 220, 120, .13), 0 0 10px rgba(56, 220, 120, .4);
}
#pkh-root .pkh-status-text {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    color: #d9e5f0;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}
#pkh-root .pkh-tabs {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin: 9px 10px 0;
    flex: 0 0 auto;
    overflow: hidden;
    background: #0c1824;
    border: 1px solid #253a4f;
    border-radius: 8px;
}
#pkh-root .pkh-tab {
    min-width: 0;
    padding: 9px 3px;
    border: 0;
    border-right: 1px solid #25384a;
    background: transparent;
    color: #b9c8d6;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 650;
    transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
#pkh-root .pkh-tab:last-child {
    border-right: 0;
}
#pkh-root .pkh-tab:hover {
    color: white;
    background: rgba(42, 139, 243, .12);
}
#pkh-root .pkh-tab.is-active {
    color: white;
    background: linear-gradient(180deg, #2494ff, #1177e8);
    box-shadow: inset 0 1px rgba(255, 255, 255, .18), 0 0 16px rgba(22, 130, 244, .2);
}
#pkh-root .pkh-scroll {
    min-height: 0;
    padding: 10px;
    flex: 1 1 auto;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #36516b transparent;
}
#pkh-root .pkh-scroll::-webkit-scrollbar {
    width: 8px;
}
#pkh-root .pkh-scroll::-webkit-scrollbar-thumb {
    background: #36516b;
    border: 2px solid transparent;
    border-radius: 8px;
    background-clip: padding-box;
}
#pkh-root .pkh-card {
    display: block;
    position: static;
    width: 100%;
    max-width: none;
    max-height: none;
    margin: 0 0 10px;
    padding: 11px;
    overflow: visible;
    overflow-wrap: anywhere;
    color: #dae8f4;
    background: linear-gradient(180deg, rgba(22, 38, 54, .98), rgba(16, 29, 43, .98));
    border: 1px solid #263d53;
    border-radius: 10px;
    box-shadow: 0 5px 14px rgba(0, 0, 0, .14);
    font-size: 11.5px;
    line-height: 1.4;
}
#pkh-root .pkh-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: -1px -1px 9px !important;
    padding: 0 1px 9px;
    color: #f3f8fc;
    border-bottom: 1px solid rgba(109, 148, 184, .19);
    font-size: 13.5px !important;
    font-weight: 750 !important;
}
#pkh-root .pkh-field {
    display: grid;
    grid-template-columns: minmax(88px, .85fr) minmax(0, 1.25fr);
    align-items: center;
    gap: 9px;
    margin-top: 8px;
}
#pkh-root .pkh-search-select {
    position: relative;
    width: 100%;
    min-width: 0;
}
#pkh-root .pkh-search-select > select {
    width: 100%;
}
#pkh-root .pkh-search-trigger {
    position: relative;
    width: 100%;
    min-height: 31px;
    padding: 5px 30px 5px 8px;
    overflow: hidden;
    color: #eaf3fb;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: #0b1723;
    border: 1px solid #314960;
    border-radius: 6px;
    cursor: pointer;
}
#pkh-root .pkh-search-trigger::after {
    content: "v";
    position: absolute;
    right: 9px;
    color: #8fa9bf;
}
.pkh-search-popup {
    position: fixed;
    z-index: 100001;
    width: min(300px, calc(100vw - 16px));
    max-height: min(360px, calc(100vh - 16px));
    padding: 7px;
    color: #eaf4ff;
    background: #0b1723;
    border: 1px solid #3a5872;
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, .55);
}
.pkh-search-row {
    display: flex;
    gap: 5px;
}
.pkh-search-input {
    flex: 1;
    min-width: 0;
    min-height: 31px;
    padding: 5px 8px;
    color: #eaf3fb;
    background: #07121c;
    border: 1px solid #314960;
    border-radius: 6px;
}
.pkh-search-clear {
    width: 31px;
    padding: 0;
    color: #bdcedd;
    background: #142536;
    border: 1px solid #314960;
    border-radius: 6px;
    cursor: pointer;
}
.pkh-search-results {
    max-height: 260px;
    margin-top: 6px;
    overflow-y: auto;
}
.pkh-search-option,
.pkh-search-empty {
    display: block;
    width: 100%;
    padding: 7px 8px;
    color: #dce9f4;
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: 5px;
}
.pkh-search-option {
    cursor: pointer;
}
.pkh-search-option:hover,
.pkh-search-option.is-active {
    color: white;
    background: #1a65a1;
}
.pkh-search-option.is-selected::after {
    content: "*";
    float: right;
    color: #61df91;
}
.pkh-search-empty {
    color: #8297aa;
}
#pkh-root .pkh-vitamin-details {
    margin-top: 9px;
    padding: 9px;
    background: rgba(6, 15, 24, .52);
    border: 1px solid #293e52;
    border-radius: 7px;
}
#pkh-root .pkh-vitamin-guidance {
    margin-top: 7px;
    color: #b8ccdc;
}
#pkh-root .pkh-vitamin-notice {
    margin-top: 7px;
    color: #75c7ff;
}

#pkh-root .pkh-field-label {
    margin: 0;
    color: #bac9d7;
    font-size: 11.5px;
}
#pkh-root select,
#pkh-root input {
    min-width: 0;
    min-height: 31px;
    padding: 5px 8px;
    color: #eaf3fb !important;
    background: #0b1723 !important;
    border: 1px solid #314960 !important;
    border-radius: 6px !important;
    margin: 0 !important;
    outline: none;
}
#pkh-root select:focus,
#pkh-root input:focus {
    border-color: #278fff !important;
    box-shadow: 0 0 0 2px rgba(39, 143, 255, .16);
}
#pkh-root select:disabled,
#pkh-root input:disabled {
    opacity: .5;
}
#pkh-root select option {
    color: #edf6ff;
    background: #101e2b;
}
#pkh-root .pkh-button,
#pkh-root .pkh-card button:not(.pkh-toggle) {
    min-height: 31px;
    padding: 6px 11px !important;
    border: 1px solid #3a5065 !important;
    border-radius: 6px !important;
    color: #e9f2fa !important;
    background: linear-gradient(180deg, #33495d, #283b4d) !important;
    box-shadow: inset 0 1px rgba(255, 255, 255, .07), 0 2px 5px rgba(0, 0, 0, .18);
    cursor: pointer;
    font-weight: 650;
    transition: filter .15s ease, transform .08s ease;
}
#pkh-root .pkh-button:hover:not(:disabled),
#pkh-root .pkh-card button:hover:not(:disabled):not(.pkh-toggle) {
    filter: brightness(1.12);
}
#pkh-root .pkh-button:active:not(:disabled),
#pkh-root .pkh-card button:active:not(:disabled):not(.pkh-toggle) {
    transform: translateY(1px);
}
#pkh-root .pkh-button-primary,
#pkh-root .pkh-card .pkh-button-primary {
    border-color: #2696ff !important;
    background: linear-gradient(180deg, #2696ff, #1179e9) !important;
}
#pkh-root .pkh-button-danger,
#pkh-root .pkh-card .pkh-button-danger {
    border-color: #f24b58 !important;
    background: linear-gradient(180deg, #f34d5a, #d92d3a) !important;
}
#pkh-root button:disabled {
    cursor: default !important;
    opacity: .42;
    filter: grayscale(.25);
}
#pkh-root .pkh-status-action {
    min-width: 66px;
    flex: 0 0 auto;
}
#pkh-root .pkh-full-button {
    width: 100%;
    margin-top: 9px !important;
}
#pkh-root .pkh-setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 38px;
    border-bottom: 1px solid rgba(98, 137, 173, .13);
}
#pkh-root .pkh-setting:last-child {
    border-bottom: 0;
}
#pkh-root .pkh-setting-label {
    color: #c5d3df;
}
#pkh-root .pkh-toggle {
    position: relative;
    width: 42px;
    height: 23px;
    flex: 0 0 42px;
    padding: 0;
    border: 1px solid #3a5269;
    border-radius: 999px;
    background: #26394b;
    cursor: pointer;
    transition: background .16s ease, border-color .16s ease;
}
#pkh-root .pkh-toggle::after {
    content: "";
    position: absolute;
    left: 3px;
    top: 3px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, .45);
    transition: transform .16s ease;
}
#pkh-root .pkh-toggle.is-on {
    border-color: #2b94ff;
    background: #1687f7;
}
#pkh-root .pkh-toggle.is-on::after {
    transform: translateX(18px);
}
#pkh-root .pkh-toggle.is-unavailable {
    opacity: .45;
    filter: grayscale(.45);
    cursor: not-allowed;
}
#pkh-root .pkh-note {
    margin-top: 9px;
    padding: 8px 9px;
    color: #9eb2c5;
    background: rgba(48, 121, 184, .09);
    border: 1px solid rgba(73, 145, 205, .16);
    border-radius: 7px;
    font-size: 10.5px;
}
#pkh-root .pkh-note::before {
    content: "ⓘ";
    margin-right: 6px;
    color: #65baff;
}
#pkh-root .pkh-metric-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    min-height: 27px;
    padding: 4px 0;
    color: #b9c9d7;
    border-bottom: 1px solid rgba(96, 135, 169, .12);
}
#pkh-root .pkh-metric-row:last-child {
    border-bottom: 0;
}
#pkh-root .pkh-metric-row strong {
    color: #edf6ff;
    font-weight: 650;
    text-align: right;
}
#pkh-root .pkh-positive {
    color: #43dc89 !important;
}
#pkh-root .pkh-empty-state {
    padding: 12px 8px;
    color: #93a8bb;
    text-align: center;
    background: rgba(5, 13, 21, .24);
    border: 1px dashed #30465a;
    border-radius: 7px;
}
#pkh-root .pkh-table-wrap {
    margin-top: 9px;
    overflow-x: auto;
    border: 1px solid #293e52;
    border-radius: 7px;
}
#pkh-root .pkh-vitamin-table {
    width: 100%;
    min-width: 100%;
    border-collapse: collapse;
    color: #cbd9e5;
    font-size: 9.5px;
    white-space: nowrap;
}
#pkh-root .pkh-vitamin-table th,
#pkh-root .pkh-vitamin-table td {
    padding: 6px 5px;
    border-right: 1px solid rgba(81, 118, 150, .17);
    border-bottom: 1px solid rgba(81, 118, 150, .17);
    text-align: center;
}
#pkh-root .pkh-vitamin-table th {
    color: #aebfce;
    background: #0d1a27;
    font-weight: 700;
}
#pkh-root .pkh-vitamin-table td:nth-child(2),
#pkh-root .pkh-vitamin-table th:nth-child(2) {
    text-align: left;
}
#pkh-root .pkh-vitamin-table tr:last-child td {
    border-bottom: 0;
}
#pkh-root .pkh-vitamin-table th:last-child,
#pkh-root .pkh-vitamin-table td:last-child {
    border-right: 0;
}
#pkh-root .pkh-launcher {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0 !important;
    padding: 8px 14px !important;
    color: #f3f8fc !important;
    background: linear-gradient(180deg, #162c40, #0e2031) !important;
    border: 1px solid #2a5577 !important;
    border-radius: 999px !important;
    box-shadow: 0 8px 22px rgba(0, 0, 0, .42) !important;
}
#pkh-root .pkh-launcher:hover {
    filter: brightness(1.12);
}
#pkh-root .pkh-launcher::after {
    content: "";
    width: 7px;
    height: 7px;
    margin-left: 1px;
    border-radius: 50%;
    background: #718395;
}
#pkh-root .pkh-launcher.is-active::after {
    background: #3ce17e;
    box-shadow: 0 0 8px rgba(60, 225, 126, .65);
}
#pkh-root .pkh-launcher .pkh-brand-ball {
    width: 19px;
    height: 19px;
    flex-basis: 19px;
}
#pkh-root .pkh-card-title {
    cursor: pointer;
    user-select: none;
}
#pkh-root .pkh-card-title:focus-visible {
    outline: 2px solid #2696ff;
    outline-offset: 2px;
}
#pkh-root .pkh-card-state {
    margin-left: auto;
    color: #65d88a;
    font-size: 10px;
    font-weight: 700;
}
#pkh-root .pkh-collapse-indicator {
    width: 14px;
    color: #8fa5b8;
    text-align: center;
}
#pkh-root .pkh-card.is-collapsed .pkh-card-title {
    margin-bottom: -1px !important;
    border-bottom-color: transparent;
}
#pkh-root .pkh-card-content {
    display: block;
}
#pkh-root .pkh-card.is-collapsed .pkh-card-content {
    display: none;
}
#pkh-root .pkh-card.is-collapsed > :not(.pkh-card-title) {
    display: none !important;
}
#pkh-root .pkh-feature-description,
#pkh-root .pkh-inline-help {
    color: #91a8bb;
    font-size: 10.5px;
    line-height: 1.35;
}
#pkh-root .pkh-feature-description {
    margin: -4px 0 6px;
}
#pkh-root .pkh-priority-list {
    display: grid;
    gap: 5px;
    margin-top: 6px;
}
#pkh-root .pkh-priority-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 32px;
    padding: 4px 7px;
    border: 1px solid rgba(83, 128, 167, .2);
    border-radius: 6px;
    background: rgba(15, 30, 43, .65);
}
#pkh-root .pkh-priority-row small {
    color: #7790a4;
}
#pkh-root .pkh-priority-buttons {
    display: flex;
    gap: 4px;
}
#pkh-root .pkh-priority-buttons button {
    min-height: 24px !important;
    padding: 2px 7px !important;
    font-size: 10px;
}
#pkh-root .pkh-advanced-controls {
    margin: 5px 0;
    padding: 7px;
    border: 1px solid rgba(38, 150, 255, .25);
    border-radius: 7px;
    background: rgba(38, 150, 255, .06);
}
#pkh-root .pkh-advanced-controls select[multiple] {
    min-height: 95px;
}
#pkh-root .pkh-subheading {
    margin: 10px 0 5px;
    color: #d8e7f4;
    font-weight: 750;
}
#pkh-root .pkh-loot-info {
    display: grid;
    gap: 5px;
    max-height: 175px;
    overflow-y: auto;
    padding-right: 3px;
}
#pkh-root .pkh-loot-group {
    padding: 6px 7px;
    border: 1px solid rgba(83, 128, 167, .18);
    border-radius: 6px;
    background: rgba(10, 22, 32, .52);
}
#pkh-root .pkh-loot-group strong {
    display: block;
    color: #70c0ff;
    text-transform: capitalize;
}
#pkh-root .pkh-loot-items {
    margin-top: 2px;
    color: #b8c9d8;
    font-size: 10.5px;
}
#pkh-root .pkh-collection-info {
    margin-top: 7px;
    color: #b8c9d8;
}
@media (max-width: 520px) {
    #pkh-root {
        right: 8px;
        bottom: 8px;
    }
    #pkh-root .pkh-shell {
        width: calc(100vw - 16px);
        max-height: calc(100vh - 70px);
    }
}
`;

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
    let dashboardAutomationStatusText = null;
    let dashboardAutomationStopButton = null;
    let dashboardQuickStatusText = null;
    let automationStatusDot = null;
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

    function getGemBalance(type) {
        return Number(readObservable(App.game.gems.gemWallet[type]));
    }

    function isOwnedTargetMode(mode) {
        return mode === 'owned' ||
            mode === 'farmPointsOwned' ||
            mode === 'berriesOwned';
    }

    function getResourceGoalProgress(mode, current, baseline) {
        const amount = Number(current);
        if (!Number.isFinite(amount)) {
            return NaN;
        }
        if (isOwnedTargetMode(mode)) {
            return Math.max(0, amount);
        }
        return Math.max(0, amount - Number(baseline));
    }

    function getResourceGoalRemaining(mode, target, current, baseline) {
        if (target === null) {
            return null;
        }
        const progress = getResourceGoalProgress(
            mode,
            current,
            baseline
        );
        return Number.isFinite(progress)
            ? Math.max(0, target - progress)
            : NaN;
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

    function updateCardRunningState(
        key,
        running,
        label = 'Running'
    ) {
        const card = collapsibleCardHeaders[key];
        if (!card) {
            return;
        }

        card.state.textContent = running ? label : '';
        card.state.style.display = running ? 'inline' : 'none';
    }

    function updateAutomationUI() {
        const activeDetails = [];
        if (foregroundJob) {
            activeDetails.push(foregroundJob.type + ': ' + foregroundJob.detail);
        }
        if (farmerJob) {
            activeDetails.push('Auto Farmer: ' + farmerJob.detail);
        }

        const active = Boolean(foregroundJob || farmerJob);
        const compactDetail = foregroundJob
            ? foregroundJob.type + ' • ' + foregroundJob.detail.replace(/\n/g, ' • ')
            : farmerJob
                ? 'Auto Farmer • ' + farmerJob.detail.replace(/\n/g, ' • ')
                : 'Automation: Idle';
        const summaryText = activeDetails.length
            ? activeDetails.join('\n')
            : 'No automation is currently running.\n' + foregroundLastStatus;

        if (automationStatusText) {
            automationStatusText.textContent = compactDetail;
        }
        if (dashboardAutomationStatusText) {
            dashboardAutomationStatusText.textContent = summaryText;
        }
        if (automationStatusDot) {
            automationStatusDot.classList.toggle('is-active', active);
        }
        for (const button of [
            automationStopButton,
            dashboardAutomationStopButton
        ]) {
            if (button) {
                button.disabled = !active;
            }
        }
        if (helperLauncherButton) {
            helperLauncherButton.classList.toggle('is-active', active);
            helperLauncherButton.title = active
                ? 'PokéClicker Helper — automation active'
                : 'Open PokéClicker Helper';
        }
        if (dashboardQuickStatusText) {
            const route = getCurrentRouteInfo();
            const town = typeof player.town === 'string'
                ? player.town
                : player.town?.name;
            const location = route?.name || town || getRegionName(player.region);
            const background = [
                farmerJob ? 'Auto Farmer' : '',
                featureSettings.autoHatching ? 'Auto Hatch' : ''
            ].filter(Boolean).join(', ') || 'Idle';
            dashboardQuickStatusText.innerHTML =
                '<div class="pkh-metric-row"><span>Location</span><strong>' +
                    location + '</strong></div>' +
                '<div class="pkh-metric-row"><span>Foreground</span><strong>' +
                    (foregroundJob?.type || 'Idle') + '</strong></div>' +
                '<div class="pkh-metric-row"><span>Background</span><strong>' +
                    background + '</strong></div>' +
                '<div class="pkh-metric-row"><span>Managed plots</span><strong>' +
                    (farmerJob?.owned?.size ?? '—') + '</strong></div>';
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
                ? 'Auto Farmer: ' + BerryType[farmerJob.berry] + ' (Running) ▾'
                : 'Auto Farmer ▾';
        }
        if (dungeonHeaderButton) {
            dungeonHeaderButton.textContent = foregroundJob?.id === 'dungeon'
                ? 'Auto Dungeon: ' + foregroundJob.dungeon.name + ' ▾'
                : 'Auto Dungeon ▾';
        }
        updateCardRunningState(
            'farms-auto-farmer',
            Boolean(farmerJob)
        );
        updateCardRunningState(
            'dungeon-runner',
            foregroundJob?.id === 'dungeon'
        );
        updateCardRunningState(
            'breeding-hatch-settings',
            featureSettings.autoHatching,
            'Enabled'
        );
    }

    function stopAllAutomation() {
        const hadActiveJob = Boolean(foregroundJob || farmerJob);
        if (foregroundJob) {
            stopForegroundJob();
        }
        if (farmerJob) {
            stopFarmer();
        }
        if (!hadActiveJob) {
            updateAutomationUI();
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

    function completeForegroundStart(id, reason) {
        foregroundLastStatus = 'Complete: ' + reason;
        if (executionViews[id]) {
            executionViews[id].lastStatus = foregroundLastStatus;
        }
        console.log('[Automation]', foregroundLastStatus);
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

    function estimateBallRequirements(
        result,
        remainingGoal
    ) {
        if (
            result?.expectedRewardPerEncounter ===
            undefined
        ) {
            return null;
        }

        const rewardPerEncounter =
            Number(
                result.expectedRewardPerEncounter
            );

        if (
            !Number.isFinite(rewardPerEncounter) ||
            rewardPerEncounter <= 0
        ) {
            throw new Error(
                'The selected route has zero expected reward under the current Poké Ball settings.'
            );
        }

        const encounters =
            remainingGoal /
            rewardPerEncounter;

        const requirements =
            Object.entries(
                result.ballUsagePerEncounter ?? {}
            )
                .map(([ballType, useRate]) => {
                    const needed = Math.ceil(
                        encounters *
                        Number(useRate)
                    );

                    const owned = Math.floor(
                        getBallQuantity(ballType)
                    );

                    return {
                        ballType:
                            Number(ballType),
                        name:
                            getBallName(ballType),
                        needed,
                        owned,
                        shortage:
                            Math.max(
                                0,
                                needed - owned
                            )
                    };
                })
                .filter(entry =>
                    entry.needed > 0
                );

        return {
            encounters,
            requirements,
            shortages:
                requirements.filter(entry =>
                    entry.shortage > 0
                )
        };
    }

    function confirmBallInventoryPreflight(
        farmLabel,
        goalLabel,
        remainingGoal,
        result
    ) {
        let estimate;
        try {
            estimate =
                estimateBallRequirements(
                    result,
                    remainingGoal
                );
        } catch (error) {
            return {
                canStart: false,
                error: error.message
            };
        }

        if (
            !estimate ||
            !estimate.shortages.length
        ) {
            return {
                canStart: true,
                estimate
            };
        }

        const lines = [
            `${farmLabel} inventory warning`,
            '',
            `Goal: ${goalLabel}`,
            `Remaining: ${formatNumber(remainingGoal)}`,
            `Route: ${result.route.routeName}`,
            '',
            ...estimate.requirements.map(entry =>
                `${entry.name}: need about ${formatNumber(entry.needed)}, ` +
                `own ${formatNumber(entry.owned)}, ` +
                `short about ${formatNumber(entry.shortage)}`
            ),
            '',
            'This is an expected-value estimate using current filters and inventory. Ball fallback and catch randomness can change the actual mix.',
            '',
            'Continue anyway?'
        ];

        const confirmStart =
            typeof globalThis.confirm ===
            'function'
                ? globalThis.confirm(
                    lines.join('\n')
                )
                : false;

        return {
            canStart:
                Boolean(confirmStart),
            cancelled:
                !confirmStart,
            estimate
        };
    }
    function startDungeonTokenAutomation(mode, rawTarget) {
        let target;
        try {
            target = requireFiniteTarget(mode, rawTarget);
        } catch (error) {
            failForegroundStart('dt', error.message);
            return;
        }

        const baseline = getDungeonTokens();
        if (!Number.isFinite(baseline)) {
            failForegroundStart('dt', 'Dungeon Token balance is unavailable.');
            return;
        }
        if (mode === 'owned' && target !== null && baseline >= target) {
            completeForegroundStart(
                'dt',
                'Already own ' + formatNumber(baseline) + ' DT.'
            );
            return;
        }

        const best = scanDungeonTokenRoutes()[0];
        if (!best) {
            failForegroundStart('dt', 'No unlocked route can earn Dungeon Tokens with the current Poké Ball settings.');
            return;
        }

        if (
            target !== null &&
            best.expectedRewardPerEncounter !==
                undefined
        ) {
            const remainingGoal =
                mode === 'owned'
                    ? Math.max(0, target - baseline)
                    : target;

            const preflight =
                confirmBallInventoryPreflight(
                    'Dungeon Token Farm',
                    mode === 'owned'
                        ? `Reach ${formatNumber(target)} DT owned`
                        : `Gain ${formatNumber(target)} DT`,
                    remainingGoal,
                    best
                );

            if (preflight.error) {
                failForegroundStart(
                    'dt',
                    preflight.error
                );
                return;
            }

            if (!preflight.canStart) {
                failForegroundStart(
                    'dt',
                    'Cancelled after Poké Ball inventory warning.'
                );
                return;
            }
        }

        const job = {
            id: 'dt',
            type: 'Dungeon Token Farm',
            needsClicks: true,
            mode,
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
                const current = getDungeonTokens();
                const progress = getResourceGoalProgress(
                    this.mode,
                    current,
                    this.baseline
                );
                if (!Number.isFinite(progress)) {
                    stopForegroundJob('Dungeon Token balance is unavailable.');
                    return;
                }

                const ownedTarget = isOwnedTargetMode(this.mode);
                this.detail = this.route.routeName + '\n' +
                    makeProgressText(
                        ownedTarget ? 'DT owned' : 'DT gained',
                        progress,
                        this.target,
                        best.estimatedDTPerMinute
                    );
                if (this.target !== null && progress >= this.target) {
                    stopForegroundJob(
                        ownedTarget
                            ? 'Reached ' + formatNumber(current) + ' DT owned.'
                            : 'Gained ' + formatNumber(progress) + ' DT.',
                        true
                    );
                    return;
                }
                if (!isOnRoute(this.route)) {
                    stopForegroundJob('Player left the selected route.');
                }
            }
        };
        activateForegroundJob(job);
    }

    function startTypeFarmAutomation(mode, rawTarget) {
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

        if (
            target !== null &&
            best.expectedRewardPerEncounter !==
                undefined
        ) {
            const preflight =
                confirmBallInventoryPreflight(
                    'Type Farm',
                    `Catch ${formatNumber(target)} ${typeName} Pokémon`,
                    target,
                    best
                );

            if (preflight.error) {
                failForegroundStart(
                    'type',
                    preflight.error
                );
                return;
            }

            if (!preflight.canStart) {
                failForegroundStart(
                    'type',
                    'Cancelled after Poké Ball inventory warning.'
                );
                return;
            }
        }

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

    function getGymHostTown(gym) {
        if (!gym) {
            return null;
        }

        const parentName = gym.parent?.name;
        if (parentName && TownList[parentName]) {
            return TownList[parentName];
        }

        if (gym.town && TownList[gym.town]) {
            return TownList[gym.town];
        }

        return Object.values(TownList).find(town =>
            town?.content?.includes?.(gym)
        ) ?? null;
    }

    function getGymClearCount(gym) {
        const index = GameConstants.getGymIndex(gym.town);
        return Number(readObservable(App.game.statistics.gymsDefeated[index]));
    }

    function getGymAutoRepeatState(gym, allowPaid) {
        const clears = getGymClearCount(gym);
        const cost = Math.max(0, Number(gym?.moneyReward || 10) * 2);

        if (clears < 10) {
            return {
                clears,
                cost,
                mode: 'locked',
                useBuiltIn: false,
                paid: false,
                label: 'Locked (<10 clears)'
            };
        }
        if (clears >= 100) {
            return {
                clears,
                cost: 0,
                mode: 'free',
                useBuiltIn: true,
                paid: false,
                label: 'Free (100+ clears)'
            };
        }
        if (allowPaid) {
            return {
                clears,
                cost,
                mode: 'paid',
                useBuiltIn: true,
                paid: true,
                label: 'Paid — $' + formatNumber(cost) + '/repeat'
            };
        }
        return {
            clears,
            cost,
            mode: 'manual',
            useBuiltIn: false,
            paid: false,
            label: 'Manual (paid autorun off)'
        };
    }

    function canAffordGymAutoRepeat(state) {
        return !state.paid ||
            getCurrencyAmount(GameConstants.Currency.money) >= state.cost;
    }

    function isSelectedGymRunning(gym) {
        if (!GymRunner.running() &&
            App.game.gameState !== GameConstants.GameState.gym) {
            return false;
        }
        const activeGym = typeof GymRunner.gymObservable === 'function'
            ? GymRunner.gymObservable()
            : GymBattle.gym;
        return activeGym === gym;
    }

    function startGemGym(job, initialRun, forceManual = false) {
        const state = getGymAutoRepeatState(
            job.result.gym,
            gemFarmAllowPaidGymAutorun
        );
        GymRunner.startGym(
            job.result.gym,
            state.useBuiltIn && !forceManual,
            initialRun
        );
        job.gymRunningSeen = GymRunner.running();
        return state;
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
        const baseline = mode === 'owned'
            ? getGemBalance(gemType)
            : getGemGainCount(gemType);
        if (!Number.isFinite(baseline)) {
            failForegroundStart('gem', gemName + ' gem balance is unavailable.');
            return;
        }
        if (mode === 'owned' && target !== null && baseline >= target) {
            completeForegroundStart(
                'gem',
                'Already own ' + formatNumber(baseline) + ' ' +
                    gemName + ' gems.'
            );
            return;
        }

        const best = scanGemFarms()[0];
        if (!best) {
            failForegroundStart('gem', 'No farm can produce ' + gemName + ' gems.');
            return;
        }

        const job = {
            id: 'gem',
            type: 'Gem Farm',
            needsClicks: true,
            mode,
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
                    MapHelper.moveToRoute(
                        this.result.route.number,
                        this.result.route.region
                    );
                    if (!isOnRoute(this.result.route)) {
                        throw new Error(
                            'Could not move to ' + this.result.location + '.'
                        );
                    }
                } else {
                    const gym = this.result.gym;
                    if (!gym?.isUnlocked?.()) {
                        throw new Error('The selected gym is unavailable.');
                    }
                    const town = this.result.town ?? getGymHostTown(gym);
                    if (!town?.name || town.isUnlocked?.() === false) {
                        throw new Error('The selected gym location is unavailable.');
                    }
                    MapHelper.moveToTown(town.name);
                    if (player.town?.name !== town.name) {
                        throw new Error('Could not move to ' + town.name + '.');
                    }
                    this.lastGymClears = getGymClearCount(gym);
                    startGemGym(this, true);
                }
                this.tick();
            },
            cleanup() {
                GymRunner.autoRestart(false);
            },
            tick() {
                const current = this.mode === 'owned'
                    ? getGemBalance(this.gemType)
                    : getGemGainCount(this.gemType);
                const progress = getResourceGoalProgress(
                    this.mode,
                    current,
                    this.baseline
                );
                if (!Number.isFinite(progress)) {
                    stopForegroundJob(
                        this.gemName + ' gem balance is unavailable.'
                    );
                    return;
                }

                const ownedTarget = isOwnedTargetMode(this.mode);
                let autoRepeatState = null;
                this.detail = this.result.kind + ': ' +
                    this.result.location + '\n' +
                    makeProgressText(
                        this.gemName +
                            (ownedTarget ? ' gems owned' : ' gems gained'),
                        progress,
                        this.target,
                        this.result.gemsPerMinute
                    );
                if (this.result.kind === 'Gym') {
                    autoRepeatState = getGymAutoRepeatState(
                        this.result.gym,
                        gemFarmAllowPaidGymAutorun
                    );
                    this.detail += '\nAutorun: ' + autoRepeatState.label;
                }

                if (this.target !== null && progress >= this.target) {
                    stopForegroundJob(
                        ownedTarget
                            ? 'Reached ' + formatNumber(current) + ' ' +
                                this.gemName + ' gems owned.'
                            : 'Gained ' + formatNumber(progress) + ' ' +
                                this.gemName + ' gems.',
                        true
                    );
                    return;
                }

                if (this.result.kind === 'Route') {
                    if (!isOnRoute(this.result.route)) {
                        stopForegroundJob('Player left the selected route.');
                    }
                    return;
                }

                const gym = this.result.gym;
                const clears = getGymClearCount(gym);
                if (GymRunner.running() ||
                    App.game.gameState === GameConstants.GameState.gym) {
                    if (!isSelectedGymRunning(gym)) {
                        stopForegroundJob(
                            'A different gym battle is running.'
                        );
                        return;
                    }
                    if (clears > this.lastGymClears) {
                        this.lastGymClears = clears;
                        autoRepeatState = getGymAutoRepeatState(
                            gym,
                            gemFarmAllowPaidGymAutorun
                        );
                        GymRunner.autoRestart(
                            autoRepeatState.useBuiltIn
                        );
                        updateGemUI();
                    }
                    this.gymRunningSeen = true;
                    return;
                }

                if (!this.gymRunningSeen) {
                    stopForegroundJob('The gym did not start.');
                    return;
                }
                if (clears <= this.lastGymClears) {
                    stopForegroundJob(
                        'The gym battle was lost or interrupted.'
                    );
                    return;
                }
                if (!gym.isUnlocked()) {
                    stopForegroundJob(
                        'The selected gym is no longer available.'
                    );
                    return;
                }

                autoRepeatState = getGymAutoRepeatState(
                    gym,
                    gemFarmAllowPaidGymAutorun
                );
                const paidRepeatFailed =
                    autoRepeatState.paid &&
                    GymRunner.autoRestart();
                const paidRepeatUnaffordable =
                    autoRepeatState.paid &&
                    !canAffordGymAutoRepeat(autoRepeatState);

                this.lastGymClears = clears;
                this.gymRunningSeen = false;
                startGemGym(
                    this,
                    false,
                    paidRepeatFailed || paidRepeatUnaffordable
                );
                updateGemUI();

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

    function isBerryFarmerMode(mode) {
        return mode === 'berries' || mode === 'berriesOwned';
    }

    function isFarmPointFarmerMode(mode) {
        return mode === 'farmPoints' ||
            mode === 'farmPointsOwned' ||
            mode === 'indefinite';
    }

    function chooseFarmBerry(selection, mode, target, availablePlots) {
        const farmPointGoal = isFarmPointFarmerMode(mode) &&
            mode !== 'indefinite';
        if (selection !== 'auto') {
            const candidate = getFarmCandidate(
                Number(selection),
                availablePlots,
                farmPointGoal ? target : null
            );
            if (isBerryFarmerMode(mode) && candidate &&
                BerryList[candidate.berry].harvestAmount <= 1) {
                return null;
            }
            return candidate;
        }
        if (isBerryFarmerMode(mode)) {
            return null;
        }
        const candidates = [];
        BerryList.forEach((berry, berryType) => {
            const candidate = getFarmCandidate(
                berryType,
                availablePlots,
                farmPointGoal ? target : null
            );
            if (candidate) {
                candidates.push(candidate);
            }
        });
        candidates.sort(farmPointGoal
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

    function completeFarmerStart(reason) {
        farmerLastStatus = 'Complete: ' + reason;
        console.log('[Auto Farmer]', farmerLastStatus);
        updateAutomationUI();
    }

    function getFarmerCurrentValue(job) {
        if (job.resource === 'berries') {
            return Number(
                App.game.farming.berryInventory[job.berry]()
            );
        }
        return getFarmPoints();
    }

    function getFarmerProgress(job) {
        return getResourceGoalProgress(
            job.mode,
            getFarmerCurrentValue(job),
            job.baseline
        );
    }

    function updateFarmerDetail(job) {
        const progress = getFarmerProgress(job);
        const resourceLabel = job.resource === 'berries'
            ? BerryType[job.berry] + ' berries'
            : 'Farm Points';
        const progressLabel = resourceLabel +
            (job.ownedTarget ? ' owned' : ' gained');
        job.detail = BerryType[job.berry] + ' on ' + job.owned.size +
            ' managed plots\n' +
            makeProgressText(progressLabel, progress, job.target);
        return progress;
    }

    function finishFarmerGoalIfReached(job, progress) {
        if (job.target === null || progress < job.target) {
            return false;
        }
        const resourceLabel = job.resource === 'berries'
            ? BerryType[job.berry] + ' berry'
            : 'Farm Point';
        stopFarmer(
            resourceLabel +
                (job.ownedTarget ? ' owned goal reached.' : ' gain goal reached.'),
            true
        );
        return true;
    }

    function startAutoFarmer(selection, mode, rawTarget) {
        if (!featureSettings.autoFarm) {
            farmerLastStatus =
                'Could not start: Enable Auto Farm in the Features tab.';
            updateAutomationUI();
            return;
        }

        if (farmerJob) {
            stopFarmer('Replaced by a new farm run.');
        }

        const berryGoal = isBerryFarmerMode(mode);
        if (!berryGoal && !isFarmPointFarmerMode(mode)) {
            farmerLastStatus = 'Could not start: Select a valid farm goal.';
            updateAutomationUI();
            return;
        }

        let target = null;
        if (mode !== 'indefinite') {
            target = Math.floor(Number(rawTarget));
            if (!Number.isFinite(target) || target <= 0) {
                farmerLastStatus =
                    'Could not start: Enter a target greater than zero.';
                updateAutomationUI();
                return;
            }
        }
        if (berryGoal && selection === 'auto') {
            farmerLastStatus =
                'Could not start: Select a concrete berry for a berry goal.';
            updateAutomationUI();
            return;
        }

        const farming = App.game.farming;
        const selectedBerry = selection === 'auto'
            ? null
            : Number(selection);
        if (berryGoal &&
            (!Number.isInteger(selectedBerry) ||
                !farming.berryInventory[selectedBerry])) {
            farmerLastStatus =
                'Could not start: Select an available berry.';
            updateAutomationUI();
            return;
        }
        const initialValue = berryGoal
            ? Number(farming.berryInventory[selectedBerry]())
            : getFarmPoints();
        if (!Number.isFinite(initialValue)) {
            farmerLastStatus =
                'Could not start: The selected resource balance is unavailable.';
            updateAutomationUI();
            return;
        }

        const ownedTarget = isOwnedTargetMode(mode);
        if (ownedTarget && target !== null && initialValue >= target) {
            completeFarmerStart(
                'Already own ' + formatNumber(initialValue) + ' ' +
                    (berryGoal
                        ? BerryType[selectedBerry] + ' berries.'
                        : 'Farm Points.')
            );
            return;
        }

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

        const planningTarget = target === null
            ? null
            : ownedTarget
                ? getResourceGoalRemaining(
                    mode,
                    target,
                    initialValue,
                    initialValue
                )
                : target;
        const candidate = chooseFarmBerry(
            selection,
            mode,
            planningTarget,
            eligible.length
        );
        if (!candidate) {
            farmerLastStatus =
                'Could not start: No unlocked berry has enough sustainable seed stock.';
            updateAutomationUI();
            return;
        }

        const owned = new Set(eligible.slice(0, candidate.plotCount));
        const job = {
            mode,
            resource: berryGoal ? 'berries' : 'farmPoints',
            ownedTarget,
            target,
            berry: candidate.berry,
            owned,
            baseline: initialValue,
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

        if (!featureSettings.autoFarm) {
            stopFarmer('Auto Farm was disabled.');
            return;
        }

        let progress = updateFarmerDetail(job);
        if (finishFarmerGoalIfReached(job, progress)) {
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

            progress = updateFarmerDetail(job);
            if (finishFarmerGoalIfReached(job, progress)) {
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
            stopFarmer(
                'No managed plots remain or the required seeds ran out.'
            );
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

    function dungeonPointKey(point) {
        return point.floor + ':' + point.x + ',' + point.y;
    }

    function sameDungeonPoint(a, b) {
        return a.floor === b.floor &&
            a.x === b.x &&
            a.y === b.y;
    }

    function getDungeonTile(map, point) {
        return map.board()[point.floor]?.[point.y]?.[point.x] ?? null;
    }

    function getDungeonNeighbors(map, point) {
        const floor = map.board()[point.floor] ?? [];
        const points = [
            { x: point.x, y: point.y - 1, floor: point.floor },
            { x: point.x + 1, y: point.y, floor: point.floor },
            { x: point.x, y: point.y + 1, floor: point.floor },
            { x: point.x - 1, y: point.y, floor: point.floor }
        ];

        return points.filter(candidate =>
            candidate.y >= 0 &&
            candidate.y < floor.length &&
            candidate.x >= 0 &&
            candidate.x < (floor[candidate.y]?.length ?? 0)
        );
    }

    function reconstructDungeonPath(cameFrom, start, target) {
        const path = [];
        let current = target;

        while (!sameDungeonPoint(current, start)) {
            path.unshift(current);
            current = cameFrom.get(dungeonPointKey(current));
            if (!current) {
                return null;
            }
        }

        return path;
    }

    function findKnownDungeonPath(
        map,
        target,
        {
            avoidEnemies = false,
            allowUnknownTarget = false
        } = {}
    ) {
        const start = map.playerPosition();
        if (sameDungeonPoint(start, target)) {
            return [];
        }

        const queue = [start];
        const visited = new Set([dungeonPointKey(start)]);
        const cameFrom = new Map();
        const tileTypes = GameConstants.DungeonTileType;

        while (queue.length) {
            const current = queue.shift();

            for (const neighbor of getDungeonNeighbors(map, current)) {
                const key = dungeonPointKey(neighbor);
                if (visited.has(key)) {
                    continue;
                }

                const tile = getDungeonTile(map, neighbor);
                const isTarget = sameDungeonPoint(neighbor, target);
                const isKnown = tile?.isVisited || tile?.isVisible;

                if (!tile || (!isKnown && !(isTarget && allowUnknownTarget))) {
                    continue;
                }

                if (
                    avoidEnemies &&
                    tile.isVisible &&
                    tile.type() === tileTypes.enemy &&
                    !isTarget
                ) {
                    continue;
                }

                visited.add(key);
                cameFrom.set(key, current);

                if (isTarget) {
                    return reconstructDungeonPath(
                        cameFrom,
                        start,
                        neighbor
                    );
                }

                queue.push(neighbor);
            }
        }

        return null;
    }

    function findAdvancedDungeonPath(map, target, options = {}) {
        return findKnownDungeonPath(map, target, options);
    }

    function getVisibleDungeonTilesByType(map, type) {
        const position = map.playerPosition();

        return map.board()[position.floor]
            .flat()
            .filter(tile =>
                tile.isVisible &&
                tile.type() === type
            );
    }

    function getDungeonExplorationFrontiers(map, job) {
        const position = map.playerPosition();
        const floor = map.board()[position.floor];

        return floor
            .flat()
            .filter(tile => {
                if (
                    tile.isVisited ||
                    job.unreachableObjectives.has(
                        dungeonPointKey(tile.position)
                    )
                ) {
                    return false;
                }

                return getDungeonNeighbors(map, tile.position)
                    .some(point => getDungeonTile(map, point)?.isVisited);
            });
    }

    function findDefaultExplorationPath(map, job) {
        const position = map.playerPosition();
        const adjacent = getDungeonNeighbors(map, position)
            .map(point => getDungeonTile(map, point))
            .filter(tile =>
                tile &&
                !tile.isVisited &&
                !job.unreachableObjectives.has(
                    dungeonPointKey(tile.position)
                )
            );

        if (adjacent.length) {
            return [adjacent[0].position];
        }

        const paths = getDungeonExplorationFrontiers(map, job)
            .map(tile =>
                findKnownDungeonPath(
                    map,
                    tile.position,
                    { allowUnknownTarget: true }
                )
            )
            .filter(path => path?.length)
            .sort((a, b) => a.length - b.length);

        return paths[0] ?? null;
    }

    function chooseClosestDungeonTarget(
        map,
        tiles,
        job,
        options = {}
    ) {
        const paths = tiles
            .filter(tile =>
                !job.unreachableObjectives.has(
                    dungeonPointKey(tile.position)
                )
            )
            .map(tile => ({
                tile,
                path: findAdvancedDungeonPath(
                    map,
                    tile.position,
                    options
                )
            }))
            .filter(candidate => candidate.path?.length)
            .sort((a, b) => a.path.length - b.path.length);

        return paths[0] ?? null;
    }

    function moveDungeonAlongPath(map, job, path, target) {
        if (!path?.length) {
            return false;
        }

        const next = path[0];
        const before = map.playerPosition();

        map.moveToCoordinates(next.x, next.y, next.floor);

        const after = map.playerPosition();
        const moved =
            !sameDungeonPoint(before, after) &&
            sameDungeonPoint(after, next);

        const targetKey = dungeonPointKey(target ?? next);

        if (moved) {
            job.failedMoves.delete(dungeonPointKey(next));
            job.failedMoves.delete(targetKey);
            return true;
        }

        const failures = (job.failedMoves.get(targetKey) ?? 0) + 1;
        job.failedMoves.set(targetKey, failures);

        if (failures >= 3) {
            job.unreachableObjectives.add(targetKey);
        }

        return false;
    }

    function getVisibleChestTier(tile) {
        if (
            !tile?.isVisible ||
            tile.type() !== GameConstants.DungeonTileType.chest
        ) {
            return null;
        }

        return tile.metadata?.tier ?? null;
    }

    function getDungeonPokemonProgress(dungeon) {
        let names = [];

        try {
            names = dungeon.allAvailablePokemon?.() ?? [];
        } catch (error) {
            console.error(
                '[Auto Dungeon] Could not read dungeon encounters.',
                error
            );
        }

        const obtainable = [
            ...new Set(
                names.filter(name =>
                    typeof name === 'string' && name.length
                )
            )
        ];
        const missing = obtainable.filter(name =>
            !App.game.party.alreadyCaughtPokemonByName(name)
        );

        return {
            total: obtainable.length,
            caught: obtainable.length - missing.length,
            missing
        };
    }

    function formatDungeonCollectionProgress(progress) {
        const summary =
            progress.caught + ' / ' +
            progress.total +
            ' obtainable caught';

        return progress.missing.length
            ? summary + '\nMissing: ' + progress.missing.join(', ')
            : summary + '\nAll currently obtainable Pokémon caught.';
    }

    function getAvailableDungeonLoot(dungeon, tier) {
        return (dungeon.lootTable?.[tier] ?? [])
            .filter(loot => {
                try {
                    if (
                        loot.requirement &&
                        !loot.requirement.isCompleted()
                    ) {
                        return false;
                    }

                    const item =
                        typeof ItemList !== 'undefined'
                            ? ItemList[loot.loot]
                            : null;

                    return !item ||
                        (
                            (!item.isAvailable || item.isAvailable()) &&
                            (!item.isSoldOut || !item.isSoldOut())
                        );
                } catch {
                    return false;
                }
            })
            .filter(loot => {
                const chance =
                    getDungeonLootChance(
                        dungeon,
                        loot,
                        tier
                    );
                return chance === null ||
                    chance > 0;
            });
    }

    function getDungeonLootChance(dungeon, loot, tier) {
        try {
            const chance = Number(
                dungeon.getLootChance?.(loot, tier)
            );

            return Number.isFinite(chance) && chance >= 0
                ? chance
                : null;
        } catch {
            return null;
        }
    }

    function formatDungeonRewardName(name) {
        try {
            return GameConstants.camelCaseToString(
                GameConstants.humanifyString(name)
            );
        } catch {
            return String(name).replace(/_/g, ' ');
        }
    }

    function navigateDefaultDungeon(job) {
        const map = DungeonRunner.map;
        const tileTypes = GameConstants.DungeonTileType;
        const currentType = map.currentTile().type();

        if (
            currentType === tileTypes.chest ||
            currentType === tileTypes.ladder ||
            currentType === tileTypes.boss
        ) {
            DungeonRunner.handleInteraction();
            return;
        }

        const chestTarget = chooseClosestDungeonTarget(
            map,
            getVisibleDungeonTilesByType(map, tileTypes.chest),
            job
        );

        if (chestTarget) {
            moveDungeonAlongPath(
                map,
                job,
                chestTarget.path,
                chestTarget.tile.position
            );
            return;
        }

        const exitTarget = chooseClosestDungeonTarget(
            map,
            [
                ...getVisibleDungeonTilesByType(map, tileTypes.ladder),
                ...getVisibleDungeonTilesByType(map, tileTypes.boss)
            ],
            job
        );

        if (exitTarget) {
            moveDungeonAlongPath(
                map,
                job,
                exitTarget.path,
                exitTarget.tile.position
            );
            return;
        }

        const explorationPath = findDefaultExplorationPath(map, job);

        if (explorationPath) {
            moveDungeonAlongPath(
                map,
                job,
                explorationPath,
                explorationPath[explorationPath.length - 1]
            );
            return;
        }

        throw new Error(
            'Default Pathing found no reachable unexplored tile or exit.'
        );
    }

    function selectAdvancedDungeonObjective(map, job) {
        const tileTypes = GameConstants.DungeonTileType;
        const visibleChests = getVisibleDungeonTilesByType(
            map,
            tileTypes.chest
        );
        const selectedChests = visibleChests.filter(tile =>
            selectedDungeonChestRarities.includes(
                getVisibleChestTier(tile)
            )
        );

        const selectedTarget = chooseClosestDungeonTarget(
            map,
            selectedChests,
            job
        );

        if (selectedTarget) {
            return {
                kind: 'selected chest',
                ...selectedTarget
            };
        }

        if (
            job.navigationMode === 'chest' ||
            job.navigationMode === 'full'
        ) {
            const chestTarget = chooseClosestDungeonTarget(
                map,
                visibleChests,
                job
            );

            if (chestTarget) {
                return {
                    kind: 'chest',
                    ...chestTarget
                };
            }
        }

        if (job.navigationMode === 'full') {
            const enemyTarget = chooseClosestDungeonTarget(
                map,
                getVisibleDungeonTilesByType(map, tileTypes.enemy),
                job
            );

            if (enemyTarget) {
                return {
                    kind: 'enemy',
                    ...enemyTarget
                };
            }
        }

        const frontiers = getDungeonExplorationFrontiers(map, job);
        const shouldSearch =
            selectedDungeonChestRarities.length > 0 ||
            job.navigationMode === 'chest' ||
            job.navigationMode === 'full';
        const exits = [
            ...getVisibleDungeonTilesByType(map, tileTypes.ladder),
            ...getVisibleDungeonTilesByType(map, tileTypes.boss)
        ];

        if (!exits.length || (shouldSearch && frontiers.length)) {
            const frontierTarget = chooseClosestDungeonTarget(
                map,
                frontiers,
                job,
                { allowUnknownTarget: true }
            );

            if (frontierTarget) {
                return {
                    kind: 'exploration',
                    ...frontierTarget
                };
            }
        }

        const exitTarget =
            chooseClosestDungeonTarget(
                map,
                exits,
                job,
                {
                    avoidEnemies:
                        job.navigationMode === 'boss'
                }
            ) ??
            chooseClosestDungeonTarget(map, exits, job);

        return exitTarget
            ? {
                kind: 'exit',
                ...exitTarget
            }
            : null;
    }

    function navigateAdvancedDungeon(job) {
        const map = DungeonRunner.map;
        const tileTypes = GameConstants.DungeonTileType;
        const currentType = map.currentTile().type();

        if (
            currentType === tileTypes.chest ||
            currentType === tileTypes.ladder ||
            currentType === tileTypes.boss
        ) {
            DungeonRunner.handleInteraction();
            return;
        }

        const objective = selectAdvancedDungeonObjective(map, job);

        if (objective) {
            const moved = moveDungeonAlongPath(
                map,
                job,
                objective.path,
                objective.tile.position
            );
            job.currentObjective = moved
                ? objective.kind
                : 'recalculating route';
            return;
        }

        throw new Error(
            'Advanced Pathing found no reachable dungeon objective.'
        );
    }

    function navigateDungeon(job) {
        if (DungeonRunner.fighting() || DungeonBattle.catching()) {
            return;
        }

        const map = DungeonRunner.map;
        if (!map?.board?.()?.length) {
            throw new Error('Dungeon map is unavailable.');
        }

        if (
            job.navigationMode === 'default' ||
            !featureSettings.advancedDungeon
        ) {
            navigateDefaultDungeon(job);
            return;
        }

        navigateAdvancedDungeon(job);
    }

    function startDungeonAttempt(job) {
        const tokens = getDungeonTokens();
        const cost = Number(job.dungeon.tokenCost);

        if (!Number.isFinite(tokens) || tokens < cost) {
            throw new Error('Insufficient Dungeon Tokens.');
        }
        if (tokens - cost < job.reserve) {
            throw new Error(
                'Starting another run would use the ' +
                formatNumber(job.reserve) +
                ' DT reserve.'
            );
        }
        if (!DungeonRunner.canStartDungeon(job.dungeon)) {
            throw new Error(
                'The selected dungeon can no longer be entered.'
            );
        }

        MapHelper.moveToTown(job.dungeon.name);
        const townName =
            typeof player.town === 'string'
                ? player.town
                : player.town?.name;

        if (townName !== job.dungeon.name) {
            throw new Error(
                'Could not move to ' + job.dungeon.name + '.'
            );
        }

        const started = DungeonRunner.initializeDungeon(job.dungeon);
        if (
            started === false ||
            App.game.gameState !== GameConstants.GameState.dungeon
        ) {
            throw new Error('The dungeon could not be started.');
        }

        job.runStartClears = getDungeonClearCount(job.dungeon);
        job.runActive = true;
        job.currentObjective = 'exploration';
        job.failedMoves.clear();
        job.unreachableObjectives.clear();
    }

    function startAutoDungeon(
        dungeonName,
        navigationMode,
        goalMode,
        rawTarget,
        rawReserve
    ) {
        if (!featureSettings.autoDungeon) {
            failForegroundStart(
                'dungeon',
                'Enable Auto Dungeon in the Features tab.'
            );
            return;
        }

        stopForegroundJob('Replaced by Auto Dungeon');

        let target = null;
        if (goalMode !== 'allCaught') {
            try {
                target = requireFiniteTarget(goalMode, rawTarget);
            } catch (error) {
                failForegroundStart('dungeon', error.message);
                return;
            }
        }

        const reserve = Math.max(
            0,
            Math.floor(Number(rawReserve) || 0)
        );
        const town = TownList[dungeonName];
        const dungeon = town?.dungeon;

        if (
            !dungeon ||
            !town.isUnlocked?.() ||
            !dungeon.isUnlocked?.() ||
            !dungeon.hasUnlockedBoss?.()
        ) {
            failForegroundStart(
                'dungeon',
                'Select an unlocked dungeon.'
            );
            return;
        }
        if (
            typeof DungeonGuides !== 'undefined' &&
            DungeonGuides.hired?.()
        ) {
            failForegroundStart(
                'dungeon',
                'Dismiss the active Dungeon Guide so normal entry costs are used.'
            );
            return;
        }

        const collectionGoal = goalMode === 'allCaught';
        const initialCollection = getDungeonPokemonProgress(dungeon);

        if (collectionGoal && !initialCollection.missing.length) {
            completeForegroundStart(
                'dungeon',
                'All currently obtainable Pokémon in ' +
                dungeon.name +
                ' are already caught.'
            );
            return;
        }

        const advancedModes = new Set(['boss', 'chest', 'full']);
        const effectiveNavigation =
            featureSettings.advancedDungeon &&
            advancedModes.has(navigationMode)
                ? navigationMode
                : 'default';
        const initialClears = getDungeonClearCount(dungeon);
        const job = {
            id: 'dungeon',
            type: 'Auto Dungeon',
            needsClicks: true,
            dungeon,
            navigationMode: effectiveNavigation,
            target,
            reserve,
            collectionGoal,
            completedClears: 0,
            runStartClears: initialClears,
            runActive: false,
            finishAfterRun: false,
            failedMoves: new Map(),
            unreachableObjectives: new Set(),
            currentObjective: 'starting',
            detail: '',
            updateDetail() {
                const modeName = {
                    default: 'Default Pathing',
                    boss: 'Advanced Boss Rush',
                    chest: 'Advanced Chest Farm',
                    full: 'Advanced Full Clear'
                }[this.navigationMode];

                this.detail =
                    this.dungeon.name +
                    ' (' + modeName + ')' +
                    '\nObjective: ' +
                    this.currentObjective;

                if (this.collectionGoal) {
                    const progress = getDungeonPokemonProgress(
                        this.dungeon
                    );
                    this.detail +=
                        '\n' +
                        formatDungeonCollectionProgress(progress);

                    if (!progress.missing.length && this.runActive) {
                        this.finishAfterRun = true;
                    }
                } else {
                    this.detail +=
                        '\n' +
                        makeProgressText(
                            'Clears',
                            this.completedClears,
                            this.target
                        );
                }
            },
            start() {
                startDungeonAttempt(this);
                this.tick();
            },
            tick() {
                if (!featureSettings.autoDungeon) {
                    stopForegroundJob('Auto Dungeon was disabled.');
                    return;
                }

                if (
                    !featureSettings.advancedDungeon &&
                    this.navigationMode !== 'default'
                ) {
                    this.navigationMode = 'default';
                    this.currentObjective = 'default exploration';
                    this.failedMoves.clear();
                    this.unreachableObjectives.clear();
                }

                const clears = getDungeonClearCount(this.dungeon);

                if (
                    App.game.gameState ===
                    GameConstants.GameState.dungeon
                ) {
                    this.runActive = true;
                    this.updateDetail();
                    navigateDungeon(this);
                    return;
                }

                if (this.runActive) {
                    if (clears <= this.runStartClears) {
                        stopForegroundJob(
                            'The dungeon was lost or interrupted.'
                        );
                        return;
                    }
                    this.completedClears++;
                    this.runActive = false;
                }

                this.updateDetail();

                if (this.collectionGoal) {
                    const progress = getDungeonPokemonProgress(
                        this.dungeon
                    );

                    if (
                        this.finishAfterRun ||
                        !progress.missing.length
                    ) {
                        stopForegroundJob(
                            'Caught all currently obtainable Pokémon in ' +
                            this.dungeon.name +
                            '.',
                            true
                        );
                        return;
                    }
                } else if (
                    this.target !== null &&
                    this.completedClears >= this.target
                ) {
                    stopForegroundJob(
                        'Cleared ' +
                        this.dungeon.name +
                        ' ' +
                        formatNumber(this.completedClears) +
                        ' times.',
                        true
                    );
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
        button.classList.add('pkh-button');
        if (color === '#dc3545') {
            button.classList.add('pkh-button-danger');
        } else if (color) {
            button.classList.add('pkh-button-primary');
        }
        Object.assign(button.style, {
            flex: '1',
            cursor: 'pointer'
        });
    }

    function createFieldLabel(text, control) {
        const label = document.createElement('label');
        label.textContent = text;
        label.className = 'pkh-field-label';
        Object.assign(control.style, {
            width: '100%',
            boxSizing: 'border-box'
        });
        const wrapper = document.createElement('div');
        wrapper.className = 'pkh-field';
        wrapper.appendChild(label);
        wrapper.appendChild(control);
        return wrapper;
    }

    const searchableSelectControllers = new WeakMap();
    let activeSearchableSelect = null;
    let searchableSelectId = 0;

    function filterSearchableOptions(options, query) {
        const needle = String(query ?? '').trim().toLocaleLowerCase();
        return [...options].filter(option => {
            const haystack = (option.dataset.search || option.textContent || '')
                .toLocaleLowerCase();
            return !needle || haystack.includes(needle);
        });
    }

    function refreshSearchableSelect(select) {
        searchableSelectControllers.get(select)?.refresh();
    }

    function createSearchableSelect(select, config = {}) {
        const existing = searchableSelectControllers.get(select);
        if (existing) {
            existing.refresh();
            return existing.wrapper;
        }

        const threshold = config.threshold ?? 6;
        const wrapper = document.createElement('div');
        wrapper.className = 'pkh-search-select';
        if (select.style.marginBottom) {
            wrapper.style.marginBottom = select.style.marginBottom;
            select.style.marginBottom = '';
        }
        const controlId = 'pkh-search-' + ++searchableSelectId;
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'pkh-search-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', controlId + '-results');

        const popup = document.createElement('div');
        popup.className = 'pkh-search-popup';
        popup.style.display = 'none';
        const searchRow = document.createElement('div');
        searchRow.className = 'pkh-search-row';
        const input = document.createElement('input');
        input.type = 'search';
        input.className = 'pkh-search-input';
        input.placeholder = config.placeholder || 'Search...';
        input.setAttribute('aria-label', input.placeholder);
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', controlId + '-results');
        input.setAttribute('aria-expanded', 'false');
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'pkh-search-clear';
        clear.textContent = 'x';
        clear.setAttribute('aria-label', 'Clear search');
        const results = document.createElement('div');
        results.className = 'pkh-search-results';
        results.id = controlId + '-results';
        results.setAttribute('role', 'listbox');
        searchRow.appendChild(input);
        searchRow.appendChild(clear);
        popup.appendChild(searchRow);
        popup.appendChild(results);
        wrapper.appendChild(select);
        wrapper.appendChild(trigger);
        document.body.appendChild(popup);

        let activeIndex = 0;
        let visibleOptions = [];

        const isEnhanced = () => select.options.length >= threshold;
        const selectedText = () =>
            select.selectedOptions?.[0]?.textContent ||
            select.options[select.selectedIndex]?.textContent ||
            config.placeholder || 'Select...';

        const positionPopup = () => {
            const rect = trigger.getBoundingClientRect();
            const viewportWidth = document.documentElement.clientWidth;
            const viewportHeight = document.documentElement.clientHeight;
            const width = Math.min(Math.max(rect.width, 240), viewportWidth - 16);
            popup.style.width = width + 'px';
            popup.style.left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8)) + 'px';
            const height = Math.min(popup.offsetHeight || 320, viewportHeight - 16);
            const below = rect.bottom + 4;
            popup.style.top = (below + height <= viewportHeight - 8
                ? below
                : Math.max(8, rect.top - height - 4)) + 'px';
        };

        const close = (restoreFocus = false) => {
            popup.style.display = 'none';
            trigger.setAttribute('aria-expanded', 'false');
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute?.('aria-activedescendant');
            input.value = '';
            if (activeSearchableSelect?.select === select) {
                activeSearchableSelect = null;
            }
            if (restoreFocus) {
                trigger.focus();
            }
        };

        const choose = option => {
            const changed = select.value !== option.value;
            select.value = option.value;
            controller.refresh();
            close(true);
            if (changed) {
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        const render = () => {
            visibleOptions = filterSearchableOptions(select.options, input.value);
            activeIndex = Math.max(0, Math.min(activeIndex, visibleOptions.length - 1));
            results.replaceChildren();
            if (!visibleOptions.length) {
                const empty = document.createElement('div');
                empty.className = 'pkh-search-empty';
                empty.textContent = config.noResultsText || 'No matches';
                results.appendChild(empty);
                return;
            }
            visibleOptions.forEach((option, index) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'pkh-search-option' +
                    (option.value === select.value ? ' is-selected' : '') +
                    (index === activeIndex ? ' is-active' : '');
                item.textContent = option.textContent;
                item.id = controlId + '-option-' + index;
                item.setAttribute('role', 'option');
                item.setAttribute('aria-selected', String(option.value === select.value));
                item.addEventListener('mouseenter', () => {
                    activeIndex = index;
                    [...results.children].forEach((result, resultIndex) => {
                        result.classList.toggle('is-active', resultIndex === activeIndex);
                    });
                    input.setAttribute('aria-activedescendant', item.id);
                });
                item.addEventListener('click', () => choose(option));
                results.appendChild(item);
            });
            const active = results.children[activeIndex];
            if (active) {
                input.setAttribute('aria-activedescendant', active.id);
                active.scrollIntoView?.({ block: 'nearest' });
            }
        };

        const open = () => {
            controller.refresh();
            if (!isEnhanced()) {
                return;
            }
            if (activeSearchableSelect && activeSearchableSelect.select !== select) {
                activeSearchableSelect.close();
            }
            activeSearchableSelect = controller;
            activeIndex = Math.max(0, [...select.options]
                .findIndex(option => option.value === select.value));
            popup.style.display = 'block';
            trigger.setAttribute('aria-expanded', 'true');
            input.setAttribute('aria-expanded', 'true');
            render();
            positionPopup();
            input.focus();
        };

        const move = direction => {
            if (!visibleOptions.length) {
                return;
            }
            activeIndex = (activeIndex + direction + visibleOptions.length) %
                visibleOptions.length;
            render();
        };

        const controller = {
            select,
            wrapper,
            close,
            refresh() {
                const enhanced = isEnhanced();
                select.style.display = enhanced ? 'none' : '';
                trigger.style.display = enhanced ? '' : 'none';
                trigger.textContent = selectedText();
                trigger.disabled = select.disabled;
                if (!enhanced) {
                    close();
                } else if (popup.style.display !== 'none') {
                    render();
                    positionPopup();
                }
            }
        };
        searchableSelectControllers.set(select, controller);

        trigger.addEventListener('click', () => {
            if (popup.style.display === 'none') {
                open();
            } else {
                close(true);
            }
        });
        trigger.addEventListener('keydown', event => {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
                event.preventDefault();
                open();
                if (event.key === 'ArrowUp') {
                    move(-1);
                }
            } else if (event.key === 'Escape') {
                close();
            }
        });
        input.addEventListener('input', () => {
            activeIndex = 0;
            render();
        });
        input.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(event.key === 'ArrowDown' ? 1 : -1);
            } else if (event.key === 'Enter' && visibleOptions[activeIndex]) {
                event.preventDefault();
                choose(visibleOptions[activeIndex]);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                close(true);
            }
        });
        clear.addEventListener('click', () => {
            input.value = '';
            activeIndex = 0;
            render();
            input.focus();
        });
        select.addEventListener('change', () => controller.refresh());
        document.addEventListener('mousedown', event => {
            if (popup.style.display !== 'none' &&
                !wrapper.contains(event.target) && !popup.contains(event.target)) {
                close();
            }
        });
        globalThis.addEventListener?.('resize', () => {
            if (popup.style.display !== 'none') {
                positionPopup();
            }
        });
        globalThis.addEventListener?.('scroll', () => {
            if (popup.style.display !== 'none') {
                positionPopup();
            }
        }, true);

        controller.refresh();
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

        const modes = config.modes ?? [
            ['finite', config.finiteLabel],
            ['indefinite', 'Run indefinitely']
        ];
        const mode = document.createElement('select');
        for (const [value, label] of modes) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            mode.appendChild(option);
        }
        const storedMode =
            localStorage.getItem(storagePrefix + 'Mode') ?? modes[0][0];
        mode.value = modes.some(([value]) => value === storedMode)
            ? storedMode
            : modes[0][0];

        const target = createNumberInput(
            localStorage.getItem(storagePrefix + 'Target') ??
                config.defaultTarget
        );
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
        panel.className = 'pkh-status-strip';
        automationStatusDot = document.createElement('span');
        automationStatusDot.className = 'pkh-status-dot';
        automationStatusText = document.createElement('div');
        automationStatusText.className = 'pkh-status-text';
        automationStopButton = document.createElement('button');
        automationStopButton.textContent = 'Stop';
        automationStopButton.className = 'pkh-button pkh-button-danger pkh-status-action';
        automationStopButton.addEventListener('click', stopAllAutomation);
        panel.appendChild(automationStatusDot);
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
        refreshSearchableSelect(select);
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
        const berryControl = createSearchableSelect(berry, {
            placeholder: 'Search berries...'
        });

        const goalModes = [
            ['farmPoints', 'Gain X Farm Points'],
            ['farmPointsOwned', 'Reach X Farm Points owned'],
            ['berries', 'Gain X selected berries'],
            ['berriesOwned', 'Reach X selected berry inventory'],
            ['indefinite', 'Run indefinitely']
        ];
        const goal = document.createElement('select');
        for (const [value, label] of goalModes) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            goal.appendChild(option);
        }
        const storedGoal =
            localStorage.getItem(AUTO_FARMER_MODE_STORAGE_KEY) ??
                'farmPoints';
        goal.value = goalModes.some(([value]) => value === storedGoal)
            ? storedGoal
            : 'farmPoints';

        const target = createNumberInput(
            localStorage.getItem(AUTO_FARMER_TARGET_STORAGE_KEY) ?? '5000'
        );
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
        farmerStartButton = startButton;
        startButton.textContent = 'Start';
        styleCompactButton(startButton, '#198754');
        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        styleCompactButton(stopButton, '#dc3545');

        const syncGoal = () => {
            target.disabled = goal.value === 'indefinite';
            localStorage.setItem(
                AUTO_FARMER_MODE_STORAGE_KEY,
                goal.value
            );
        };
        berry.addEventListener('change', () =>
            localStorage.setItem(
                AUTO_FARMER_BERRY_STORAGE_KEY,
                berry.value
            ));
        goal.addEventListener('change', syncGoal);
        target.addEventListener('change', () =>
            localStorage.setItem(
                AUTO_FARMER_TARGET_STORAGE_KEY,
                target.value
            ));
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
        panel.appendChild(createFieldLabel('Berry', berryControl));
        panel.appendChild(createFieldLabel('Goal', goal));
        panel.appendChild(createFieldLabel('Target', target));
        panel.appendChild(farmerStatusText);
        panel.appendChild(buttons);

        farmerHeaderButton.addEventListener('click', () => {
            populateBerrySelect(berry);
            panel.style.display =
                panel.style.display === 'none' ? 'block' : 'none';
        });
        syncGoal();
        updateAutomationUI();
        return {
            header: farmerHeaderButton,
            panel,
            refresh: () => populateBerrySelect(berry)
        };
    }

    function getSelectedDungeon() {
        return TownList[
            dungeonSelect?.value
        ]?.dungeon ?? null;
    }

    function renderDungeonRewardInfo() {
        if (!dungeonRewardInfo) {
            return;
        }

        const dungeon =
            getSelectedDungeon();

        if (!dungeon) {
            dungeonRewardInfo.textContent =
                'Select an unlocked dungeon to view chest rewards.';
            return;
        }

        dungeonRewardInfo.replaceChildren();

        for (
            const tier of
            DUNGEON_CHEST_RARITIES
        ) {
            const loot =
                getAvailableDungeonLoot(
                    dungeon,
                    tier
                );

            if (!loot.length) {
                continue;
            }

            const group =
                document.createElement(
                    'div'
                );
            group.className =
                'pkh-loot-group';

            const heading =
                document.createElement(
                    'strong'
                );
            heading.textContent =
                tier[0].toUpperCase() +
                tier.slice(1) +
                ' chest';
            group.appendChild(heading);

            const rewards =
                document.createElement(
                    'div'
                );
            rewards.className =
                'pkh-loot-items';
            rewards.textContent =
                loot.map(item => {
                    const chance =
                        getDungeonLootChance(
                            dungeon,
                            item,
                            tier
                        );
                    const chanceText =
                        chance === null
                            ? ''
                            : ' (' +
                                (
                                    chance *
                                    100
                                ).toFixed(
                                    chance >=
                                        0.01
                                        ? 2
                                        : 4
                                ) +
                                '%)';
                    const amount =
                        Number(
                            item.amount ??
                            1
                        );
                    const amountText =
                        amount !== 1
                            ? amount + 'x '
                            : '';

                    return amountText +
                        formatDungeonRewardName(
                            item.loot
                        ) +
                        chanceText;
                }).join(', ');
            group.appendChild(rewards);
            dungeonRewardInfo
                .appendChild(group);
        }

        if (
            !dungeonRewardInfo
                .childElementCount
        ) {
            dungeonRewardInfo.textContent =
                'No currently available chest rewards were found.';
        }
    }

    function renderDungeonCollectionInfo() {
        if (!dungeonCollectionInfo) {
            return;
        }

        const dungeon =
            getSelectedDungeon();

        if (!dungeon) {
            dungeonCollectionInfo
                .textContent = '';
            return;
        }

        dungeonCollectionInfo
            .textContent =
            formatDungeonCollectionProgress(
                getDungeonPokemonProgress(
                    dungeon
                )
            );
    }

    function updateDungeonInformation() {
        renderDungeonRewardInfo();
        renderDungeonCollectionInfo();
    }

    function populateDungeonSelect() {
        if (!dungeonSelect) {
            return;
        }

        const current =
            dungeonSelect.value ||
            localStorage.getItem(
                AUTO_DUNGEON_STORAGE_KEY
            ) ||
            '';

        dungeonSelect.replaceChildren();

        for (
            const town of
            getAvailableDungeons()
        ) {
            const option =
                document.createElement(
                    'option'
                );
            option.value =
                town.name;
            option.textContent =
                town.name +
                ' (' +
                formatNumber(
                    town.dungeon.tokenCost
                ) +
                ' DT)';
            dungeonSelect
                .appendChild(option);
        }

        if (
            [
                ...dungeonSelect
                    .options
            ].some(option =>
                option.value ===
                current
            )
        ) {
            dungeonSelect.value =
                current;
        } else if (
            dungeonSelect
                .options.length
        ) {
            dungeonSelect
                .selectedIndex = 0;
        }

        refreshSearchableSelect(
            dungeonSelect
        );
        updateDungeonInformation();
    }

    function updateDungeonAdvancedAvailability() {
        if (!dungeonNavigationSelect) {
            return;
        }

        const advancedAvailable =
            featureSettings.autoDungeon &&
            featureSettings.advancedDungeon;
        const preferred =
            localStorage.getItem(
                AUTO_DUNGEON_MODE_STORAGE_KEY
            ) ??
            'default';

        for (
            const option of
            dungeonNavigationSelect
                .options
        ) {
            const advanced =
                option.value !==
                'default';
            option.disabled =
                advanced &&
                !advancedAvailable;
            option.hidden =
                advanced &&
                !advancedAvailable;
        }

        if (!advancedAvailable) {
            dungeonNavigationSelect
                .value = 'default';
        } else if (
            [
                ...dungeonNavigationSelect
                    .options
            ].some(option =>
                option.value ===
                preferred
            )
        ) {
            dungeonNavigationSelect
                .value = preferred;
        }

        if (
            dungeonAdvancedControls
        ) {
            dungeonAdvancedControls
                .style.display =
                advancedAvailable &&
                dungeonNavigationSelect
                    .value !==
                    'default'
                    ? 'block'
                    : 'none';
        }
    }

    function createAutoDungeonPanel() {
        dungeonHeaderButton =
            document.createElement(
                'button'
            );
        styleMainButton(
            dungeonHeaderButton
        );
        dungeonHeaderButton
            .style.background =
            '#795548';

        const panel =
            document.createElement(
                'div'
            );
        styleCompactPanel(panel);

        const title =
            document.createElement(
                'div'
            );
        title.textContent =
            'Auto Dungeon Runner';
        title.style.fontWeight =
            'bold';
        title.style.fontSize =
            '14px';

        dungeonSelect =
            document.createElement(
                'select'
            );
        const dungeonControl =
            createSearchableSelect(
                dungeonSelect,
                {
                    placeholder:
                        'Search dungeons...'
                }
            );

        dungeonNavigationSelect =
            document.createElement(
                'select'
            );
        for (
            const [
                value,
                label
            ] of [
                [
                    'default',
                    'Default Pathing'
                ],
                [
                    'boss',
                    'Advanced Boss Rush'
                ],
                [
                    'chest',
                    'Advanced Chest Farm'
                ],
                [
                    'full',
                    'Advanced Full Clear'
                ]
            ]
        ) {
            const option =
                document.createElement(
                    'option'
                );
            option.value = value;
            option.textContent =
                label;
            dungeonNavigationSelect
                .appendChild(option);
        }

        dungeonAdvancedControls =
            document.createElement(
                'div'
            );
        dungeonAdvancedControls
            .className =
            'pkh-advanced-controls';

        dungeonChestRaritySelect =
            document.createElement(
                'select'
            );
        dungeonChestRaritySelect
            .multiple = true;
        dungeonChestRaritySelect
            .size =
            DUNGEON_CHEST_RARITIES
                .length;

        for (
            const rarity of
            DUNGEON_CHEST_RARITIES
        ) {
            const option =
                document.createElement(
                    'option'
                );
            option.value = rarity;
            option.textContent =
                rarity[0]
                    .toUpperCase() +
                rarity.slice(1);
            option.selected =
                selectedDungeonChestRarities
                    .includes(rarity);
            dungeonChestRaritySelect
                .appendChild(option);
        }

        dungeonAdvancedControls
            .appendChild(
                createFieldLabel(
                    'Detour for chest rarities',
                    dungeonChestRaritySelect
                )
            );

        const rarityNote =
            createTextLine();
        rarityNote.className =
            'pkh-inline-help';
        rarityNote.textContent =
            'Advanced routing searches remaining frontiers for selected tiers and only reads rarity after a chest is visible.';
        dungeonAdvancedControls
            .appendChild(rarityNote);

        const goal =
            document.createElement(
                'select'
            );
        for (
            const [
                value,
                label
            ] of [
                [
                    'finite',
                    'Clear X times'
                ],
                [
                    'indefinite',
                    'Run indefinitely'
                ],
                [
                    'allCaught',
                    'Run until all Pok\u00e9mon caught'
                ]
            ]
        ) {
            const option =
                document.createElement(
                    'option'
                );
            option.value = value;
            option.textContent =
                label;
            goal.appendChild(option);
        }

        const storedGoal =
            localStorage.getItem(
                AUTO_DUNGEON_GOAL_STORAGE_KEY
            ) ??
            'finite';
        goal.value = [
            'finite',
            'indefinite',
            'allCaught'
        ].includes(storedGoal)
            ? storedGoal
            : 'finite';

        const target =
            createNumberInput(
                localStorage.getItem(
                    AUTO_DUNGEON_TARGET_STORAGE_KEY
                ) ??
                '1'
            );
        const reserve =
            createNumberInput(
                localStorage.getItem(
                    AUTO_DUNGEON_RESERVE_STORAGE_KEY
                ) ??
                '0'
            );
        reserve.min = '0';

        dungeonCollectionInfo =
            createTextLine();
        dungeonCollectionInfo
            .className =
            'pkh-collection-info';
        dungeonCollectionInfo
            .style.whiteSpace =
            'pre-line';

        const rewardHeading =
            document.createElement(
                'div'
            );
        rewardHeading.className =
            'pkh-subheading';
        rewardHeading.textContent =
            'Possible chest rewards';

        dungeonRewardInfo =
            document.createElement(
                'div'
            );
        dungeonRewardInfo.className =
            'pkh-loot-info';

        const rewardNote =
            createTextLine();
        rewardNote.className =
            'pkh-inline-help';
        rewardNote.textContent =
            'Only rewards currently allowed by game requirements and item availability are shown. Percentages are per chest and use the game\'s current clear-count and debuff logic.';

        const status =
            createTextLine();
        status.style.whiteSpace =
            'pre-line';
        status.style.marginTop =
            '8px';
        status.textContent = 'Idle';
        executionViews.dungeon = {
            status,
            lastStatus: 'Idle'
        };

        const buttons =
            document.createElement(
                'div'
            );
        Object.assign(
            buttons.style,
            {
                display: 'flex',
                gap: '5px',
                marginTop: '8px'
            }
        );

        dungeonStartButton =
            document.createElement(
                'button'
            );
        dungeonStartButton
            .textContent = 'Start';
        styleCompactButton(
            dungeonStartButton,
            '#198754'
        );

        const stopButton =
            document.createElement(
                'button'
            );
        stopButton.textContent =
            'Stop';
        styleCompactButton(
            stopButton,
            '#dc3545'
        );

        const syncGoal = () => {
            target.disabled =
                goal.value !==
                'finite';
            localStorage.setItem(
                AUTO_DUNGEON_GOAL_STORAGE_KEY,
                goal.value
            );
            renderDungeonCollectionInfo();
        };

        dungeonSelect
            .addEventListener(
                'change',
                () => {
                    localStorage.setItem(
                        AUTO_DUNGEON_STORAGE_KEY,
                        dungeonSelect.value
                    );
                    updateDungeonInformation();
                }
            );

        dungeonNavigationSelect
            .addEventListener(
                'change',
                () => {
                    localStorage.setItem(
                        AUTO_DUNGEON_MODE_STORAGE_KEY,
                        dungeonNavigationSelect
                            .value
                    );
                    updateDungeonAdvancedAvailability();
                }
            );

        dungeonChestRaritySelect
            .addEventListener(
                'change',
                () => {
                    selectedDungeonChestRarities =
                        [
                            ...dungeonChestRaritySelect
                                .selectedOptions
                        ].map(option =>
                            option.value
                        );
                    localStorage.setItem(
                        DUNGEON_CHEST_RARITIES_STORAGE_KEY,
                        JSON.stringify(
                            selectedDungeonChestRarities
                        )
                    );
                }
            );

        goal.addEventListener(
            'change',
            syncGoal
        );
        target.addEventListener(
            'change',
            () =>
                localStorage.setItem(
                    AUTO_DUNGEON_TARGET_STORAGE_KEY,
                    target.value
                )
        );
        reserve.addEventListener(
            'change',
            () =>
                localStorage.setItem(
                    AUTO_DUNGEON_RESERVE_STORAGE_KEY,
                    reserve.value
                )
        );

        dungeonStartButton
            .addEventListener(
                'click',
                event => {
                    event.stopPropagation();
                    startAutoDungeon(
                        dungeonSelect.value,
                        dungeonNavigationSelect
                            .value,
                        goal.value,
                        target.value,
                        reserve.value
                    );
                }
            );
        stopButton.addEventListener(
            'click',
            event => {
                event.stopPropagation();
                if (
                    foregroundJob?.id ===
                    'dungeon'
                ) {
                    stopForegroundJob();
                }
            }
        );

        buttons.appendChild(
            dungeonStartButton
        );
        buttons.appendChild(
            stopButton
        );
        panel.appendChild(title);
        panel.appendChild(
            createFieldLabel(
                'Dungeon',
                dungeonControl
            )
        );
        panel.appendChild(
            createFieldLabel(
                'Navigation',
                dungeonNavigationSelect
            )
        );
        panel.appendChild(
            dungeonAdvancedControls
        );
        panel.appendChild(
            createFieldLabel(
                'Goal',
                goal
            )
        );
        panel.appendChild(
            createFieldLabel(
                'Target',
                target
            )
        );
        panel.appendChild(
            createFieldLabel(
                'Minimum DT reserve',
                reserve
            )
        );
        panel.appendChild(
            dungeonCollectionInfo
        );
        panel.appendChild(
            rewardHeading
        );
        panel.appendChild(
            dungeonRewardInfo
        );
        panel.appendChild(
            rewardNote
        );
        panel.appendChild(status);
        panel.appendChild(buttons);

        dungeonHeaderButton
            .addEventListener(
                'click',
                () => {
                    populateDungeonSelect();
                    panel.style.display =
                        panel.style.display ===
                            'none'
                            ? 'block'
                            : 'none';
                }
            );

        syncGoal();
        populateDungeonSelect();
        updateDungeonAdvancedAvailability();
        updateAutomationUI();

        return {
            header:
                dungeonHeaderButton,
            panel,
            refresh() {
                populateDungeonSelect();
                updateDungeonAdvancedAvailability();
            }
        };
    }


    // ============================================================
    // Main button UI
    // ============================================================

    function updateClickButton() {
        if (!clickButton) {
            return;
        }

        clickButton.classList.toggle('is-on', autoClickEnabled);
        clickButton.setAttribute('aria-pressed', String(autoClickEnabled));
        clickButton.setAttribute(
            'aria-label',
            'Auto Click ' + (autoClickEnabled ? 'on' : 'off')
        );
        clickButton.title = 'Auto Click: ' + (autoClickEnabled ? 'ON' : 'OFF');
    }

    function createFeatureToggleButton(
        name,
        featureOwner = false
    ) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pkh-toggle';
        button.dataset.featureOwner = String(featureOwner);
        button.addEventListener('click', () =>
            setFeatureEnabled(
                name,
                !featureSettings[name],
                featureOwner
            )
        );
        featureToggleButtons[name].push(button);
        return button;
    }

    function getBreedingStrategyLabel(strategy) {
        return {
            pokerus: 'Pok\u00e9rus',
            mega: 'Mega',
            default: 'Custom',
            off: 'None'
        }[strategy] ?? strategy;
    }

    function moveBreedingPriority(strategy, direction) {
        if (strategy === 'off') {
            return;
        }

        const movable = breedingPriority.filter(entry => entry !== 'off');
        const index = movable.indexOf(strategy);
        const nextIndex = index + direction;

        if (
            index < 0 ||
            nextIndex < 0 ||
            nextIndex >= movable.length
        ) {
            return;
        }

        [movable[index], movable[nextIndex]] =
            [movable[nextIndex], movable[index]];
        breedingPriority = [...movable, 'off'];
        localStorage.setItem(
            BREEDING_PRIORITY_STORAGE_KEY,
            JSON.stringify(breedingPriority)
        );
        renderBreedingPriorityViews();
    }

    function renderBreedingPriorityView(view) {
        view.replaceChildren();

        const activeStrategies = breedingPriority.filter(strategy =>
            strategy === 'default' ||
            strategy === 'off' ||
            featureSettings.advancedHatching
        );
        const movable = activeStrategies.filter(
            strategy => strategy !== 'off'
        );

        activeStrategies.forEach((strategy, index) => {
            const row = document.createElement('div');
            row.className = 'pkh-priority-row';

            const label = document.createElement('span');
            label.textContent =
                (index + 1) + '. ' +
                getBreedingStrategyLabel(strategy);
            row.appendChild(label);

            if (strategy !== 'off') {
                const controls = document.createElement('span');
                controls.className = 'pkh-priority-buttons';

                const up = document.createElement('button');
                up.type = 'button';
                up.textContent = 'Up';
                up.title = 'Move earlier';
                up.disabled = movable.indexOf(strategy) === 0;
                up.addEventListener('click', () =>
                    moveBreedingPriority(strategy, -1)
                );

                const down = document.createElement('button');
                down.type = 'button';
                down.textContent = 'Down';
                down.title = 'Move later';
                down.disabled =
                    movable.indexOf(strategy) === movable.length - 1;
                down.addEventListener('click', () =>
                    moveBreedingPriority(strategy, 1)
                );

                controls.appendChild(up);
                controls.appendChild(down);
                row.appendChild(controls);
            } else {
                const fixed = document.createElement('small');
                fixed.textContent = 'terminal fallback';
                row.appendChild(fixed);
            }

            view.appendChild(row);
        });
    }

    function renderBreedingPriorityViews() {
        for (const view of breedingPriorityViews) {
            renderBreedingPriorityView(view);
        }
    }

    function createBreedingPriorityControl() {
        const view = document.createElement('div');
        view.className = 'pkh-priority-list';
        breedingPriorityViews.push(view);
        renderBreedingPriorityView(view);
        return view;
    }

    function updateFeatureUI() {
        const dependencies = {
            advancedHatching: featureSettings.autoHatching,
            advancedDungeon: featureSettings.autoDungeon
        };

        for (
            const [name, buttons] of
            Object.entries(featureToggleButtons)
        ) {
            const available = dependencies[name] ?? true;

            for (const button of buttons) {
                const featureOwner =
                    button.dataset.featureOwner === 'true';
                const canChangeHere =
                    featureOwner || featureSettings[name];
                const unavailable =
                    !available || !canChangeHere;

                button.disabled = unavailable;
                button.classList.toggle(
                    'is-on',
                    featureSettings[name]
                );
                button.classList.toggle(
                    'is-unavailable',
                    unavailable
                );
                button.setAttribute(
                    'aria-pressed',
                    String(featureSettings[name])
                );
                button.setAttribute(
                    'aria-label',
                    name + ' ' +
                    (featureSettings[name] ? 'on' : 'off')
                );
                button.title = !available
                    ? (
                        featureSettings[name]
                            ? 'Saved as enabled; inactive until the basic feature is enabled.'
                            : 'Enable the basic feature first.'
                    )
                    : !canChangeHere
                        ? 'Enable this feature from the Features tab.'
                        : (featureSettings[name] ? 'Enabled' : 'Disabled');
            }
        }

        if (dungeonStartButton) {
            dungeonStartButton.disabled =
                !featureSettings.autoDungeon;
        }
        if (farmerStartButton) {
            farmerStartButton.disabled =
                !featureSettings.autoFarm;
        }

        updateDungeonAdvancedAvailability();
        renderBreedingPriorityViews();
    }

    function updateHatchButton() {
        updateFeatureUI();
    }

    // ============================================================
    // DT UI
    // ============================================================

    function formatExpectedBallRates(result) {
        const rates =
            Object.entries(
                result?.ballsPerMinute ?? {}
            )
                .filter(([, rate]) =>
                    Number(rate) > 0
                )
                .map(([ballType, rate]) =>
                    `${getBallName(ballType)} ${Number(rate).toFixed(1)}/min`
                );

        return rates.length
            ? rates.join(', ')
            : 'No balls thrown';
    }

    function formatRouteRanking(
        label,
        results,
        metric,
        suffix,
        digits = null
    ) {
        if (!results?.length) {
            return `<strong>${label}:</strong><br>No positive-yield route`;
        }

        const shown =
            results.slice(0, 4);

        return `<strong>${label}:</strong><br>` +
            shown.map((result, index) => {
                const value =
                    digits === null
                        ? formatNumber(
                            result[metric]
                        )
                        : Number(
                            result[metric]
                        ).toFixed(digits);

                return `${index + 1}. ${result.route.routeName} — ` +
                    `${value}${suffix}`;
            }).join('<br>') +
            `<br><span style="opacity:.72">Best ball use: ` +
            `${formatExpectedBallRates(shown[0])}</span>`;
    }
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

        if (dtStrategyText) {
            dtStrategyText.innerHTML =
                dtHasScanned
                    ? formatRouteRanking(
                        'Current Settings',
                        dtScenarioResults.currentSettings,
                        'estimatedDTPerMinute',
                        ' DT/min'
                    ) +
                    '<div style="height:8px"></div>' +
                    formatRouteRanking(
                        'Ultra Ball — Catch All (comparison)',
                        dtScenarioResults.ultraAll,
                        'estimatedDTPerMinute',
                        ' DT/min'
                    )
                    : 'Press Rescan to compare capture strategies.';
        }

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
                width: '300px',
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

        dtStrategyText =
            createTextLine();

        Object.assign(
            dtStrategyText.style,
            {
                marginTop: '8px',
                paddingTop: '8px',
                borderTop:
                    '1px solid rgba(255,255,255,0.2)'
            }
        );

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
            dtStrategyText
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

        const best = gemResults[0];
        if (!best) {
            gemHeaderButton.textContent =
                'Gem Farm: ' + selectedGemType +
                ' — Not scanned ▾';
            gemBestText.textContent = 'Press Rescan';
            gemTopText.innerHTML = '';
            return;
        }

        const bestName = best.kind === 'Gym'
            ? best.name + ' — ' + best.location
            : best.location;
        const autorun = best.kind === 'Gym'
            ? getGymAutoRepeatState(
                best.gym,
                gemFarmAllowPaidGymAutorun
            )
            : null;

        gemHeaderButton.textContent =
            'Gem Farm: ' + selectedGemType +
            ' → ' + best.name + ' ▾';
        gemBestText.innerHTML =
            '<strong>Best:</strong><br>' +
            bestName + '<br>' +
            'Est. ' + formatNumber(best.gemsPerMinute) + ' gems/min' +
            (autorun
                ? '<br>Autorun: ' + autorun.label
                : '');

        gemTopText.innerHTML = gemResults
            .slice(1, 5)
            .map((result, index) => {
                const name = result.kind === 'Gym'
                    ? result.name + ' — ' + result.location
                    : result.location;
                return (index + 2) + '. ' + name + ' — ' +
                    formatNumber(result.gemsPerMinute) + '/min';
            })
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

        const gemTypeControl = createSearchableSelect(gemTypeSelect, {
            placeholder: 'Search gem types...'
        });

        const paidAutorunRow =
            document.createElement(
                'label'
            );

        paidAutorunRow.className =
            'pkh-setting';

        const paidAutorunLabel =
            document.createElement(
                'span'
            );

        paidAutorunLabel.className =
            'pkh-setting-label';

        paidAutorunLabel.textContent =
            'Allow paid gym autorun';

        const paidAutorunToggle =
            document.createElement(
                'button'
            );

        paidAutorunToggle.type =
            'button';

        paidAutorunToggle.className =
            'pkh-toggle';

        const syncPaidAutorunToggle = () => {
            paidAutorunToggle.classList.toggle(
                'is-on',
                gemFarmAllowPaidGymAutorun
            );
            paidAutorunToggle.setAttribute(
                'aria-pressed',
                String(gemFarmAllowPaidGymAutorun)
            );
        };

        paidAutorunToggle.addEventListener(
            'click',
            event => {
                event.preventDefault();
                event.stopPropagation();

                gemFarmAllowPaidGymAutorun =
                    !gemFarmAllowPaidGymAutorun;

                localStorage.setItem(
                    GEM_FARM_PAID_AUTORUN_STORAGE_KEY,
                    String(gemFarmAllowPaidGymAutorun)
                );

                syncPaidAutorunToggle();
                updateGemUI();
            }
        );

        syncPaidAutorunToggle();
        paidAutorunRow.appendChild(
            paidAutorunLabel
        );
        paidAutorunRow.appendChild(
            paidAutorunToggle
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
            gemTypeControl
        );
        gemPanel.appendChild(
            paidAutorunRow
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
            typeFarmScenarioResults
                .currentSettings[0];

        if (!typeFarmHasScanned) {
            typeFarmHeaderButton.textContent =
                `Type Farm: ${typeName} — Not scanned ▾`;
            typeFarmBestText.textContent =
                'Press Rescan';
            typeFarmTopText.textContent = '';
            return;
        }

        if (best) {
            typeFarmHeaderButton.textContent =
                `Type Farm: ${typeName} → ${best.route.routeName} ▾`;
        } else {
            typeFarmHeaderButton.textContent =
                `Type Farm: ${typeName} — No current route ▾`;
        }

        typeFarmBestText.innerHTML =
            formatRouteRanking(
                'Current Settings',
                typeFarmScenarioResults
                    .currentSettings,
                'catchesPerMinute',
                ' catches/min',
                2
            ) +
            '<div style="height:8px"></div>' +
            formatRouteRanking(
                'Ultra Ball — Catch All (comparison)',
                typeFarmScenarioResults.ultraAll,
                'catchesPerMinute',
                ' catches/min',
                2
            ) +
            '<div style="height:8px"></div>' +
            formatRouteRanking(
                'Ultra Ball — Target Only (comparison)',
                typeFarmScenarioResults
                    .ultraTargetOnly,
                'catchesPerMinute',
                ' catches/min',
                2
            );

        if (best) {
            typeFarmTopText.innerHTML =
                `Current best: target encounters ` +
                `${(
                    best.targetEncounterRate * 100
                ).toFixed(1)}%, ` +
                `target catch chance ` +
                `${(
                    best.targetCatchChance * 100
                ).toFixed(1)}%`;
        } else {
            typeFarmTopText.textContent =
                'Current filters produce no positive expected catches for this type.';
        }
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
                typeFarmScenarioResults = {
                    currentSettings: [],
                    ultraAll: [],
                    ultraTargetOnly: []
                };
                typeFarmHasScanned = false;

                updateTypeFarmUI();
            }
        );

        const typeFarmTypeControl = createSearchableSelect(typeFarmTypeSelect, {
            placeholder: 'Search types...'
        });

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
            'Current Settings controls automation. Ultra Ball rows are comparisons only and never change filters.';

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
            typeFarmTypeControl
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

    function escapeVitaminHTML(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function populateVitaminRegionSelect() {
        if (!vitaminRegionSelect) {
            return;
        }
        const highestRegion = player.highestRegion();
        selectedVitaminRegion = Math.min(selectedVitaminRegion, highestRegion);
        vitaminRegionSelect.replaceChildren();
        for (let region = 0; region <= highestRegion; region++) {
            const option = document.createElement('option');
            option.value = String(region);
            option.textContent = getRegionName(region);
            vitaminRegionSelect.appendChild(option);
        }
        vitaminRegionSelect.value = String(selectedVitaminRegion);
        refreshSearchableSelect(vitaminRegionSelect);
    }

    function populateVitaminPokemonSelect() {
        if (!vitaminPokemonSelect) {
            return;
        }
        const pokemonList = App.game.party.caughtPokemon || [];
        const selected = selectedVitaminPokemon &&
            pokemonList.includes(selectedVitaminPokemon)
            ? selectedVitaminPokemon
            : null;
        const nameCounts = new Map();
        for (const pokemon of pokemonList) {
            nameCounts.set(pokemon.name, (nameCounts.get(pokemon.name) || 0) + 1);
        }

        vitaminPokemonByValue = new Map();
        vitaminPokemonSelect.replaceChildren();
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'Choose a Pokemon';
        vitaminPokemonSelect.appendChild(empty);

        let selectedValue = '';
        pokemonList.forEach((pokemon, index) => {
            const value = String(index);
            const option = document.createElement('option');
            option.value = value;
            option.textContent = nameCounts.get(pokemon.name) > 1
                ? pokemon.name + ' (#' + (pokemon.id ?? index + 1) + ')'
                : pokemon.name;
            option.dataset.search = pokemon.name + ' ' + option.textContent;
            vitaminPokemonByValue.set(value, pokemon);
            vitaminPokemonSelect.appendChild(option);
            if (pokemon === selected) {
                selectedValue = value;
            }
        });

        selectedVitaminPokemon = selected;
        vitaminPokemonSelect.value = selectedValue;
        refreshSearchableSelect(vitaminPokemonSelect);
    }

    function updateSelectedVitaminUI() {
        if (!vitaminPokemonDetailsText) {
            return;
        }
        if (!selectedVitaminPokemon) {
            vitaminPokemonDetailsText.innerHTML =
                '<div class="pkh-empty-state">Search for any owned Pokemon to inspect its true vitamin optimum.</div>';
            return;
        }

        let result;
        try {
            result = analyzeIndividualVitaminPokemon(
                selectedVitaminPokemon,
                selectedVitaminRegion
            );
        } catch (error) {
            console.warn('[Vitamin Tracker] Individual calculation failed.', error);
            vitaminPokemonDetailsText.innerHTML =
                '<div class="pkh-empty-state">This Pokemon could not be calculated.</div>';
            return;
        }

        const nativeRegion = result.nativeRegion === null
            ? 'Unknown'
            : getRegionName(result.nativeRegion);
        const percent = Number.isFinite(result.improvementPercent)
            ? result.improvementPercent.toFixed(2) + '%'
            : 'Infinite';
        const signedImprovement = (result.improvement >= 0 ? '+' : '') +
            result.improvement.toFixed(6);
        const statuses = [
            Math.abs(result.improvement) <= 1e-12
                ? 'Already at the optimal setup.'
                : 'Optimization available.'
        ];
        if (result.currentTotal >= result.cap) {
            statuses.push('Vitamin cap reached.');
        }
        const formatChange = value => value > 0
            ? '+' + value
            : (value < 0 ? String(value) : 'No change');
        const hatcheryNotice = result.inHatchery
            ? '<div class="pkh-vitamin-notice">This Pokemon must leave the Hatchery or queue before its vitamins can be changed. The optimum remains available here.</div>'
            : '';

        vitaminPokemonDetailsText.innerHTML =
            '<div class="pkh-vitamin-details">' +
            '<div class="pkh-metric-row"><span>Pokemon</span><strong>' +
                escapeVitaminHTML(result.name) + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Native Region</span><strong>' +
                escapeVitaminHTML(nativeRegion) + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Target Region</span><strong>' +
                escapeVitaminHTML(getRegionName(result.targetRegion)) + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Vitamin Cap</span><strong>' +
                result.cap + '</strong></div>' +
            '<div class="pkh-table-wrap"><table class="pkh-vitamin-table">' +
            '<thead><tr><th>Vitamin</th><th>Current</th><th>Optimal</th><th>Change</th></tr></thead>' +
            '<tbody><tr><td>Protein</td><td>' + result.current.protein +
                '</td><td class="pkh-positive">' + result.optimal.protein +
                '</td><td>' + formatChange(result.optimal.protein - result.current.protein) + '</td></tr>' +
            '<tr><td>Calcium</td><td>' + result.current.calcium +
                '</td><td class="pkh-positive">' + result.optimal.calcium +
                '</td><td>' + formatChange(result.optimal.calcium - result.current.calcium) + '</td></tr>' +
            '<tr><td>Carbos</td><td>' + result.current.carbos +
                '</td><td class="pkh-positive">' + result.optimal.carbos +
                '</td><td>' + formatChange(result.optimal.carbos - result.current.carbos) + '</td></tr>' +
            '<tr><td><strong>Total</strong></td><td><strong>' + result.currentTotal +
                '</strong></td><td class="pkh-positive"><strong>' + result.optimalTotal +
                '</strong></td><td><strong>' +
                formatChange(result.optimalTotal - result.currentTotal) +
                '</strong></td></tr></tbody></table></div>' +
            '<div class="pkh-metric-row"><span>Regional BE</span><strong>' +
                result.currentBE.toFixed(6) + ' -> ' + result.optimalBE.toFixed(6) +
                '</strong></div>' +
            '<div class="pkh-metric-row"><span>Improvement</span><strong class="' +
                (result.improvement > 1e-12 ? 'pkh-positive' : '') + '">' +
                signedImprovement + ' (' + percent + ')</strong></div>' +
            '<div class="pkh-metric-row"><span>Egg Steps</span><strong>' +
                formatNumber(result.currentEggSteps) + ' -> ' +
                formatNumber(result.optimalEggSteps) + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Breeding Attack Gain</span><strong>' +
                result.currentAttackGain.toFixed(3) + ' -> ' +
                result.optimalAttackGain.toFixed(3) + '</strong></div>' +
            '<div class="pkh-vitamin-guidance"><strong>Guidance:</strong> ' +
                escapeVitaminHTML(result.guidance) + '<br>' +
                escapeVitaminHTML(statuses.join(' ')) + '</div>' +
            hatcheryNotice +
            '</div>';
    }

    function updateVitaminUI() {
        if (!vitaminHeaderButton) {
            return;
        }

        updateSelectedVitaminUI();
        const regionName = getRegionName(selectedVitaminRegion);
        const best = vitaminResults[0];
        const multiplier = getNonNativeAttackMultiplier();
        vitaminSummaryText.innerHTML =
            '<div class="pkh-metric-row"><span>Target Region</span><strong>' +
                regionName + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Regional Debuff</span><strong class="' +
                (isRegionalDebuffActive() ? 'pkh-positive' : '') + '">' +
                (isRegionalDebuffActive() ? 'Active' : 'Off') + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Non-native multiplier</span><strong>x' +
                multiplier.toFixed(2) + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Vitamin Cap</span><strong>' +
                getVitaminCap() + '</strong></div>';

        if (!best) {
            vitaminHeaderButton.textContent =
                'Vitamins: ' + regionName + ' - ' +
                (vitaminHasScanned ? 'No beneficial targets' : 'Not scanned');
            vitaminResultsText.innerHTML =
                '<div class="pkh-empty-state">' +
                (vitaminHasScanned
                    ? 'No beneficial vitamin investments with currently unlocked vitamins.'
                    : 'Refresh the tracker to calculate the best investments.') +
                '</div>';
            return;
        }

        vitaminHeaderButton.textContent =
            'Vitamins: ' + regionName + ' -> ' + best.name;

        const rows = vitaminResults
            .slice(0, 10)
            .map((result, index) => {
                const current = result.current;
                const optimal = result.optimal;
                const nativeRegion = result.nativeRegion === null
                    ? 'Unknown'
                    : getRegionName(result.nativeRegion);
                const gain =
                    (Math.floor(result.nextGain * 1000) / 1000).toFixed(3);
                return (
                    '<tr>' +
                    '<td>' + (index + 1) + '</td>' +
                    '<td><strong>' + escapeVitaminHTML(result.name) + '</strong></td>' +
                    '<td>' + escapeVitaminHTML(nativeRegion) + '</td>' +
                    '<td>' + current.protein + 'P/' + current.calcium + 'Ca/' +
                        current.carbos + 'Cb</td>' +
                    '<td class="pkh-positive">' + optimal.protein + 'P/' +
                        optimal.calcium + 'Ca/' + optimal.carbos + 'Cb</td>' +
                    '<td class="pkh-positive">+' + gain + '</td>' +
                    '</tr>'
                );
            })
            .join('');

        vitaminResultsText.innerHTML =
            '<div class="pkh-table-wrap"><table class="pkh-vitamin-table">' +
            '<thead><tr><th>#</th><th>Pokemon</th><th>Native</th>' +
            '<th>Current</th><th>Optimal</th>' +
            '<th title="regional BE / vitamin">Delta BE</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';
    }

    function createVitaminPanel() {
        vitaminHeaderButton = document.createElement('button');
        styleMainButton(vitaminHeaderButton);
        vitaminHeaderButton.style.background = '#20c997';
        vitaminHeaderButton.textContent =
            'Vitamins: ' + getRegionName(selectedVitaminRegion) + ' - Not scanned';

        vitaminPanel = document.createElement('div');
        Object.assign(vitaminPanel.style, {
            display: 'none',
            background: 'rgba(25,25,25,0.97)',
            color: 'white',
            borderRadius: '6px',
            padding: '10px',
            position: 'fixed',
            boxSizing: 'border-box',
            width: '360px',
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: 'min(78vh, calc(100vh - 16px))',
            overflowWrap: 'anywhere',
            overflowY: 'auto',
            fontSize: '12px',
            lineHeight: '1.35',
            boxShadow: '0 2px 8px rgba(0,0,0,0.45)'
        });

        const title = document.createElement('div');
        title.textContent = 'Vitamin Tracker';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '14px';
        title.style.marginBottom = '8px';

        vitaminRegionSelect = document.createElement('select');
        populateVitaminRegionSelect();
        const regionControl = createSearchableSelect(vitaminRegionSelect, {
            placeholder: 'Search regions...'
        });
        vitaminRegionSelect.addEventListener('change', () => {
            selectedVitaminRegion = Number(vitaminRegionSelect.value);
            localStorage.setItem(
                VITAMIN_REGION_STORAGE_KEY,
                String(selectedVitaminRegion)
            );
            vitaminScanId++;
            vitaminResults = [];
            vitaminHasScanned = false;
            updateVitaminUI();
        });

        vitaminPokemonSelect = document.createElement('select');
        populateVitaminPokemonSelect();
        const pokemonControl = createSearchableSelect(vitaminPokemonSelect, {
            placeholder: 'Search owned Pokemon...',
            noResultsText: 'No owned Pokemon match'
        });
        vitaminPokemonSelect.addEventListener('change', () => {
            selectedVitaminPokemon =
                vitaminPokemonByValue.get(vitaminPokemonSelect.value) || null;
            updateSelectedVitaminUI();
        });

        vitaminPokemonDetailsText = document.createElement('div');
        vitaminSummaryText = document.createElement('div');
        Object.assign(vitaminSummaryText.style, {
            marginTop: '10px',
            marginBottom: '10px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.2)'
        });
        vitaminResultsText = document.createElement('div');

        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Refresh Tracker';
        refreshButton.className =
            'pkh-button pkh-button-primary pkh-full-button';
        Object.assign(refreshButton.style, {
            width: '100%',
            border: 'none',
            borderRadius: '4px',
            padding: '7px',
            marginTop: '8px',
            cursor: 'pointer'
        });
        refreshButton.addEventListener('click', event => {
            event.stopPropagation();
            vitaminResultsText.textContent = 'Calculating...';
            setTimeout(scanVitaminEfficiency, 0);
        });

        vitaminPanel.appendChild(title);
        vitaminPanel.appendChild(createFieldLabel('Target Region', regionControl));
        vitaminPanel.appendChild(createFieldLabel('Pokemon', pokemonControl));
        vitaminPanel.appendChild(vitaminPokemonDetailsText);
        vitaminPanel.appendChild(vitaminSummaryText);
        vitaminPanel.appendChild(vitaminResultsText);
        vitaminPanel.appendChild(refreshButton);

        vitaminHeaderButton.addEventListener('click', () => {
            const opening = vitaminPanel.style.display === 'none';
            vitaminPanel.style.display = opening ? 'block' : 'none';
            if (opening) {
                populateVitaminRegionSelect();
                populateVitaminPokemonSelect();
                updateVitaminUI();
            }
        });

        updateVitaminUI();
        return {
            header: vitaminHeaderButton,
            panel: vitaminPanel,
            refresh() {
                populateVitaminRegionSelect();
                populateVitaminPokemonSelect();
                updateVitaminUI();
            }
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

    function setFeatureEnabled(
        name,
        value,
        allowEnable = false
    ) {
        if (!(name in featureSettings)) {
            return;
        }

        if (
            value &&
            !featureSettings[name] &&
            !allowEnable
        ) {
            return;
        }

        if (
            name === 'advancedHatching' &&
            value &&
            !featureSettings.autoHatching
        ) {
            return;
        }

        if (
            name === 'advancedDungeon' &&
            value &&
            !featureSettings.autoDungeon
        ) {
            return;
        }

        featureSettings[name] =
            Boolean(value);
        localStorage.setItem(
            FEATURE_STORAGE_KEYS[name],
            String(
                featureSettings[name]
            )
        );

        if (
            name === 'autoDungeon' &&
            !featureSettings.autoDungeon &&
            foregroundJob?.id ===
                'dungeon'
        ) {
            stopForegroundJob(
                'Auto Dungeon was disabled.'
            );
        }

        if (
            name === 'advancedDungeon' &&
            !featureSettings.advancedDungeon &&
            foregroundJob?.id ===
                'dungeon' &&
            foregroundJob.navigationMode !==
                'default'
        ) {
            foregroundJob.navigationMode =
                'default';
            foregroundJob.currentObjective =
                'default exploration';
            foregroundJob.failedMoves
                ?.clear();
            foregroundJob
                .unreachableObjectives
                ?.clear();
        }

        if (
            name === 'autoFarm' &&
            !featureSettings.autoFarm &&
            farmerJob
        ) {
            stopFarmer(
                'Auto Farm was disabled.'
            );
        }

        updateFeatureUI();
        updateAutomationUI();

        if (
            (
                name ===
                    'autoHatching' ||
                name ===
                    'advancedHatching'
            ) &&
            featureSettings.autoHatching
        ) {
            runAutoHatch();
        }
    }

    function setHatchMode(mode) {
        if (!HATCH_MODES.includes(mode)) {
            return;
        }

        hatchMode = mode;
        localStorage.setItem(
            HATCH_MODE_STORAGE_KEY,
            hatchMode
        );

        if (mode === 'off') {
            setFeatureEnabled(
                'autoHatching',
                false
            );
            return;
        }

        setFeatureEnabled(
            'autoHatching',
            true
        );

        if (
            mode === 'pokerus' ||
            mode === 'mega'
        ) {
            setFeatureEnabled(
                'advancedHatching',
                true
            );
            const remaining =
                breedingPriority.filter(
                    strategy =>
                        strategy !== mode &&
                        strategy !== 'off'
                );
            breedingPriority = [
                mode,
                ...remaining,
                'off'
            ];
            localStorage.setItem(
                BREEDING_PRIORITY_STORAGE_KEY,
                JSON.stringify(
                    breedingPriority
                )
            );
            renderBreedingPriorityViews();
        }
    }

    // ============================================================
    // Controls
    // ============================================================

    function createControls() {
        if (!document.getElementById('pkh-styles')) {
            const style = document.createElement('style');
            style.id = 'pkh-styles';
            style.textContent = HELPER_STYLES;
            document.head.appendChild(style);
        }

        const container = document.createElement('div');
        container.id = 'pkh-root';

        const vitaminControls = createVitaminPanel();
        const typeFarmControls = createTypeFarmPanel();
        const gemControls = createGemPanel();
        const dtControls = createDungeonTokenPanel();
        const farmerControls = createAutoFarmerPanel();
        const dungeonControls = createAutoDungeonPanel();

        addGoalExecutionControls(
            dtControls.panel,
            {
                id: 'dt',
                modes: [
                    ['finite', 'Gain X DT'],
                    ['owned', 'Reach X DT owned'],
                    ['indefinite', 'Run indefinitely']
                ],
                defaultTarget: '1000',
                start: startDungeonTokenAutomation
            }
        );

        addGoalExecutionControls(
            gemControls.panel,
            {
                id: 'gem',
                modes: [
                    ['finite', 'Gain X selected gems'],
                    ['owned', 'Reach X selected gems owned'],
                    ['indefinite', 'Run indefinitely']
                ],
                defaultTarget: '1000',
                start: startGemFarmAutomation
            }
        );

        addGoalExecutionControls(
            typeFarmControls.panel,
            {
                id: 'type',
                finiteLabel: 'Catch X selected-type Pokémon',
                defaultTarget: '500',
                start: startTypeFarmAutomation
            }
        );

        const decorateTitle = title => {
            title.classList.add(
                'pkh-card-title'
            );
        };

        const prepareCard = (
            panel,
            sectionKey = ''
        ) => {
            panel.classList.add(
                'pkh-card'
            );
            Object.assign(
                panel.style,
                {
                    display: 'block',
                    position: 'static',
                    left: 'auto',
                    top: 'auto',
                    right: 'auto',
                    bottom: 'auto',
                    width: '100%',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    overflow: 'visible',
                    margin: '0 0 10px',
                    padding: '11px',
                    background: '',
                    border: '',
                    borderRadius: '',
                    boxShadow: ''
                }
            );

            const title =
                panel.firstElementChild;
            if (!title) {
                return panel;
            }

            decorateTitle(
                title
            );

            const key =
                sectionKey ||
                title.textContent
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9]+/g,
                        '-'
                    )
                    .replace(
                        /(^-|-$)/g,
                        ''
                    );
            const content =
                document.createElement(
                    'div'
                );
            content.className =
                'pkh-card-content';

            while (
                title.nextSibling
            ) {
                content.appendChild(
                    title.nextSibling
                );
            }

            panel.appendChild(content);

            const state =
                document.createElement(
                    'span'
                );
            state.className =
                'pkh-card-state';
            state.style.display =
                'none';

            const indicator =
                document.createElement(
                    'span'
                );
            indicator.className =
                'pkh-collapse-indicator';

            title.appendChild(state);
            title.appendChild(indicator);
            title.tabIndex = 0;
            title.setAttribute(
                'role',
                'button'
            );

            const applyCollapsed =
                collapsed => {
                    panel.classList
                        .toggle(
                            'is-collapsed',
                            collapsed
                        );
                    indicator
                        .textContent =
                        collapsed
                            ? '+'
                            : '-';
                    title.setAttribute(
                        'aria-expanded',
                        String(
                            !collapsed
                        )
                    );
                };

            const toggle = () => {
                const collapsed =
                    !panel.classList
                        .contains(
                            'is-collapsed'
                        );
                collapsedSections[key] =
                    collapsed;
                localStorage.setItem(
                    COLLAPSED_SECTIONS_STORAGE_KEY,
                    JSON.stringify(
                        collapsedSections
                    )
                );
                applyCollapsed(
                    collapsed
                );
            };

            title.addEventListener(
                'click',
                toggle
            );
            title.addEventListener(
                'keydown',
                event => {
                    if (
                        event.key ===
                            'Enter' ||
                        event.key ===
                            ' '
                    ) {
                        event
                            .preventDefault();
                        toggle();
                    }
                }
            );

            applyCollapsed(
                collapsedSections[key] ===
                    true
            );
            collapsibleCardHeaders[key] = {
                panel,
                title,
                state
            };

            return panel;
        };

        const createCard = (
            titleText,
            sectionKey
        ) => {
            const card =
                document.createElement(
                    'div'
                );
            const title =
                document.createElement(
                    'div'
                );
            title.textContent =
                titleText;
            card.appendChild(title);
            return prepareCard(
                card,
                sectionKey
            );
        };

        const createSetting = (labelText, control) => {
            const row = document.createElement('label');
            row.className = 'pkh-setting';
            const label = document.createElement('span');
            label.className = 'pkh-setting-label';
            label.textContent = labelText;
            row.appendChild(label);
            row.appendChild(control);
            return row;
        };

        const createNote = text => {
            const note = document.createElement('div');
            note.className = 'pkh-note';
            note.textContent = text;
            return note;
        };

        const createBrandBall = () => {
            const ball = document.createElement('span');
            ball.className = 'pkh-brand-ball';
            ball.setAttribute('aria-hidden', 'true');
            return ball;
        };

        const mainPanel = document.createElement('div');
        mainPanel.className = 'pkh-shell';
        mainPanel.style.display = 'none';
        mainPanel.setAttribute('role', 'dialog');
        mainPanel.setAttribute('aria-label', 'PokéClicker Helper');

        const header = document.createElement('div');
        header.className = 'pkh-header';
        const heading = document.createElement('div');
        heading.className = 'pkh-brand';
        heading.appendChild(createBrandBall());
        const headingText = document.createElement('span');
        headingText.textContent = 'PokéClicker Helper';
        heading.appendChild(headingText);
        const version = document.createElement('span');
        version.className = 'pkh-version';
        version.textContent = 'v8.0.1';
        const closeButton = document.createElement('button');
        closeButton.className = 'pkh-close';
        closeButton.type = 'button';
        closeButton.textContent = '×';
        closeButton.setAttribute('aria-label', 'Close PokéClicker Helper');
        header.appendChild(heading);
        header.appendChild(version);
        header.appendChild(closeButton);

        const automationStatusPanel = createAutomationStatusPanel();

        const tabs = document.createElement('div');
        tabs.className = 'pkh-tabs';
        tabs.setAttribute('role', 'tablist');
        const contentViewport = document.createElement('div');
        contentViewport.className = 'pkh-scroll';

        const tabNames = [
            'Dashboard',
            'Farms',
            'Dungeon',
            'Breeding',
            'Features'
        ];
        const tabButtons = {};
        const tabContents = {};

        for (const tabName of tabNames) {
            const button =
                document.createElement(
                    'button'
                );
            button.className =
                'pkh-tab';
            button.type = 'button';
            button.textContent = tabName;
            button.title = tabName;
            button.setAttribute(
                'role',
                'tab'
            );
            tabs.appendChild(button);
            tabButtons[tabName] =
                button;

            const content =
                document.createElement(
                    'div'
                );
            content.style.display =
                'none';
            content.dataset.helperTab =
                tabName;
            content.setAttribute(
                'role',
                'tabpanel'
            );
            contentViewport
                .appendChild(content);
            tabContents[tabName] =
                content;
        }

        const createFeaturePreference = (
            label,
            name,
            description
        ) => {
            const group =
                document.createElement(
                    'div'
                );
            group.appendChild(
                createSetting(
                    label,
                    createFeatureToggleButton(
                        name,
                        true
                    )
                )
            );
            const help =
                document.createElement(
                    'div'
                );
            help.className =
                'pkh-feature-description';
            help.textContent =
                description;
            group.appendChild(help);
            return group;
        };

        const dashboardAutomationCard =
            createCard(
                'Automation Summary',
                'dashboard-automation'
            );
        dashboardAutomationStatusText =
            document.createElement(
                'div'
            );
        dashboardAutomationStatusText
            .style.whiteSpace =
            'pre-line';
        dashboardAutomationStopButton =
            document.createElement(
                'button'
            );
        dashboardAutomationStopButton
            .textContent =
            'Stop Automation';
        dashboardAutomationStopButton
            .className =
            'pkh-button pkh-button-danger pkh-full-button';
        dashboardAutomationStopButton
            .addEventListener(
                'click',
                stopAllAutomation
            );
        dashboardAutomationCard
            .appendChild(
                dashboardAutomationStatusText
            );
        dashboardAutomationCard
            .appendChild(
                dashboardAutomationStopButton
            );

        const dashboardSettingsCard =
            createCard(
                'Quick Controls',
                'dashboard-quick-controls'
            );
        clickButton =
            document.createElement(
                'button'
            );
        clickButton.type = 'button';
        clickButton.className =
            'pkh-toggle';
        clickButton.addEventListener(
            'click',
            () =>
                setAutoClick(
                    !autoClickEnabled
                )
        );
        dashboardSettingsCard
            .appendChild(
                createSetting(
                    'Auto Click',
                    clickButton
                )
            );
        dashboardSettingsCard
            .appendChild(
                createSetting(
                    'Auto Hatching',
                    createFeatureToggleButton(
                        'autoHatching'
                    )
                )
            );

        const dashboardStatusCard =
            createCard(
                'Quick Status',
                'dashboard-status'
            );
        dashboardQuickStatusText =
            document.createElement(
                'div'
            );
        dashboardStatusCard
            .appendChild(
                dashboardQuickStatusText
            );

        tabContents.Dashboard
            .appendChild(
                dashboardAutomationCard
            );
        tabContents.Dashboard
            .appendChild(
                dashboardSettingsCard
            );
        tabContents.Dashboard
            .appendChild(
                dashboardStatusCard
            );

        tabContents.Farms.appendChild(
            prepareCard(
                dtControls.panel,
                'farms-dungeon-tokens'
            )
        );
        tabContents.Farms.appendChild(
            prepareCard(
                gemControls.panel,
                'farms-gems'
            )
        );
        tabContents.Farms.appendChild(
            prepareCard(
                typeFarmControls.panel,
                'farms-type'
            )
        );
        tabContents.Farms.appendChild(
            prepareCard(
                farmerControls.panel,
                'farms-auto-farmer'
            )
        );

        tabContents.Dungeon
            .appendChild(
                prepareCard(
                    dungeonControls.panel,
                    'dungeon-runner'
                )
            );
        dungeonControls.panel
            .appendChild(
                createNote(
                    'Uses normal Dungeon Token costs, starts the game timer through ordinary movement, and stops after a lost run.'
                )
            );

        const hatchSettingsCard =
            createCard(
                'Hatch Settings',
                'breeding-hatch-settings'
            );
        hatchSettingsCard
            .appendChild(
                createSetting(
                    'Auto Hatching',
                    createFeatureToggleButton(
                        'autoHatching'
                    )
                )
            );
        hatchSettingsCard
            .appendChild(
                createSetting(
                    'Advanced Strategies',
                    createFeatureToggleButton(
                        'advancedHatching'
                    )
                )
            );

        const priorityHeading =
            document.createElement(
                'div'
            );
        priorityHeading.className =
            'pkh-subheading';
        priorityHeading.textContent =
            'Breeding priority';
        hatchSettingsCard
            .appendChild(
                priorityHeading
            );
        hatchSettingsCard
            .appendChild(
                createBreedingPriorityControl()
            );
        hatchSettingsCard
            .appendChild(
                createNote(
                    'Uncaught Type Eggs always fill free slots first. Custom follows the custom hatchery settings configured in Pok\u00e9Clicker. None is the fixed terminal fallback.'
                )
            );

        tabContents.Breeding
            .appendChild(
                hatchSettingsCard
            );
        tabContents.Breeding
            .appendChild(
                prepareCard(
                    vitaminControls.panel,
                    'breeding-vitamin-tracker'
                )
            );

        const optionalHatchingCard =
            createCard(
                'Hatching',
                'features-hatching'
            );
        optionalHatchingCard
            .appendChild(
                createFeaturePreference(
                    'Auto Hatching',
                    'autoHatching',
                    'Enables Type Egg priority and the Custom strategy based on your current Pok\u00e9Clicker hatchery filters.'
                )
            );
        optionalHatchingCard
            .appendChild(
                createFeaturePreference(
                    'Advanced Hatching Strategies',
                    'advancedHatching',
                    'Unlocks Pok\u00e9rus and Mega strategies. Requires Auto Hatching.'
                )
            );

        const optionalDungeonCard =
            createCard(
                'Dungeons',
                'features-dungeons'
            );
        optionalDungeonCard
            .appendChild(
                createFeaturePreference(
                    'Auto Dungeon',
                    'autoDungeon',
                    'Enables manual-style Default Pathing and dungeon run goals.'
                )
            );
        optionalDungeonCard
            .appendChild(
                createFeaturePreference(
                    'Advanced Dungeon Pathing',
                    'advancedDungeon',
                    'Unlocks objective-driven BFS modes and visible chest-rarity detours. Requires Auto Dungeon.'
                )
            );

        const optionalFarmCard =
            createCard(
                'Farming',
                'features-farming'
            );
        optionalFarmCard
            .appendChild(
                createFeaturePreference(
                    'Auto Farm',
                    'autoFarm',
                    'Enables the plot-managing Auto Farmer. Route, gem, and type optimizers remain separate.'
                )
            );

        tabContents[
            'Features'
        ].appendChild(
            optionalHatchingCard
        );
        tabContents[
            'Features'
        ].appendChild(
            optionalDungeonCard
        );
        tabContents[
            'Features'
        ].appendChild(
            optionalFarmCard
        );

        let selectedTab = localStorage.getItem(HELPER_TAB_STORAGE_KEY);
        if (selectedTab === 'Optional Features') {
            selectedTab = 'Features';
        }
        if (!tabNames.includes(selectedTab)) {
            selectedTab = 'Dashboard';
        }
        const selectTab = tabName => {
            selectedTab = tabName;
            localStorage.setItem(HELPER_TAB_STORAGE_KEY, tabName);
            for (const name of tabNames) {
                const selected = name === tabName;
                tabContents[name].style.display = selected ? 'block' : 'none';
                tabButtons[name].classList.toggle('is-active', selected);
                tabButtons[name].setAttribute('aria-selected', String(selected));
            }
            if (tabName === 'Farms') {
                farmerControls.refresh();
            } else if (tabName === 'Dungeon') {
                dungeonControls.refresh();
            } else if (tabName === 'Breeding') {
                vitaminControls.refresh();
            }
        };
        for (const tabName of tabNames) {
            tabButtons[tabName].addEventListener('click', () => selectTab(tabName));
        }
        selectTab(selectedTab);

        helperLauncherButton = document.createElement('button');
        styleMainButton(helperLauncherButton);
        helperLauncherButton.classList.add('pkh-launcher');
        helperLauncherButton.type = 'button';
        helperLauncherButton.appendChild(createBrandBall());
        const launcherText = document.createElement('span');
        launcherText.textContent = 'Helper';
        helperLauncherButton.appendChild(launcherText);
        helperLauncherButton.addEventListener('click', () => {
            const opening = mainPanel.style.display === 'none';
            mainPanel.style.display = opening ? 'flex' : 'none';
            helperLauncherButton.setAttribute('aria-expanded', String(opening));
            if (opening) {
                selectTab(selectedTab);
            }
        });
        helperLauncherButton.setAttribute('aria-expanded', 'false');
        closeButton.addEventListener('click', () => {
            mainPanel.style.display = 'none';
            helperLauncherButton.setAttribute('aria-expanded', 'false');
        });

        mainPanel.appendChild(header);
        mainPanel.appendChild(automationStatusPanel);
        mainPanel.appendChild(tabs);
        mainPanel.appendChild(contentViewport);
        container.appendChild(mainPanel);
        container.appendChild(helperLauncherButton);
        document.body.appendChild(container);

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
            featureSettings.autoHatching
        ) {
            runAutoHatch();
        }

        console.log(
            '[My PokéClicker Automation v8.0.1] Loaded'
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

                        typeof ItemList !==
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