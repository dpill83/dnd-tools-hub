/**
 * Writes hub-tool-dates.json from git history (last commit touching each tool path).
 * Run from repo root: node scripts/gen-hub-tool-dates.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function diskPath(href) {
    const p = href.replace(/\/$/, '');
    return join(root, ...p.split('/').filter(Boolean));
}

/** Path passed to git log -- <path> (forward slashes). */
function resolveGitPath(href) {
    const p = href.replace(/\/$/, '');
    if (p.endsWith('.html')) {
        if (existsSync(diskPath(p))) return p;
        const parent = p.split('/').slice(0, -1).join('/');
        return parent;
    }
    return p;
}

function gitMtime(gitPath) {
    try {
        const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', gitPath], {
            cwd: root,
            encoding: 'utf8',
        }).trim();
        const t = parseInt(out, 10);
        return Number.isFinite(t) ? t : 0;
    } catch {
        return 0;
    }
}

const html = readFileSync(join(root, 'index.html'), 'utf8');
const hrefs = [...html.matchAll(/data-tool-href="([^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(hrefs)];

const tools = {};
for (const href of unique) {
    const gp = resolveGitPath(href);
    tools[href] = gitMtime(gp);
}

const payload = {
    generatedAt: new Date().toISOString(),
    tools,
};

writeFileSync(join(root, 'hub-tool-dates.json'), JSON.stringify(payload, null, 2) + '\n');
process.stdout.write(`Wrote hub-tool-dates.json (${unique.length} tools, git path per href)\n`);
