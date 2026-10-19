const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'pokeclicker-automation.user.js'),
    'utf8'
);

function functionSlice(start, end) {
    return source.slice(source.indexOf(start), source.indexOf(end));
}

function makePokemon(name, progress, options = {}) {
    const baseAttack = options.baseAttack ?? 100;
    return {
        name,
        baseAttack,
        attack: baseAttack * 500 * progress,
        level: options.level ?? 100,
        breeding: options.breeding ?? false,
        isHatchable: () => options.hatchable ?? true,
    };
}

test('Type Egg selection preserves regional NotCaught eligibility and excludes Mystery Eggs', () => {
    const eggNames = [
        'Fire_egg',
        'Water_egg',
        'Grass_egg',
        'Fighting_egg',
        'Electric_egg',
        'Dragon_egg',
        'Mystery_egg',
    ];
    const EggItemType = {};
    eggNames.forEach((name, index) => {
        const value = index + 1;
        EggItemType[name] = value;
        EggItemType[value] = name;
    });

    const checked = [];
    const added = [];
    const itemList = Object.fromEntries(
        eggNames.map(name => [name, () => ['Fire_egg', 'Water_egg', 'Mystery_egg'].includes(name) ? 1 : 0])
    );
    const context = vm.createContext({
        GameConstants: { EggItemType },
        CaughtStatus: { NotCaught: 'not-caught' },
        player: { itemList },
        App: {
            game: {
                breeding: {
                    getTypeCaughtStatus(eggType) {
                        checked.push(eggType);
                        return eggType === EggItemType.Water_egg ? 'not-caught' : 'caught';
                    },
                    addEggItemToHatchery(eggType) {
                        added.push(eggType);
                        return true;
                    },
                },
            },
        },
    });
    vm.runInContext(
        functionSlice(
            '    function tryUncaughtTypeEgg()',
            '    function getPokemonTypes('
        ),
        context
    );

    assert.equal(vm.runInContext('tryUncaughtTypeEgg()', context), true);
    assert.deepEqual(checked, [EggItemType.Fire_egg, EggItemType.Water_egg]);
    assert.deepEqual(added, [EggItemType.Water_egg]);
    assert.doesNotMatch(
        functionSlice('    function tryUncaughtTypeEgg()', '    function getPokemonTypes('),
        /Mystery_egg/
    );
});

test('Mega candidates prioritize owned stones, then closest progress', () => {
    const party = [
        makePokemon('No Stone Near', 0.99),
        makePokemon('Owned Far', 0.40),
        makePokemon('Owned Near', 0.80),
        makePokemon('Multi Stone', 0.90),
        makePokemon('Already Breeding', 0.999, { breeding: true }),
        makePokemon('At Threshold', 1),
        makePokemon('Not Hatchable', 0.999, { hatchable: false }),
        makePokemon('Not Level 100', 0.999, { level: 99 }),
        makePokemon('No Mega', 0.999),
    ];
    const stones = {
        'Owned Far': [{ megaStone: 'far' }],
        'Owned Near': [{ megaStone: 'near' }],
        'Multi Stone': [{ megaStone: 'missing' }, { megaStone: 'multi-owned' }],
        'Already Breeding': [{ megaStone: 'breeding' }],
        'At Threshold': [{ megaStone: 'exact' }],
        'Not Hatchable': [{ megaStone: 'not-hatchable' }],
        'Not Level 100': [{ megaStone: 'low-level' }],
        'No Stone Near': [{ megaStone: 'unowned' }],
        'No Mega': [],
    };
    const ownedStones = new Set(['far', 'near', 'multi-owned', 'breeding', 'exact',
        'not-hatchable', 'low-level']);
    const context = vm.createContext({
        App: { game: { party: { caughtPokemon: party } } },
        GameConstants: { MEGA_REQUIRED_ATTACK_MULTIPLIER: 500 },
        PokemonHelper: {
            hasMegaEvolution: name => name !== 'No Mega',
            getMegaStones: name => stones[name],
        },
        player: { hasMegaStone: stone => ownedStones.has(stone) },
    });
    const megaSelector = functionSlice(
        '    function findBestMegaCandidate()',
        '    function getEffectiveBreedingPriority()'
    );
    assert.match(megaSelector, /GameConstants\.MEGA_REQUIRED_ATTACK_MULTIPLIER/);
    assert.doesNotMatch(megaSelector, /\*\s*500/);
    vm.runInContext(megaSelector, context);

    assert.equal(vm.runInContext('findBestMegaCandidate().name', context), 'Multi Stone');

    party.find(pokemon => pokemon.name === 'Multi Stone').attack = 100 * 500;
    party.find(pokemon => pokemon.name === 'Owned Near').attack = 100 * 500;
    party.find(pokemon => pokemon.name === 'Owned Far').attack = 100 * 500;
    assert.equal(vm.runInContext('findBestMegaCandidate().name', context), 'No Stone Near');

    party.find(pokemon => pokemon.name === 'No Stone Near').attack = 100 * 500;
    assert.equal(vm.runInContext('findBestMegaCandidate()', context), null);
});

function runPriority({
    enabled = true,
    advanced = true,
    priority = ['pokerus', 'mega', 'default', 'off'],
    pokerus = 'none',
    mega = false,
    typeEggs = 0,
    freeSlots = 1,
} = {}) {
    const events = [];
    const errors = [];
    const context = vm.createContext({
        console: { error: message => errors.push(message) },
    });
    vm.runInContext(
        "const featureSettings = { autoHatching: " + JSON.stringify(enabled) +
        ", advancedHatching: " + JSON.stringify(advanced) + " }; " +
        "const BREEDING_STRATEGIES = ['pokerus', 'mega', 'default', 'off']; " +
        "let breedingPriority = " + JSON.stringify(priority) + "; " +
        "let freeSlots = " + JSON.stringify(freeSlots) + "; " +
        "let typeEggs = " + JSON.stringify(typeEggs) + "; " +
        "let megaAvailable = " + JSON.stringify(mega) + "; " +
        "const events = []; " +
        "const App = { game: { breeding: { eggSlots: 0, hatchPokemonEgg() {}, " +
        "hasFreeEggSlot: () => freeSlots > 0, addPokemonToHatchery(pokemon) { " +
        "events.push('add:' + pokemon.name); pokemon.breeding = true; freeSlots--; return true; } } } }; " +
        "function tryPokerusSpread() { events.push('pokerus'); " +
        (pokerus === 'added' ? "freeSlots--;" : "") +
        "return " + JSON.stringify(pokerus) + "; } " +
        "function findBestMegaCandidate() { events.push('mega-check'); " +
        "if (!megaAvailable) return null; megaAvailable = false; return { name: 'Mega' }; } " +
        "function tryUncaughtTypeEgg() { events.push('type-egg'); " +
        "if (typeEggs <= 0) return false; typeEggs--; freeSlots--; return true; } " +
        "const BreedingController = { hatcherySortedFilteredList() { " +
        "events.push('custom-list'); return [{ name: 'Custom', isHatchable: () => true }]; } };\n" +
        functionSlice(
            '    function getEffectiveBreedingPriority()',
            '    // ============================================================\n    // Dungeon Token optimizer'
        ),
        context
    );
    vm.runInContext('runAutoHatch()', context);
    events.push(...vm.runInContext('events', context));
    return { events, errors };
}

test('Auto Hatching stays disabled until enabled and prioritizes Type Eggs', () => {
    assert.deepEqual(
        runPriority({
            enabled: false,
            pokerus: 'added',
            mega: true,
            typeEggs: 1,
        }).events,
        []
    );
    assert.deepEqual(
        runPriority({
            pokerus: 'added',
            mega: true,
            typeEggs: 1,
        }).events,
        ['type-egg']
    );
    assert.deepEqual(
        runPriority({
            pokerus: 'added',
            mega: true,
            typeEggs: 2,
            freeSlots: 3,
        }).events,
        ['type-egg', 'type-egg', 'type-egg', 'pokerus']
    );
});

test('configurable breeding priority respects advanced availability and fallback', () => {
    assert.deepEqual(
        runPriority({
            pokerus: 'none',
            mega: true,
        }).events,
        ['type-egg', 'pokerus', 'mega-check', 'add:Mega']
    );
    assert.deepEqual(
        runPriority({
            priority: ['mega', 'pokerus', 'default', 'off'],
            pokerus: 'added',
            mega: true,
        }).events,
        ['type-egg', 'mega-check', 'add:Mega']
    );
    assert.deepEqual(
        runPriority({
            advanced: false,
            pokerus: 'added',
            mega: true,
        }).events,
        ['type-egg', 'custom-list', 'add:Custom']
    );
    assert.deepEqual(
        runPriority({
            pokerus: 'wait',
            mega: true,
        }).events,
        ['type-egg', 'pokerus']
    );
});

test('breeding priority persists Custom naming and fixed None fallback', () => {
    assert.match(
        source,
        /const BREEDING_STRATEGIES = \[\s*'pokerus',\s*'mega',\s*'default',\s*'off'\s*\]/
    );
    assert.match(source, /default: 'Custom'/);
    assert.match(source, /off: 'None'/);
    assert.match(
        source,
        /BREEDING_PRIORITY_STORAGE_KEY,\s*JSON\.stringify/
    );
    assert.match(source, /parsed\[parsed\.length - 1\] ===\s*'off'/);
    assert.match(
        source,
        /featureSettings\.advancedHatching[\s\S]*new Set\(\['default', 'off'\]\)/
    );
    assert.match(
        source,
        /tryUncaughtTypeEgg\(\)[\s\S]*getEffectiveBreedingPriority\(\)/
    );
});
