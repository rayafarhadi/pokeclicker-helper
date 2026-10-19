
    function createAutomationStatusPanel() {
        const panel = document.createElement('div');
        panel.className = 'pkh-status-strip';
        automationStatusDot = document.createElement('span');
        automationStatusDot.className = 'pkh-status-dot';
        automationStatusText = document.createElement('div');
        automationStatusText.className = 'pkh-status-text';
        automationStopButton = document.createElement('button');
        automationStopButton.textContent = 'Stop';
        automationStopButton.className = 'pkh-button pkh-button-danger pkh-status-action';
        automationStopButton.addEventListener('click', stopAllAutomation);
        panel.appendChild(automationStatusDot);
        panel.appendChild(automationStatusText);
        panel.appendChild(automationStopButton);
        return panel;
    }

    function populateBerrySelect(select) {
        const current = select.value ||
            localStorage.getItem(AUTO_FARMER_BERRY_STORAGE_KEY) || 'auto';
        select.replaceChildren();
        const auto = document.createElement('option');
        auto.value = 'auto';
        auto.textContent = 'Auto - fastest FP';
        select.appendChild(auto);
        BerryList.forEach((berry, berryType) => {
            if (!berry || !App.game.farming.unlockedBerries[berryType]()) {
                return;
            }
            const option = document.createElement('option');
            option.value = String(berryType);
            option.textContent = BerryType[berryType] + ' (' +
                formatNumber(App.game.farming.berryInventory[berryType]()) + ')';
            select.appendChild(option);
        });
        select.value = [...select.options].some(option => option.value === current)
            ? current
            : 'auto';
        refreshSearchableSelect(select);
    }

    function createAutoFarmerPanel() {
        farmerHeaderButton = document.createElement('button');
        styleMainButton(farmerHeaderButton);
        farmerHeaderButton.style.background = '#198754';

        const panel = document.createElement('div');
        styleCompactPanel(panel);
        const title = document.createElement('div');
        title.textContent = 'Auto Farmer';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '14px';

        const berry = document.createElement('select');
        populateBerrySelect(berry);
        const berryControl = createSearchableSelect(berry, {
            placeholder: 'Search berries...'
        });

        const goalModes = [
            ['farmPoints', 'Gain X Farm Points'],
            ['farmPointsOwned', 'Reach X Farm Points owned'],
            ['berries', 'Gain X selected berries'],
            ['berriesOwned', 'Reach X selected berry inventory'],
            ['indefinite', 'Run indefinitely']
        ];
        const goal = document.createElement('select');
        for (const [value, label] of goalModes) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            goal.appendChild(option);
        }
        const storedGoal =
            localStorage.getItem(AUTO_FARMER_MODE_STORAGE_KEY) ??
                'farmPoints';
        goal.value = goalModes.some(([value]) => value === storedGoal)
            ? storedGoal
            : 'farmPoints';

        const target = createNumberInput(
            localStorage.getItem(AUTO_FARMER_TARGET_STORAGE_KEY) ?? '5000'
        );
        farmerStatusText = createTextLine();
        farmerStatusText.style.whiteSpace = 'pre-line';
        farmerStatusText.style.marginTop = '8px';

        const buttons = document.createElement('div');
        Object.assign(buttons.style, {
            display: 'flex',
            gap: '5px',
            marginTop: '8px'
        });
        const startButton = document.createElement('button');
        farmerStartButton = startButton;
        startButton.textContent = 'Start';
        styleCompactButton(startButton, '#198754');
        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        styleCompactButton(stopButton, '#dc3545');

        const syncGoal = () => {
            target.disabled = goal.value === 'indefinite';
            localStorage.setItem(
                AUTO_FARMER_MODE_STORAGE_KEY,
                goal.value
            );
        };
        berry.addEventListener('change', () =>
            localStorage.setItem(
                AUTO_FARMER_BERRY_STORAGE_KEY,
                berry.value
            ));
        goal.addEventListener('change', syncGoal);
        target.addEventListener('change', () =>
            localStorage.setItem(
                AUTO_FARMER_TARGET_STORAGE_KEY,
                target.value
            ));
        startButton.addEventListener('click', event => {
            event.stopPropagation();
            startAutoFarmer(berry.value, goal.value, target.value);
        });
        stopButton.addEventListener('click', event => {
            event.stopPropagation();
            stopFarmer();
        });

        buttons.appendChild(startButton);
        buttons.appendChild(stopButton);
        panel.appendChild(title);
        panel.appendChild(createFieldLabel('Berry', berryControl));
        panel.appendChild(createFieldLabel('Goal', goal));
        panel.appendChild(createFieldLabel('Target', target));
        panel.appendChild(farmerStatusText);
        panel.appendChild(buttons);

        farmerHeaderButton.addEventListener('click', () => {
            populateBerrySelect(berry);
            panel.style.display =
                panel.style.display === 'none' ? 'block' : 'none';
        });
        syncGoal();
        updateAutomationUI();
        return {
            header: farmerHeaderButton,
            panel,
            refresh: () => populateBerrySelect(berry)
        };
    }
