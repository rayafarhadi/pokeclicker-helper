    // ============================================================
    // Type Farm UI
    // ============================================================

    function updateTypeFarmUI() {
        if (!typeFarmHeaderButton) {
            return;
        }

        const typeName =
            getTypeFarmTypeName();

        const best =
            typeFarmScenarioResults
                .currentSettings[0];

        if (!typeFarmHasScanned) {
            typeFarmHeaderButton.textContent =
                `Type Farm: ${typeName} — Not scanned ▾`;
            typeFarmBestText.textContent =
                'Press Rescan';
            typeFarmTopText.textContent = '';
            return;
        }

        if (best) {
            typeFarmHeaderButton.textContent =
                `Type Farm: ${typeName} → ${best.route.routeName} ▾`;
        } else {
            typeFarmHeaderButton.textContent =
                `Type Farm: ${typeName} — No current route ▾`;
        }

        typeFarmBestText.innerHTML =
            formatRouteRanking(
                'Current Settings',
                typeFarmScenarioResults
                    .currentSettings,
                'catchesPerMinute',
                ' catches/min',
                2
            ) +
            '<div style="height:8px"></div>' +
            formatRouteRanking(
                'Ultra Ball — Catch All (comparison)',
                typeFarmScenarioResults.ultraAll,
                'catchesPerMinute',
                ' catches/min',
                2
            ) +
            '<div style="height:8px"></div>' +
            formatRouteRanking(
                'Ultra Ball — Target Only (comparison)',
                typeFarmScenarioResults
                    .ultraTargetOnly,
                'catchesPerMinute',
                ' catches/min',
                2
            );

        if (best) {
            typeFarmTopText.innerHTML =
                `Current best: target encounters ` +
                `${(
                    best.targetEncounterRate * 100
                ).toFixed(1)}%, ` +
                `target catch chance ` +
                `${(
                    best.targetCatchChance * 100
                ).toFixed(1)}%`;
        } else {
            typeFarmTopText.textContent =
                'Current filters produce no positive expected catches for this type.';
        }
    }
    function createTypeFarmPanel() {
        typeFarmHeaderButton =
            document.createElement(
                'button'
            );

        styleMainButton(
            typeFarmHeaderButton
        );

        typeFarmHeaderButton.style.background =
            '#fd7e14';

        typeFarmHeaderButton.textContent =
            `Type Farm: ${getTypeFarmTypeName()} — Not scanned ▾`;

        typeFarmPanel =
            document.createElement(
                'div'
            );

        Object.assign(
            typeFarmPanel.style,
            {
                display: 'none',
                background:
                    'rgba(25,25,25,0.96)',
                color: 'white',
                borderRadius: '6px',
                padding: '10px',
                width: '250px',
                fontSize: '12px',
                lineHeight: '1.35',
                boxShadow:
                    '0 2px 8px rgba(0,0,0,0.45)'
            }
        );

        const title =
            document.createElement(
                'div'
            );

        title.textContent =
            'Type Farm';

        title.style.fontWeight =
            'bold';

        title.style.fontSize =
            '14px';

        title.style.marginBottom =
            '8px';

        typeFarmTypeSelect =
            document.createElement(
                'select'
            );

        Object.assign(
            typeFarmTypeSelect.style,
            {
                width: '100%',
                marginBottom: '10px'
            }
        );

        for (
            const type of
            TYPE_FARM_TYPES
        ) {
            const option =
                document.createElement(
                    'option'
                );

            option.value =
                String(type);

            option.textContent =
                PokemonType[type];

            typeFarmTypeSelect
                .appendChild(option);
        }

        typeFarmTypeSelect.value =
            String(typeFarmType);

        typeFarmTypeSelect.addEventListener(
            'change',
            () => {
                typeFarmType =
                    Number(
                        typeFarmTypeSelect
                            .value
                    );

                localStorage.setItem(
                    TYPE_FARM_STORAGE_KEY,
                    String(
                        typeFarmType
                    )
                );

                typeFarmResults = [];
                typeFarmScenarioResults = {
                    currentSettings: [],
                    ultraAll: [],
                    ultraTargetOnly: []
                };
                typeFarmHasScanned = false;

                updateTypeFarmUI();
            }
        );

        const typeFarmTypeControl = createSearchableSelect(typeFarmTypeSelect, {
            placeholder: 'Search types...'
        });

        typeFarmBestText =
            document.createElement(
                'div'
            );

        typeFarmBestText.style.marginBottom =
            '8px';

        typeFarmTopText =
            document.createElement(
                'div'
            );

        typeFarmTopText.style.opacity =
            '0.85';

        const note =
            document.createElement(
                'div'
            );

        note.textContent =
            'Current Settings controls automation. Ultra Ball rows are comparisons only and never change filters.';

        Object.assign(
            note.style,
            {
                marginTop: '8px',
                paddingTop: '8px',
                borderTop:
                    '1px solid rgba(255,255,255,0.2)',
                opacity: '0.7'
            }
        );

        const rescanButton =
            document.createElement(
                'button'
            );

        rescanButton.textContent =
            'Rescan';

        Object.assign(
            rescanButton.style,
            {
                width: '100%',
                border: 'none',
                borderRadius: '4px',
                padding: '6px',
                marginTop: '10px',
                cursor: 'pointer'
            }
        );

        rescanButton.addEventListener(
            'click',
            event => {
                event.stopPropagation();

                typeFarmBestText.textContent =
                    'Scanning...';

                setTimeout(
                    scanTypeCatchRoutes,
                    0
                );
            }
        );

        typeFarmPanel.appendChild(
            title
        );

        typeFarmPanel.appendChild(
            typeFarmTypeControl
        );

        typeFarmPanel.appendChild(
            typeFarmBestText
        );

        typeFarmPanel.appendChild(
            typeFarmTopText
        );

        typeFarmPanel.appendChild(
            note
        );

        typeFarmPanel.appendChild(
            rescanButton
        );

        typeFarmHeaderButton.addEventListener(
            'click',
            () => {
                const opening =
                    typeFarmPanel.style.display ===
                    'none';

                typeFarmPanel.style.display =
                    opening
                        ? 'block'
                        : 'none';
            }
        );

        updateTypeFarmUI();

        return {
            header:
                typeFarmHeaderButton,
            panel:
                typeFarmPanel
        };
    }
