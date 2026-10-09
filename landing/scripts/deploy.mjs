// Deploys the landing to Vercel from this machine:
//   node scripts/deploy.mjs [--prod]
// The Vercel project has no Git connection, so a push changes nothing; this script is the only deploy path.
// It uploads a copy of the committed landing/ tree with no .git, so the CLI sends no commit author to Vercel,
// and records the commit in the deployment's metadata instead. Vercel builds the copy remotely.
// --prod deploys only a checkout at origin/master, so the live site always matches the pushed branch, then
// checks that the site serves the new deployment. Without it the script makes a preview of HEAD.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LANDING = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.NUXT_PUBLIC_SITE_URL || 'https://evb-folder-player.vercel.app';
const prod = process.argv.includes('--prod');
const run = (command, args, options) =>
  execFileSync(command, args, {
    cwd: LANDING,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  }).trim();
const git = (...args) => run('git', args);

const link = path.join(LANDING, '.vercel/project.json');
if (!existsSync(link)) {
  throw new Error(`Missing ${link}. Link this folder once: vercel link --yes --project evb-folder-player`);
}
if (git('status', '--porcelain', '--untracked-files=all', '--', '.')) {
  throw new Error('landing/ has uncommitted changes. Only committed files are deployed; commit them first.');
}
const commit = git('rev-parse', 'HEAD');
if (prod) {
  git('fetch', '--quiet', 'origin', 'master');
  const master = git('rev-parse', 'FETCH_HEAD');
  if (commit !== master) {
    throw new Error(`HEAD ${commit.slice(0, 7)} is not origin/master ${master.slice(0, 7)}. Push or pull first.`);
  }
}

const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'folder-player-landing-')));
try {
  const source = path.join(scratch, 'source');
  const archive = path.join(scratch, 'landing.tar');
  mkdirSync(path.join(source, '.vercel'), { recursive: true });
  // Run from a subdirectory, git archive keeps only paths under it, which a landing/ tree does not have.
  const tree = `${commit}:${git('rev-parse', '--show-prefix')}`;
  run('git', ['archive', '--format=tar', `--output=${archive}`, tree], { cwd: git('rev-parse', '--show-toplevel') });
  run('tar', ['-xf', archive, '-C', source]);
  cpSync(link, path.join(source, '.vercel/project.json'));

  // JSON output is the same whether or not the CLI thinks an agent or a terminal is running it.
  const vercel = (...args) => {
    try {
      // TMPDIR can lie inside this repository; stop the CLI's git from finding it above the copy.
      const env = { ...process.env, GIT_CEILING_DIRECTORIES: scratch };
      return JSON.parse(run('vercel', [...args, '--format=json'], { cwd: source, env }));
    } catch (error) {
      throw new Error(`vercel ${args[0]} failed. ${error.stdout?.trim() || error.message}`);
    }
  };
  console.log(`Deploying ${prod ? 'production' : 'a preview'} of ${git('log', '-1', '--format=%h %s', commit)}`);
  const { deployment } = vercel('deploy', '--yes', '--meta', `commit=${commit}`, ...(prod ? ['--prod'] : []));
  console.log(deployment.url);

  if (prod) {
    const live = vercel('inspect', SITE);
    if (live.id !== deployment.id) throw new Error(`${SITE} still serves ${live.url}, not ${deployment.url}.`);
    for (const route of ['/', '/api/release']) {
      const response = await fetch(SITE + route, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${SITE}${route} answered ${response.status}.`);
    }
    console.log(`${SITE} serves ${commit.slice(0, 7)}.`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
