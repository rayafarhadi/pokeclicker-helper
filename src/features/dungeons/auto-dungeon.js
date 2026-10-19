
    function startAutoDungeon(
        dungeonName,
        navigationMode,
        goalMode,
        rawTarget,
        rawReserve
    ) {
        if (!featureSettings.autoDungeon) {
            failForegroundStart(
                'dungeon',
                'Enable Auto Dungeon in the Features tab.'
            );
            return;
        }

        stopForegroundJob('Replaced by Auto Dungeon');

        let target = null;
        if (goalMode !== 'allCaught') {
            try {
                target = requireFiniteTarget(goalMode, rawTarget);
            } catch (error) {
                failForegroundStart('dungeon', error.message);
                return;
            }
        }

        const reserve = Math.max(
            0,
            Math.floor(Number(rawReserve) || 0)
        );
        const town = TownList[dungeonName];
        const dungeon = town?.dungeon;

        if (
            !dungeon ||
            !town.isUnlocked?.() ||
            !dungeon.isUnlocked?.() ||
            !dungeon.hasUnlockedBoss?.()
        ) {
            failForegroundStart(
                'dungeon',
                'Select an unlocked dungeon.'
            );
            return;
        }
        if (
            typeof DungeonGuides !== 'undefined' &&
            DungeonGuides.hired?.()
        ) {
            failForegroundStart(
                'dungeon',
                'Dismiss the active Dungeon Guide so normal entry costs are used.'
            );
            return;
        }

        const collectionGoal = goalMode === 'allCaught';
        const initialCollection = getDungeonPokemonProgress(dungeon);

        if (collectionGoal && !initialCollection.missing.length) {
            completeForegroundStart(
                'dungeon',
                'All currently obtainable Pokémon in ' +
                dungeon.name +
                ' are already caught.'
            );
            return;
        }

        const advancedModes = new Set(['boss', 'chest', 'full']);
        const effectiveNavigation =
            featureSettings.advancedDungeon &&
            advancedModes.has(navigationMode)
                ? navigationMode
                : 'default';
        const initialClears = getDungeonClearCount(dungeon);
        const job = {
            id: 'dungeon',
            type: 'Auto Dungeon',
            needsClicks: true,
            dungeon,
            navigationMode: effectiveNavigation,
            target,
            reserve,
            collectionGoal,
            completedClears: 0,
            runStartClears: initialClears,
            runActive: false,
            finishAfterRun: false,
            failedMoves: new Map(),
            unreachableObjectives: new Set(),
            currentObjective: 'starting',
            detail: '',
            updateDetail() {
                const modeName = {
                    default: 'Default Pathing',
                    boss: 'Boss Rush',
                    chest: 'Chest Farm',
                    full: 'Full Clear'
                }[this.navigationMode];

                this.detail =
                    this.dungeon.name +
                    ' (' + modeName + ')' +
                    '\nObjective: ' +
                    this.currentObjective;

                if (this.collectionGoal) {
                    const progress = getDungeonPokemonProgress(
                        this.dungeon
                    );
                    this.detail +=
                        '\n' +
                        formatDungeonCollectionProgress(progress);

                    if (!progress.missing.length && this.runActive) {
                        this.finishAfterRun = true;
                    }
                } else {
                    this.detail +=
                        '\n' +
                        makeProgressText(
                            'Clears',
                            this.completedClears,
                            this.target
                        );
                }
            },
            start() {
                startDungeonAttempt(this);
                this.tick();
            },
            tick() {
                if (!featureSettings.autoDungeon) {
                    stopForegroundJob('Auto Dungeon was disabled.');
                    return;
                }

                if (
                    !featureSettings.advancedDungeon &&
                    this.navigationMode !== 'default'
                ) {
                    this.navigationMode = 'default';
                    this.currentObjective = 'default exploration';
                    this.failedMoves.clear();
                    this.unreachableObjectives.clear();
                }

                const clears = getDungeonClearCount(this.dungeon);

                if (
                    App.game.gameState ===
                    GameConstants.GameState.dungeon
                ) {
                    this.runActive = true;
                    this.updateDetail();
                    navigateDungeon(this);
                    return;
                }

                if (this.runActive) {
                    if (clears <= this.runStartClears) {
                        stopForegroundJob(
                            'The dungeon was lost or interrupted.'
                        );
                        return;
                    }
                    this.completedClears++;
                    this.runActive = false;
                }

                this.updateDetail();

                if (this.collectionGoal) {
                    const progress = getDungeonPokemonProgress(
                        this.dungeon
                    );

                    if (
                        this.finishAfterRun ||
                        !progress.missing.length
                    ) {
                        stopForegroundJob(
                            'Caught all currently obtainable Pokémon in ' +
                            this.dungeon.name +
                            '.',
                            true
                        );
                        return;
                    }
                } else if (
                    this.target !== null &&
                    this.completedClears >= this.target
                ) {
                    stopForegroundJob(
                        'Cleared ' +
                        this.dungeon.name +
                        ' ' +
                        formatNumber(this.completedClears) +
                        ' times.',
                        true
                    );
                    return;
                }

                startDungeonAttempt(this);
            }
        };

        activateForegroundJob(job);
    }

    function runAutomationTick() {
        try {
            runAutoFarmerTick();
        } catch (error) {
            console.error('[Auto Farmer]', error);
            stopFarmer(error?.message ?? 'Unexpected farming error.');
        }
        const job = foregroundJob;
        if (job) {
            try {
                job.tick();
            } catch (error) {
                console.error('[Automation] ' + job.type, error);
                stopForegroundJob(error?.message ?? 'Unexpected automation error.');
            }
        }
        updateAutomationUI();
    }
