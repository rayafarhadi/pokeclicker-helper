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
