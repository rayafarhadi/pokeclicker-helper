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
