const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'pokeclicker-automation.user.js'), 'utf8');

function setup() {
    const state = { highest: 3, cap: 20, debuff: true, disabled: false, lookups: 0, yields: 0 };
    const regions = { none: -1, kanto: 0, johto: 1, hoenn: 2, sinnoh: 3, unova: 4,
        0: 'Kanto', 1: 'Johto', 2: 'Hoenn', 3: 'Sinnoh', 4: 'Unova', '-1': 'None' };
    // Released v0.10.26 effective Gyarados data; other fixtures exercise ranking.
    const data = { Gyarados: { id: 130, attack: 148, eggCycles: 8 },
        Garchomp: { id: 445, attack: 200, eggCycles: 40 },
        Lucario: { id: 448, attack: 150, eggCycles: 40 },
        Bulbasaur: { id: 1 }, Cyndaquil: { id: 155 }, Treecko: { id: 252 },
        Alternate: { id: 1.1, nativeRegion: 3 }, Regionless: { nativeRegion: -1 } };
    const warnings = [];
    const context = vm.createContext({
        GameConstants: { Region: regions, VitaminType: { Protein: 0, Calcium: 1, Carbos: 2 },
            BREEDING_ATTACK_BONUS: 25, EGG_CYCLE_MULTIPLIER: 40 },
        PokemonHelper: {
            // Canonical calcNativeRegion logic: explicit override, then the game's ID boundaries.
            calcNativeRegion(name) {
                const p = data[name];
                if (p.nativeRegion !== undefined) return p.nativeRegion;
                return [151, 251, 386, 493, 649].findIndex(max => max >= Math.floor(p.id));
            },
            getPokemonByName: name => { state.lookups++; return data[name]; }
        },
        player: { highestRegion: () => state.highest },
        ItemList: { Protein: { isAvailable: () => true },
            Calcium: { isAvailable: () => state.highest >= 2 },
            Carbos: { isAvailable: () => state.highest >= 4 } },
        App: { game: { breeding: { maxVitamins: () => state.cap, getSteps: cycles => cycles * 40 },
            challenges: { list: { regionalAttackDebuff: { active: () => state.debuff },
                disableVitamins: { active: () => state.disabled } } },
            party: { caughtPokemon: [], getRegionAttackMultiplier: () => Math.min(1, Math.max(.2, .1 + state.highest / 10)) } } },
        console: { warn: message => warnings.push(message), table() {} },
        setTimeout: callback => { state.yields++; callback(); }
    });
    const tracker = source.slice(source.indexOf('    function getVitaminCap('), source.indexOf('    // UI helpers'));
    const ui = source.slice(source.indexOf('    function positionVitaminPanel('), source.indexOf('    function createVitaminPanel('));
    vm.runInContext('let vitaminResults = []; let vitaminHasScanned = false; let vitaminScanId = 0; let selectedVitaminRegion = 3;' +
        'let vitaminPanel = null; let vitaminHeaderButton = {}; let vitaminSummaryText = {}; let vitaminResultsText = {};' +
        'function getRegionName(r) { return GameConstants.Region[r]; }\n' + tracker + ui, context);
    return { state, context, warnings, run: code => vm.runInContext(code, context) };
}
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`); }

test('7.0.1 userscript parses and startup version matches', () => {
    new vm.Script(source);
    assert.match(source, /@version\s+7\.0\.1/);
    assert.match(source, /Automation v7\.0\.1\] Loaded/);
    assert.ok(!source.includes('6.0.5'));
});

test('Gyarados proof: baseline BE, vitamin penalties, and zero-vitamin optimum', () => {
    const { run } = setup();
    near(run("calculateVitaminAttackGain({name:'Gyarados'},0,0)"), 37);
    assert.equal(run("calculateVitaminEggSteps({name:'Gyarados'},0,0,0)"), 320);
    near(run("calculateRegionalBE({name:'Gyarados'},0,0,0,0)"), 4.625);
    near(run("calculateRegionalBE({name:'Gyarados'},0,0,0,3)"), 1.850);
    near(run("calculateRegionalBE({name:'Gyarados'},1,0,0,3)"), 38 / 340 * 40 * .4);
    near(run("calculateRegionalBE({name:'Gyarados'},0,1,0,3)"), 38.48 / 340 * 40 * .4);
    assert.equal(run("JSON.stringify(optimizeVitaminSetup({name:'Gyarados'},3))"),
        JSON.stringify({ protein: 0, calcium: 0, carbos: 0, be: 1.85 }));
    assert.equal(run("getVitaminInvestmentRecommendation({name:'Gyarados'},3)"), null);
});

test('search respects the cap and vitamin availability', () => {
    const { state, run } = setup();
    const locked = JSON.parse(run("JSON.stringify(optimizeVitaminSetup({name:'Gyarados'},3))"));
    assert.equal(locked.carbos, 0);
    assert.ok(locked.protein + locked.calcium <= 20);
    state.highest = 4;
    const unlocked = JSON.parse(run("JSON.stringify(optimizeVitaminSetup({name:'Gyarados'},3))"));
    assert.ok(unlocked.carbos > 0);
    assert.ok(unlocked.protein + unlocked.calcium + unlocked.carbos <= 20);
    assert.ok(run("getVitaminInvestmentRecommendation({name:'Gyarados'},3).gain") > 0,
        'Multi-vitamin investment must overcome Carbos rounding plateaus');
    state.highest = 0;
    const best = JSON.parse(run("JSON.stringify(optimizeVitaminSetup({name:'Gyarados'},0))"));
    assert.equal(best.calcium, 0);
    assert.equal(best.carbos, 0);
    state.disabled = true;
    assert.equal(run("getVitaminInvestmentRecommendation({name:'Garchomp'},3)"), null);
});

test('Unova scan uses one cached setup pass per Pokemon and yields to the UI', async () => {
    const { state, context, run } = setup();
    state.highest = 4;
    state.cap = 25;
    for (const counts of [[0, 0, 0], [3, 2, 0], [4, 5, 6], [10, 10, 5]]) {
        const args = counts.join(',');
        near(run(`createVitaminBECalculator({name:'Gyarados'},4)(${args})`),
            run(`calculateRegionalBE({name:'Gyarados'},${args},4)`));
    }
    state.lookups = 0;
    context.App.game.party.caughtPokemon = Array.from({ length: 649 }, () => ({ name: 'Gyarados' }));
    await run('scanVitaminEfficiency()');
    assert.ok(state.yields >= 32, `Expected batched UI yields, got ${state.yields}`);
    assert.ok(state.lookups <= context.App.game.party.caughtPokemon.length * 3,
        `Expected cached Pokemon data, got ${state.lookups} lookups`);
    assert.equal(run('vitaminResults.every(r => r.optimal.protein + r.optimal.calcium + r.optimal.carbos <= 25)'), true);
});

test('native regions, forms, unknown fallback, and debuff switch', () => {
    const { state, run, warnings } = setup();
    for (const [name, region] of Object.entries({ Gyarados: 0, Bulbasaur: 0, Cyndaquil: 1,
        Treecko: 2, Garchomp: 3, Lucario: 3, Alternate: 3, Regionless: -1 })) {
        assert.equal(run(`getPokemonNativeRegion({name:'${name}',region:0})`), region);
    }
    near(run("getRegionalAttackMultiplier({name:'Gyarados'},3)"), .4);
    assert.equal(run("getRegionalAttackMultiplier({name:'Lucario'},3)"), 1);
    assert.equal(run("getRegionalAttackMultiplier({name:'Regionless'},3)"), 1);
    assert.equal(run("getPokemonNativeRegion({name:'Missing'})"), null);
    near(run("getRegionalAttackMultiplier({name:'Missing'},3)"), .4);
    assert.equal(warnings.length, 1);
    state.debuff = false;
    assert.equal(run("getRegionalAttackMultiplier({name:'Gyarados'},3)"), 1);
});

test('ranking uses current observables, excludes harmful investment, and preserves UI', async () => {
    const { context, run } = setup();
    context.App.game.party.caughtPokemon = ['Gyarados', 'Garchomp', 'Lucario'].map(name => ({
        name, vitaminsUsed: { 0: () => 3, 1: () => 2, 2: () => 0 }
    }));
    await run('scanVitaminEfficiency()');
    assert.equal(run('vitaminResults.some(r => r.name === "Gyarados")'), false);
    assert.equal(run('vitaminResults.length'), 2);
    assert.equal(run('vitaminResults.every(r => r.nextGain > 0 && r.optimal.carbos === 0)'), true);
    assert.equal(run('vitaminResults.every(r => r.current.protein === 3 && r.current.calcium === 2)'), true);
    assert.equal(run('vitaminResults.every((r,i,a) => !i || a[i-1].currentBE >= r.currentBE)'), true);
    assert.match(run('vitaminResultsText.innerHTML'), /Native: Sinnoh/);
    assert.match(run('vitaminResultsText.innerHTML'), /regional BE \/ vitamin/);
    assert.ok(!/Protein|Calcium|Carbos/.test(run('vitaminHeaderButton.textContent')));
    assert.ok(!/Protein|Calcium|Carbos/.test(run('vitaminResultsText.innerHTML')));
    // Higher current BE wins even when its gain per vitamin is smaller.
    context.App.game.party.caughtPokemon = [
        { name: 'Garchomp', eggCycles: 40 },
        { name: 'Lucario', eggCycles: 13 }
    ];
    await run('scanVitaminEfficiency()');
    assert.equal(run('vitaminResults[0].name'), 'Lucario');
    assert.equal(run('vitaminResults[1].name'), 'Garchomp');
    assert.equal(run('vitaminResults[0].nextGain < vitaminResults[1].nextGain'), true);
    context.App.game.party.caughtPokemon = [{ name: 'Gyarados' }];
    await run('scanVitaminEfficiency()');
    assert.match(run('vitaminResultsText.innerHTML'), /No beneficial/);
    for (const label of ['Target:', 'Regional debuff:', 'Non-native multiplier:', 'Vitamin cap:']) {
        assert.ok(run('vitaminSummaryText.innerHTML').includes(label));
    }
});

test('modified BE retains EV, held-item, and shadow factors; fallback egg steps matches game', () => {
    const { context, run } = setup();
    context.modified = { name: 'Gyarados', calculateEVAttackBonus: () => 1.5,
        heldItemAttackBonus: () => 2, shadowAttackBonus: () => .8 };
    near(run('calculateRegionalBE(modified,0,0,0,3)'), 1.85 * 1.5 * 2 * .8);
    delete context.App.game.breeding.getSteps;
    assert.equal(run("calculateVitaminEggSteps({name:'Gyarados'},0,0,0)"), 320);
    assert.equal(run("calculateVitaminEggSteps({name:'Gyarados'},0,1,10)"),
        Math.round((340 / 300) ** (1 - 10 / 70) * 300));
});