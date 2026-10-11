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
        '    function runAutoHatch()'
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

function runMode(mode, {
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
        "let hatchMode = " + JSON.stringify(mode) + "; " +
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
        "events.push('normal-list'); return [{ name: 'Normal', isHatchable: () => true }]; } };\n" +
        functionSlice(
            '    function runAutoHatch()',
            '    // ============================================================\n    // Dungeon Token optimizer'
        ),
        context
    );
    vm.runInContext('runAutoHatch()', context);
    events.push(...vm.runInContext('events', context));
    return { events, errors };
}

test('Auto Hatch modes always prioritize Type Eggs before lower-priority work', () => {
    assert.deepEqual(
        runMode('off', { pokerus: 'added', mega: true, typeEggs: 1 }).events,
        [],
        'Off mode must not perform any automatic hatching'
    );
    assert.deepEqual(
        runMode('pokerus', { pokerus: 'added', mega: true, typeEggs: 1 }).events,
        ['type-egg'],
        'Type Eggs must take precedence even when Pokérus can add a pair member'
    );
    assert.deepEqual(
        runMode('mega', { mega: true, typeEggs: 1 }).events,
        ['type-egg'],
        'Mega mode must add a Type Egg before training a Mega candidate'
    );
    assert.deepEqual(
        runMode('default', { mega: true, typeEggs: 1 }).events,
        ['type-egg'],
        'Default mode must add a Type Egg before normal breeding'
    );
    assert.deepEqual(
        runMode('pokerus', { pokerus: 'added', mega: true, typeEggs: 2, freeSlots: 3 }).events,
        ['type-egg', 'type-egg', 'type-egg', 'pokerus'],
        'eligible Type Eggs must fill available slots before Pokérus work begins'
    );
});

test('Auto Hatch modes retain their fallback priority after Type Eggs', () => {
    assert.deepEqual(
        runMode('pokerus', { pokerus: 'wait', mega: true }).events,
        ['type-egg', 'pokerus'],
        'Pokérus wait must block Mega and normal fallbacks'
    );
    assert.deepEqual(
        runMode('pokerus', { pokerus: 'none', mega: true }).events,
        ['type-egg', 'pokerus', 'mega-check', 'add:Mega'],
        'Pokérus mode must fall through to Mega'
    );
    assert.deepEqual(
        runMode('mega', { mega: true }).events,
        ['type-egg', 'mega-check', 'add:Mega'],
        'Mega mode must train Mega candidates after checking Type Eggs'
    );
    assert.deepEqual(
        runMode('mega', { mega: false }).events,
        ['type-egg', 'mega-check', 'normal-list', 'add:Normal'],
        'Mega mode must fall through to normal breeding'
    );
    assert.deepEqual(
        runMode('default', { mega: true }).events,
        ['type-egg', 'normal-list', 'add:Normal'],
        'Default mode must retain the existing sorted-list fallback and skip Mega selection'
    );
});

test('Auto Hatch mode values, labels, persistence, and selector sync include Mega', () => {
    assert.match(
        source,
        /const HATCH_MODES = \[\s*'off',\s*'pokerus',\s*'mega',\s*'default'\s*\]/
    );
    const selector = functionSlice(
        '    function createHatchModeSelect()',
        '    function updateHatchButton()'
    );
    assert.match(
        selector,
        /\['off', 'Off'\],\s*\['pokerus', 'Pokérus'\],\s*\['mega', 'Mega'\],\s*\['default', 'Default'\]/
    );
    const setter = functionSlice(
        '    function setHatchMode(',
        '    // ============================================================\n    // Controls'
    );
    assert.match(setter, /localStorage\.setItem\(\s*HATCH_MODE_STORAGE_KEY/);
    assert.match(setter, /updateHatchButton\(\)/);
    assert.match(source, /for \(const select of hatchModeSelects\) \{\s*select\.value = hatchMode/);
});
