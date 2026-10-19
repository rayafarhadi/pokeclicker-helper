    // ============================================================
    // State
    // ============================================================

    let theoreticalResults = [];
    let dtScenarioResults = {
        currentSettings: [],
        ultraAll: []
    };
    let dtHasScanned = false;
    let gemResults = [];
    let typeFarmResults = [];
    let typeFarmScenarioResults = {
        currentSettings: [],
        ultraAll: [],
        ultraTargetOnly: []
    };
    let typeFarmHasScanned = false;
    let vitaminResults = [];
    let vitaminHasScanned = false;
    let vitaminScanId = 0;

    let dtHistory = [];
    let currentMeasuredRouteKey = null;
    let currentMeasuredRouteName = null;

    let bestMeasuredRate = 0;
    let bestMeasuredRoute = null;
