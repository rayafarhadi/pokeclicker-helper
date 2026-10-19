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
