import { watch } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import {
    globalsFile,
    metadataFile,
    sourceFiles,
} from '../src/main.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const outputFile = path.join(projectRoot, 'pokeclicker-automation.user.js');

async function readProjectFile(relativePath) {
    return readFile(path.join(projectRoot, relativePath), 'utf8');
}

function trimFinalNewline(value) {
    return value.replace(/(?:\r?\n)+$/, '');
}

async function createUserscript() {
    const [metadata, globals, ...modules] = await Promise.all([
        readProjectFile(metadataFile),
        readProjectFile(globalsFile),
        ...sourceFiles.map(readProjectFile),
    ]);

    if (!metadata.startsWith('// ==UserScript==\n') ||
        !metadata.includes('\n// ==/UserScript==')) {
        throw new Error('src/metadata.js does not contain a complete userscript header');
    }

    const moduleSource = modules.map(trimFinalNewline).join('\n\n');
    const userscript = [
        trimFinalNewline(metadata),
        '',
        trimFinalNewline(globals),
        '',
        '(() => {',
        "    'use strict';",
        '',
        moduleSource,
        '})();',
    ].join('\n');

    // esbuild supplies the parser and compatibility validation while the
    // emitted source remains the readable, ordered assembly above. Reformatting
    // the legacy IIFE would add a large unrelated diff and weaken equivalence.
    await transform(userscript, {
        loader: 'js',
        target: ['chrome90', 'firefox90'],
        minify: false,
    });

    let current = null;
    try {
        current = await readFile(outputFile, 'utf8');
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    if (current !== userscript) {
        await writeFile(outputFile, userscript);
        console.log(`Built ${path.relative(projectRoot, outputFile)}`);
    } else {
        console.log(`Up to date: ${path.relative(projectRoot, outputFile)}`);
    }
}

let buildQueue = Promise.resolve();

function queueBuild() {
    buildQueue = buildQueue
        .then(createUserscript)
        .catch(error => {
            console.error(error);
            process.exitCode = 1;
        });
}

queueBuild();

if (process.argv.includes('--watch')) {
    let debounceTimer = null;
    const watcher = watch(
        path.join(projectRoot, 'src'),
        { recursive: true },
        () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(queueBuild, 75);
        }
    );
    console.log('Watching src/ for changes...');
    process.on('SIGINT', () => {
        watcher.close();
        process.exit(0);
    });
}
