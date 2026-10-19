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
