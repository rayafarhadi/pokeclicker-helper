
    function styleCompactPanel(panel, width = '250px') {
        Object.assign(panel.style, {
            display: 'none',
            background: 'rgba(25,25,25,0.96)',
            color: 'white',
            borderRadius: '6px',
            padding: '10px',
            width,
            maxWidth: 'calc(100vw - 30px)',
            maxHeight: 'calc(100vh - 30px)',
            overflowY: 'auto',
            fontSize: '12px',
            lineHeight: '1.35',
            boxShadow: '0 2px 8px rgba(0,0,0,0.45)'
        });
    }

    function styleCompactButton(button, color = '') {
        button.classList.add('pkh-button');
        if (color === '#dc3545') {
            button.classList.add('pkh-button-danger');
        } else if (color) {
            button.classList.add('pkh-button-primary');
        }
        Object.assign(button.style, {
            flex: '1',
            cursor: 'pointer'
        });
    }

    function createFieldLabel(text, control) {
        const label = document.createElement('label');
        label.textContent = text;
        label.className = 'pkh-field-label';
        Object.assign(control.style, {
            width: '100%',
            boxSizing: 'border-box'
        });
        const wrapper = document.createElement('div');
        wrapper.className = 'pkh-field';
        wrapper.appendChild(label);
        wrapper.appendChild(control);
        return wrapper;
    }

    const searchableSelectControllers = new WeakMap();
    let activeSearchableSelect = null;
    let searchableSelectId = 0;

    function filterSearchableOptions(options, query) {
        const needle = String(query ?? '').trim().toLocaleLowerCase();
        return [...options].filter(option => {
            const haystack = (option.dataset.search || option.textContent || '')
                .toLocaleLowerCase();
            return !needle || haystack.includes(needle);
        });
    }

    function refreshSearchableSelect(select) {
        searchableSelectControllers.get(select)?.refresh();
    }

    function createSearchableSelect(select, config = {}) {
        const existing = searchableSelectControllers.get(select);
        if (existing) {
            existing.refresh();
            return existing.wrapper;
        }

        const threshold = config.threshold ?? 6;
        const wrapper = document.createElement('div');
        wrapper.className = 'pkh-search-select';
        if (select.style.marginBottom) {
            wrapper.style.marginBottom = select.style.marginBottom;
            select.style.marginBottom = '';
        }
        const controlId = 'pkh-search-' + ++searchableSelectId;
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'pkh-search-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', controlId + '-results');

        const popup = document.createElement('div');
        popup.className = 'pkh-search-popup';
        popup.style.display = 'none';
        const searchRow = document.createElement('div');
        searchRow.className = 'pkh-search-row';
        const input = document.createElement('input');
        input.type = 'search';
        input.className = 'pkh-search-input';
        input.placeholder = config.placeholder || 'Search...';
        input.setAttribute('aria-label', input.placeholder);
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', controlId + '-results');
        input.setAttribute('aria-expanded', 'false');
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'pkh-search-clear';
        clear.textContent = 'x';
        clear.setAttribute('aria-label', 'Clear search');
        const results = document.createElement('div');
        results.className = 'pkh-search-results';
        results.id = controlId + '-results';
        results.setAttribute('role', 'listbox');
        searchRow.appendChild(input);
        searchRow.appendChild(clear);
        popup.appendChild(searchRow);
        popup.appendChild(results);
        wrapper.appendChild(select);
        wrapper.appendChild(trigger);
        document.body.appendChild(popup);

        let activeIndex = 0;
        let visibleOptions = [];

        const isEnhanced = () => select.options.length >= threshold;
        const selectedText = () =>
            select.selectedOptions?.[0]?.textContent ||
            select.options[select.selectedIndex]?.textContent ||
            config.placeholder || 'Select...';

        const positionPopup = () => {
            const rect = trigger.getBoundingClientRect();
            const viewportWidth = document.documentElement.clientWidth;
            const viewportHeight = document.documentElement.clientHeight;
            const width = Math.min(Math.max(rect.width, 240), viewportWidth - 16);
            popup.style.width = width + 'px';
            popup.style.left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8)) + 'px';
            const height = Math.min(popup.offsetHeight || 320, viewportHeight - 16);
            const below = rect.bottom + 4;
            popup.style.top = (below + height <= viewportHeight - 8
                ? below
                : Math.max(8, rect.top - height - 4)) + 'px';
        };

        const close = (restoreFocus = false) => {
            popup.style.display = 'none';
            trigger.setAttribute('aria-expanded', 'false');
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute?.('aria-activedescendant');
            input.value = '';
            if (activeSearchableSelect?.select === select) {
                activeSearchableSelect = null;
            }
            if (restoreFocus) {
                trigger.focus();
            }
        };

        const choose = option => {
            const changed = select.value !== option.value;
            select.value = option.value;
            controller.refresh();
            close(true);
            if (changed) {
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        const render = () => {
            visibleOptions = filterSearchableOptions(select.options, input.value);
            activeIndex = Math.max(0, Math.min(activeIndex, visibleOptions.length - 1));
            results.replaceChildren();
            if (!visibleOptions.length) {
                const empty = document.createElement('div');
                empty.className = 'pkh-search-empty';
                empty.textContent = config.noResultsText || 'No matches';
                results.appendChild(empty);
                return;
            }
            visibleOptions.forEach((option, index) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'pkh-search-option' +
                    (option.value === select.value ? ' is-selected' : '') +
                    (index === activeIndex ? ' is-active' : '');
                item.textContent = option.textContent;
                item.id = controlId + '-option-' + index;
                item.setAttribute('role', 'option');
                item.setAttribute('aria-selected', String(option.value === select.value));
                item.addEventListener('mouseenter', () => {
                    activeIndex = index;
                    [...results.children].forEach((result, resultIndex) => {
                        result.classList.toggle('is-active', resultIndex === activeIndex);
                    });
                    input.setAttribute('aria-activedescendant', item.id);
                });
                item.addEventListener('click', () => choose(option));
                results.appendChild(item);
            });
            const active = results.children[activeIndex];
            if (active) {
                input.setAttribute('aria-activedescendant', active.id);
                active.scrollIntoView?.({ block: 'nearest' });
            }
        };

        const open = () => {
            controller.refresh();
            if (!isEnhanced()) {
                return;
            }
            if (activeSearchableSelect && activeSearchableSelect.select !== select) {
                activeSearchableSelect.close();
            }
            activeSearchableSelect = controller;
            activeIndex = Math.max(0, [...select.options]
                .findIndex(option => option.value === select.value));
            popup.style.display = 'block';
            trigger.setAttribute('aria-expanded', 'true');
            input.setAttribute('aria-expanded', 'true');
            render();
            positionPopup();
            input.focus();
        };

        const move = direction => {
            if (!visibleOptions.length) {
                return;
            }
            activeIndex = (activeIndex + direction + visibleOptions.length) %
                visibleOptions.length;
            render();
        };

        const controller = {
            select,
            wrapper,
            close,
            refresh() {
                const enhanced = isEnhanced();
                select.style.display = enhanced ? 'none' : '';
                trigger.style.display = enhanced ? '' : 'none';
                trigger.textContent = selectedText();
                trigger.disabled = select.disabled;
                if (!enhanced) {
                    close();
                } else if (popup.style.display !== 'none') {
                    render();
                    positionPopup();
                }
            }
        };
        searchableSelectControllers.set(select, controller);

        trigger.addEventListener('click', () => {
            if (popup.style.display === 'none') {
                open();
            } else {
                close(true);
            }
        });
        trigger.addEventListener('keydown', event => {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
                event.preventDefault();
                open();
                if (event.key === 'ArrowUp') {
                    move(-1);
                }
            } else if (event.key === 'Escape') {
                close();
            }
        });
        input.addEventListener('input', () => {
            activeIndex = 0;
            render();
        });
        input.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(event.key === 'ArrowDown' ? 1 : -1);
            } else if (event.key === 'Enter' && visibleOptions[activeIndex]) {
                event.preventDefault();
                choose(visibleOptions[activeIndex]);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                close(true);
            }
        });
        clear.addEventListener('click', () => {
            input.value = '';
            activeIndex = 0;
            render();
            input.focus();
        });
        select.addEventListener('change', () => controller.refresh());
        document.addEventListener('mousedown', event => {
            if (popup.style.display !== 'none' &&
                !wrapper.contains(event.target) && !popup.contains(event.target)) {
                close();
            }
        });
        globalThis.addEventListener?.('resize', () => {
            if (popup.style.display !== 'none') {
                positionPopup();
            }
        });
        globalThis.addEventListener?.('scroll', () => {
            if (popup.style.display !== 'none') {
                positionPopup();
            }
        }, true);

        controller.refresh();
        return wrapper;
    }

    function createNumberInput(value = '100') {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.step = '1';
        input.value = value;
        return input;
    }

    function addGoalExecutionControls(panel, config) {
        const storagePrefix = 'myAutomation' + config.id;
        const divider = document.createElement('div');
        divider.style.borderTop = '1px solid rgba(255,255,255,0.2)';
        divider.style.marginTop = '10px';
        divider.style.paddingTop = '5px';

        const modes = config.modes ?? [
            ['finite', config.finiteLabel],
            ['indefinite', 'Run indefinitely']
        ];
        const mode = document.createElement('select');
        for (const [value, label] of modes) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            mode.appendChild(option);
        }
        const storedMode =
            localStorage.getItem(storagePrefix + 'Mode') ?? modes[0][0];
        mode.value = modes.some(([value]) => value === storedMode)
            ? storedMode
            : modes[0][0];

        const target = createNumberInput(
            localStorage.getItem(storagePrefix + 'Target') ??
                config.defaultTarget
        );
        const status = createTextLine();
        status.style.whiteSpace = 'pre-line';
        status.style.marginTop = '8px';
        status.textContent = 'Idle';

        const buttonRow = document.createElement('div');
        Object.assign(buttonRow.style, {
            display: 'flex',
            gap: '5px',
            marginTop: '8px'
        });
        const startButton = document.createElement('button');
        startButton.textContent = 'Start Farming';
        styleCompactButton(startButton, '#198754');
        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        styleCompactButton(stopButton, '#dc3545');

        const syncMode = () => {
            target.disabled = mode.value === 'indefinite';
            localStorage.setItem(storagePrefix + 'Mode', mode.value);
        };
        mode.addEventListener('change', syncMode);
        target.addEventListener('change', () =>
            localStorage.setItem(storagePrefix + 'Target', target.value));
        startButton.addEventListener('click', event => {
            event.stopPropagation();
            config.start(mode.value, target.value);
        });
        stopButton.addEventListener('click', event => {
            event.stopPropagation();
            if (foregroundJob?.id === config.id) {
                stopForegroundJob();
            }
        });

        buttonRow.appendChild(startButton);
        buttonRow.appendChild(stopButton);
        divider.appendChild(createFieldLabel('Mode', mode));
        divider.appendChild(createFieldLabel('Target', target));
        divider.appendChild(status);
        divider.appendChild(buttonRow);
        panel.appendChild(divider);
        executionViews[config.id] = { status, lastStatus: 'Idle' };
        syncMode();
    }
