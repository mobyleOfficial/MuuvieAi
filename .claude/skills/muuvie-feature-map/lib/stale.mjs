import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { git, isCheckout } from './git.mjs';
import { FEATURES_DIR, INDEX_FILE, SUBMODULES } from './paths.mjs';
import { parseFeatureFile } from './references.mjs';

/**
 * For each feature file: the submodule commits since its `> Mapped at` sha that touch the
 * paths it cites. A file with commits listed may describe behaviour that has since changed;
 * it is the to-do list for an audit.
 */
export function stale(root, { featuresDir = join(root, FEATURES_DIR) } = {}) {
  const files = [];
  const errors = [];
  const names = existsSync(featuresDir)
    ? readdirSync(featuresDir).filter((n) => n.endsWith('.md') && n !== INDEX_FILE && statSync(join(featuresDir, n)).isFile()).sort()
    : [];

  for (const name of names) {
    const { refs, header } = parseFeatureFile(name, readFileSync(join(featuresDir, name), 'utf8'));
    if (!header) continue;
    const entry = { file: name };
    for (const submodule of SUBMODULES) {
      const sha = header[submodule];
      const paths = [...new Set(refs.filter((r) => r.kind === 'path' && r.value.startsWith(`${submodule}/`)).map((r) => r.value.slice(submodule.length + 1)))];
      if (!sha || paths.length === 0) continue;
      const dir = join(root, submodule);
      if (!isCheckout(dir)) {
        errors.push({ file: name, submodule, error: `${submodule} is not a git checkout` });
        continue;
      }
      if (git(dir, 'cat-file', '-e', `${sha}^{commit}`) === null) {
        errors.push({ file: name, submodule, error: `${submodule} has no commit ${sha}; fetch it or re-map the file` });
        continue;
      }
      const log = git(dir, 'log', '--format=%h%x09%s', `${sha}..HEAD`, '--', ...paths) ?? '';
      const commits = log
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [commitSha, ...subject] = line.split('\t');
          return { sha: commitSha, subject: subject.join('\t') };
        });
      if (commits.length > 0) entry[submodule] = { since: sha, commits };
    }
    if (SUBMODULES.some((s) => entry[s])) files.push(entry);
  }
  return { files, errors };
}
