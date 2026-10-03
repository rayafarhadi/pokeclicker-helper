// ==UserScript==
// @name         My PokéClicker Automation
// @namespace    raya-pokeclicker
// @version      5.0
// @description  Auto clicker, auto hatchery, Dungeon Token optimizer, type-catch quest optimizer, gem optimizer and live DT/min benchmarking.
// @match        https://www.pokeclicker.com/*
// @match        https://pokeclicker.com/*
// @grant        none
// @sandbox      raw
// @run-at       document-idle
// @noframes
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

    let autoClickEnabled =
        localStorage.getItem(CLICK_STORAGE_KEY) === 'true';

    const HATCH_MODES = [
        'default',
        'pokerus',
        'off'
    ];

    let hatchMode =
        localStorage.getItem(HATCH_MODE_STORAGE_KEY);

    // Migrate the old ON/OFF setting.
    if (!HATCH_MODES.includes(hatchMode)) {
        const oldSetting =
              localStorage.getItem('myAutoHatchEnabled');

        hatchMode =
            oldSetting === 'false'
            ? 'off'
        : 'default';
    }

    const TYPE_FARM_STORAGE_KEY = 'myTypeFarmType';

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
        localStorage.getItem(TYPE_FARM_STORAGE_KEY) ?? PokemonType.Fairy
    );

    if (!TYPE_FARM_TYPES.includes(typeFarmType)) {
        typeFarmType = PokemonType.Fairy;
    }

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

    // ============================================================
    // Dungeon Token benchmark state
    // ============================================================

    let theoreticalResults = [];

    let dtHistory = [];
    let currentMeasuredRouteKey = null;
    let currentMeasuredRouteName = null;

    let bestMeasuredRate = 0;
    let bestMeasuredRoute = null;

    let typeFarmResults = [];

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

        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function getRegionName(region) {
        try {
            return capitalize(GameConstants.Region[region]);
        } catch {
            return `Region ${region}`;
        }
    }

    function getCurrentRouteInfo() {
        try {
            const region = player.region;
            const routeNumber = player.route;

            const route = Routes.getRoute(
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
                key: `${region}:${routeNumber}`,
                name: route.routeName
            };

        } catch {
            console.error(
                '[DT Benchmark] Could not determine current route'
            );
        }
    }

    function getDungeonTokens() {
        try {
            /*
             * Current save format stores Dungeon Tokens as currency
             * index 2. We also check the enum in case the name is
             * available.
             */
            let index = 2;

            if (
                GameConstants.Currency &&
                GameConstants.Currency.dungeonTokens !== undefined
            ) {
                index = GameConstants.Currency.dungeonTokens;
            } else if (
                GameConstants.Currency &&
                GameConstants.Currency.dungeonToken !== undefined
            ) {
                index = GameConstants.Currency.dungeonToken;
            }

            const currency =
                App.game.wallet.currencies[index];

            if (typeof currency === 'function') {
                return currency();
            }

            if (typeof ko !== 'undefined') {
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

    // ============================================================
    // Auto Clicker
    // ============================================================

    function attackIfAlive(battleClass) {
        const enemy = battleClass.enemyPokemon?.();

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
                    attackIfAlive(TemporaryBattleBattle);
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
                  GameConstants.EggItemType[eggType];

            const amount =
                  player.itemList[eggName]?.() ?? 0;

            if (amount <= 0) {
                continue;
            }

            const status =
                  App.game.breeding
            .getTypeCaughtStatus(eggType);

            if (status === CaughtStatus.NotCaught) {
                return App.game.breeding
                    .addEggItemToHatchery(eggType);
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
            type !== PokemonType.None &&
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
                GameConstants.Pokerus.Contagious
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
                GameConstants.Pokerus.Contagious
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
                GameConstants.Pokerus.Uninfected
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

            // Prefer dual types.
            if (types.length === 2) {
                score += 100;
            }

            // Strongly prefer a Pokémon that
            // gives us access to a new type.
            if (
                types.some(
                    type =>
                    !contagiousTypes.has(type)
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

        // Find usable contagious/resistant Pokémon.
        for (
            const pokemon of
            App.game.party.caughtPokemon
        ) {
            if (
                pokemon.breeding ||
                pokemon.level < 100 ||
                pokemon.pokerus <
                GameConstants.Pokerus.Contagious
            ) {
                continue;
            }

            for (
                const type of
                getPokemonTypes(pokemon)
            ) {
                if (!seedsByType.has(type)) {
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
                  seedsByType.has(type)
              );

        if (sharedType === undefined) {
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

        /*
     * First see whether a contagious Pokémon
     * is ALREADY in the active Hatchery.
     *
     * If so, we only need to add a target.
     */
        const activeTypes =
              getActiveContagiousTypes();

        if (activeTypes.size) {
            const target =
                  findBestPokerusTarget(
                      activeTypes
                  );

            if (target) {
                return App.game.breeding
                    .addPokemonToHatchery(
                    target
                )
                    ? 'added'
                : 'none';
            }
        }

        /*
     * Otherwise we need TWO active slots:
     * contagious seed + uninfected target.
     */
        const pair =
              findBestPokerusPair();

        if (!pair) {
            return 'none';
        }

        if (freeSlots < 2) {
            // Intentionally leave this slot empty.
            // Once another egg finishes we'll have
            // room for the pair.
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
            // Hatch completed eggs.
            for (
                let i =
                App.game.breeding.eggSlots - 1;
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
                // --------------------------------
                // Pokérus mode
                // --------------------------------

                if (
                    hatchMode === 'pokerus'
                ) {
                    const result =
                          tryPokerusSpread();

                    if (
                        result === 'added'
                    ) {
                        continue;
                    }

                    if (
                        result === 'wait'
                    ) {
                        /*
                     * A valid infection pair exists,
                     * but we need another active slot.
                     *
                     * Leave the slot empty rather than
                     * blocking it with another Pokémon.
                     */
                        break;
                    }

                    /*
                 * "none" means there is currently
                 * nobody useful left to infect.
                 *
                 * Fall through to normal breeding.
                 */
                }

                // --------------------------------
                // Uncaught type eggs
                // --------------------------------

                if (
                    tryUncaughtTypeEgg()
                ) {
                    continue;
                }

                // --------------------------------
                // Normal Breeding Efficiency
                // --------------------------------

                const pokemon =
                      BreedingController
                .hatcherySortedFilteredList()
                .find(
                    p => p.isHatchable()
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
    // Theoretical Dungeon Token optimizer
    // ============================================================

    function getRouteKills(route) {
        const stats = App.game.statistics.routeKills;

        const value =
              stats?.[route.region]?.[route.number] ??
              stats?.[GameConstants.Region[route.region]]?.[route.number];

        return typeof value === 'function'
            ? value()
        : Number(value ?? 0);
    }

    function getBallBonusForRoute(ballType, route, pokemon) {
        const ball =
              App.game.pokeballs.pokeballs[ballType];

        const options = {
            pokemon: pokemon.name,
            encounterType: EncounterType.route
        };

        switch (ballType) {
            case GameConstants.Pokeball.Quickball: {
                const kills = getRouteKills(route);

                return Math.min(
                    15,
                    Math.max(
                        0,
                        Math.pow(
                            16,
                            1 -
                            Math.pow(
                                Math.max(0, kills - 10),
                                0.6
                            ) / 145
                        ) - 1
                    )
                );
            }

            case GameConstants.Pokeball.Timerball: {
                const kills = getRouteKills(route);

                return Math.min(
                    15,
                    Math.max(
                        0,
                        Math.pow(
                            16,
                            Math.pow(kills, 0.6) / 250
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

                return environments.includes('Water')
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
                      routeData.pokemon.land.length > 0;

                const isWaterPokemon =
                      routeData.pokemon.water.includes(
                          pokemon.name
                      );

                return hasLandPokemon && isWaterPokemon
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
                          routes[routes.length - 1].number,
                          highestRegion
                      );

                const candidateRoute =
                      MapHelper.normalizeRoute(
                          route.number,
                          route.region
                      );

                return Math.min(
                    15,
                    Math.max(1, highestRegion) *
                    Math.max(
                        1,
                        maxRoute / candidateRoute
                    )
                );
            }

            default:
                return ball.catchBonus(options);
        }
    }

    function calculateRouteDTScore(route) {
        try {
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
                .getPokemonByName(name);

                // ----------------------------------------
                // HP / kill time
                // ----------------------------------------

                const health =
                      routeBaseHealth *
                      (
                          0.9 +
                          (
                              pokemon.hitpoints /
                              avgBaseHP
                          ) / 10
                      );

                const pokemonAttack =
                      App.game.party
                .calculatePokemonAttack(
                    pokemon.type1,
                    pokemon.type2,
                    false,
                    route.region,
                    false,
                    false,
                    undefined,
                    false,
                    true,
                    route.subRegion ?? 0
                );

                const clickAttack =
                      App.game.party
                .calculateClickAttack();

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

                const killTime =
                      Math.max(
                          CLICK_INTERVAL / 1000,
                          health / totalDPS
                      );

                // ----------------------------------------
                // Determine which ball YOUR filters
                // would actually use on this Pokémon
                // ----------------------------------------

                const ballType =
                      App.game.pokeballs
                .calculatePokeballToUse(
                    pokemon.id,
                    false, // normal, not shiny
                    false, // not shadow
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
                        GameConstants.clipNumber(
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

                // ----------------------------------------
                // Expected contribution of this encounter
                // ----------------------------------------

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

            // Expected Dungeon Tokens per second
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
                    Routes.getRoutesByRegion(region);

                for (const route of routes) {
                    if (!route.isUnlocked()) {
                        continue;
                    }

                    const result =
                        calculateRouteDTScore(route);

                    if (result) {
                        results.push(result);
                    }
                }
            }

            results.sort(
                (a, b) => b.score - a.score
            );

            theoreticalResults = results;

            updateDungeonTokenUI();

            console.group(
                '[Dungeon Token Optimizer] Top unlocked routes'
            );

            console.table(
                results
                    .slice(0, 10)
                    .map((result, index) => ({
                        Rank: index + 1,
                        Route: result.route.routeName,

                        Score:
                            result.score.toFixed(1),

                        'Tokens/Catch':
                            result.tokens.toFixed(0),

                        'Base Catchability':
                            `${(
                                result.catchability * 100
                            ).toFixed(1)}%`,

                        'Estimated Kill':
                            `${result.killTime.toFixed(3)}s`
                    }))
            );

            console.groupEnd();

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
    // Dungeon Tokens
    // ============================================================

    function resetCurrentDTSample() {
        dtHistory = [];
        currentMeasuredRouteKey = null;
        currentMeasuredRouteName = null;
    }

    function updateDungeonTokenBenchmark() {
        try {
            /*
             * Only measure while actually farming a normal route.
             *
             * This prevents gyms, dungeons, rivals, towns, etc.
             * from polluting the route benchmark.
             */
            if (
                App.game.gameState !==
                GameConstants.GameState.fighting
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

            if (!Number.isFinite(tokens)) {
                return;
            }

            const now =
                performance.now();

            /*
             * New route = new benchmark.
             */
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

            /*
             * If tokens decreased, the player probably spent some
             * on a dungeon. Reset rather than interpreting that as
             * negative farming.
             */
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

            /*
             * Keep slightly more than 60 seconds so timer jitter
             * doesn't prevent us from ever reaching a full sample.
             */
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
                        sample.time >= cutoff
                );

            /*
             * Once we have over 60 seconds, use the sample nearest
             * the start of the rolling 60-second window.
             */
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
                    const sample of dtHistory
                ) {
                    if (
                        sample.time >= targetTime
                    ) {
                        startSample = sample;
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
                        elapsedMs / 1000;

                    /*
                     * Only record "Best Seen" once the benchmark
                     * has a full stable sample.
                     */
                    if (
                        elapsedSeconds >=
                            DT_STABLE_SECONDS - 1 &&
                        rate > bestMeasuredRate
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
        if (dtHistory.length < 2) {
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
            const sample of dtHistory
        ) {
            if (
                sample.time >= targetTime
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
                elapsedMs / 1000
        };
    }

    // ============================================================
    // Gems
    // ============================================================

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
        localStorage.getItem('myGemFarmType') ?? 'Rock';

    let gemResults = [];

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

        // Single-type Pokémon give double gems.
        if (
            type1 === targetType &&
            (
                type2 === PokemonType.None ||
                type2 === undefined ||
                type2 === null
            )
        ) {
            return baseGems * 2;
        }

        return baseGems;
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
              (1000 / CLICK_INTERVAL);

        const totalDPS =
              Math.max(
                  1,
                  pokemonAttack + clickDPS
              );

        return Math.max(
            CLICK_INTERVAL / 1000,
            health / totalDPS
        );
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
                  GameConstants.getGymRegion(gymName);

            const subRegion =
                  TownList[gym.town]?.subRegion ?? 0;

            const pokemonList =
                  gym.getPokemonList();

            let totalGems = 0;
            let totalTime = 0;

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

                totalTime +=
                    estimateKillTime(
                    gymPokemon.maxHealth,
                    data.type1,
                    data.type2,
                    region,
                    subRegion
                );
            }

            if (totalGems <= 0) {
                return null;
            }

            const score =
                  totalGems /
                  Math.max(0.05, totalTime);

            const leader =
                  gym.leaderName ?? gymName;

            return {
                kind: 'Gym',
                name: leader,
                location: gymName,
                score,
                gemsPerMinute: score * 60
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

                          return (
                              sum +
                              data.hitpoints *
                              weights[index]
                          );
                      },
                      0
                  ) / totalWeight;

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
                    weight * gems;

                expectedTime +=
                    weight * time;
            }

            if (expectedGems <= 0) {
                return null;
            }

            const score =
                  expectedGems /
                  expectedTime;

            return {
                kind: 'Route',
                name: route.routeName,
                location: route.routeName,
                score,
                gemsPerMinute: score * 60
            };

        } catch {
            return null;
        }
    }

    function scanGemFarms() {
        const targetType =
              PokemonType[selectedGemType];

        const results = [];

        // -----------------------------
        // Unlocked gyms
        // -----------------------------

        for (
            const [gymName, gym]
            of Object.entries(GymList)
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

        // -----------------------------
        // Unlocked routes
        // -----------------------------

        const highestRegion =
              player.highestRegion();

        for (
            let region = 0;
            region <= highestRegion;
            region++
        ) {
            for (
                const route
                of Routes.getRoutesByRegion(region)
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

        console.table(
            results
            .slice(0, 10)
            .map((result, index) => ({
                Rank: index + 1,
                Type: result.kind,
                Location:
                result.kind === 'Gym'
                ? `${result.name} — ${result.location}`
                : result.location,
                'Est. Gems/min':
                result.gemsPerMinute
                .toFixed(0)
            }))
        );

        return results;
    }

    // ============================================================
    // Type Farm optimizer
    // ============================================================

    function getTypeFarmTypeName() {
        return PokemonType[typeFarmType] ?? 'Unknown';
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

                          return (
                              sum +
                              data.hitpoints *
                              weights[index]
                          );
                      },
                      0
                  ) / totalWeight;

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
                      PokemonHelper.getPokemonByName(
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
                              false, // normal, not shiny
                              false, // not shadow
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
                        GameConstants.clipNumber(
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

                // Time spent on every encounter matters, including
                // non-target Pokémon and catches triggered by your
                // current Poké Ball filters.
                expectedTime +=
                    encounterWeight *
                    (
                        killTime +
                        catchTime
                    );
            }

            if (targetEncounterRate <= 0) {
                return null;
            }

            const catchesPerSecond =
                  expectedTime > 0
                      ? expectedCatches /
                        expectedTime
                      : 0;

            return {
                route,
                score: catchesPerSecond,
                catchesPerMinute:
                    catchesPerSecond * 60,
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
                    Routes.getRoutesByRegion(region)
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

            typeFarmResults = results;

            updateTypeFarmUI();

            console.group(
                `[Type Farm Optimizer] ${getTypeFarmTypeName()} routes`
            );

            console.table(
                results
                    .slice(0, 10)
                    .map((result, index) => ({
                        Rank: index + 1,
                        Route: result.route.routeName,
                        'Est. catches/min':
                            result.catchesPerMinute
                                .toFixed(2),
                        'Target encounters':
                            `${(
                                result.targetEncounterRate *
                                100
                            ).toFixed(1)}%`,
                        'Target catch chance':
                            `${(
                                result.targetCatchChance *
                                100
                            ).toFixed(1)}%`
                    }))
            );

            console.groupEnd();

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
    // UI
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

    function updateClickButton() {
        clickButton.textContent =
            `Auto Click: ${
                autoClickEnabled
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

    function updateDungeonTokenUI() {
        if (!dtHeaderButton) {
            return;
        }

        // ------------------------------
        // Suggested route
        // ------------------------------

        const bestSuggestion =
            theoreticalResults[0];

        const suggestedName =
            bestSuggestion
                ? bestSuggestion.route.routeName
                : 'Not Scanned';

        dtHeaderButton.textContent =
            `DT Farm: ${suggestedName} ▾`;

        dtSuggestedText.textContent =
            `Suggested: ${suggestedName}`;

        // ------------------------------
        // Current route
        // ------------------------------

        dtCurrentText.textContent =
            `Current: ${
                currentMeasuredRouteName ??
                'Not farming a route'
            }`;

        // ------------------------------
        // Current rate
        // ------------------------------

        const current =
            getCurrentDTRate();

        if (
            current.seconds >= 2
        ) {
            dtRateText.textContent =
                `DT/min: ${formatNumber(
                    current.rate
                )}`;
        } else {
            dtRateText.textContent =
                'DT/min: —';
        }

        // ------------------------------
        // Sample confidence
        // ------------------------------

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
                )}s / ${DT_STABLE_SECONDS}s`;
        } else {
            dtSampleText.textContent =
                'Sample: Waiting';
        }

        // ------------------------------
        // Best measured
        // ------------------------------

        if (
            bestMeasuredRoute &&
            bestMeasuredRate > 0
        ) {
            dtBestText.innerHTML =
                `Best seen: <strong>${
                    formatNumber(
                        bestMeasuredRate
                    )
                } DT/min</strong><br>` +
                `${bestMeasuredRoute}`;
        } else {
            dtBestText.innerHTML =
                'Best seen: —';
        }
    }

    function updateGemUI() {
        if (!gemHeaderButton) {
            return;
        }

        const best =
              gemResults[0];

        if (!best) {
            gemHeaderButton.textContent =
                `Gem Farm: ${selectedGemType} — None ▾`;

            gemBestText.textContent =
                'No matching unlocked location';

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
        )} gems/min`;

        gemTopText.innerHTML =
            gemResults
            .slice(1, 5)
            .map(
            (result, index) => {
                const name =
                      result.kind === 'Gym'
                ? `${result.name} — ${result.location}`
                : result.location;

                return (
                    `${index + 2}. ${name}` +
                    ` — ${formatNumber(
                        result.gemsPerMinute
                    )}/min`
                );
            }
        )
            .join('<br>');
    }

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
                `Type Farm: ${typeName} — None ▾`;

            typeFarmBestText.textContent =
                'No matching unlocked route';

            typeFarmTopText.innerHTML = '';

            return;
        }

        typeFarmHeaderButton.textContent =
            `Type Farm: ${typeName} → ${best.route.routeName} ▾`;

        typeFarmBestText.innerHTML =
            `<strong>Best:</strong><br>` +
            `${best.route.routeName}<br>` +
            `Est. ${best.catchesPerMinute.toFixed(2)} catches/min<br>` +
            `Target encounters: ${(
                best.targetEncounterRate * 100
            ).toFixed(1)}%<br>` +
            `Target catch chance: ${(
                best.targetCatchChance * 100
            ).toFixed(1)}%`;

        typeFarmTopText.innerHTML =
            typeFarmResults
                .slice(1, 5)
                .map(
                    (result, index) =>
                        `${index + 2}. ${result.route.routeName}` +
                        ` — ${result.catchesPerMinute.toFixed(2)}/min`
                )
                .join('<br>');
    }

    function createTypeFarmPanel() {
        typeFarmHeaderButton =
            document.createElement('button');

        styleMainButton(
            typeFarmHeaderButton
        );

        typeFarmHeaderButton.style.background =
            '#fd7e14';

        typeFarmHeaderButton.textContent =
            `Type Farm: ${getTypeFarmTypeName()} — Scanning... ▾`;

        typeFarmPanel =
            document.createElement('div');

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
              document.createElement('div');

        title.textContent =
            'Type Farm';

        title.style.fontWeight =
            'bold';

        title.style.fontSize =
            '14px';

        title.style.marginBottom =
            '8px';

        typeFarmTypeSelect =
            document.createElement('select');

        Object.assign(
            typeFarmTypeSelect.style,
            {
                width: '100%',
                marginBottom: '10px'
            }
        );

        for (
            const type of TYPE_FARM_TYPES
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
                        typeFarmTypeSelect.value
                    );

                localStorage.setItem(
                    TYPE_FARM_STORAGE_KEY,
                    String(typeFarmType)
                );

                typeFarmResults = [];

                updateTypeFarmUI();

                setTimeout(
                    scanTypeCatchRoutes,
                    0
                );
            }
        );

        typeFarmBestText =
            document.createElement('div');

        typeFarmBestText.style.marginBottom =
            '8px';

        typeFarmTopText =
            document.createElement('div');

        typeFarmTopText.style.opacity =
            '0.85';

        const note =
              document.createElement('div');

        note.textContent =
            'Uses route encounters, current Poké Ball filters, catch odds and battle speed. Hatches are not included.';

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
              document.createElement('button');

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

        typeFarmPanel.appendChild(title);
        typeFarmPanel.appendChild(
            typeFarmTypeSelect
        );
        typeFarmPanel.appendChild(
            typeFarmBestText
        );
        typeFarmPanel.appendChild(
            typeFarmTopText
        );
        typeFarmPanel.appendChild(note);
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

                typeFarmHeaderButton.textContent =
                    typeFarmHeaderButton.textContent
                        .replace(
                            opening ? '▾' : '▴',
                            opening ? '▴' : '▾'
                        );
            }
        );

        updateTypeFarmUI();

        return {
            header: typeFarmHeaderButton,
            panel: typeFarmPanel
        };
    }

    function createGemPanel() {
        gemHeaderButton =
            document.createElement('button');

        styleMainButton(
            gemHeaderButton
        );

        gemHeaderButton.style.background =
            '#6f42c1';

        gemPanel =
            document.createElement('div');

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
              document.createElement('div');

        title.textContent =
            'Gem Farm';

        title.style.fontWeight =
            'bold';

        title.style.fontSize =
            '14px';

        title.style.marginBottom =
            '8px';

        gemTypeSelect =
            document.createElement('select');

        Object.assign(
            gemTypeSelect.style,
            {
                width: '100%',
                marginBottom: '10px'
            }
        );

        for (
            const type
            of GEM_TYPES
        ) {
            const option =
                  document.createElement(
                      'option'
                  );

            option.value = type;
            option.textContent = type;

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
                    'myGemFarmType',
                    selectedGemType
                );

                scanGemFarms();
            }
        );

        gemBestText =
            document.createElement('div');

        gemBestText.style.marginBottom =
            '8px';

        gemTopText =
            document.createElement('div');

        gemTopText.style.opacity =
            '0.85';

        const rescanButton =
              document.createElement('button');

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
                scanGemFarms();
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
            header: gemHeaderButton,
            panel: gemPanel
        };
    }

    function createTextLine() {
        const div =
            document.createElement('div');

        Object.assign(
            div.style,
            {
                marginBottom: '5px'
            }
        );

        return div;
    }

    function createDungeonTokenPanel() {
        dtHeaderButton =
            document.createElement('button');

        styleMainButton(
            dtHeaderButton
        );

        dtHeaderButton.style.background =
            '#0d6efd';

        dtHeaderButton.textContent =
            'DT Farm: Scanning... ▾';

        dtPanel =
            document.createElement('div');

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
            document.createElement('div');

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
            document.createElement('div');

        Object.assign(
            buttonRow.style,
            {
                display: 'flex',
                gap: '5px',
                marginTop: '10px'
            }
        );

        const resetButton =
            document.createElement('button');

        resetButton.textContent =
            'Reset Best';

        const rescanButton =
            document.createElement('button');

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
        dtPanel.appendChild(dtSuggestedText);
        dtPanel.appendChild(dtCurrentText);
        dtPanel.appendChild(dtRateText);
        dtPanel.appendChild(dtSampleText);
        dtPanel.appendChild(dtBestText);
        dtPanel.appendChild(buttonRow);

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

                dtHeaderButton.textContent =
                    dtHeaderButton.textContent
                        .replace(
                            opening ? '▾' : '▴',
                            opening ? '▴' : '▾'
                        );
            }
        );

        return {
            header: dtHeaderButton,
            panel: dtPanel
        };
    }

    function setAutoClick(value) {
        autoClickEnabled = value;

        localStorage.setItem(
            CLICK_STORAGE_KEY,
            String(value)
        );

        updateClickButton();
    }

    function setHatchMode(mode) {
        hatchMode = mode;

        localStorage.setItem(
            HATCH_MODE_STORAGE_KEY,
            hatchMode
        );

        updateHatchButton();

        if (hatchMode !== 'off') {
            runAutoHatch();
        }
    }

    function cycleHatchMode() {
        const index =
              HATCH_MODES.indexOf(
                  hatchMode
              );

        const nextIndex =
              (index + 1) %
              HATCH_MODES.length;

        setHatchMode(
            HATCH_MODES[nextIndex]
        );
    }

    function createControls() {
        const container =
            document.createElement('div');

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

        const dtControls =
            createDungeonTokenPanel();

        const gemControls =
              createGemPanel();

        const typeFarmControls =
              createTypeFarmPanel();

        clickButton =
            document.createElement('button');

        hatchButton =
            document.createElement('button');

        styleMainButton(clickButton);
        styleMainButton(hatchButton);

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
        updateTypeFarmUI();
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

        if (hatchMode !== 'off') {
            runAutoHatch();
        }

        console.log(
            '[My PokéClicker Automation v5.0] Loaded'
        );
    }

    // ============================================================
    // Wait for PokéClicker
    // ============================================================

    const waitForGame =
        setInterval(() => {
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
        }, 500);

})();