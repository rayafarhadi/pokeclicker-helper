# PokéClicker Helper

PokéClicker Helper is developed as a set of focused JavaScript source files and built into one self-contained Tampermonkey userscript. The generated installable file remains `pokeclicker-automation.user.js`, so existing raw GitHub update and download URLs continue to work.

## Project structure

```text
src/
├── main.js                 Ordered source manifest
├── metadata.js             Tampermonkey metadata block
├── globals.js              PokéClicker global declarations
├── core/                   Settings, state, utilities, startup
├── features/
│   ├── automation/         Shared foreground resource jobs
│   ├── breeding/           Auto Hatch behavior and priorities
│   ├── dungeons/           Dungeon execution and pathing
│   ├── farming/            DT, Gem, Type, and Berry automation
│   └── tracking/           Vitamin calculations and scans
└── ui/                     Shared controls and feature panels
scripts/build.js            Ordered assembler and esbuild validation
tests/                      Existing behavior tests and build checks
pokeclicker-automation.user.js
                            Generated installable userscript
```

The source files are assembled inside the same IIFE and in the same order as the previous monolithic script. This preserves shared mutable state, access to PokéClicker globals, initialization timing, and existing function-hoisting behavior without adding a runtime module loader.

## Install dependencies and build

Install the development dependency once:

```bash
npm install
```

Build the userscript:

```bash
npm run build
```

The build reads the order in `src/main.js`, assembles the modules, validates the complete JavaScript with esbuild, and writes `pokeclicker-automation.user.js`. Output is readable and is not minified.

For rebuilds while editing:

```bash
npm run dev
```

Run the syntax and behavior checks with:

```bash
npm run check
```

## Install or update in Tampermonkey

Open `pokeclicker-automation.user.js` through its GitHub raw URL and allow Tampermonkey to install or update it. The generated file retains the existing `@updateURL`, `@downloadURL`, `@match`, `@grant`, `@sandbox`, and `@run-at` metadata.

Do not install files from `src/` individually. They are development fragments that intentionally share one lexical scope after assembly.

## Development workflow

1. Find the feature module in `src/` and inspect its directly used shared modules.
2. Edit source files only.
3. Run `npm run build` to refresh the generated userscript.
4. Run `npm run check` before distributing changes.
5. Review both the source diff and generated output diff.

The repository preserves the existing storage keys and value formats. Structural work should not rename keys, change defaults, reorder startup, or change automation behavior unless a task explicitly requests it.

## Manual browser smoke test

Automated checks cannot prove live PokéClicker and Tampermonkey behavior. After structural changes, verify in the game that:

- Tampermonkey installs the generated userscript and recognizes its metadata and version.
- The Helper launcher appears after the game becomes ready and all tabs and collapsible cards open normally.
- Existing saved feature choices, selected modes, targets, priorities, collapsed sections, and chest rarity choices load unchanged.
- Auto Click and every enabled Auto Hatch strategy start and stop correctly; Type Eggs retain priority.
- DT, Gem, Type, Berry, and Vitamin scans produce results and their automation controls stop at configured goals.
- Dungeon default, Boss Rush, Chest Farm, and Full Clear modes navigate and stop on failure as expected.
- Disabling a feature from the Features tab stops or blocks its related controls.
- Reloading the page preserves settings and does not create duplicate panels or intervals.
