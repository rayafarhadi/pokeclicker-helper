    // ============================================================
    // Main button UI
    // ============================================================

    function updateClickButton() {
        if (!clickButton) {
            return;
        }

        clickButton.classList.toggle('is-on', autoClickEnabled);
        clickButton.setAttribute('aria-pressed', String(autoClickEnabled));
        clickButton.setAttribute(
            'aria-label',
            'Auto Click ' + (autoClickEnabled ? 'on' : 'off')
        );
        clickButton.title = 'Auto Click: ' + (autoClickEnabled ? 'ON' : 'OFF');
    }

    function createFeatureToggleButton(
        name,
        featureOwner = false
    ) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pkh-toggle';
        button.dataset.featureOwner = String(featureOwner);
        button.addEventListener('click', () =>
            setFeatureEnabled(
                name,
                !featureSettings[name],
                featureOwner
            )
        );
        featureToggleButtons[name].push(button);
        return button;
    }

    function getBreedingStrategyLabel(strategy) {
        return {
            pokerus: 'Pok\u00e9rus',
            mega: 'Mega',
            default: 'Custom',
            off: 'None'
        }[strategy] ?? strategy;
    }

    function moveBreedingPriority(strategy, direction) {
        if (strategy === 'off') {
            return;
        }

        const movable = breedingPriority.filter(entry => entry !== 'off');
        const index = movable.indexOf(strategy);
        const nextIndex = index + direction;

        if (
            index < 0 ||
            nextIndex < 0 ||
            nextIndex >= movable.length
        ) {
            return;
        }

        [movable[index], movable[nextIndex]] =
            [movable[nextIndex], movable[index]];
        breedingPriority = [...movable, 'off'];
        localStorage.setItem(
            BREEDING_PRIORITY_STORAGE_KEY,
            JSON.stringify(breedingPriority)
        );
        renderBreedingPriorityViews();
    }

    function renderBreedingPriorityView(view) {
        view.replaceChildren();

        const activeStrategies = breedingPriority.filter(strategy =>
            strategy === 'default' ||
            strategy === 'off' ||
            featureSettings.advancedHatching
        );
        const movable = activeStrategies.filter(
            strategy => strategy !== 'off'
        );

        activeStrategies.forEach((strategy, index) => {
            const row = document.createElement('div');
            row.className = 'pkh-priority-row';

            const label = document.createElement('span');
            label.textContent =
                (index + 1) + '. ' +
                getBreedingStrategyLabel(strategy);
            row.appendChild(label);

            if (strategy !== 'off') {
                const controls = document.createElement('span');
                controls.className = 'pkh-priority-buttons';

                const up = document.createElement('button');
                up.type = 'button';
                up.textContent = 'Up';
                up.title = 'Move earlier';
                up.disabled = movable.indexOf(strategy) === 0;
                up.addEventListener('click', () =>
                    moveBreedingPriority(strategy, -1)
                );

                const down = document.createElement('button');
                down.type = 'button';
                down.textContent = 'Down';
                down.title = 'Move later';
                down.disabled =
                    movable.indexOf(strategy) === movable.length - 1;
                down.addEventListener('click', () =>
                    moveBreedingPriority(strategy, 1)
                );

                controls.appendChild(up);
                controls.appendChild(down);
                row.appendChild(controls);
            } else {
                const fixed = document.createElement('small');
                fixed.textContent = 'terminal fallback';
                row.appendChild(fixed);
            }

            view.appendChild(row);
        });
    }

    function renderBreedingPriorityViews() {
        for (const view of breedingPriorityViews) {
            renderBreedingPriorityView(view);
        }
    }

    function createBreedingPriorityControl() {
        const view = document.createElement('div');
        view.className = 'pkh-priority-list';
        breedingPriorityViews.push(view);
        renderBreedingPriorityView(view);
        return view;
    }

    function updateFeatureUI() {
        const dependencies = {
            advancedHatching: featureSettings.autoHatching,
            advancedDungeon: featureSettings.autoDungeon
        };

        for (
            const [name, buttons] of
            Object.entries(featureToggleButtons)
        ) {
            const available = dependencies[name] ?? true;

            for (const button of buttons) {
                const featureOwner =
                    button.dataset.featureOwner === 'true';
                const canChangeHere =
                    featureOwner || featureSettings[name];
                const unavailable =
                    !available || !canChangeHere;

                button.disabled = unavailable;
                button.classList.toggle(
                    'is-on',
                    featureSettings[name]
                );
                button.classList.toggle(
                    'is-unavailable',
                    unavailable
                );
                button.setAttribute(
                    'aria-pressed',
                    String(featureSettings[name])
                );
                button.setAttribute(
                    'aria-label',
                    name + ' ' +
                    (featureSettings[name] ? 'on' : 'off')
                );
                button.title = !available
                    ? (
                        featureSettings[name]
                            ? 'Saved as enabled; inactive until the basic feature is enabled.'
                            : 'Enable the basic feature first.'
                    )
                    : !canChangeHere
                        ? 'Enable this feature from the Features tab.'
                        : (featureSettings[name] ? 'Enabled' : 'Disabled');
            }
        }

        if (dungeonStartButton) {
            dungeonStartButton.disabled =
                !featureSettings.autoDungeon;
        }
        if (farmerStartButton) {
            farmerStartButton.disabled =
                !featureSettings.autoFarm;
        }

        updateDungeonAdvancedAvailability();
        renderBreedingPriorityViews();
    }

    function updateHatchButton() {
        updateFeatureUI();
    }
