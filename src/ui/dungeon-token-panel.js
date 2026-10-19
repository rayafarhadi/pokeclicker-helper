    // ============================================================
    // DT UI
    // ============================================================

    function formatExpectedBallRates(result) {
        const rates =
            Object.entries(
                result?.ballsPerMinute ?? {}
            )
                .filter(([, rate]) =>
                    Number(rate) > 0
                )
                .map(([ballType, rate]) =>
                    `${getBallName(ballType)} ${Number(rate).toFixed(1)}/min`
                );

        return rates.length
            ? rates.join(', ')
            : 'No balls thrown';
    }

    function formatRouteRanking(
        label,
        results,
        metric,
        suffix,
        digits = null
    ) {
        if (!results?.length) {
            return `<strong>${label}:</strong><br>No positive-yield route`;
        }

        const shown =
            results.slice(0, 4);

        return `<strong>${label}:</strong><br>` +
            shown.map((result, index) => {
                const value =
                    digits === null
                        ? formatNumber(
                            result[metric]
                        )
                        : Number(
                            result[metric]
                        ).toFixed(digits);

                return `${index + 1}. ${result.route.routeName} — ` +
                    `${value}${suffix}`;
            }).join('<br>') +
            `<br><span style="opacity:.72">Best ball use: ` +
            `${formatExpectedBallRates(shown[0])}</span>`;
    }
    function updateDungeonTokenUI() {
        if (!dtHeaderButton) {
            return;
        }

        const bestSuggestion =
            theoreticalResults[0];

        const suggestedName =
            bestSuggestion
                ? bestSuggestion.route
                    .routeName
                : 'Not scanned';

        dtHeaderButton.textContent =
            `DT Farm: ${suggestedName} ▾`;

        dtSuggestedText.textContent =
            `Suggested: ${suggestedName}`;

        if (dtStrategyText) {
            dtStrategyText.innerHTML =
                dtHasScanned
                    ? formatRouteRanking(
                        'Current Settings',
                        dtScenarioResults.currentSettings,
                        'estimatedDTPerMinute',
                        ' DT/min'
                    ) +
                    '<div style="height:8px"></div>' +
                    formatRouteRanking(
                        'Ultra Ball — Catch All (comparison)',
                        dtScenarioResults.ultraAll,
                        'estimatedDTPerMinute',
                        ' DT/min'
                    )
                    : 'Press Rescan to compare capture strategies.';
        }

        dtCurrentText.textContent =
            `Current: ${currentMeasuredRouteName ??
            'Not farming a route'
            }`;

        const current =
            getCurrentDTRate();

        if (
            current.seconds >= 2
        ) {
            dtRateText.textContent =
                `DT/min: ${formatNumber(
                    current.rate
                )
                }`;
        } else {
            dtRateText.textContent =
                'DT/min: —';
        }

        if (
            current.seconds >=
            DT_STABLE_SECONDS - 1
        ) {
            dtSampleText.textContent =
                'Sample: Stable';
        } else if (
            current.seconds > 0
        ) {
            dtSampleText.textContent =
                `Sample: ${Math.floor(
                    current.seconds
                )
                }s / ${DT_STABLE_SECONDS
                }s`;
        } else {
            dtSampleText.textContent =
                'Sample: Waiting';
        }

        if (
            bestMeasuredRoute &&
            bestMeasuredRate > 0
        ) {
            dtBestText.innerHTML =
                `Best seen: <strong>${formatNumber(
                    bestMeasuredRate
                )
                } DT/min</strong><br>` +
                bestMeasuredRoute;
        } else {
            dtBestText.innerHTML =
                'Best seen: —';
        }
    }

    function createDungeonTokenPanel() {
        dtHeaderButton =
            document.createElement(
                'button'
            );

        styleMainButton(
            dtHeaderButton
        );

        dtHeaderButton.style.background =
            '#0d6efd';

        dtHeaderButton.textContent =
            'DT Farm: Not scanned ▾';

        dtPanel =
            document.createElement(
                'div'
            );

        Object.assign(
            dtPanel.style,
            {
                display: 'none',
                background:
                    'rgba(25,25,25,0.96)',
                color: 'white',
                borderRadius: '6px',
                padding: '10px',
                width: '300px',
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
            'Dungeon Token Farm';

        Object.assign(
            title.style,
            {
                fontWeight: 'bold',
                fontSize: '14px',
                marginBottom: '8px'
            }
        );

        dtSuggestedText =
            createTextLine();

        dtStrategyText =
            createTextLine();

        Object.assign(
            dtStrategyText.style,
            {
                marginTop: '8px',
                paddingTop: '8px',
                borderTop:
                    '1px solid rgba(255,255,255,0.2)'
            }
        );

        dtCurrentText =
            createTextLine();

        dtRateText =
            createTextLine();

        dtRateText.style.fontSize =
            '15px';

        dtRateText.style.fontWeight =
            'bold';

        dtSampleText =
            createTextLine();

        dtBestText =
            createTextLine();

        dtBestText.style.marginTop =
            '8px';

        dtBestText.style.paddingTop =
            '8px';

        dtBestText.style.borderTop =
            '1px solid rgba(255,255,255,0.2)';

        const buttonRow =
            document.createElement(
                'div'
            );

        Object.assign(
            buttonRow.style,
            {
                display: 'flex',
                gap: '5px',
                marginTop: '10px'
            }
        );

        const resetButton =
            document.createElement(
                'button'
            );

        resetButton.textContent =
            'Reset Best';

        const rescanButton =
            document.createElement(
                'button'
            );

        rescanButton.textContent =
            'Rescan';

        for (
            const button of [
                resetButton,
                rescanButton
            ]
        ) {
            Object.assign(
                button.style,
                {
                    flex: '1',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px',
                    cursor: 'pointer'
                }
            );
        }

        resetButton.addEventListener(
            'click',
            event => {
                event.stopPropagation();

                bestMeasuredRate = 0;
                bestMeasuredRoute = null;

                updateDungeonTokenUI();
            }
        );

        rescanButton.addEventListener(
            'click',
            event => {
                event.stopPropagation();

                dtSuggestedText.textContent =
                    'Suggested: Scanning...';

                setTimeout(
                    scanDungeonTokenRoutes,
                    0
                );
            }
        );

        buttonRow.appendChild(
            resetButton
        );

        buttonRow.appendChild(
            rescanButton
        );

        dtPanel.appendChild(title);
        dtPanel.appendChild(
            dtSuggestedText
        );
        dtPanel.appendChild(
            dtStrategyText
        );
        dtPanel.appendChild(
            dtCurrentText
        );
        dtPanel.appendChild(
            dtRateText
        );
        dtPanel.appendChild(
            dtSampleText
        );
        dtPanel.appendChild(
            dtBestText
        );
        dtPanel.appendChild(
            buttonRow
        );

        dtHeaderButton.addEventListener(
            'click',
            () => {
                const opening =
                    dtPanel.style.display ===
                    'none';

                dtPanel.style.display =
                    opening
                        ? 'block'
                        : 'none';
            }
        );

        return {
            header:
                dtHeaderButton,
            panel:
                dtPanel
        };
    }
