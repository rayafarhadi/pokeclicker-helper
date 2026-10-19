    // ============================================================
    // Vitamin UI
    // ============================================================

    function escapeVitaminHTML(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function populateVitaminRegionSelect() {
        if (!vitaminRegionSelect) {
            return;
        }
        const highestRegion = player.highestRegion();
        selectedVitaminRegion = Math.min(selectedVitaminRegion, highestRegion);
        vitaminRegionSelect.replaceChildren();
        for (let region = 0; region <= highestRegion; region++) {
            const option = document.createElement('option');
            option.value = String(region);
            option.textContent = getRegionName(region);
            vitaminRegionSelect.appendChild(option);
        }
        vitaminRegionSelect.value = String(selectedVitaminRegion);
        refreshSearchableSelect(vitaminRegionSelect);
    }

    function populateVitaminPokemonSelect() {
        if (!vitaminPokemonSelect) {
            return;
        }
        const pokemonList = App.game.party.caughtPokemon || [];
        const selected = selectedVitaminPokemon &&
            pokemonList.includes(selectedVitaminPokemon)
            ? selectedVitaminPokemon
            : null;
        const nameCounts = new Map();
        for (const pokemon of pokemonList) {
            nameCounts.set(pokemon.name, (nameCounts.get(pokemon.name) || 0) + 1);
        }

        vitaminPokemonByValue = new Map();
        vitaminPokemonSelect.replaceChildren();
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'Choose a Pokemon';
        vitaminPokemonSelect.appendChild(empty);

        let selectedValue = '';
        pokemonList.forEach((pokemon, index) => {
            const value = String(index);
            const option = document.createElement('option');
            option.value = value;
            option.textContent = nameCounts.get(pokemon.name) > 1
                ? pokemon.name + ' (#' + (pokemon.id ?? index + 1) + ')'
                : pokemon.name;
            option.dataset.search = pokemon.name + ' ' + option.textContent;
            vitaminPokemonByValue.set(value, pokemon);
            vitaminPokemonSelect.appendChild(option);
            if (pokemon === selected) {
                selectedValue = value;
            }
        });

        selectedVitaminPokemon = selected;
        vitaminPokemonSelect.value = selectedValue;
        refreshSearchableSelect(vitaminPokemonSelect);
    }

    function updateSelectedVitaminUI() {
        if (!vitaminPokemonDetailsText) {
            return;
        }
        if (!selectedVitaminPokemon) {
            vitaminPokemonDetailsText.innerHTML =
                '<div class="pkh-empty-state">Search for any owned Pokemon to inspect its true vitamin optimum.</div>';
            return;
        }

        let result;
        try {
            result = analyzeIndividualVitaminPokemon(
                selectedVitaminPokemon,
                selectedVitaminRegion
            );
        } catch (error) {
            console.warn('[Vitamin Tracker] Individual calculation failed.', error);
            vitaminPokemonDetailsText.innerHTML =
                '<div class="pkh-empty-state">This Pokemon could not be calculated.</div>';
            return;
        }

        const nativeRegion = result.nativeRegion === null
            ? 'Unknown'
            : getRegionName(result.nativeRegion);
        const percent = Number.isFinite(result.improvementPercent)
            ? result.improvementPercent.toFixed(2) + '%'
            : 'Infinite';
        const signedImprovement = (result.improvement >= 0 ? '+' : '') +
            result.improvement.toFixed(6);
        const statuses = [
            Math.abs(result.improvement) <= 1e-12
                ? 'Already at the optimal setup.'
                : 'Optimization available.'
        ];
        if (result.currentTotal >= result.cap) {
            statuses.push('Vitamin cap reached.');
        }
        const formatChange = value => value > 0
            ? '+' + value
            : (value < 0 ? String(value) : 'No change');
        const hatcheryNotice = result.inHatchery
            ? '<div class="pkh-vitamin-notice">This Pokemon must leave the Hatchery or queue before its vitamins can be changed. The optimum remains available here.</div>'
            : '';

        vitaminPokemonDetailsText.innerHTML =
            '<div class="pkh-vitamin-details">' +
            '<div class="pkh-metric-row"><span>Pokemon</span><strong>' +
                escapeVitaminHTML(result.name) + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Native Region</span><strong>' +
                escapeVitaminHTML(nativeRegion) + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Target Region</span><strong>' +
                escapeVitaminHTML(getRegionName(result.targetRegion)) + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Vitamin Cap</span><strong>' +
                result.cap + '</strong></div>' +
            '<div class="pkh-table-wrap"><table class="pkh-vitamin-table">' +
            '<thead><tr><th>Vitamin</th><th>Current</th><th>Optimal</th><th>Change</th></tr></thead>' +
            '<tbody><tr><td>Protein</td><td>' + result.current.protein +
                '</td><td class="pkh-positive">' + result.optimal.protein +
                '</td><td>' + formatChange(result.optimal.protein - result.current.protein) + '</td></tr>' +
            '<tr><td>Calcium</td><td>' + result.current.calcium +
                '</td><td class="pkh-positive">' + result.optimal.calcium +
                '</td><td>' + formatChange(result.optimal.calcium - result.current.calcium) + '</td></tr>' +
            '<tr><td>Carbos</td><td>' + result.current.carbos +
                '</td><td class="pkh-positive">' + result.optimal.carbos +
                '</td><td>' + formatChange(result.optimal.carbos - result.current.carbos) + '</td></tr>' +
            '<tr><td><strong>Total</strong></td><td><strong>' + result.currentTotal +
                '</strong></td><td class="pkh-positive"><strong>' + result.optimalTotal +
                '</strong></td><td><strong>' +
                formatChange(result.optimalTotal - result.currentTotal) +
                '</strong></td></tr></tbody></table></div>' +
            '<div class="pkh-metric-row"><span>Regional BE</span><strong>' +
                result.currentBE.toFixed(6) + ' -> ' + result.optimalBE.toFixed(6) +
                '</strong></div>' +
            '<div class="pkh-metric-row"><span>Improvement</span><strong class="' +
                (result.improvement > 1e-12 ? 'pkh-positive' : '') + '">' +
                signedImprovement + ' (' + percent + ')</strong></div>' +
            '<div class="pkh-metric-row"><span>Egg Steps</span><strong>' +
                formatNumber(result.currentEggSteps) + ' -> ' +
                formatNumber(result.optimalEggSteps) + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Breeding Attack Gain</span><strong>' +
                result.currentAttackGain.toFixed(3) + ' -> ' +
                result.optimalAttackGain.toFixed(3) + '</strong></div>' +
            '<div class="pkh-vitamin-guidance"><strong>Guidance:</strong> ' +
                escapeVitaminHTML(result.guidance) + '<br>' +
                escapeVitaminHTML(statuses.join(' ')) + '</div>' +
            hatcheryNotice +
            '</div>';
    }

    function updateVitaminUI() {
        if (!vitaminHeaderButton) {
            return;
        }

        updateSelectedVitaminUI();
        const regionName = getRegionName(selectedVitaminRegion);
        const best = vitaminResults[0];
        const multiplier = getNonNativeAttackMultiplier();
        vitaminSummaryText.innerHTML =
            '<div class="pkh-metric-row"><span>Target Region</span><strong>' +
                regionName + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Regional Debuff</span><strong class="' +
                (isRegionalDebuffActive() ? 'pkh-positive' : '') + '">' +
                (isRegionalDebuffActive() ? 'Active' : 'Off') + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Non-native multiplier</span><strong>x' +
                multiplier.toFixed(2) + '</strong></div>' +
            '<div class="pkh-metric-row"><span>Vitamin Cap</span><strong>' +
                getVitaminCap() + '</strong></div>';

        if (!best) {
            vitaminHeaderButton.textContent =
                'Vitamins: ' + regionName + ' - ' +
                (vitaminHasScanned ? 'No beneficial targets' : 'Not scanned');
            vitaminResultsText.innerHTML =
                '<div class="pkh-empty-state">' +
                (vitaminHasScanned
                    ? 'No beneficial vitamin investments with currently unlocked vitamins.'
                    : 'Refresh the tracker to calculate the best investments.') +
                '</div>';
            return;
        }

        vitaminHeaderButton.textContent =
            'Vitamins: ' + regionName + ' -> ' + best.name;

        const rows = vitaminResults
            .slice(0, 10)
            .map((result, index) => {
                const current = result.current;
                const optimal = result.optimal;
                const nativeRegion = result.nativeRegion === null
                    ? 'Unknown'
                    : getRegionName(result.nativeRegion);
                const gain =
                    (Math.floor(result.nextGain * 1000) / 1000).toFixed(3);
                return (
                    '<tr>' +
                    '<td>' + (index + 1) + '</td>' +
                    '<td><strong>' + escapeVitaminHTML(result.name) + '</strong></td>' +
                    '<td>' + escapeVitaminHTML(nativeRegion) + '</td>' +
                    '<td>' + current.protein + 'P/' + current.calcium + 'Ca/' +
                        current.carbos + 'Cb</td>' +
                    '<td class="pkh-positive">' + optimal.protein + 'P/' +
                        optimal.calcium + 'Ca/' + optimal.carbos + 'Cb</td>' +
                    '<td class="pkh-positive">+' + gain + '</td>' +
                    '</tr>'
                );
            })
            .join('');

        vitaminResultsText.innerHTML =
            '<div class="pkh-table-wrap"><table class="pkh-vitamin-table">' +
            '<thead><tr><th>#</th><th>Pokemon</th><th>Native</th>' +
            '<th>Current</th><th>Optimal</th>' +
            '<th title="regional BE / vitamin">Delta BE</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';
    }

    function createVitaminPanel() {
        vitaminHeaderButton = document.createElement('button');
        styleMainButton(vitaminHeaderButton);
        vitaminHeaderButton.style.background = '#20c997';
        vitaminHeaderButton.textContent =
            'Vitamins: ' + getRegionName(selectedVitaminRegion) + ' - Not scanned';

        vitaminPanel = document.createElement('div');
        Object.assign(vitaminPanel.style, {
            display: 'none',
            background: 'rgba(25,25,25,0.97)',
            color: 'white',
            borderRadius: '6px',
            padding: '10px',
            position: 'fixed',
            boxSizing: 'border-box',
            width: '360px',
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: 'min(78vh, calc(100vh - 16px))',
            overflowWrap: 'anywhere',
            overflowY: 'auto',
            fontSize: '12px',
            lineHeight: '1.35',
            boxShadow: '0 2px 8px rgba(0,0,0,0.45)'
        });

        const title = document.createElement('div');
        title.textContent = 'Vitamin Tracker';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '14px';
        title.style.marginBottom = '8px';

        vitaminRegionSelect = document.createElement('select');
        populateVitaminRegionSelect();
        const regionControl = createSearchableSelect(vitaminRegionSelect, {
            placeholder: 'Search regions...'
        });
        vitaminRegionSelect.addEventListener('change', () => {
            selectedVitaminRegion = Number(vitaminRegionSelect.value);
            localStorage.setItem(
                VITAMIN_REGION_STORAGE_KEY,
                String(selectedVitaminRegion)
            );
            vitaminScanId++;
            vitaminResults = [];
            vitaminHasScanned = false;
            updateVitaminUI();
        });

        vitaminPokemonSelect = document.createElement('select');
        populateVitaminPokemonSelect();
        const pokemonControl = createSearchableSelect(vitaminPokemonSelect, {
            placeholder: 'Search owned Pokemon...',
            noResultsText: 'No owned Pokemon match'
        });
        vitaminPokemonSelect.addEventListener('change', () => {
            selectedVitaminPokemon =
                vitaminPokemonByValue.get(vitaminPokemonSelect.value) || null;
            updateSelectedVitaminUI();
        });

        vitaminPokemonDetailsText = document.createElement('div');
        vitaminSummaryText = document.createElement('div');
        Object.assign(vitaminSummaryText.style, {
            marginTop: '10px',
            marginBottom: '10px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.2)'
        });
        vitaminResultsText = document.createElement('div');

        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Refresh Tracker';
        refreshButton.className =
            'pkh-button pkh-button-primary pkh-full-button';
        Object.assign(refreshButton.style, {
            width: '100%',
            border: 'none',
            borderRadius: '4px',
            padding: '7px',
            marginTop: '8px',
            cursor: 'pointer'
        });
        refreshButton.addEventListener('click', event => {
            event.stopPropagation();
            vitaminResultsText.textContent = 'Calculating...';
            setTimeout(scanVitaminEfficiency, 0);
        });

        vitaminPanel.appendChild(title);
        vitaminPanel.appendChild(createFieldLabel('Target Region', regionControl));
        vitaminPanel.appendChild(createFieldLabel('Pokemon', pokemonControl));
        vitaminPanel.appendChild(vitaminPokemonDetailsText);
        vitaminPanel.appendChild(vitaminSummaryText);
        vitaminPanel.appendChild(vitaminResultsText);
        vitaminPanel.appendChild(refreshButton);

        vitaminHeaderButton.addEventListener('click', () => {
            const opening = vitaminPanel.style.display === 'none';
            vitaminPanel.style.display = opening ? 'block' : 'none';
            if (opening) {
                populateVitaminRegionSelect();
                populateVitaminPokemonSelect();
                updateVitaminUI();
            }
        });

        updateVitaminUI();
        return {
            header: vitaminHeaderButton,
            panel: vitaminPanel,
            refresh() {
                populateVitaminRegionSelect();
                populateVitaminPokemonSelect();
                updateVitaminUI();
            }
        };
    }
