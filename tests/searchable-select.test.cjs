const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'pokeclicker-automation.user.js'),
    'utf8'
);
const componentSource = source.slice(
    source.indexOf('    const searchableSelectControllers'),
    source.indexOf('    function createNumberInput(')
);

class FakeEvent {
    constructor(type, init = {}) {
        this.type = type;
        Object.assign(this, init);
    }
    preventDefault() {
        this.defaultPrevented = true;
    }
}

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.style = {};
        this.dataset = {};
        this.attributes = {};
        this.listeners = new Map();
        this.className = '';
        this.textContent = '';
        this.disabled = false;
        this._value = '';
        this.clientWidth = 1000;
        this.clientHeight = 800;
        this.offsetHeight = 160;
    }
    get options() {
        return this.tagName === 'SELECT' ? this.children : undefined;
    }
    get value() {
        if (this.tagName !== 'SELECT') return this._value;
        if (this.children.some(option => option.value === this._value)) {
            return this._value;
        }
        return this.children[0]?.value || '';
    }
    set value(value) {
        this._value = String(value);
    }
    get selectedIndex() {
        return this.children.findIndex(option => option.value === this.value);
    }
    set selectedIndex(index) {
        this._value = this.children[index]?.value || '';
    }
    get selectedOptions() {
        const option = this.children.find(item => item.value === this.value);
        return option ? [option] : [];
    }
    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.children = child.parentNode.children.filter(
                item => item !== child
            );
        }
        child.parentNode = this;
        this.children.push(child);
        return child;
    }
    replaceChildren(...children) {
        this.children.forEach(child => { child.parentNode = null; });
        this.children = [];
        children.forEach(child => this.appendChild(child));
    }
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }
    dispatchEvent(event) {
        event.target ||= this;
        for (const listener of this.listeners.get(event.type) || []) {
            listener(event);
        }
        return true;
    }
    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }
    getAttribute(name) {
        return this.attributes[name];
    }
    contains(target) {
        return target === this || this.children.some(child => child.contains(target));
    }
    focus() {
        fakeDocument.activeElement = this;
    }
    getBoundingClientRect() {
        return { left: 100, top: 100, bottom: 131, width: 260 };
    }
    scrollIntoView() {}
}

const fakeDocument = {
    body: new FakeElement('body'),
    documentElement: new FakeElement('html'),
    activeElement: null,
    listeners: new Map(),
    createElement: tag => new FakeElement(tag),
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    },
    dispatchEvent(event) {
        for (const listener of this.listeners.get(event.type) || []) {
            listener(event);
        }
    }
};

function setup(optionCount = 6) {
    fakeDocument.body.replaceChildren();
    fakeDocument.listeners.clear();
    const context = vm.createContext({
        document: fakeDocument,
        Event: FakeEvent,
        console,
    });
    vm.runInContext(componentSource, context);
    const select = fakeDocument.createElement('select');
    ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta']
        .slice(0, optionCount)
        .forEach((label, index) => {
            const option = fakeDocument.createElement('option');
            option.value = String(index);
            option.textContent = label;
            option.dataset.search = label + (label === 'Zeta' ? ' alternate-form' : '');
            select.appendChild(option);
        });
    select.value = '0';
    context.select = select;
    const wrapper = vm.runInContext(
        "createSearchableSelect(select,{placeholder:'Search choices...'})",
        context
    );
    const trigger = wrapper.children[1];
    const popup = fakeDocument.body.children[0];
    const input = popup.children[0].children[0];
    const clear = popup.children[0].children[1];
    const results = popup.children[1];
    return { context, select, wrapper, trigger, popup, input, clear, results };
}

test('filtering is case-insensitive and searches alternate labels without changing value', () => {
    const ui = setup();
    let changes = 0;
    ui.select.addEventListener('change', () => changes++);
    ui.trigger.dispatchEvent(new FakeEvent('click'));
    ui.input.value = 'ALTERNATE';
    ui.input.dispatchEvent(new FakeEvent('input'));
    assert.equal(ui.results.children.length, 1);
    assert.equal(ui.results.children[0].textContent, 'Zeta');
    assert.equal(ui.select.value, '0');
    assert.equal(changes, 0);
    ui.input.value = 'missing';
    ui.input.dispatchEvent(new FakeEvent('input'));
    assert.equal(ui.results.children[0].textContent, 'No matches');
});

test('mouse selection and outside click use the same native control', () => {
    const ui = setup();
    let changes = 0;
    ui.select.addEventListener('change', () => changes++);
    ui.context.wrapper = ui.wrapper;
    assert.equal(
        vm.runInContext('createSearchableSelect(select) === wrapper', ui.context),
        true
    );
    ui.trigger.dispatchEvent(new FakeEvent('click'));
    ui.results.children[1].dispatchEvent(new FakeEvent('click'));
    assert.equal(ui.select.value, '1');
    assert.equal(changes, 1);
    assert.equal(ui.trigger.textContent, 'Beta');

    ui.trigger.dispatchEvent(new FakeEvent('click'));
    fakeDocument.dispatchEvent(new FakeEvent('mousedown', {
        target: fakeDocument.body
    }));
    assert.equal(ui.popup.style.display, 'none');
});

test('keyboard selection updates the native select and dispatches one change only when changed', () => {
    const ui = setup();
    let changes = 0;
    ui.select.addEventListener('change', () => changes++);
    ui.trigger.dispatchEvent(new FakeEvent('click'));
    ui.input.value = 'ta';
    ui.input.dispatchEvent(new FakeEvent('input'));
    ui.input.dispatchEvent(new FakeEvent('keydown', { key: 'ArrowDown' }));
    ui.input.dispatchEvent(new FakeEvent('keydown', { key: 'Enter' }));
    assert.equal(ui.select.value, '3');
    assert.equal(changes, 1);
    assert.equal(ui.popup.style.display, 'none');

    ui.trigger.dispatchEvent(new FakeEvent('click'));
    ui.input.value = 'delta';
    ui.input.dispatchEvent(new FakeEvent('input'));
    ui.input.dispatchEvent(new FakeEvent('keydown', { key: 'Enter' }));
    assert.equal(ui.select.value, '3');
    assert.equal(changes, 1);
});

test('escape, clear, selected marker, and both threshold crossings are supported', () => {
    const single = setup(1);
    assert.equal(single.select.style.display, '');
    assert.equal(single.trigger.style.display, 'none');

    const ui = setup(5);
    assert.equal(ui.select.style.display, '');
    assert.equal(ui.trigger.style.display, 'none');

    const option = fakeDocument.createElement('option');
    option.value = '5';
    option.textContent = 'Zeta';
    ui.select.appendChild(option);
    vm.runInContext('refreshSearchableSelect(select)', ui.context);
    assert.equal(ui.select.style.display, 'none');
    assert.equal(ui.trigger.style.display, '');

    ui.trigger.dispatchEvent(new FakeEvent('click'));
    assert.match(ui.results.children[0].className, /is-selected/);
    ui.input.value = 'zet';
    ui.input.dispatchEvent(new FakeEvent('input'));
    ui.clear.dispatchEvent(new FakeEvent('click'));
    assert.equal(ui.input.value, '');
    assert.equal(ui.results.children.length, 6);
    ui.input.dispatchEvent(new FakeEvent('keydown', { key: 'Escape' }));
    assert.equal(ui.popup.style.display, 'none');
    assert.equal(fakeDocument.activeElement, ui.trigger);

    ui.select.replaceChildren(...ui.select.children.slice(0, 5));
    vm.runInContext('refreshSearchableSelect(select)', ui.context);
    assert.equal(ui.select.style.display, '');
    assert.equal(ui.trigger.style.display, 'none');
});
