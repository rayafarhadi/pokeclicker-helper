    // ============================================================
    // Start
    // ============================================================

    function start() {
        createControls();

        setInterval(
            runAutoClick,
            CLICK_INTERVAL
        );

        setInterval(
            runAutoHatch,
            HATCH_INTERVAL
        );

        setInterval(
            updateDungeonTokenBenchmark,
            DT_SAMPLE_INTERVAL
        );

        setInterval(
            runAutomationTick,
            AUTOMATION_INTERVAL
        );

        if (
            featureSettings.autoHatching
        ) {
            runAutoHatch();
        }

        console.log(
            '[My PokéClicker Automation v8.0.3] Loaded'
        );
    }
