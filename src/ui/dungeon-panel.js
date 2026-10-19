
    function getSelectedDungeon() {
        return TownList[
            dungeonSelect?.value
        ]?.dungeon ?? null;
    }

    function setDungeonChestRaritySelected(
        rarity,
        selected
    ) {
        if (
            !DUNGEON_CHEST_RARITIES
                .includes(rarity)
        ) {
            return;
        }

        const next =
            new Set(
                selectedDungeonChestRarities
            );

        if (selected) {
            next.add(rarity);
        } else {
            next.delete(rarity);
        }

        selectedDungeonChestRarities =
            DUNGEON_CHEST_RARITIES
                .filter(tier =>
                    next.has(tier)
                );

        localStorage.setItem(
            DUNGEON_CHEST_RARITIES_STORAGE_KEY,
            JSON.stringify(
                selectedDungeonChestRarities
            )
        );
    }

    function renderDungeonRewardInfo() {
        if (!dungeonRewardInfo) {
            return;
        }

        const dungeon =
            getSelectedDungeon();

        dungeonRewardInfo.replaceChildren();

        for (
            const tier of
            DUNGEON_CHEST_RARITIES
        ) {
            const loot =
                dungeon
                    ? getAvailableDungeonLoot(
                        dungeon,
                        tier
                    )
                    : [];

            const group =
                document.createElement(
                    'div'
                );
            group.className =
                'pkh-loot-group';

            const heading =
                document.createElement(
                    'label'
                );
            heading.className =
                'pkh-loot-heading';

            const checkbox =
                document.createElement(
                    'input'
                );
            checkbox.type = 'checkbox';
            checkbox.className =
                'pkh-loot-checkbox';
            checkbox.checked =
                selectedDungeonChestRarities
                    .includes(tier);
            checkbox.setAttribute(
                'aria-label',
                'Detour for ' +
                    tier +
                    ' chests'
            );

            const headingText =
                document.createElement(
                    'span'
                );
            headingText.textContent =
                tier[0].toUpperCase() +
                tier.slice(1) +
                ' chest';

            heading.appendChild(
                checkbox
            );
            heading.appendChild(
                headingText
            );
            group.appendChild(
                heading
            );
            group.classList.toggle(
                'is-selected',
                checkbox.checked
            );

            checkbox.addEventListener(
                'change',
                () => {
                    setDungeonChestRaritySelected(
                        tier,
                        checkbox.checked
                    );
                    group.classList.toggle(
                        'is-selected',
                        checkbox.checked
                    );
                }
            );

            const rewards =
                document.createElement(
                    'div'
                );
            rewards.className =
                'pkh-loot-items';

            if (!dungeon) {
                rewards.textContent =
                    'Select an unlocked dungeon to view rewards.';
            } else if (!loot.length) {
                rewards.textContent =
                    'No currently available rewards.';
            } else {
                rewards.textContent =
                    loot.map(item => {
                        const chance =
                            getDungeonLootChance(
                                dungeon,
                                item,
                                tier
                            );
                        const chanceText =
                            chance === null
                                ? ''
                                : ' (' +
                                    (
                                        chance *
                                        100
                                    ).toFixed(
                                        chance >=
                                            0.01
                                            ? 2
                                            : 4
                                    ) +
                                    '%)';
                        const amount =
                            Number(
                                item.amount ??
                                1
                            );
                        const amountText =
                            amount !== 1
                                ? amount + 'x '
                                : '';

                        return amountText +
                            formatDungeonRewardName(
                                item.loot
                            ) +
                            chanceText;
                    }).join(', ');
            }

            group.appendChild(rewards);
            dungeonRewardInfo
                .appendChild(group);
        }
    }

    function renderDungeonCollectionInfo() {
        if (!dungeonCollectionInfo) {
            return;
        }

        const dungeon =
            getSelectedDungeon();

        if (!dungeon) {
            dungeonCollectionInfo
                .textContent = '';
            return;
        }

        dungeonCollectionInfo
            .textContent =
            formatDungeonCollectionProgress(
                getDungeonPokemonProgress(
                    dungeon
                )
            );
    }

    function updateDungeonInformation() {
        renderDungeonRewardInfo();
        renderDungeonCollectionInfo();
    }

    function populateDungeonSelect() {
        if (!dungeonSelect) {
            return;
        }

        const current =
            dungeonSelect.value ||
            localStorage.getItem(
                AUTO_DUNGEON_STORAGE_KEY
            ) ||
            '';

        dungeonSelect.replaceChildren();

        for (
            const town of
            getAvailableDungeons()
        ) {
            const option =
                document.createElement(
                    'option'
                );
            option.value =
                town.name;
            option.textContent =
                town.name +
                ' (' +
                formatNumber(
                    town.dungeon.tokenCost
                ) +
                ' DT)';
            dungeonSelect
                .appendChild(option);
        }

        if (
            [
                ...dungeonSelect
                    .options
            ].some(option =>
                option.value ===
                current
            )
        ) {
            dungeonSelect.value =
                current;
        } else if (
            dungeonSelect
                .options.length
        ) {
            dungeonSelect
                .selectedIndex = 0;
        }

        refreshSearchableSelect(
            dungeonSelect
        );
        updateDungeonInformation();
    }

    function updateDungeonAdvancedAvailability() {
        if (!dungeonNavigationSelect) {
            return;
        }

        const advancedAvailable =
            featureSettings.autoDungeon &&
            featureSettings.advancedDungeon;
        const preferred =
            localStorage.getItem(
                AUTO_DUNGEON_MODE_STORAGE_KEY
            ) ??
            'default';

        for (
            const option of
            dungeonNavigationSelect
                .options
        ) {
            const advanced =
                option.value !==
                'default';
            option.disabled =
                advanced &&
                !advancedAvailable;
            option.hidden =
                advanced &&
                !advancedAvailable;
        }

        if (!advancedAvailable) {
            dungeonNavigationSelect
                .value = 'default';
        } else if (
            [
                ...dungeonNavigationSelect
                    .options
            ].some(option =>
                option.value ===
                preferred
            )
        ) {
            dungeonNavigationSelect
                .value = preferred;
        }

        if (
            dungeonAdvancedControls
        ) {
            dungeonAdvancedControls
                .style.display =
                advancedAvailable &&
                dungeonNavigationSelect
                    .value !==
                    'default'
                    ? 'block'
                    : 'none';
        }
    }

    function createAutoDungeonPanel() {
        dungeonHeaderButton =
            document.createElement(
                'button'
            );
        styleMainButton(
            dungeonHeaderButton
        );
        dungeonHeaderButton
            .style.background =
            '#795548';

        const panel =
            document.createElement(
                'div'
            );
        styleCompactPanel(panel);

        const title =
            document.createElement(
                'div'
            );
        title.textContent =
            'Auto Dungeon Runner';
        title.style.fontWeight =
            'bold';
        title.style.fontSize =
            '14px';

        dungeonSelect =
            document.createElement(
                'select'
            );
        const dungeonControl =
            createSearchableSelect(
                dungeonSelect,
                {
                    placeholder:
                        'Search dungeons...'
                }
            );

        dungeonNavigationSelect =
            document.createElement(
                'select'
            );
        for (
            const [
                value,
                label
            ] of [
                [
                    'default',
                    'Default Pathing'
                ],
                [
                    'boss',
                    'Boss Rush'
                ],
                [
                    'chest',
                    'Chest Farm'
                ],
                [
                    'full',
                    'Full Clear'
                ]
            ]
        ) {
            const option =
                document.createElement(
                    'option'
                );
            option.value = value;
            option.textContent =
                label;
            dungeonNavigationSelect
                .appendChild(option);
        }

        dungeonAdvancedControls =
            document.createElement(
                'div'
            );
        dungeonAdvancedControls
            .className =
            'pkh-advanced-controls';

        const rewardHeading =
            document.createElement(
                'div'
            );
        rewardHeading.className =
            'pkh-subheading';
        rewardHeading.textContent =
            'Chest rewards and priorities';

        dungeonRewardInfo =
            document.createElement(
                'div'
            );
        dungeonRewardInfo.className =
            'pkh-loot-info';

        const rarityNote =
            createTextLine();
        rarityNote.className =
            'pkh-inline-help';
        rarityNote.textContent =
            'Full Clear collects checked rarities before battles and other chests. Chest Farm collects every chest while minimizing battles. PokéClicker generates chest tiers with the map, so hidden objectives can be routed to directly.';

        const rewardNote =
            createTextLine();
        rewardNote.className =
            'pkh-inline-help';
        rewardNote.textContent =
            'Rewards shown are currently allowed by game requirements and item availability. Percentages are per chest and use the current clear-count and debuff logic.';

        dungeonAdvancedControls
            .appendChild(
                rewardHeading
            );
        dungeonAdvancedControls
            .appendChild(
                dungeonRewardInfo
            );
        dungeonAdvancedControls
            .appendChild(
                rarityNote
            );
        dungeonAdvancedControls
            .appendChild(
                rewardNote
            );

        const goal =
            document.createElement(
                'select'
            );
        for (
            const [
                value,
                label
            ] of [
                [
                    'finite',
                    'Clear X times'
                ],
                [
                    'indefinite',
                    'Run indefinitely'
                ],
                [
                    'allCaught',
                    'Run until all Pok\u00e9mon caught'
                ]
            ]
        ) {
            const option =
                document.createElement(
                    'option'
                );
            option.value = value;
            option.textContent =
                label;
            goal.appendChild(option);
        }

        const storedGoal =
            localStorage.getItem(
                AUTO_DUNGEON_GOAL_STORAGE_KEY
            ) ??
            'finite';
        goal.value = [
            'finite',
            'indefinite',
            'allCaught'
        ].includes(storedGoal)
            ? storedGoal
            : 'finite';

        const target =
            createNumberInput(
                localStorage.getItem(
                    AUTO_DUNGEON_TARGET_STORAGE_KEY
                ) ??
                '1'
            );
        const reserve =
            createNumberInput(
                localStorage.getItem(
                    AUTO_DUNGEON_RESERVE_STORAGE_KEY
                ) ??
                '0'
            );
        reserve.min = '0';

        dungeonCollectionInfo =
            createTextLine();
        dungeonCollectionInfo
            .className =
            'pkh-collection-info';
        dungeonCollectionInfo
            .style.whiteSpace =
            'pre-line';

        const status =
            createTextLine();
        status.style.whiteSpace =
            'pre-line';
        status.style.marginTop =
            '8px';
        status.textContent = 'Idle';
        executionViews.dungeon = {
            status,
            lastStatus: 'Idle'
        };

        const buttons =
            document.createElement(
                'div'
            );
        Object.assign(
            buttons.style,
            {
                display: 'flex',
                gap: '5px',
                marginTop: '8px'
            }
        );

        dungeonStartButton =
            document.createElement(
                'button'
            );
        dungeonStartButton
            .textContent = 'Start';
        styleCompactButton(
            dungeonStartButton,
            '#198754'
        );

        const stopButton =
            document.createElement(
                'button'
            );
        stopButton.textContent =
            'Stop';
        styleCompactButton(
            stopButton,
            '#dc3545'
        );

        const syncGoal = () => {
            target.disabled =
                goal.value !==
                'finite';
            localStorage.setItem(
                AUTO_DUNGEON_GOAL_STORAGE_KEY,
                goal.value
            );
            renderDungeonCollectionInfo();
        };

        dungeonSelect
            .addEventListener(
                'change',
                () => {
                    localStorage.setItem(
                        AUTO_DUNGEON_STORAGE_KEY,
                        dungeonSelect.value
                    );
                    updateDungeonInformation();
                }
            );

        dungeonNavigationSelect
            .addEventListener(
                'change',
                () => {
                    localStorage.setItem(
                        AUTO_DUNGEON_MODE_STORAGE_KEY,
                        dungeonNavigationSelect
                            .value
                    );
                    updateDungeonAdvancedAvailability();
                }
            );

        goal.addEventListener(
            'change',
            syncGoal
        );
        target.addEventListener(
            'change',
            () =>
                localStorage.setItem(
                    AUTO_DUNGEON_TARGET_STORAGE_KEY,
                    target.value
                )
        );
        reserve.addEventListener(
            'change',
            () =>
                localStorage.setItem(
                    AUTO_DUNGEON_RESERVE_STORAGE_KEY,
                    reserve.value
                )
        );

        dungeonStartButton
            .addEventListener(
                'click',
                event => {
                    event.stopPropagation();
                    startAutoDungeon(
                        dungeonSelect.value,
                        dungeonNavigationSelect
                            .value,
                        goal.value,
                        target.value,
                        reserve.value
                    );
                }
            );
        stopButton.addEventListener(
            'click',
            event => {
                event.stopPropagation();
                if (
                    foregroundJob?.id ===
                    'dungeon'
                ) {
                    stopForegroundJob();
                }
            }
        );

        buttons.appendChild(
            dungeonStartButton
        );
        buttons.appendChild(
            stopButton
        );
        panel.appendChild(title);
        panel.appendChild(
            createFieldLabel(
                'Dungeon',
                dungeonControl
            )
        );
        panel.appendChild(
            createFieldLabel(
                'Navigation',
                dungeonNavigationSelect
            )
        );
        panel.appendChild(
            dungeonAdvancedControls
        );
        panel.appendChild(
            createFieldLabel(
                'Goal',
                goal
            )
        );
        panel.appendChild(
            createFieldLabel(
                'Target',
                target
            )
        );
        panel.appendChild(
            createFieldLabel(
                'Minimum DT reserve',
                reserve
            )
        );
        panel.appendChild(
            dungeonCollectionInfo
        );
        panel.appendChild(status);
        panel.appendChild(buttons);

        dungeonHeaderButton
            .addEventListener(
                'click',
                () => {
                    populateDungeonSelect();
                    panel.style.display =
                        panel.style.display ===
                            'none'
                            ? 'block'
                            : 'none';
                }
            );

        syncGoal();
        populateDungeonSelect();
        updateDungeonAdvancedAvailability();
        updateAutomationUI();

        return {
            header:
                dungeonHeaderButton,
            panel,
            refresh() {
                populateDungeonSelect();
                updateDungeonAdvancedAvailability();
            }
        };
    }
