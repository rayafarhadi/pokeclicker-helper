    // ============================================================
    // Settings setters
    // ============================================================

    function setAutoClick(value) {
        autoClickEnabled =
            value;

        localStorage.setItem(
            CLICK_STORAGE_KEY,
            String(value)
        );

        updateClickButton();
    }

    function setFeatureEnabled(
        name,
        value,
        allowEnable = false
    ) {
        if (!(name in featureSettings)) {
            return;
        }

        if (
            value &&
            !featureSettings[name] &&
            !allowEnable
        ) {
            return;
        }

        if (
            name === 'advancedHatching' &&
            value &&
            !featureSettings.autoHatching
        ) {
            return;
        }

        if (
            name === 'advancedDungeon' &&
            value &&
            !featureSettings.autoDungeon
        ) {
            return;
        }

        featureSettings[name] =
            Boolean(value);
        localStorage.setItem(
            FEATURE_STORAGE_KEYS[name],
            String(
                featureSettings[name]
            )
        );

        if (
            name === 'autoDungeon' &&
            !featureSettings.autoDungeon &&
            foregroundJob?.id ===
                'dungeon'
        ) {
            stopForegroundJob(
                'Auto Dungeon was disabled.'
            );
        }

        if (
            name === 'advancedDungeon' &&
            !featureSettings.advancedDungeon &&
            foregroundJob?.id ===
                'dungeon' &&
            foregroundJob.navigationMode !==
                'default'
        ) {
            foregroundJob.navigationMode =
                'default';
            foregroundJob.currentObjective =
                'default exploration';
            foregroundJob.failedMoves
                ?.clear();
            foregroundJob
                .unreachableObjectives
                ?.clear();
        }

        if (
            name === 'autoFarm' &&
            !featureSettings.autoFarm &&
            farmerJob
        ) {
            stopFarmer(
                'Auto Farm was disabled.'
            );
        }

        updateFeatureUI();
        updateAutomationUI();

        if (
            (
                name ===
                    'autoHatching' ||
                name ===
                    'advancedHatching'
            ) &&
            featureSettings.autoHatching
        ) {
            runAutoHatch();
        }
    }

    function setHatchMode(mode) {
        if (!HATCH_MODES.includes(mode)) {
            return;
        }

        hatchMode = mode;
        localStorage.setItem(
            HATCH_MODE_STORAGE_KEY,
            hatchMode
        );

        if (mode === 'off') {
            setFeatureEnabled(
                'autoHatching',
                false
            );
            return;
        }

        setFeatureEnabled(
            'autoHatching',
            true
        );

        if (
            mode === 'pokerus' ||
            mode === 'mega'
        ) {
            setFeatureEnabled(
                'advancedHatching',
                true
            );
            const remaining =
                breedingPriority.filter(
                    strategy =>
                        strategy !== mode &&
                        strategy !== 'off'
                );
            breedingPriority = [
                mode,
                ...remaining,
                'off'
            ];
            localStorage.setItem(
                BREEDING_PRIORITY_STORAGE_KEY,
                JSON.stringify(
                    breedingPriority
                )
            );
            renderBreedingPriorityViews();
        }
    }
