
    function getFarmCandidate(berry, availablePlots, finiteTarget = null) {
        const farming = App.game.farming;
        const data = BerryList[berry];
        const inventory = Math.floor(farming.berryInventory[berry]());
        if (!data || !farming.unlockedBerries[berry]() ||
            inventory <= 0 || data.harvestAmount < 1) {
            return null;
        }
        const plotCount = Math.min(availablePlots, inventory);
        if (!plotCount) {
            return null;
        }
        const multiplier = Math.max(0.0001, farming.getGrowthMultiplier());
        const growthSeconds = data.growthTime[PlotStage.Bloom] / multiplier;
        const fpPerCycle = plotCount * data.farmValue;
        return {
            berry,
            plotCount,
            completionSeconds: finiteTarget === null
                ? Infinity
                : Math.ceil(finiteTarget / fpPerCycle) * growthSeconds,
            longRunRate: fpPerCycle / growthSeconds
        };
    }

    function isBerryFarmerMode(mode) {
        return mode === 'berries' || mode === 'berriesOwned';
    }

    function isFarmPointFarmerMode(mode) {
        return mode === 'farmPoints' ||
            mode === 'farmPointsOwned' ||
            mode === 'indefinite';
    }

    function chooseFarmBerry(selection, mode, target, availablePlots) {
        const farmPointGoal = isFarmPointFarmerMode(mode) &&
            mode !== 'indefinite';
        if (selection !== 'auto') {
            const candidate = getFarmCandidate(
                Number(selection),
                availablePlots,
                farmPointGoal ? target : null
            );
            if (isBerryFarmerMode(mode) && candidate &&
                BerryList[candidate.berry].harvestAmount <= 1) {
                return null;
            }
            return candidate;
        }
        if (isBerryFarmerMode(mode)) {
            return null;
        }
        const candidates = [];
        BerryList.forEach((berry, berryType) => {
            const candidate = getFarmCandidate(
                berryType,
                availablePlots,
                farmPointGoal ? target : null
            );
            if (candidate) {
                candidates.push(candidate);
            }
        });
        candidates.sort(farmPointGoal
            ? (a, b) => a.completionSeconds - b.completionSeconds ||
                b.longRunRate - a.longRunRate
            : (a, b) => b.longRunRate - a.longRunRate);
        return candidates[0] ?? null;
    }

    function stopFarmer(reason = 'Stopped by user', completed = false) {
        farmerJob = null;
        farmerLastStatus = (completed ? 'Complete: ' : 'Stopped: ') + reason;
        console.log('[Auto Farmer]', farmerLastStatus);
        updateAutomationUI();
    }

    function completeFarmerStart(reason) {
        farmerLastStatus = 'Complete: ' + reason;
        console.log('[Auto Farmer]', farmerLastStatus);
        updateAutomationUI();
    }

    function getFarmerCurrentValue(job) {
        if (job.resource === 'berries') {
            return Number(
                App.game.farming.berryInventory[job.berry]()
            );
        }
        return getFarmPoints();
    }

    function getFarmerProgress(job) {
        return getResourceGoalProgress(
            job.mode,
            getFarmerCurrentValue(job),
            job.baseline
        );
    }

    function updateFarmerDetail(job) {
        const progress = getFarmerProgress(job);
        const resourceLabel = job.resource === 'berries'
            ? BerryType[job.berry] + ' berries'
            : 'Farm Points';
        const progressLabel = resourceLabel +
            (job.ownedTarget ? ' owned' : ' gained');
        job.detail = BerryType[job.berry] + ' on ' + job.owned.size +
            ' managed plots\n' +
            makeProgressText(progressLabel, progress, job.target);
        return progress;
    }

    function finishFarmerGoalIfReached(job, progress) {
        if (job.target === null || progress < job.target) {
            return false;
        }
        const resourceLabel = job.resource === 'berries'
            ? BerryType[job.berry] + ' berry'
            : 'Farm Point';
        stopFarmer(
            resourceLabel +
                (job.ownedTarget ? ' owned goal reached.' : ' gain goal reached.'),
            true
        );
        return true;
    }

    function startAutoFarmer(selection, mode, rawTarget) {
        if (!featureSettings.autoFarm) {
            farmerLastStatus =
                'Could not start: Enable Auto Farm in the Features tab.';
            updateAutomationUI();
            return;
        }

        if (farmerJob) {
            stopFarmer('Replaced by a new farm run.');
        }

        const berryGoal = isBerryFarmerMode(mode);
        if (!berryGoal && !isFarmPointFarmerMode(mode)) {
            farmerLastStatus = 'Could not start: Select a valid farm goal.';
            updateAutomationUI();
            return;
        }

        let target = null;
        if (mode !== 'indefinite') {
            target = Math.floor(Number(rawTarget));
            if (!Number.isFinite(target) || target <= 0) {
                farmerLastStatus =
                    'Could not start: Enter a target greater than zero.';
                updateAutomationUI();
                return;
            }
        }
        if (berryGoal && selection === 'auto') {
            farmerLastStatus =
                'Could not start: Select a concrete berry for a berry goal.';
            updateAutomationUI();
            return;
        }

        const farming = App.game.farming;
        const selectedBerry = selection === 'auto'
            ? null
            : Number(selection);
        if (berryGoal &&
            (!Number.isInteger(selectedBerry) ||
                !farming.berryInventory[selectedBerry])) {
            farmerLastStatus =
                'Could not start: Select an available berry.';
            updateAutomationUI();
            return;
        }
        const initialValue = berryGoal
            ? Number(farming.berryInventory[selectedBerry]())
            : getFarmPoints();
        if (!Number.isFinite(initialValue)) {
            farmerLastStatus =
                'Could not start: The selected resource balance is unavailable.';
            updateAutomationUI();
            return;
        }

        const ownedTarget = isOwnedTargetMode(mode);
        if (ownedTarget && target !== null && initialValue >= target) {
            completeFarmerStart(
                'Already own ' + formatNumber(initialValue) + ' ' +
                    (berryGoal
                        ? BerryType[selectedBerry] + ' berries.'
                        : 'Farm Points.')
            );
            return;
        }

        const eligible = [];
        farming.plotList.forEach((plot, index) => {
            if (plot.isUnlocked && plot.isEmpty() && !plot.isSafeLocked) {
                eligible.push(index);
            }
        });
        if (!eligible.length) {
            farmerLastStatus =
                'Could not start: No unlocked empty plots are available.';
            updateAutomationUI();
            return;
        }

        const planningTarget = target === null
            ? null
            : ownedTarget
                ? getResourceGoalRemaining(
                    mode,
                    target,
                    initialValue,
                    initialValue
                )
                : target;
        const candidate = chooseFarmBerry(
            selection,
            mode,
            planningTarget,
            eligible.length
        );
        if (!candidate) {
            farmerLastStatus =
                'Could not start: No unlocked berry has enough sustainable seed stock.';
            updateAutomationUI();
            return;
        }

        const owned = new Set(eligible.slice(0, candidate.plotCount));
        const job = {
            mode,
            resource: berryGoal ? 'berries' : 'farmPoints',
            ownedTarget,
            target,
            berry: candidate.berry,
            owned,
            baseline: initialValue,
            detail: ''
        };
        for (const index of [...owned]) {
            farming.plant(index, job.berry);
            if (farming.plotList[index].berry !== job.berry) {
                owned.delete(index);
            }
        }
        if (!owned.size) {
            farmerLastStatus =
                'Could not start: The selected berry could not be planted.';
            updateAutomationUI();
            return;
        }
        farmerJob = job;
        farmerLastStatus = 'Running';
        updateFarmerDetail(job);
        updateAutomationUI();
    }

    function runAutoFarmerTick() {
        const job = farmerJob;
        if (!job) {
            return;
        }

        if (!featureSettings.autoFarm) {
            stopFarmer('Auto Farm was disabled.');
            return;
        }

        let progress = updateFarmerDetail(job);
        if (finishFarmerGoalIfReached(job, progress)) {
            return;
        }

        const farming = App.game.farming;
        for (const index of [...job.owned]) {
            const plot = farming.plotList[index];
            if (!plot || plot.isSafeLocked || plot.berry !== job.berry) {
                job.owned.delete(index);
                continue;
            }
            if (plot.stage() !== PlotStage.Berry) {
                continue;
            }
            farming.harvest(index);
            if (!plot.isEmpty()) {
                job.owned.delete(index);
                continue;
            }

            progress = updateFarmerDetail(job);
            if (finishFarmerGoalIfReached(job, progress)) {
                return;
            }

            farming.plant(index, job.berry);
            if (plot.berry !== job.berry) {
                job.owned.delete(index);
            }
        }
        if (!farmerJob) {
            return;
        }
        if (!job.owned.size) {
            stopFarmer(
                'No managed plots remain or the required seeds ran out.'
            );
            return;
        }
        updateFarmerDetail(job);
    }
