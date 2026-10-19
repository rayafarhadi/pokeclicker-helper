    // ============================================================
    // Gem UI
    // ============================================================

    function updateGemUI() {
        if (!gemHeaderButton) {
            return;
        }

        const best = gemResults[0];
        if (!best) {
            gemHeaderButton.textContent =
                'Gem Farm: ' + selectedGemType +
                ' — Not scanned ▾';
            gemBestText.textContent = 'Press Rescan';
            gemTopText.innerHTML = '';
            return;
        }

        const bestName = best.kind === 'Gym'
            ? best.name + ' — ' + best.location
            : best.location;
        const autorun = best.kind === 'Gym'
            ? getGymAutoRepeatState(
                best.gym,
                gemFarmAllowPaidGymAutorun
            )
            : null;

        gemHeaderButton.textContent =
            'Gem Farm: ' + selectedGemType +
            ' → ' + best.name + ' ▾';
        gemBestText.innerHTML =
            '<strong>Best:</strong><br>' +
            bestName + '<br>' +
            'Est. ' + formatNumber(best.gemsPerMinute) + ' gems/min' +
            (autorun
                ? '<br>Autorun: ' + autorun.label
                : '');

        gemTopText.innerHTML = gemResults
            .slice(1, 5)
            .map((result, index) => {
                const name = result.kind === 'Gym'
                    ? result.name + ' — ' + result.location
                    : result.location;
                return (index + 2) + '. ' + name + ' — ' +
                    formatNumber(result.gemsPerMinute) + '/min';
            })
            .join('<br>');
    }

    function createGemPanel() {
        gemHeaderButton =
            document.createElement(
                'button'
            );

        styleMainButton(
            gemHeaderButton
        );

        gemHeaderButton.style.background =
            '#6f42c1';

        gemPanel =
            document.createElement(
                'div'
            );

        Object.assign(
            gemPanel.style,
            {
                display: 'none',
                background:
                    'rgba(25,25,25,0.96)',
                color: 'white',
                borderRadius: '6px',
                padding: '10px',
                width: '250px',
                fontSize: '12px',
                boxShadow:
                    '0 2px 8px rgba(0,0,0,0.45)'
            }
        );

        const title =
            document.createElement(
                'div'
            );

        title.textContent =
            'Gem Farm';

        title.style.fontWeight =
            'bold';

        title.style.fontSize =
            '14px';

        title.style.marginBottom =
            '8px';

        gemTypeSelect =
            document.createElement(
                'select'
            );

        Object.assign(
            gemTypeSelect.style,
            {
                width: '100%',
                marginBottom: '10px'
            }
        );

        for (
            const type of GEM_TYPES
        ) {
            const option =
                document.createElement(
                    'option'
                );

            option.value =
                type;

            option.textContent =
                type;

            gemTypeSelect
                .appendChild(option);
        }

        gemTypeSelect.value =
            selectedGemType;

        gemTypeSelect
            .addEventListener(
                'change',
                () => {
                    selectedGemType =
                        gemTypeSelect.value;

                    localStorage.setItem(
                        GEM_FARM_STORAGE_KEY,
                        selectedGemType
                    );

                    gemResults = [];
                    updateGemUI();
                }
            );

        const gemTypeControl = createSearchableSelect(gemTypeSelect, {
            placeholder: 'Search gem types...'
        });

        const paidAutorunRow =
            document.createElement(
                'label'
            );

        paidAutorunRow.className =
            'pkh-setting';

        const paidAutorunLabel =
            document.createElement(
                'span'
            );

        paidAutorunLabel.className =
            'pkh-setting-label';

        paidAutorunLabel.textContent =
            'Allow paid gym autorun';

        const paidAutorunToggle =
            document.createElement(
                'button'
            );

        paidAutorunToggle.type =
            'button';

        paidAutorunToggle.className =
            'pkh-toggle';

        const syncPaidAutorunToggle = () => {
            paidAutorunToggle.classList.toggle(
                'is-on',
                gemFarmAllowPaidGymAutorun
            );
            paidAutorunToggle.setAttribute(
                'aria-pressed',
                String(gemFarmAllowPaidGymAutorun)
            );
        };

        paidAutorunToggle.addEventListener(
            'click',
            event => {
                event.preventDefault();
                event.stopPropagation();

                gemFarmAllowPaidGymAutorun =
                    !gemFarmAllowPaidGymAutorun;

                localStorage.setItem(
                    GEM_FARM_PAID_AUTORUN_STORAGE_KEY,
                    String(gemFarmAllowPaidGymAutorun)
                );

                syncPaidAutorunToggle();
                updateGemUI();
            }
        );

        syncPaidAutorunToggle();
        paidAutorunRow.appendChild(
            paidAutorunLabel
        );
        paidAutorunRow.appendChild(
            paidAutorunToggle
        );
        gemBestText =
            document.createElement(
                'div'
            );

        gemBestText.style.marginBottom =
            '8px';

        gemTopText =
            document.createElement(
                'div'
            );

        gemTopText.style.opacity =
            '0.85';

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

                gemBestText.textContent =
                    'Scanning...';

                setTimeout(
                    scanGemFarms,
                    0
                );
            }
        );

        gemPanel.appendChild(title);
        gemPanel.appendChild(
            gemTypeControl
        );
        gemPanel.appendChild(
            paidAutorunRow
        );
        gemPanel.appendChild(
            gemBestText
        );
        gemPanel.appendChild(
            gemTopText
        );
        gemPanel.appendChild(
            rescanButton
        );

        gemHeaderButton.addEventListener(
            'click',
            () => {
                const opening =
                    gemPanel.style.display ===
                    'none';

                gemPanel.style.display =
                    opening
                        ? 'block'
                        : 'none';
            }
        );

        updateGemUI();

        return {
            header:
                gemHeaderButton,
            panel:
                gemPanel
        };
    }
