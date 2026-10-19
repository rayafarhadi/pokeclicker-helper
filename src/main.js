export const metadataFile = 'src/metadata.js';
export const globalsFile = 'src/globals.js';

// These modules are assembled in this order inside the userscript's existing
// IIFE. Keep the order explicit: functions share lexical state and several UI
// modules intentionally refer to declarations from earlier feature modules.
export const sourceFiles = [
    'src/core/settings.js',
    'src/ui/references.js',
    'src/core/state.js',
    'src/core/utilities.js',
    'src/features/auto-clicker.js',
    'src/features/breeding/auto-hatch.js',
    'src/features/farming/dungeon-tokens.js',
    'src/features/farming/dungeon-token-benchmark.js',
    'src/features/farming/gems.js',
    'src/features/farming/types.js',
    'src/features/tracking/vitamins.js',
    'src/ui/helpers.js',
    'src/features/automation/resource-jobs.js',
    'src/features/farming/auto-farmer.js',
    'src/features/dungeons/pathing.js',
    'src/features/dungeons/auto-dungeon.js',
    'src/ui/automation-controls.js',
    'src/ui/automation-panels.js',
    'src/ui/dungeon-panel.js',
    'src/ui/main-button.js',
    'src/ui/dungeon-token-panel.js',
    'src/ui/gem-panel.js',
    'src/ui/type-farm-panel.js',
    'src/ui/vitamin-panel.js',
    'src/core/setters.js',
    'src/ui/helper-panel.js',
    'src/core/start.js',
    'src/core/wait-for-game.js',
];
