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
