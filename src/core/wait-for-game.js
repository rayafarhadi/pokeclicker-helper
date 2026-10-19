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
