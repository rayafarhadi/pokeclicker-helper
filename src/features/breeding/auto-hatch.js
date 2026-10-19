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
