    // ============================================================
    // Controls
    // ============================================================

    function createControls() {
        if (!document.getElementById('pkh-styles')) {
            const style = document.createElement('style');
            style.id = 'pkh-styles';
            style.textContent = HELPER_STYLES;
            document.head.appendChild(style);
        }

        const container = document.createElement('div');
        container.id = 'pkh-root';

        const vitaminControls = createVitaminPanel();
        const typeFarmControls = createTypeFarmPanel();
        const gemControls = createGemPanel();
        const dtControls = createDungeonTokenPanel();
        const farmerControls = createAutoFarmerPanel();
        const dungeonControls = createAutoDungeonPanel();

        addGoalExecutionControls(
            dtControls.panel,
            {
                id: 'dt',
                modes: [
                    ['finite', 'Gain X DT'],
                    ['owned', 'Reach X DT owned'],
                    ['indefinite', 'Run indefinitely']
                ],
                defaultTarget: '1000',
                start: startDungeonTokenAutomation
            }
        );

        addGoalExecutionControls(
            gemControls.panel,
            {
                id: 'gem',
                modes: [
                    ['finite', 'Gain X selected gems'],
                    ['owned', 'Reach X selected gems owned'],
                    ['indefinite', 'Run indefinitely']
                ],
                defaultTarget: '1000',
                start: startGemFarmAutomation
            }
        );

        addGoalExecutionControls(
            typeFarmControls.panel,
            {
                id: 'type',
                finiteLabel: 'Catch X selected-type Pokémon',
                defaultTarget: '500',
                start: startTypeFarmAutomation
            }
        );

        const decorateTitle = title => {
            title.classList.add(
                'pkh-card-title'
            );
        };

        const prepareCard = (
            panel,
            sectionKey = ''
        ) => {
            panel.classList.add(
                'pkh-card'
            );
            Object.assign(
                panel.style,
                {
                    display: 'block',
                    position: 'static',
                    left: 'auto',
                    top: 'auto',
                    right: 'auto',
                    bottom: 'auto',
                    width: '100%',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    overflow: 'visible',
                    margin: '0 0 10px',
                    padding: '11px',
                    background: '',
                    border: '',
                    borderRadius: '',
                    boxShadow: ''
                }
            );

            const title =
                panel.firstElementChild;
            if (!title) {
                return panel;
            }

            decorateTitle(
                title
            );

            const key =
                sectionKey ||
                title.textContent
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9]+/g,
                        '-'
                    )
                    .replace(
                        /(^-|-$)/g,
                        ''
                    );
            const content =
                document.createElement(
                    'div'
                );
            content.className =
                'pkh-card-content';

            while (
                title.nextSibling
            ) {
                content.appendChild(
                    title.nextSibling
                );
            }

            panel.appendChild(content);

            const state =
                document.createElement(
                    'span'
                );
            state.className =
                'pkh-card-state';
            state.style.display =
                'none';

            const indicator =
                document.createElement(
                    'span'
                );
            indicator.className =
                'pkh-collapse-indicator';

            title.appendChild(state);
            title.appendChild(indicator);
            title.tabIndex = 0;
            title.setAttribute(
                'role',
                'button'
            );

            const applyCollapsed =
                collapsed => {
                    panel.classList
                        .toggle(
                            'is-collapsed',
                            collapsed
                        );
                    indicator
                        .textContent =
                        collapsed
                            ? '+'
                            : '-';
                    title.setAttribute(
                        'aria-expanded',
                        String(
                            !collapsed
                        )
                    );
                };

            const toggle = () => {
                const collapsed =
                    !panel.classList
                        .contains(
                            'is-collapsed'
                        );
                collapsedSections[key] =
                    collapsed;
                localStorage.setItem(
                    COLLAPSED_SECTIONS_STORAGE_KEY,
                    JSON.stringify(
                        collapsedSections
                    )
                );
                applyCollapsed(
                    collapsed
                );
            };

            title.addEventListener(
                'click',
                toggle
            );
            title.addEventListener(
                'keydown',
                event => {
                    if (
                        event.key ===
                            'Enter' ||
                        event.key ===
                            ' '
                    ) {
                        event
                            .preventDefault();
                        toggle();
                    }
                }
            );

            applyCollapsed(
                collapsedSections[key] ===
                    true
            );
            collapsibleCardHeaders[key] = {
                panel,
                title,
                state
            };

            return panel;
        };

        const createCard = (
            titleText,
            sectionKey
        ) => {
            const card =
                document.createElement(
                    'div'
                );
            const title =
                document.createElement(
                    'div'
                );
            title.textContent =
                titleText;
            card.appendChild(title);
            return prepareCard(
                card,
                sectionKey
            );
        };

        const createSetting = (labelText, control) => {
            const row = document.createElement('label');
            row.className = 'pkh-setting';
            const label = document.createElement('span');
            label.className = 'pkh-setting-label';
            label.textContent = labelText;
            row.appendChild(label);
            row.appendChild(control);
            return row;
        };

        const createNote = text => {
            const note = document.createElement('div');
            note.className = 'pkh-note';
            note.textContent = text;
            return note;
        };

        const createBrandBall = () => {
            const ball = document.createElement('span');
            ball.className = 'pkh-brand-ball';
            ball.setAttribute('aria-hidden', 'true');
            return ball;
        };

        const mainPanel = document.createElement('div');
        mainPanel.className = 'pkh-shell';
        mainPanel.style.display = 'none';
        mainPanel.setAttribute('role', 'dialog');
        mainPanel.setAttribute('aria-label', 'PokéClicker Helper');

        const header = document.createElement('div');
        header.className = 'pkh-header';
        const heading = document.createElement('div');
        heading.className = 'pkh-brand';
        heading.appendChild(createBrandBall());
        const headingText = document.createElement('span');
        headingText.textContent = 'PokéClicker Helper';
        heading.appendChild(headingText);
        const version = document.createElement('span');
        version.className = 'pkh-version';
        version.textContent = 'v8.0.3';
        const closeButton = document.createElement('button');
        closeButton.className = 'pkh-close';
        closeButton.type = 'button';
        closeButton.textContent = '×';
        closeButton.setAttribute('aria-label', 'Close PokéClicker Helper');
        header.appendChild(heading);
        header.appendChild(version);
        header.appendChild(closeButton);

        const automationStatusPanel = createAutomationStatusPanel();

        const tabs = document.createElement('div');
        tabs.className = 'pkh-tabs';
        tabs.setAttribute('role', 'tablist');
        const contentViewport = document.createElement('div');
        contentViewport.className = 'pkh-scroll';

        const tabNames = [
            'Dashboard',
            'Farms',
            'Dungeon',
            'Breeding',
            'Features'
        ];
        const tabButtons = {};
        const tabContents = {};

        for (const tabName of tabNames) {
            const button =
                document.createElement(
                    'button'
                );
            button.className =
                'pkh-tab';
            button.type = 'button';
            button.textContent = tabName;
            button.title = tabName;
            button.setAttribute(
                'role',
                'tab'
            );
            tabs.appendChild(button);
            tabButtons[tabName] =
                button;

            const content =
                document.createElement(
                    'div'
                );
            content.style.display =
                'none';
            content.dataset.helperTab =
                tabName;
            content.setAttribute(
                'role',
                'tabpanel'
            );
            contentViewport
                .appendChild(content);
            tabContents[tabName] =
                content;
        }

        const createFeaturePreference = (
            label,
            name,
            description
        ) => {
            const group =
                document.createElement(
                    'div'
                );
            group.appendChild(
                createSetting(
                    label,
                    createFeatureToggleButton(
                        name,
                        true
                    )
                )
            );
            const help =
                document.createElement(
                    'div'
                );
            help.className =
                'pkh-feature-description';
            help.textContent =
                description;
            group.appendChild(help);
            return group;
        };

        const dashboardAutomationCard =
            createCard(
                'Automation Summary',
                'dashboard-automation'
            );
        dashboardAutomationStatusText =
            document.createElement(
                'div'
            );
        dashboardAutomationStatusText
            .style.whiteSpace =
            'pre-line';
        dashboardAutomationStopButton =
            document.createElement(
                'button'
            );
        dashboardAutomationStopButton
            .textContent =
            'Stop Automation';
        dashboardAutomationStopButton
            .className =
            'pkh-button pkh-button-danger pkh-full-button';
        dashboardAutomationStopButton
            .addEventListener(
                'click',
                stopAllAutomation
            );
        dashboardAutomationCard
            .appendChild(
                dashboardAutomationStatusText
            );
        dashboardAutomationCard
            .appendChild(
                dashboardAutomationStopButton
            );

        const dashboardSettingsCard =
            createCard(
                'Quick Controls',
                'dashboard-quick-controls'
            );
        clickButton =
            document.createElement(
                'button'
            );
        clickButton.type = 'button';
        clickButton.className =
            'pkh-toggle';
        clickButton.addEventListener(
            'click',
            () =>
                setAutoClick(
                    !autoClickEnabled
                )
        );
        dashboardSettingsCard
            .appendChild(
                createSetting(
                    'Auto Click',
                    clickButton
                )
            );
        dashboardSettingsCard
            .appendChild(
                createSetting(
                    'Auto Hatching',
                    createFeatureToggleButton(
                        'autoHatching'
                    )
                )
            );

        const dashboardStatusCard =
            createCard(
                'Quick Status',
                'dashboard-status'
            );
        dashboardQuickStatusText =
            document.createElement(
                'div'
            );
        dashboardStatusCard
            .appendChild(
                dashboardQuickStatusText
            );

        tabContents.Dashboard
            .appendChild(
                dashboardAutomationCard
            );
        tabContents.Dashboard
            .appendChild(
                dashboardSettingsCard
            );
        tabContents.Dashboard
            .appendChild(
                dashboardStatusCard
            );

        tabContents.Farms.appendChild(
            prepareCard(
                dtControls.panel,
                'farms-dungeon-tokens'
            )
        );
        tabContents.Farms.appendChild(
            prepareCard(
                gemControls.panel,
                'farms-gems'
            )
        );
        tabContents.Farms.appendChild(
            prepareCard(
                typeFarmControls.panel,
                'farms-type'
            )
        );
        tabContents.Farms.appendChild(
            prepareCard(
                farmerControls.panel,
                'farms-auto-farmer'
            )
        );

        tabContents.Dungeon
            .appendChild(
                prepareCard(
                    dungeonControls.panel,
                    'dungeon-runner'
                )
            );
        dungeonControls.panel
            .appendChild(
                createNote(
                    'Uses normal Dungeon Token costs, starts the game timer through ordinary movement, and stops after a lost run.'
                )
            );

        const hatchSettingsCard =
            createCard(
                'Hatch Settings',
                'breeding-hatch-settings'
            );
        hatchSettingsCard
            .appendChild(
                createSetting(
                    'Auto Hatching',
                    createFeatureToggleButton(
                        'autoHatching'
                    )
                )
            );
        hatchSettingsCard
            .appendChild(
                createSetting(
                    'Advanced Strategies',
                    createFeatureToggleButton(
                        'advancedHatching'
                    )
                )
            );

        const priorityHeading =
            document.createElement(
                'div'
            );
        priorityHeading.className =
            'pkh-subheading';
        priorityHeading.textContent =
            'Breeding priority';
        hatchSettingsCard
            .appendChild(
                priorityHeading
            );
        hatchSettingsCard
            .appendChild(
                createBreedingPriorityControl()
            );
        hatchSettingsCard
            .appendChild(
                createNote(
                    'Uncaught Type Eggs always fill free slots first. Custom follows the custom hatchery settings configured in Pok\u00e9Clicker. None is the fixed terminal fallback.'
                )
            );

        tabContents.Breeding
            .appendChild(
                hatchSettingsCard
            );
        tabContents.Breeding
            .appendChild(
                prepareCard(
                    vitaminControls.panel,
                    'breeding-vitamin-tracker'
                )
            );

        const optionalHatchingCard =
            createCard(
                'Hatching',
                'features-hatching'
            );
        optionalHatchingCard
            .appendChild(
                createFeaturePreference(
                    'Auto Hatching',
                    'autoHatching',
                    'Enables Type Egg priority and the Custom strategy based on your current Pok\u00e9Clicker hatchery filters.'
                )
            );
        optionalHatchingCard
            .appendChild(
                createFeaturePreference(
                    'Advanced Hatching Strategies',
                    'advancedHatching',
                    'Unlocks Pok\u00e9rus and Mega strategies. Requires Auto Hatching.'
                )
            );

        const optionalDungeonCard =
            createCard(
                'Dungeons',
                'features-dungeons'
            );
        optionalDungeonCard
            .appendChild(
                createFeaturePreference(
                    'Auto Dungeon',
                    'autoDungeon',
                    'Enables manual-style Default Pathing and dungeon run goals.'
                )
            );
        optionalDungeonCard
            .appendChild(
                createFeaturePreference(
                    'Advanced Dungeon Pathing',
                    'advancedDungeon',
                    'Unlocks objective-driven BFS modes and chest-rarity detours. Requires Auto Dungeon.'
                )
            );

        const optionalFarmCard =
            createCard(
                'Farming',
                'features-farming'
            );
        optionalFarmCard
            .appendChild(
                createFeaturePreference(
                    'Auto Farm',
                    'autoFarm',
                    'Enables the plot-managing Auto Farmer. Route, gem, and type optimizers remain separate.'
                )
            );

        tabContents[
            'Features'
        ].appendChild(
            optionalHatchingCard
        );
        tabContents[
            'Features'
        ].appendChild(
            optionalDungeonCard
        );
        tabContents[
            'Features'
        ].appendChild(
            optionalFarmCard
        );

        let selectedTab = localStorage.getItem(HELPER_TAB_STORAGE_KEY);
        if (selectedTab === 'Optional Features') {
            selectedTab = 'Features';
        }
        if (!tabNames.includes(selectedTab)) {
            selectedTab = 'Dashboard';
        }
        const selectTab = tabName => {
            selectedTab = tabName;
            localStorage.setItem(HELPER_TAB_STORAGE_KEY, tabName);
            for (const name of tabNames) {
                const selected = name === tabName;
                tabContents[name].style.display = selected ? 'block' : 'none';
                tabButtons[name].classList.toggle('is-active', selected);
                tabButtons[name].setAttribute('aria-selected', String(selected));
            }
            if (tabName === 'Farms') {
                farmerControls.refresh();
            } else if (tabName === 'Dungeon') {
                dungeonControls.refresh();
            } else if (tabName === 'Breeding') {
                vitaminControls.refresh();
            }
        };
        for (const tabName of tabNames) {
            tabButtons[tabName].addEventListener('click', () => selectTab(tabName));
        }
        selectTab(selectedTab);

        helperLauncherButton = document.createElement('button');
        styleMainButton(helperLauncherButton);
        helperLauncherButton.classList.add('pkh-launcher');
        helperLauncherButton.type = 'button';
        helperLauncherButton.appendChild(createBrandBall());
        const launcherText = document.createElement('span');
        launcherText.textContent = 'Helper';
        helperLauncherButton.appendChild(launcherText);
        helperLauncherButton.addEventListener('click', () => {
            const opening = mainPanel.style.display === 'none';
            mainPanel.style.display = opening ? 'flex' : 'none';
            helperLauncherButton.setAttribute('aria-expanded', String(opening));
            if (opening) {
                selectTab(selectedTab);
            }
        });
        helperLauncherButton.setAttribute('aria-expanded', 'false');
        closeButton.addEventListener('click', () => {
            mainPanel.style.display = 'none';
            helperLauncherButton.setAttribute('aria-expanded', 'false');
        });

        mainPanel.appendChild(header);
        mainPanel.appendChild(automationStatusPanel);
        mainPanel.appendChild(tabs);
        mainPanel.appendChild(contentViewport);
        container.appendChild(mainPanel);
        container.appendChild(helperLauncherButton);
        document.body.appendChild(container);

        updateClickButton();
        updateHatchButton();
        updateDungeonTokenUI();
        updateGemUI();
        updateTypeFarmUI();
        updateVitaminUI();
        updateAutomationUI();
    }
