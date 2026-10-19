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
