    // ============================================================
    // UI helpers
    // ============================================================

    const HELPER_STYLES = `
#pkh-root,
#pkh-root * {
    box-sizing: border-box;
}
#pkh-root {
    position: fixed;
    right: 14px;
    bottom: 14px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 9px;
    color: #eef6ff;
    font: 12px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
#pkh-root button,
#pkh-root select,
#pkh-root input {
    font: inherit;
}
#pkh-root .pkh-shell {
    width: min(420px, calc(100vw - 28px));
    max-height: calc(100vh - 86px);
    flex-direction: column;
    overflow: hidden;
    color: #eaf4ff;
    background:
        radial-gradient(circle at 100% 0, rgba(31, 137, 255, .12), transparent 38%),
        linear-gradient(180deg, rgba(17, 31, 46, .985), rgba(10, 21, 33, .985));
    border: 1px solid #294158;
    border-radius: 15px;
    box-shadow: 0 18px 52px rgba(0, 0, 0, .58), 0 0 0 1px rgba(7, 15, 24, .65);
    backdrop-filter: blur(12px);
}
#pkh-root .pkh-header {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 48px;
    padding: 10px 12px;
    flex: 0 0 auto;
    background: linear-gradient(180deg, rgba(28, 46, 65, .96), rgba(16, 29, 43, .96));
    border-bottom: 1px solid rgba(108, 153, 194, .18);
}
#pkh-root .pkh-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    flex: 1;
    font-size: 16px;
    font-weight: 750;
    letter-spacing: -.2px;
    color: #f7fbff;
}
#pkh-root .pkh-brand-ball {
    position: relative;
    display: inline-block;
    width: 23px;
    height: 23px;
    flex: 0 0 23px;
    overflow: hidden;
    border: 2px solid #08111a;
    border-radius: 50%;
    background: linear-gradient(#f04450 0 46%, #111923 47% 55%, #f5f7fa 56% 100%);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, .16), 0 2px 6px rgba(0, 0, 0, .35);
}
#pkh-root .pkh-brand-ball::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 6px;
    height: 6px;
    transform: translate(-50%, -50%);
    border: 2px solid #0b1118;
    border-radius: 50%;
    background: #eef3f7;
}
#pkh-root .pkh-version {
    color: #7f93a7;
    font-size: 11px;
    font-weight: 600;
}
#pkh-root .pkh-close {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #d9e5ef;
    cursor: pointer;
    font-size: 22px;
    line-height: 28px;
}
#pkh-root .pkh-close:hover {
    background: rgba(255, 255, 255, .08);
    color: white;
}
#pkh-root .pkh-status-strip {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 8px 10px 0;
    padding: 8px 9px;
    flex: 0 0 auto;
    min-height: 43px;
    overflow: hidden;
    background: rgba(8, 18, 29, .76);
    border: 1px solid #263c51;
    border-radius: 9px;
}
#pkh-root .pkh-status-dot {
    width: 11px;
    height: 11px;
    flex: 0 0 11px;
    border-radius: 50%;
    background: #6e7f90;
    box-shadow: 0 0 0 3px rgba(110, 127, 144, .12);
}
#pkh-root .pkh-status-dot.is-active {
    background: #38dc78;
    box-shadow: 0 0 0 3px rgba(56, 220, 120, .13), 0 0 10px rgba(56, 220, 120, .4);
}
#pkh-root .pkh-status-text {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    color: #d9e5f0;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}
#pkh-root .pkh-tabs {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin: 9px 10px 0;
    flex: 0 0 auto;
    overflow: hidden;
    background: #0c1824;
    border: 1px solid #253a4f;
    border-radius: 8px;
}
#pkh-root .pkh-tab {
    min-width: 0;
    padding: 9px 3px;
    border: 0;
    border-right: 1px solid #25384a;
    background: transparent;
    color: #b9c8d6;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 650;
    transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
#pkh-root .pkh-tab:last-child {
    border-right: 0;
}
#pkh-root .pkh-tab:hover {
    color: white;
    background: rgba(42, 139, 243, .12);
}
#pkh-root .pkh-tab.is-active {
    color: white;
    background: linear-gradient(180deg, #2494ff, #1177e8);
    box-shadow: inset 0 1px rgba(255, 255, 255, .18), 0 0 16px rgba(22, 130, 244, .2);
}
#pkh-root .pkh-scroll {
    min-height: 0;
    padding: 10px;
    flex: 1 1 auto;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #36516b transparent;
}
#pkh-root .pkh-scroll::-webkit-scrollbar {
    width: 8px;
}
#pkh-root .pkh-scroll::-webkit-scrollbar-thumb {
    background: #36516b;
    border: 2px solid transparent;
    border-radius: 8px;
    background-clip: padding-box;
}
#pkh-root .pkh-card {
    display: block;
    position: static;
    width: 100%;
    max-width: none;
    max-height: none;
    margin: 0 0 10px;
    padding: 11px;
    overflow: visible;
    overflow-wrap: anywhere;
    color: #dae8f4;
    background: linear-gradient(180deg, rgba(22, 38, 54, .98), rgba(16, 29, 43, .98));
    border: 1px solid #263d53;
    border-radius: 10px;
    box-shadow: 0 5px 14px rgba(0, 0, 0, .14);
    font-size: 11.5px;
    line-height: 1.4;
}
#pkh-root .pkh-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: -1px -1px 9px !important;
    padding: 0 1px 9px;
    color: #f3f8fc;
    border-bottom: 1px solid rgba(109, 148, 184, .19);
    font-size: 13.5px !important;
    font-weight: 750 !important;
}
#pkh-root .pkh-field {
    display: grid;
    grid-template-columns: minmax(88px, .85fr) minmax(0, 1.25fr);
    align-items: center;
    gap: 9px;
    margin-top: 8px;
}
#pkh-root .pkh-search-select {
    position: relative;
    width: 100%;
    min-width: 0;
}
#pkh-root .pkh-search-select > select {
    width: 100%;
}
#pkh-root .pkh-search-trigger {
    position: relative;
    width: 100%;
    min-height: 31px;
    padding: 5px 30px 5px 8px;
    overflow: hidden;
    color: #eaf3fb;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: #0b1723;
    border: 1px solid #314960;
    border-radius: 6px;
    cursor: pointer;
}
#pkh-root .pkh-search-trigger::after {
    content: "v";
    position: absolute;
    right: 9px;
    color: #8fa9bf;
}
.pkh-search-popup {
    position: fixed;
    z-index: 100001;
    width: min(300px, calc(100vw - 16px));
    max-height: min(360px, calc(100vh - 16px));
    padding: 7px;
    color: #eaf4ff;
    background: #0b1723;
    border: 1px solid #3a5872;
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, .55);
}
.pkh-search-row {
    display: flex;
    gap: 5px;
}
.pkh-search-input {
    flex: 1;
    min-width: 0;
    min-height: 31px;
    padding: 5px 8px;
    color: #eaf3fb;
    background: #07121c;
    border: 1px solid #314960;
    border-radius: 6px;
}
.pkh-search-clear {
    width: 31px;
    padding: 0;
    color: #bdcedd;
    background: #142536;
    border: 1px solid #314960;
    border-radius: 6px;
    cursor: pointer;
}
.pkh-search-results {
    max-height: 260px;
    margin-top: 6px;
    overflow-y: auto;
}
.pkh-search-option,
.pkh-search-empty {
    display: block;
    width: 100%;
    padding: 7px 8px;
    color: #dce9f4;
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: 5px;
}
.pkh-search-option {
    cursor: pointer;
}
.pkh-search-option:hover,
.pkh-search-option.is-active {
    color: white;
    background: #1a65a1;
}
.pkh-search-option.is-selected::after {
    content: "*";
    float: right;
    color: #61df91;
}
.pkh-search-empty {
    color: #8297aa;
}
#pkh-root .pkh-vitamin-details {
    margin-top: 9px;
    padding: 9px;
    background: rgba(6, 15, 24, .52);
    border: 1px solid #293e52;
    border-radius: 7px;
}
#pkh-root .pkh-vitamin-guidance {
    margin-top: 7px;
    color: #b8ccdc;
}
#pkh-root .pkh-vitamin-notice {
    margin-top: 7px;
    color: #75c7ff;
}

#pkh-root .pkh-field-label {
    margin: 0;
    color: #bac9d7;
    font-size: 11.5px;
}
#pkh-root select,
#pkh-root input {
    min-width: 0;
    min-height: 31px;
    padding: 5px 8px;
    color: #eaf3fb !important;
    background: #0b1723 !important;
    border: 1px solid #314960 !important;
    border-radius: 6px !important;
    margin: 0 !important;
    outline: none;
}
#pkh-root select:focus,
#pkh-root input:focus {
    border-color: #278fff !important;
    box-shadow: 0 0 0 2px rgba(39, 143, 255, .16);
}
#pkh-root select:disabled,
#pkh-root input:disabled {
    opacity: .5;
}
#pkh-root select option {
    color: #edf6ff;
    background: #101e2b;
}
#pkh-root .pkh-button,
#pkh-root .pkh-card button:not(.pkh-toggle) {
    min-height: 31px;
    padding: 6px 11px !important;
    border: 1px solid #3a5065 !important;
    border-radius: 6px !important;
    color: #e9f2fa !important;
    background: linear-gradient(180deg, #33495d, #283b4d) !important;
    box-shadow: inset 0 1px rgba(255, 255, 255, .07), 0 2px 5px rgba(0, 0, 0, .18);
    cursor: pointer;
    font-weight: 650;
    transition: filter .15s ease, transform .08s ease;
}
#pkh-root .pkh-button:hover:not(:disabled),
#pkh-root .pkh-card button:hover:not(:disabled):not(.pkh-toggle) {
    filter: brightness(1.12);
}
#pkh-root .pkh-button:active:not(:disabled),
#pkh-root .pkh-card button:active:not(:disabled):not(.pkh-toggle) {
    transform: translateY(1px);
}
#pkh-root .pkh-button-primary,
#pkh-root .pkh-card .pkh-button-primary {
    border-color: #2696ff !important;
    background: linear-gradient(180deg, #2696ff, #1179e9) !important;
}
#pkh-root .pkh-button-danger,
#pkh-root .pkh-card .pkh-button-danger {
    border-color: #f24b58 !important;
    background: linear-gradient(180deg, #f34d5a, #d92d3a) !important;
}
#pkh-root button:disabled {
    cursor: default !important;
    opacity: .42;
    filter: grayscale(.25);
}
#pkh-root .pkh-status-action {
    min-width: 66px;
    flex: 0 0 auto;
}
#pkh-root .pkh-full-button {
    width: 100%;
    margin-top: 9px !important;
}
#pkh-root .pkh-setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 38px;
    border-bottom: 1px solid rgba(98, 137, 173, .13);
}
#pkh-root .pkh-setting:last-child {
    border-bottom: 0;
}
#pkh-root .pkh-setting-label {
    color: #c5d3df;
}
#pkh-root .pkh-toggle {
    position: relative;
    width: 42px;
    height: 23px;
    flex: 0 0 42px;
    padding: 0;
    border: 1px solid #3a5269;
    border-radius: 999px;
    background: #26394b;
    cursor: pointer;
    transition: background .16s ease, border-color .16s ease;
}
#pkh-root .pkh-toggle::after {
    content: "";
    position: absolute;
    left: 3px;
    top: 3px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, .45);
    transition: transform .16s ease;
}
#pkh-root .pkh-toggle.is-on {
    border-color: #2b94ff;
    background: #1687f7;
}
#pkh-root .pkh-toggle.is-on::after {
    transform: translateX(18px);
}
#pkh-root .pkh-toggle.is-unavailable {
    opacity: .45;
    filter: grayscale(.45);
    cursor: not-allowed;
}
#pkh-root .pkh-note {
    margin-top: 9px;
    padding: 8px 9px;
    color: #9eb2c5;
    background: rgba(48, 121, 184, .09);
    border: 1px solid rgba(73, 145, 205, .16);
    border-radius: 7px;
    font-size: 10.5px;
}
#pkh-root .pkh-note::before {
    content: "ⓘ";
    margin-right: 6px;
    color: #65baff;
}
#pkh-root .pkh-metric-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    min-height: 27px;
    padding: 4px 0;
    color: #b9c9d7;
    border-bottom: 1px solid rgba(96, 135, 169, .12);
}
#pkh-root .pkh-metric-row:last-child {
    border-bottom: 0;
}
#pkh-root .pkh-metric-row strong {
    color: #edf6ff;
    font-weight: 650;
    text-align: right;
}
#pkh-root .pkh-positive {
    color: #43dc89 !important;
}
#pkh-root .pkh-empty-state {
    padding: 12px 8px;
    color: #93a8bb;
    text-align: center;
    background: rgba(5, 13, 21, .24);
    border: 1px dashed #30465a;
    border-radius: 7px;
}
#pkh-root .pkh-table-wrap {
    margin-top: 9px;
    overflow-x: auto;
    border: 1px solid #293e52;
    border-radius: 7px;
}
#pkh-root .pkh-vitamin-table {
    width: 100%;
    min-width: 100%;
    border-collapse: collapse;
    color: #cbd9e5;
    font-size: 9.5px;
    white-space: nowrap;
}
#pkh-root .pkh-vitamin-table th,
#pkh-root .pkh-vitamin-table td {
    padding: 6px 5px;
    border-right: 1px solid rgba(81, 118, 150, .17);
    border-bottom: 1px solid rgba(81, 118, 150, .17);
    text-align: center;
}
#pkh-root .pkh-vitamin-table th {
    color: #aebfce;
    background: #0d1a27;
    font-weight: 700;
}
#pkh-root .pkh-vitamin-table td:nth-child(2),
#pkh-root .pkh-vitamin-table th:nth-child(2) {
    text-align: left;
}
#pkh-root .pkh-vitamin-table tr:last-child td {
    border-bottom: 0;
}
#pkh-root .pkh-vitamin-table th:last-child,
#pkh-root .pkh-vitamin-table td:last-child {
    border-right: 0;
}
#pkh-root .pkh-launcher {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0 !important;
    padding: 8px 14px !important;
    color: #f3f8fc !important;
    background: linear-gradient(180deg, #162c40, #0e2031) !important;
    border: 1px solid #2a5577 !important;
    border-radius: 999px !important;
    box-shadow: 0 8px 22px rgba(0, 0, 0, .42) !important;
}
#pkh-root .pkh-launcher:hover {
    filter: brightness(1.12);
}
#pkh-root .pkh-launcher::after {
    content: "";
    width: 7px;
    height: 7px;
    margin-left: 1px;
    border-radius: 50%;
    background: #718395;
}
#pkh-root .pkh-launcher.is-active::after {
    background: #3ce17e;
    box-shadow: 0 0 8px rgba(60, 225, 126, .65);
}
#pkh-root .pkh-launcher .pkh-brand-ball {
    width: 19px;
    height: 19px;
    flex-basis: 19px;
}
#pkh-root .pkh-card-title {
    cursor: pointer;
    user-select: none;
}
#pkh-root .pkh-card-title:focus-visible {
    outline: 2px solid #2696ff;
    outline-offset: 2px;
}
#pkh-root .pkh-card-state {
    margin-left: auto;
    color: #65d88a;
    font-size: 10px;
    font-weight: 700;
}
#pkh-root .pkh-collapse-indicator {
    width: 14px;
    color: #8fa5b8;
    text-align: center;
}
#pkh-root .pkh-card.is-collapsed .pkh-card-title {
    margin-bottom: -1px !important;
    border-bottom-color: transparent;
}
#pkh-root .pkh-card-content {
    display: block;
}
#pkh-root .pkh-card.is-collapsed .pkh-card-content {
    display: none;
}
#pkh-root .pkh-card.is-collapsed > :not(.pkh-card-title) {
    display: none !important;
}
#pkh-root .pkh-feature-description,
#pkh-root .pkh-inline-help {
    color: #91a8bb;
    font-size: 10.5px;
    line-height: 1.35;
}
#pkh-root .pkh-feature-description {
    margin: -4px 0 6px;
}
#pkh-root .pkh-priority-list {
    display: grid;
    gap: 5px;
    margin-top: 6px;
}
#pkh-root .pkh-priority-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 32px;
    padding: 4px 7px;
    border: 1px solid rgba(83, 128, 167, .2);
    border-radius: 6px;
    background: rgba(15, 30, 43, .65);
}
#pkh-root .pkh-priority-row small {
    color: #7790a4;
}
#pkh-root .pkh-priority-buttons {
    display: flex;
    gap: 4px;
}
#pkh-root .pkh-priority-buttons button {
    min-height: 24px !important;
    padding: 2px 7px !important;
    font-size: 10px;
}
#pkh-root .pkh-advanced-controls {
    margin: 5px 0;
    padding: 7px;
    border: 1px solid rgba(38, 150, 255, .25);
    border-radius: 7px;
    background: rgba(38, 150, 255, .06);
}
#pkh-root .pkh-subheading {
    margin: 10px 0 5px;
    color: #d8e7f4;
    font-weight: 750;
}
#pkh-root .pkh-loot-info {
    display: grid;
    gap: 5px;
}
#pkh-root .pkh-loot-group {
    padding: 6px 7px;
    border: 1px solid rgba(83, 128, 167, .18);
    border-radius: 6px;
    background: rgba(10, 22, 32, .52);
}
#pkh-root .pkh-loot-group.is-selected {
    border-color: rgba(54, 157, 255, .58);
    background: rgba(29, 102, 164, .14);
}
#pkh-root .pkh-loot-heading {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #70c0ff;
    font-weight: 750;
    text-transform: capitalize;
    cursor: pointer;
}
#pkh-root .pkh-loot-checkbox {
    appearance: auto;
    width: 14px;
    height: 14px;
    min-width: 14px;
    min-height: 14px;
    padding: 0 !important;
    accent-color: #2494ff;
    cursor: pointer;
}
#pkh-root .pkh-loot-items {
    margin-top: 2px;
    color: #b8c9d8;
    font-size: 10.5px;
}
#pkh-root .pkh-collection-info {
    margin-top: 7px;
    color: #b8c9d8;
}
@media (max-width: 520px) {
    #pkh-root {
        right: 8px;
        bottom: 8px;
    }
    #pkh-root .pkh-shell {
        width: calc(100vw - 16px);
        max-height: calc(100vh - 70px);
    }
}
`;

    function styleMainButton(button) {
        Object.assign(
            button.style,
            {
                border: 'none',
                borderRadius: '6px',
                padding: '10px 14px',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
                minWidth: '180px',
                boxShadow:
                    '0 2px 6px rgba(0,0,0,0.35)'
            }
        );
    }

    function createTextLine() {
        const div =
            document.createElement(
                'div'
            );

        div.style.marginBottom =
            '5px';

        return div;
    }
