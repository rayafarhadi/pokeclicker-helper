    // ============================================================
    // UI references
    // ============================================================

    let clickButton = null;
    const featureToggleButtons = {
        autoHatching: [],
        advancedHatching: [],
        autoDungeon: [],
        advancedDungeon: [],
        autoFarm: []
    };
    const breedingPriorityViews = [];
    const collapsibleCardHeaders = {};
    let helperLauncherButton = null;
    let dungeonNavigationSelect = null;
    let dungeonAdvancedControls = null;
    let dungeonRewardInfo = null;
    let dungeonCollectionInfo = null;
    let dungeonStartButton = null;
    let farmerStartButton = null;

    let dtHeaderButton = null;
    let dtPanel = null;
    let dtSuggestedText = null;
    let dtCurrentText = null;
    let dtRateText = null;
    let dtBestText = null;
    let dtSampleText = null;
    let dtStrategyText = null;

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

    let vitaminHeaderButton = null;
    let vitaminPanel = null;
    let vitaminRegionSelect = null;
    let vitaminPokemonSelect = null;
    let vitaminPokemonDetailsText = null;
    let selectedVitaminPokemon = null;
    let vitaminPokemonByValue = new Map();
    let vitaminSummaryText = null;
    let vitaminResultsText = null;
