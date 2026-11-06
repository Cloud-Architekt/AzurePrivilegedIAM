import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

export function normalizeGeneratedData(content, filePath) {
    let data;
    if (filePath.endsWith('.json')) {
        data = JSON.parse(content);
        delete data.generatedUtc;
    } else {
        const context = { window: {} };
        runInNewContext(content, context, { timeout: 5000 });
        data = JSON.parse(JSON.stringify(context.window));
        for (const value of Object.values(data)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                delete value.generatedUtc;
            }
        }
    }
    return data;
}

export function verifyGeneratedData() {
    const files = [
        'ClassificationExplorer/data-manifest.json',
        'ClassificationExplorer/data/classification-data.js',
        'ClassificationExplorer/data/attack-paths.js',
        'ClassificationExplorer/data/tier-map.js',
    ];
    let failures = 0;
    for (const filePath of files) {
        const committed = execFileSync('git', ['show', `HEAD:${filePath}`], {
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
        });
        const generated = readFileSync(filePath, 'utf8');
        if (!isDeepStrictEqual(
            normalizeGeneratedData(committed, filePath),
            normalizeGeneratedData(generated, filePath),
        )) {
            console.error(`Stale generated data: ${filePath}`);
            failures++;
        }
    }
    if (failures) {
        console.error('Run Update-EntraOpsClassificationExplorerData -Mode Standalone and commit the refreshed data.');
        process.exitCode = 1;
    } else {
        console.log('Generated classification data is current (formatting and generation timestamps ignored).');
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    verifyGeneratedData();
}