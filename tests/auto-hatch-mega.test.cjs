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
    typeEgg = false,
} = {}) {
    const events = [];
    const errors = [];
    const context = vm.createContext({
        console: { error: message => errors.push(message) },
    });
    vm.runInContext(
        "let hatchMode = " + JSON.stringify(mode) + "; " +
        "let freeSlots = 1; let megaAvailable = " + JSON.stringify(mega) + "; " +
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
        (typeEgg ? "freeSlots--; return true;" : "return false;") + " } " +
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

test('Auto Hatch modes use Pokérus, Mega, Type Egg, and Normal layers in order', () => {
    assert.deepEqual(
        runMode('pokerus', { pokerus: 'wait', mega: true, typeEgg: true }).events,
        ['pokerus'],
        'Pokérus wait must block every fallback'
    );
    assert.deepEqual(
        runMode('pokerus', { pokerus: 'added', mega: true, typeEgg: true }).events,
        ['pokerus'],
        'successful Pokérus work must fill the slot first'
    );
    assert.deepEqual(
        runMode('pokerus', { pokerus: 'none', mega: true, typeEgg: true }).events,
        ['pokerus', 'mega-check', 'add:Mega'],
        'Pokérus mode must fall through to Mega'
    );
    assert.deepEqual(
        runMode('mega', { mega: true, typeEgg: true }).events,
        ['mega-check', 'add:Mega'],
        'Mega mode must train Mega candidates before Type Eggs'
    );
    assert.deepEqual(
        runMode('mega', { mega: false, typeEgg: true }).events,
        ['mega-check', 'type-egg'],
        'Mega mode must fall through to existing Type Egg behavior'
    );
    assert.deepEqual(
        runMode('default', { mega: true, typeEgg: true }).events,
        ['type-egg'],
        'Normal mode must retain Type Egg priority and skip Mega selection'
    );
    assert.deepEqual(
        runMode('default', { mega: true, typeEgg: false }).events,
        ['type-egg', 'normal-list', 'add:Normal'],
        'Normal mode must retain the existing sorted-list fallback'
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
        /\['off', 'Off'\],\s*\['pokerus', 'Pokérus'\],\s*\['mega', 'Mega'\],\s*\['default', 'Normal'\]/
    );
    const setter = functionSlice(
        '    function setHatchMode(',
        '    // ============================================================\n    // Controls'
    );
    assert.match(setter, /localStorage\.setItem\(\s*HATCH_MODE_STORAGE_KEY/);
    assert.match(setter, /updateHatchButton\(\)/);
    assert.match(source, /for \(const select of hatchModeSelects\) \{\s*select\.value = hatchMode/);
});
