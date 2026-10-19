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
