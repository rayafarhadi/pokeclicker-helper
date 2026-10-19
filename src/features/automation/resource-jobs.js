    // ============================================================
    // Automation manager and executors
    // ============================================================

    const executionViews = {};
    let foregroundJob = null;
    let foregroundLastStatus = 'Idle';
    let farmerJob = null;
    let farmerLastStatus = 'Idle';
    let automationStatusText = null;
    let automationStopButton = null;
    let dashboardAutomationStatusText = null;
    let dashboardAutomationStopButton = null;
    let dashboardQuickStatusText = null;
    let automationStatusDot = null;
    let farmerStatusText = null;
    let farmerHeaderButton = null;
    let dungeonHeaderButton = null;
    let dungeonSelect = null;

    function readObservable(value) {
        return typeof value === 'function' ? value() : Number(value);
    }

    function getCurrencyAmount(currencyType) {
        return Number(readObservable(App.game.wallet.currencies[currencyType]));
    }

    function getFarmPoints() {
        return getCurrencyAmount(GameConstants.Currency.farmPoint);
    }

    function getGemGainCount(type) {
        return Number(readObservable(App.game.statistics.gemsGained[type]));
    }

    function getGemBalance(type) {
        return Number(readObservable(App.game.gems.gemWallet[type]));
    }

    function isOwnedTargetMode(mode) {
        return mode === 'owned' ||
            mode === 'farmPointsOwned' ||
            mode === 'berriesOwned';
    }

    function getResourceGoalProgress(mode, current, baseline) {
        const amount = Number(current);
        if (!Number.isFinite(amount)) {
            return NaN;
        }
        if (isOwnedTargetMode(mode)) {
            return Math.max(0, amount);
        }
        return Math.max(0, amount - Number(baseline));
    }

    function getResourceGoalRemaining(mode, target, current, baseline) {
        if (target === null) {
            return null;
        }
        const progress = getResourceGoalProgress(
            mode,
            current,
            baseline
        );
        return Number.isFinite(progress)
            ? Math.max(0, target - progress)
            : NaN;
    }

    function getCapturedCountByType(type) {
        let total = 0;
        for (const [id, observable] of Object.entries(App.game.statistics.pokemonCaptured)) {
            if (id === 'highestID' || typeof observable !== 'function') {
                continue;
            }
            try {
                const pokemon = PokemonHelper.getPokemonById(Number(id));
                if (pokemon && (pokemon.type1 === type || pokemon.type2 === type)) {
                    total += Number(observable());
                }
            } catch {
                // Ignore obsolete save entries that have no current Pokemon data.
            }
        }
        return total;
    }

    function formatDuration(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) {
            return '';
        }
        if (seconds < 60) {
            return Math.ceil(seconds) + 's';
        }
        if (seconds < 3600) {
            return Math.ceil(seconds / 60) + 'm';
        }
        return (seconds / 3600).toFixed(1) + 'h';
    }

    function makeProgressText(label, progress, target, rate = 0) {
        const value = Math.max(0, Math.floor(progress));
        if (target === null) {
            return label + ': ' + formatNumber(value) + ' / Indefinite';
        }
        let text = label + ': ' + formatNumber(value) + ' / ' + formatNumber(target);
        if (rate > 0 && value < target) {
            text += ' (ETA ' + formatDuration((target - value) / rate * 60) + ')';
        }
        return text;
    }

    function updateCardRunningState(
        key,
        running,
        label = 'Running'
    ) {
        const card = collapsibleCardHeaders[key];
        if (!card) {
            return;
        }

        card.state.textContent = running ? label : '';
        card.state.style.display = running ? 'inline' : 'none';
    }

    function updateAutomationUI() {
        const activeDetails = [];
        if (foregroundJob) {
            activeDetails.push(foregroundJob.type + ': ' + foregroundJob.detail);
        }
        if (farmerJob) {
            activeDetails.push('Auto Farmer: ' + farmerJob.detail);
        }

        const active = Boolean(foregroundJob || farmerJob);
        const compactDetail = foregroundJob
            ? foregroundJob.type + ' • ' + foregroundJob.detail.replace(/\n/g, ' • ')
            : farmerJob
                ? 'Auto Farmer • ' + farmerJob.detail.replace(/\n/g, ' • ')
                : 'Automation: Idle';
        const summaryText = activeDetails.length
            ? activeDetails.join('\n')
            : 'No automation is currently running.\n' + foregroundLastStatus;

        if (automationStatusText) {
            automationStatusText.textContent = compactDetail;
        }
        if (dashboardAutomationStatusText) {
            dashboardAutomationStatusText.textContent = summaryText;
        }
        if (automationStatusDot) {
            automationStatusDot.classList.toggle('is-active', active);
        }
        for (const button of [
            automationStopButton,
            dashboardAutomationStopButton
        ]) {
            if (button) {
                button.disabled = !active;
            }
        }
        if (helperLauncherButton) {
            helperLauncherButton.classList.toggle('is-active', active);
            helperLauncherButton.title = active
                ? 'PokéClicker Helper — automation active'
                : 'Open PokéClicker Helper';
        }
        if (dashboardQuickStatusText) {
            const route = getCurrentRouteInfo();
            const town = typeof player.town === 'string'
                ? player.town
                : player.town?.name;
            const location = route?.name || town || getRegionName(player.region);
            const background = [
                farmerJob ? 'Auto Farmer' : '',
                featureSettings.autoHatching ? 'Auto Hatch' : ''
            ].filter(Boolean).join(', ') || 'Idle';
            dashboardQuickStatusText.innerHTML =
                '<div class="pkh-metric-row"><span>Location</span><strong>' +
                    location + '</strong></div>' +
                '<div class="pkh-metric-row"><span>Foreground</span><strong>' +
                    (foregroundJob?.type || 'Idle') + '</strong></div>' +
                '<div class="pkh-metric-row"><span>Background</span><strong>' +
                    background + '</strong></div>' +
                '<div class="pkh-metric-row"><span>Managed plots</span><strong>' +
                    (farmerJob?.owned?.size ?? '—') + '</strong></div>';
        }
        for (const [id, view] of Object.entries(executionViews)) {
            if (view.status) {
                view.status.textContent = foregroundJob?.id === id
                    ? foregroundJob.detail
                    : view.lastStatus;
            }
        }
        if (farmerStatusText) {
            farmerStatusText.textContent = farmerJob ? farmerJob.detail : farmerLastStatus;
        }
        if (farmerHeaderButton) {
            farmerHeaderButton.textContent = farmerJob
                ? 'Auto Farmer: ' + BerryType[farmerJob.berry] + ' (Running) ▾'
                : 'Auto Farmer ▾';
        }
        if (dungeonHeaderButton) {
            dungeonHeaderButton.textContent = foregroundJob?.id === 'dungeon'
                ? 'Auto Dungeon: ' + foregroundJob.dungeon.name + ' ▾'
                : 'Auto Dungeon ▾';
        }
        updateCardRunningState(
            'farms-auto-farmer',
            Boolean(farmerJob)
        );
        updateCardRunningState(
            'dungeon-runner',
            foregroundJob?.id === 'dungeon'
        );
        updateCardRunningState(
            'breeding-hatch-settings',
            featureSettings.autoHatching,
            'Enabled'
        );
    }

    function stopAllAutomation() {
        const hadActiveJob = Boolean(foregroundJob || farmerJob);
        if (foregroundJob) {
            stopForegroundJob();
        }
        if (farmerJob) {
            stopFarmer();
        }
        if (!hadActiveJob) {
            updateAutomationUI();
        }
    }

    function restoreJobAutoClick(job) {
        if (job?.autoClickChanged && autoClickEnabled !== job.autoClickBefore) {
            setAutoClick(job.autoClickBefore);
        }
    }

    function stopForegroundJob(reason = 'Stopped by user', completed = false) {
        const job = foregroundJob;
        if (!job) {
            foregroundLastStatus = reason;
            updateAutomationUI();
            return;
        }
        foregroundJob = null;
        try {
            job.cleanup?.();
        } catch (error) {
            console.error('[Automation] Cleanup failed', error);
        }
        restoreJobAutoClick(job);
        foregroundLastStatus = (completed ? 'Complete: ' : 'Stopped: ') + reason;
        if (executionViews[job.id]) {
            executionViews[job.id].lastStatus = foregroundLastStatus;
        }
        console.log('[Automation] ' + job.type + ': ' + foregroundLastStatus);
        updateAutomationUI();
    }

    function failForegroundStart(id, reason) {
        foregroundLastStatus = 'Could not start: ' + reason;
        if (executionViews[id]) {
            executionViews[id].lastStatus = foregroundLastStatus;
        }
        console.error('[Automation]', reason);
        updateAutomationUI();
    }

    function completeForegroundStart(id, reason) {
        foregroundLastStatus = 'Complete: ' + reason;
        if (executionViews[id]) {
            executionViews[id].lastStatus = foregroundLastStatus;
        }
        console.log('[Automation]', foregroundLastStatus);
        updateAutomationUI();
    }

    function activateForegroundJob(job) {
        if (foregroundJob) {
            stopForegroundJob('Replaced by ' + job.type);
        }
        job.startedAt = Date.now();
        job.autoClickBefore = autoClickEnabled;
        job.autoClickChanged = Boolean(job.needsClicks && !autoClickEnabled);
        foregroundJob = job;
        if (job.autoClickChanged) {
            setAutoClick(true);
        }
        try {
            job.start?.();
            updateAutomationUI();
        } catch (error) {
            console.error('[Automation] ' + job.type, error);
            stopForegroundJob(error?.message ?? 'Start failed');
        }
    }

    function isOnRoute(route) {
        return App.game.gameState === GameConstants.GameState.fighting &&
            player.region === route.region &&
            player.route === route.number;
    }

    function requireFiniteTarget(mode, target) {
        if (mode === 'indefinite') {
            return null;
        }
        const parsed = Math.floor(Number(target));
        if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error('Enter a target greater than zero.');
        }
        return parsed;
    }

    function estimateBallRequirements(
        result,
        remainingGoal
    ) {
        if (
            result?.expectedRewardPerEncounter ===
            undefined
        ) {
            return null;
        }

        const rewardPerEncounter =
            Number(
                result.expectedRewardPerEncounter
            );

        if (
            !Number.isFinite(rewardPerEncounter) ||
            rewardPerEncounter <= 0
        ) {
            throw new Error(
                'The selected route has zero expected reward under the current Poké Ball settings.'
            );
        }

        const encounters =
            remainingGoal /
            rewardPerEncounter;

        const requirements =
            Object.entries(
                result.ballUsagePerEncounter ?? {}
            )
                .map(([ballType, useRate]) => {
                    const needed = Math.ceil(
                        encounters *
                        Number(useRate)
                    );

                    const owned = Math.floor(
                        getBallQuantity(ballType)
                    );

                    return {
                        ballType:
                            Number(ballType),
                        name:
                            getBallName(ballType),
                        needed,
                        owned,
                        shortage:
                            Math.max(
                                0,
                                needed - owned
                            )
                    };
                })
                .filter(entry =>
                    entry.needed > 0
                );

        return {
            encounters,
            requirements,
            shortages:
                requirements.filter(entry =>
                    entry.shortage > 0
                )
        };
    }

    function confirmBallInventoryPreflight(
        farmLabel,
        goalLabel,
        remainingGoal,
        result
    ) {
        let estimate;
        try {
            estimate =
                estimateBallRequirements(
                    result,
                    remainingGoal
                );
        } catch (error) {
            return {
                canStart: false,
                error: error.message
            };
        }

        if (
            !estimate ||
            !estimate.shortages.length
        ) {
            return {
                canStart: true,
                estimate
            };
        }

        const lines = [
            `${farmLabel} inventory warning`,
            '',
            `Goal: ${goalLabel}`,
            `Remaining: ${formatNumber(remainingGoal)}`,
            `Route: ${result.route.routeName}`,
            '',
            ...estimate.requirements.map(entry =>
                `${entry.name}: need about ${formatNumber(entry.needed)}, ` +
                `own ${formatNumber(entry.owned)}, ` +
                `short about ${formatNumber(entry.shortage)}`
            ),
            '',
            'This is an expected-value estimate using current filters and inventory. Ball fallback and catch randomness can change the actual mix.',
            '',
            'Continue anyway?'
        ];

        const confirmStart =
            typeof globalThis.confirm ===
            'function'
                ? globalThis.confirm(
                    lines.join('\n')
                )
                : false;

        return {
            canStart:
                Boolean(confirmStart),
            cancelled:
                !confirmStart,
            estimate
        };
    }
    function startDungeonTokenAutomation(mode, rawTarget) {
        let target;
        try {
            target = requireFiniteTarget(mode, rawTarget);
        } catch (error) {
            failForegroundStart('dt', error.message);
            return;
        }

        const baseline = getDungeonTokens();
        if (!Number.isFinite(baseline)) {
            failForegroundStart('dt', 'Dungeon Token balance is unavailable.');
            return;
        }
        if (mode === 'owned' && target !== null && baseline >= target) {
            completeForegroundStart(
                'dt',
                'Already own ' + formatNumber(baseline) + ' DT.'
            );
            return;
        }

        const best = scanDungeonTokenRoutes()[0];
        if (!best) {
            failForegroundStart('dt', 'No unlocked route can earn Dungeon Tokens with the current Poké Ball settings.');
            return;
        }

        if (
            target !== null &&
            best.expectedRewardPerEncounter !==
                undefined
        ) {
            const remainingGoal =
                mode === 'owned'
                    ? Math.max(0, target - baseline)
                    : target;

            const preflight =
                confirmBallInventoryPreflight(
                    'Dungeon Token Farm',
                    mode === 'owned'
                        ? `Reach ${formatNumber(target)} DT owned`
                        : `Gain ${formatNumber(target)} DT`,
                    remainingGoal,
                    best
                );

            if (preflight.error) {
                failForegroundStart(
                    'dt',
                    preflight.error
                );
                return;
            }

            if (!preflight.canStart) {
                failForegroundStart(
                    'dt',
                    'Cancelled after Poké Ball inventory warning.'
                );
                return;
            }
        }

        const job = {
            id: 'dt',
            type: 'Dungeon Token Farm',
            needsClicks: true,
            mode,
            route: best.route,
            target,
            baseline,
            detail: '',
            start() {
                MapHelper.moveToRoute(this.route.number, this.route.region);
                if (!isOnRoute(this.route)) {
                    throw new Error('Could not move to ' + this.route.routeName + '.');
                }
                this.tick();
            },
            tick() {
                const current = getDungeonTokens();
                const progress = getResourceGoalProgress(
                    this.mode,
                    current,
                    this.baseline
                );
                if (!Number.isFinite(progress)) {
                    stopForegroundJob('Dungeon Token balance is unavailable.');
                    return;
                }

                const ownedTarget = isOwnedTargetMode(this.mode);
                this.detail = this.route.routeName + '\n' +
                    makeProgressText(
                        ownedTarget ? 'DT owned' : 'DT gained',
                        progress,
                        this.target,
                        best.estimatedDTPerMinute
                    );
                if (this.target !== null && progress >= this.target) {
                    stopForegroundJob(
                        ownedTarget
                            ? 'Reached ' + formatNumber(current) + ' DT owned.'
                            : 'Gained ' + formatNumber(progress) + ' DT.',
                        true
                    );
                    return;
                }
                if (!isOnRoute(this.route)) {
                    stopForegroundJob('Player left the selected route.');
                }
            }
        };
        activateForegroundJob(job);
    }

    function startTypeFarmAutomation(mode, rawTarget) {
        let target;
        try {
            target = requireFiniteTarget(mode, rawTarget);
        } catch (error) {
            failForegroundStart('type', error.message);
            return;
        }
        const selectedType = typeFarmType;
        const typeName = PokemonType[selectedType];
        const best = scanTypeCatchRoutes()[0];
        if (!best) {
            failForegroundStart('type', 'No route can farm ' + typeName + '.');
            return;
        }
        const baseline = getCapturedCountByType(selectedType);

        if (
            target !== null &&
            best.expectedRewardPerEncounter !==
                undefined
        ) {
            const preflight =
                confirmBallInventoryPreflight(
                    'Type Farm',
                    `Catch ${formatNumber(target)} ${typeName} Pokémon`,
                    target,
                    best
                );

            if (preflight.error) {
                failForegroundStart(
                    'type',
                    preflight.error
                );
                return;
            }

            if (!preflight.canStart) {
                failForegroundStart(
                    'type',
                    'Cancelled after Poké Ball inventory warning.'
                );
                return;
            }
        }

        const job = {
            id: 'type',
            type: 'Type Farm',
            needsClicks: true,
            selectedType,
            typeName,
            route: best.route,
            target,
            baseline,
            detail: '',
            start() {
                MapHelper.moveToRoute(this.route.number, this.route.region);
                if (!isOnRoute(this.route)) {
                    throw new Error('Could not move to ' + this.route.routeName + '.');
                }
                this.tick();
            },
            tick() {
                if (!isOnRoute(this.route)) {
                    stopForegroundJob('Player left the selected route.');
                    return;
                }
                const progress = Math.max(0,
                    getCapturedCountByType(this.selectedType) - this.baseline);
                this.detail = this.route.routeName + '\n' +
                    makeProgressText(this.typeName + ' catches', progress,
                        this.target, best.catchesPerMinute);
                if (this.target !== null && progress >= this.target) {
                    stopForegroundJob('Caught ' + formatNumber(progress) + ' ' +
                        this.typeName + ' Pokemon.', true);
                }
            }
        };
        activateForegroundJob(job);
    }

    function getGymHostTown(gym) {
        if (!gym) {
            return null;
        }

        const parentName = gym.parent?.name;
        if (parentName && TownList[parentName]) {
            return TownList[parentName];
        }

        if (gym.town && TownList[gym.town]) {
            return TownList[gym.town];
        }

        return Object.values(TownList).find(town =>
            town?.content?.includes?.(gym)
        ) ?? null;
    }

    function getGymClearCount(gym) {
        const index = GameConstants.getGymIndex(gym.town);
        return Number(readObservable(App.game.statistics.gymsDefeated[index]));
    }

    function getGymAutoRepeatState(gym, allowPaid) {
        const clears = getGymClearCount(gym);
        const cost = Math.max(0, Number(gym?.moneyReward || 10) * 2);

        if (clears < 10) {
            return {
                clears,
                cost,
                mode: 'locked',
                useBuiltIn: false,
                paid: false,
                label: 'Locked (<10 clears)'
            };
        }
        if (clears >= 100) {
            return {
                clears,
                cost: 0,
                mode: 'free',
                useBuiltIn: true,
                paid: false,
                label: 'Free (100+ clears)'
            };
        }
        if (allowPaid) {
            return {
                clears,
                cost,
                mode: 'paid',
                useBuiltIn: true,
                paid: true,
                label: 'Paid — $' + formatNumber(cost) + '/repeat'
            };
        }
        return {
            clears,
            cost,
            mode: 'manual',
            useBuiltIn: false,
            paid: false,
            label: 'Manual (paid autorun off)'
        };
    }

    function canAffordGymAutoRepeat(state) {
        return !state.paid ||
            getCurrencyAmount(GameConstants.Currency.money) >= state.cost;
    }

    function isSelectedGymRunning(gym) {
        if (!GymRunner.running() &&
            App.game.gameState !== GameConstants.GameState.gym) {
            return false;
        }
        const activeGym = typeof GymRunner.gymObservable === 'function'
            ? GymRunner.gymObservable()
            : GymBattle.gym;
        return activeGym === gym;
    }

    function startGemGym(job, initialRun, forceManual = false) {
        const state = getGymAutoRepeatState(
            job.result.gym,
            gemFarmAllowPaidGymAutorun
        );
        GymRunner.startGym(
            job.result.gym,
            state.useBuiltIn && !forceManual,
            initialRun
        );
        job.gymRunningSeen = GymRunner.running();
        return state;
    }

    function startGemFarmAutomation(mode, rawTarget) {
        stopForegroundJob('Replaced by Gem Farm');
        let target;
        try {
            target = requireFiniteTarget(mode, rawTarget);
        } catch (error) {
            failForegroundStart('gem', error.message);
            return;
        }

        const gemName = selectedGemType;
        const gemType = PokemonType[gemName];
        const baseline = mode === 'owned'
            ? getGemBalance(gemType)
            : getGemGainCount(gemType);
        if (!Number.isFinite(baseline)) {
            failForegroundStart('gem', gemName + ' gem balance is unavailable.');
            return;
        }
        if (mode === 'owned' && target !== null && baseline >= target) {
            completeForegroundStart(
                'gem',
                'Already own ' + formatNumber(baseline) + ' ' +
                    gemName + ' gems.'
            );
            return;
        }

        const best = scanGemFarms()[0];
        if (!best) {
            failForegroundStart('gem', 'No farm can produce ' + gemName + ' gems.');
            return;
        }

        const job = {
            id: 'gem',
            type: 'Gem Farm',
            needsClicks: true,
            mode,
            gemName,
            gemType,
            result: best,
            target,
            baseline,
            detail: '',
            gymRunningSeen: false,
            lastGymClears: 0,
            start() {
                if (this.result.kind === 'Route') {
                    MapHelper.moveToRoute(
                        this.result.route.number,
                        this.result.route.region
                    );
                    if (!isOnRoute(this.result.route)) {
                        throw new Error(
                            'Could not move to ' + this.result.location + '.'
                        );
                    }
                } else {
                    const gym = this.result.gym;
                    if (!gym?.isUnlocked?.()) {
                        throw new Error('The selected gym is unavailable.');
                    }
                    const town = this.result.town ?? getGymHostTown(gym);
                    if (!town?.name || town.isUnlocked?.() === false) {
                        throw new Error('The selected gym location is unavailable.');
                    }
                    MapHelper.moveToTown(town.name);
                    if (player.town?.name !== town.name) {
                        throw new Error('Could not move to ' + town.name + '.');
                    }
                    this.lastGymClears = getGymClearCount(gym);
                    startGemGym(this, true);
                }
                this.tick();
            },
            cleanup() {
                GymRunner.autoRestart(false);
            },
            tick() {
                const current = this.mode === 'owned'
                    ? getGemBalance(this.gemType)
                    : getGemGainCount(this.gemType);
                const progress = getResourceGoalProgress(
                    this.mode,
                    current,
                    this.baseline
                );
                if (!Number.isFinite(progress)) {
                    stopForegroundJob(
                        this.gemName + ' gem balance is unavailable.'
                    );
                    return;
                }

                const ownedTarget = isOwnedTargetMode(this.mode);
                let autoRepeatState = null;
                this.detail = this.result.kind + ': ' +
                    this.result.location + '\n' +
                    makeProgressText(
                        this.gemName +
                            (ownedTarget ? ' gems owned' : ' gems gained'),
                        progress,
                        this.target,
                        this.result.gemsPerMinute
                    );
                if (this.result.kind === 'Gym') {
                    autoRepeatState = getGymAutoRepeatState(
                        this.result.gym,
                        gemFarmAllowPaidGymAutorun
                    );
                    this.detail += '\nAutorun: ' + autoRepeatState.label;
                }

                if (this.target !== null && progress >= this.target) {
                    stopForegroundJob(
                        ownedTarget
                            ? 'Reached ' + formatNumber(current) + ' ' +
                                this.gemName + ' gems owned.'
                            : 'Gained ' + formatNumber(progress) + ' ' +
                                this.gemName + ' gems.',
                        true
                    );
                    return;
                }

                if (this.result.kind === 'Route') {
                    if (!isOnRoute(this.result.route)) {
                        stopForegroundJob('Player left the selected route.');
                    }
                    return;
                }

                const gym = this.result.gym;
                const clears = getGymClearCount(gym);
                if (GymRunner.running() ||
                    App.game.gameState === GameConstants.GameState.gym) {
                    if (!isSelectedGymRunning(gym)) {
                        stopForegroundJob(
                            'A different gym battle is running.'
                        );
                        return;
                    }
                    if (clears > this.lastGymClears) {
                        this.lastGymClears = clears;
                        autoRepeatState = getGymAutoRepeatState(
                            gym,
                            gemFarmAllowPaidGymAutorun
                        );
                        GymRunner.autoRestart(
                            autoRepeatState.useBuiltIn
                        );
                        updateGemUI();
                    }
                    this.gymRunningSeen = true;
                    return;
                }

                if (!this.gymRunningSeen) {
                    stopForegroundJob('The gym did not start.');
                    return;
                }
                if (clears <= this.lastGymClears) {
                    stopForegroundJob(
                        'The gym battle was lost or interrupted.'
                    );
                    return;
                }
                if (!gym.isUnlocked()) {
                    stopForegroundJob(
                        'The selected gym is no longer available.'
                    );
                    return;
                }

                autoRepeatState = getGymAutoRepeatState(
                    gym,
                    gemFarmAllowPaidGymAutorun
                );
                const paidRepeatFailed =
                    autoRepeatState.paid &&
                    GymRunner.autoRestart();
                const paidRepeatUnaffordable =
                    autoRepeatState.paid &&
                    !canAffordGymAutoRepeat(autoRepeatState);

                this.lastGymClears = clears;
                this.gymRunningSeen = false;
                startGemGym(
                    this,
                    false,
                    paidRepeatFailed || paidRepeatUnaffordable
                );
                updateGemUI();

                if (!this.gymRunningSeen) {
                    stopForegroundJob('The gym could not be restarted.');
                }
            }
        };
        activateForegroundJob(job);
    }
