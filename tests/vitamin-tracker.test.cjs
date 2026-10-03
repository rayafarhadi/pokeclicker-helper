const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'pokeclicker-automation.user.js'), 'utf8');

function setup() {
    const state = { highest: 3, debuff: true, disabled: false };
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
            getPokemonByName: name => data[name]
        },
        player: { highestRegion: () => state.highest },
        ItemList: { Protein: { isAvailable: () => true },
            Calcium: { isAvailable: () => state.highest >= 2 },
            Carbos: { isAvailable: () => state.highest >= 4 } },
        App: { game: { breeding: { maxVitamins: () => 20, getSteps: cycles => cycles * 40 },
            challenges: { list: { regionalAttackDebuff: { active: () => state.debuff },
                disableVitamins: { active: () => state.disabled } } },
            party: { caughtPokemon: [], getRegionAttackMultiplier: () => Math.min(1, Math.max(.2, .1 + state.highest / 10)) } } },
        console: { warn: message => warnings.push(message), table() {} }
    });
    const tracker = source.slice(source.indexOf('    function getVitaminCap('), source.indexOf('    // UI helpers'));
    const ui = source.slice(source.indexOf('    function positionVitaminPanel('), source.indexOf('    function createVitaminPanel('));
    vm.runInContext('let vitaminResults = []; let vitaminHasScanned = false; let selectedVitaminRegion = 3;' +
        'let vitaminPanel = null; let vitaminHeaderButton = {}; let vitaminSummaryText = {}; let vitaminResultsText = {};' +
        'function getRegionName(r) { return GameConstants.Region[r]; }\n' + tracker + ui, context);
    return { state, context, warnings, run: code => vm.runInContext(code, context) };
}
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`); }

test('6.0.3 userscript parses and startup version matches', () => {
    new vm.Script(source);
    assert.match(source, /@version\s+6\.0\.3/);
    assert.match(source, /Automation v6\.0\.3\] Loaded/);
    assert.ok(!source.includes('6.0.2'));
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

test('search includes every legal setup below cap and respects vitamin availability', () => {
    const { state, run } = setup();
    run('const evaluated = []; const originalBE = calculateRegionalBE;' +
        'calculateRegionalBE = (...args) => { evaluated.push(args.slice(1,4)); return originalBE(...args); };');
    run("optimizeVitaminSetup({name:'Gyarados'},3)");
    assert.equal(run('evaluated.length'), 231);
    assert.equal(run('evaluated.every(([p,c,b]) => b === 0 && p+c <= 20)'), true);
    state.highest = 4;
    run('evaluated.length = 0');
    assert.ok(run("optimizeVitaminSetup({name:'Gyarados'},3).carbos") > 0);
    assert.equal(run('evaluated.length'), 1771);
    assert.equal(run('evaluated.every(([p,c,b]) => p+c+b <= 20)'), true);
    assert.ok(run("getVitaminInvestmentRecommendation({name:'Gyarados'},3).gain") > 0,
        'Multi-vitamin investment must overcome Carbos rounding plateaus');
    state.highest = 0;
    const best = JSON.parse(run("JSON.stringify(optimizeVitaminSetup({name:'Gyarados'},0))"));
    assert.equal(best.calcium, 0);
    assert.equal(best.carbos, 0);
    state.disabled = true;
    assert.equal(run("getVitaminInvestmentRecommendation({name:'Garchomp'},3)"), null);
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

test('ranking uses current observables, excludes harmful investment, and preserves UI', () => {
    const { context, run } = setup();
    context.App.game.party.caughtPokemon = ['Gyarados', 'Garchomp', 'Lucario'].map(name => ({
        name, vitaminsUsed: { 0: () => 3, 1: () => 2, 2: () => 0 }
    }));
    run('scanVitaminEfficiency()');
    assert.equal(run('vitaminResults.some(r => r.name === "Gyarados")'), false);
    assert.equal(run('vitaminResults.length'), 2);
    assert.equal(run('vitaminResults.every(r => r.nextGain > 0 && r.optimal.carbos === 0)'), true);
    assert.equal(run('vitaminResults.every(r => r.current.protein === 3 && r.current.calcium === 2)'), true);
    assert.equal(run('vitaminResults.every((r,i,a) => !i || a[i-1].nextGain >= r.nextGain)'), true);
    assert.match(run('vitaminResultsText.innerHTML'), /Native: Sinnoh/);
    assert.match(run('vitaminResultsText.innerHTML'), /regional BE \/ vitamin/);
    assert.ok(!/Protein|Calcium|Carbos/.test(run('vitaminHeaderButton.textContent')));
    assert.ok(!/Protein|Calcium|Carbos/.test(run('vitaminResultsText.innerHTML')));
    context.App.game.party.caughtPokemon = [{ name: 'Gyarados' }];
    run('scanVitaminEfficiency()');
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