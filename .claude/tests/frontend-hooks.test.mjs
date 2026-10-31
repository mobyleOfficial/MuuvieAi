// Tests for the Flutter-side per-agent hooks (implementer-tester).
// Each hook runs under /bin/bash (3.2 on macOS) with crafted hook JSON on
// stdin, against a temp meta repo holding a nested `muuvie` git repo. `flutter`
// and `dart` are fake scripts on PATH that log their calls — real tooling never
// runs here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, utimesSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { HOOKS, META_ROOT } from './helpers.mjs';

function git(cwd, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function write(root, files) {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
}

const PUBSPEC_BUILD = (name) => `name: ${name}\ndev_dependencies:\n  build_runner: ^2.0.0\n`;
const ARB = (keys) => JSON.stringify(Object.fromEntries(keys.flatMap((k) => [[k, k], [`@${k}`, {}]])));

const APP_FILES = {
  '.gitignore': '*.g.dart\n*.config.dart\n.dart_tool/\n',
  'pubspec.yaml': PUBSPEC_BUILD('muuvie'),
  'lib/main.dart': 'void main() {}\n',
  'lib/di/injection.dart': "@InjectableInit()\nvoid configureDependencies() {}\n",
  'lib/di/movies_module.dart': '@module\nabstract class MoviesModule {}\n',
  'test/widget_test.dart': 'void main() {}\n',
  'features/movies/pubspec.yaml': 'name: movies\n',
  'features/movies/lib/movies.dart': "export 'package:movies_domain/domain.dart';\nexport 'package:movies_data/data.dart';\n",
  'features/movies/domain/pubspec.yaml': 'name: movies_domain\n',
  'features/movies/domain/lib/domain.dart': '\n',
  'features/movies/domain/lib/usecases/get_movies_use_case.dart': 'class GetMoviesUseCase {}\n',
  'features/movies/data/pubspec.yaml': PUBSPEC_BUILD('movies_data'),
  'features/movies/data/lib/data.dart': '\n',
  'features/movies/data/lib/repositories/movies_repository_impl.dart': '@LazySingleton()\nclass MoviesRepositoryImpl {}\n',
  'ui/common/pubspec.yaml': 'name: common\n',
  'ui/common/lib/l10n/app_en.arb': ARB(['title', 'save']),
  'ui/common/lib/l10n/app_es.arb': ARB(['title', 'save']),
  'ui/common/lib/l10n/app_pt.arb': ARB(['title', 'save']),
  'ui/news/pubspec.yaml': PUBSPEC_BUILD('news_ui'),
  'ui/news/lib/news_ui.dart': '\n',
  'ui/news/lib/news_list/news_list_state.dart': '\n',
  'ui/news/lib/news_list/news_list_bloc.dart': '\n',
  'ui/news/lib/news_list/news_list_page.dart': '@RoutePage()\nclass NewsListPage {}\n',
  'ui/news/lib/news_list/news_list_screen.dart': '\n',
  'ui/news/lib/legacy/legacy_page.dart': '\n',
  'ui/search/pubspec.yaml': 'name: search\n',
  'ui/search/lib/search.dart': '\n',
  'ui/search/test/search_test.dart': '\n',
};

/**
 * A meta repo with `muuvie` (and `backend`) registered as nested repos, the
 * way submodules are. origin/dev of muuvie points at its first commit. The
 * generated, gitignored injection.config.dart exists and is fresh unless
 * `config: false`.
 */
function fixture({ config = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'meta-'));
  const app = join(root, 'muuvie');
  write(app, APP_FILES);
  git(app, 'init', '-q');
  git(app, 'add', '-A');
  git(app, 'commit', '-q', '-m', 'app');
  git(app, 'update-ref', 'refs/remotes/origin/dev', 'HEAD');
  const backend = join(root, 'backend');
  write(backend, { 'build.gradle.kts': '', 'src/main/kotlin/App.kt': '' });
  git(backend, 'init', '-q');
  git(backend, 'add', '-A');
  git(backend, 'commit', '-q', '-m', 'backend');
  write(root, { 'CLAUDE.md': 'meta\n' });
  git(root, 'init', '-q');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'meta');
  if (config) setConfig(app, +1);
  return { root, app };
}

/** Writes injection.config.dart with an mtime `hours` from now. */
function setConfig(app, hours) {
  const file = join(app, 'lib/di/injection.config.dart');
  writeFileSync(file, '// generated\n');
  const time = Date.now() / 1000 + hours * 3600;
  utimesSync(file, time, time);
}

function which(tool) {
  return dirname(spawnSync('/bin/sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).stdout.trim());
}

/** PATH with git and jq but no flutter/dart. */
const BASE_PATH = [...new Set([which('jq'), which('git'), '/usr/bin', '/bin'])].join(':');

/** Fake flutter/dart that log "<physical cwd> <tool> <args>" and fail on demand. */
function fakeTools() {
  const bin = mkdtempSync(join(tmpdir(), 'fakebin-'));
  const log = join(bin, 'calls.log');
  writeFileSync(log, '');
  const script = (tool) => `#!/bin/sh
echo "$(pwd -P) ${tool} $*" >> "$FAKE_LOG"
case "${tool} $1" in
  "flutter analyze")
    if [ -n "$FAKE_ANALYZE_ERROR" ]; then
      echo "  error • Undefined name 'x' • lib/main.dart:1:1 • undefined_identifier"
      echo "1 issue found."
      exit 1
    fi ;;
  "flutter test")
    case "$(pwd -P)" in *"$FAKE_TEST_FAIL_IN") [ -n "$FAKE_TEST_FAIL_IN" ] && { echo "Some tests failed: expected 1"; exit 1; } ;; esac ;;
  "dart run")
    if [ -n "$FAKE_BUILD_FAIL" ]; then
      echo "[SEVERE] injectable_generator: boom"
      exit 1
    fi
    [ -d lib/di ] && echo generated > lib/di/injection.config.dart ;;
esac
exit 0
`;
  for (const tool of ['flutter', 'dart']) {
    writeFileSync(join(bin, tool), script(tool));
    chmodSync(join(bin, tool), 0o755);
  }
  return { path: `${bin}:${BASE_PATH}`, log, calls: () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) };
}

/** Runs a hook from an unrelated process cwd, so paths must come from the JSON. */
function run(name, input, { args = [], env = {}, path = BASE_PATH } = {}) {
  const result = spawnSync('/bin/bash', [`${HOOKS}${name}`, ...args], {
    cwd: tmpdir(),
    input: JSON.stringify(input),
    env: { HOME: process.env.HOME, PATH: path, ...env },
    encoding: 'utf8',
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

const stop = (cwd, extra = {}) => ({ hook_event_name: 'SubagentStop', cwd, stop_hook_active: false, ...extra });

// ---------------------------------------------------------------- enforce-path-restrictions

const writeInput = (root, filePath) => ({ cwd: root, tool_name: 'Write', tool_input: { file_path: filePath, content: 'x' } });

function expectPaths(root, agent, paths, status) {
  for (const path of paths) {
    const filePath = path.startsWith('/') ? path : join(root, path);
    const result = run('enforce-path-restrictions.sh', writeInput(root, filePath), { args: agent ? [agent] : [] });
    assert.equal(result.status, status, `${agent}: ${path} → ${result.status}\n${result.stderr}`);
  }
}

test('enforce-path-restrictions: implementer-tester may write only its allowed muuvie paths', () => {
  const { root } = fixture();
  expectPaths(root, 'implementer-tester', [
    'muuvie/features/movies/domain/lib/usecases/new_use_case.dart',
    'muuvie/features/brand_new/data/lib/models/deep/new_model.dart',
    'muuvie/ui/news/lib/news_list/news_list_screen.dart',
    'muuvie/lib/di/news_module.dart',
    'muuvie/test/features/movies/x_test.dart',
    'muuvie/pubspec.yaml',
    'muuvie/analysis_options.yaml',
    'muuvie/l10n.yaml',
    'muuvie/ui/common/lib/l10n/app_pt.arb',
  ], 0);
  expectPaths(root, 'implementer-tester', [
    'muuvie/secrets/.env',
    'muuvie/secrets/new/key.json',
    'muuvie/.env',
    'muuvie/lib/.env.prod',
    'muuvie/lib/di/injection.config.dart',
    'muuvie/features/movies/data/lib/models/movie.g.dart',
    'muuvie/lib/routes/app_router.gr.dart',
    'muuvie/ui/common/lib/app_localizations_en.dart',
    'muuvie/features/movies/data/lib/objectbox-model.json',
    'muuvie/ui/news/build/out.dart',
    'muuvie/lib/.dart_tool/x',
    'muuvie/android/app/build.gradle',
    'muuvie/README.md',
    'CLAUDE.md',
    'agents/implementer-tester.md',
    'backend/src/main/kotlin/App.kt',
    'muuvie/lib/../secrets/.env',
    'muuvie/lib/new_dir/../../secrets/.env',
    '/tmp/elsewhere/file.dart',
  ], 2);
});

test('enforce-path-restrictions: backend-implementer may write only its allowed backend paths', () => {
  const { root } = fixture();
  expectPaths(root, 'backend-implementer', [
    'backend/src/main/kotlin/App.kt',
    'backend/src/main/kotlin/com/muuvie/routing/NewRoute.kt',
    'backend/src/test/kotlin/com/muuvie/NewTest.kt',
    'backend/build.gradle.kts',
  ], 0);
  expectPaths(root, 'backend-implementer', [
    'backend/src/main/resources/application.conf',
    'backend/build/libs/app.jar',
    'backend/.gradle/cache',
    'backend/Dockerfile',
    'muuvie/lib/main.dart',
    'muuvie/secrets/.env',
    'CLAUDE.md',
  ], 2);
});

test('enforce-path-restrictions: other agents, missing agent and non-path tools are no-ops', () => {
  const { root } = fixture();
  expectPaths(root, '', ['muuvie/secrets/.env', 'CLAUDE.md'], 0);
  expectPaths(root, 'pm-spec', ['muuvie/secrets/.env'], 0);
  const bash = run('enforce-path-restrictions.sh', { cwd: root, tool_input: { command: 'ls' } }, { args: ['implementer-tester'] });
  assert.equal(bash.status, 0);
});

test('enforce-path-restrictions: allowlists match the "Allowed Paths" in agents/*.md', () => {
  const { root } = fixture();
  for (const agent of ['implementer-tester', 'backend-implementer']) {
    const doc = readFileSync(join(META_ROOT, 'agents', `${agent}.md`), 'utf8');
    const section = doc.split('## Allowed Paths')[1].split('\n## ')[0];
    const entries = [...section.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    assert.ok(entries.length > 0, `${agent}: no Allowed Paths entries`);
    expectPaths(root, agent, entries.map((entry) => entry.replace(/\/\*\*$/, '/pkg/sample_file.dart')), 0);
  }
});

test('enforce-path-restrictions: resolves the real meta repo from inside its submodule', () => {
  expectPaths(META_ROOT, 'implementer-tester', ['muuvie/lib/main.dart', 'muuvie/features/new_feature/lib/x.dart'], 0);
  expectPaths(META_ROOT, 'implementer-tester', ['muuvie/secrets/.env', 'README.md'], 2);
});

// ---------------------------------------------------------------- block-cross-feature-data-imports

function imports(root, file, tool) {
  return run('block-cross-feature-data-imports.sh', { cwd: root, tool_input: { file_path: join(root, 'muuvie', file), ...tool } });
}

test('block-cross-feature-data-imports blocks another feature\'s data layer via Write, Edit and MultiEdit', () => {
  const { root } = fixture();
  const line = "import 'package:movies_data/models/movie.dart';";
  const cases = [
    ['features/profile/data/lib/x.dart', { content: `import 'package:core/core.dart';\n${line}\n` }],
    ['features/profile/data/lib/x.dart', { old_string: 'a', new_string: line }],
    ['features/profile/domain/lib/x.dart', { edits: [{ old_string: 'a', new_string: '// ok' }, { old_string: 'b', new_string: line }] }],
    ['ui/news/lib/news_list/news_list_bloc.dart', { content: line }],
    ['features/profile/data/lib/x.dart', { content: "export 'package:movies_data/data.dart';" }],
    ['features/profile/data/lib/x.dart', { content: "import 'package:movies/movies.dart';" }],
  ];
  for (const [file, tool] of cases) {
    const result = imports(root, file, tool);
    assert.equal(result.status, 2, `${file} ${JSON.stringify(tool)}\n${result.stderr}`);
    assert.match(result.stderr, /package:movies_domain\/domain\.dart/);
    assert.doesNotMatch(result.stderr, /barrel\)? instead/);
  }
});

test('block-cross-feature-data-imports allows the owner, its tests, the DI root and domain imports', () => {
  const { root } = fixture();
  const line = "import 'package:movies_data/models/movie.dart';";
  const cases = [
    ['features/movies/data/lib/repositories/x.dart', { content: line }],
    ['features/movies/lib/movies.dart', { content: "export 'package:movies_data/data.dart';" }],
    ['test/features/movies/data/x_test.dart', { content: line }],
    ['lib/di/movies_module.dart', { edits: [{ old_string: 'a', new_string: line }] }],
    ['features/profile/data/lib/x.dart', { content: "import 'package:movies_domain/domain.dart';\nimport 'package:core/core.dart';" }],
    ['ui/news/lib/news_list/news_list_bloc.dart', { content: "import 'package:movies/movies.dart';" }],
    ['features/profile/data/lib/notes.md', { content: line }],
    ['features/profile/data/lib/x.dart', { content: `// ${line}` }],
  ];
  for (const [file, tool] of cases) {
    const result = imports(root, file, tool);
    assert.equal(result.status, 0, `${file} ${JSON.stringify(tool)}\n${result.stderr}`);
  }
});

// ---------------------------------------------------------------- validate-localization

test('validate-localization resolves muuvie/ from cwd and blocks on missing keys', () => {
  const { root, app } = fixture();
  assert.equal(run('validate-localization.sh', stop(root)).status, 0);
  assert.equal(run('validate-localization.sh', stop(join(app, 'lib'))).status, 0);
  write(app, { 'ui/common/lib/l10n/app_en.arb': ARB(['title', 'save', 'newKey']) });
  for (const cwd of [root, app, join(root, 'backend')]) {
    const result = run('validate-localization.sh', stop(cwd));
    assert.equal(result.status, 2, `cwd ${cwd}\n${result.stderr}`);
    assert.match(result.stderr, /app_es\.arb is missing:\n {4}- newKey/);
    assert.match(result.stderr, /app_pt\.arb is missing:\n {4}- newKey/);
  }
  assert.equal(run('validate-localization.sh', stop(root, { stop_hook_active: true })).status, 0);
});

test('validate-localization blocks on an invalid or missing locale file', () => {
  const { root, app } = fixture();
  write(app, { 'ui/common/lib/l10n/app_es.arb': '{ not json' });
  assert.match(run('validate-localization.sh', stop(root)).stderr, /app_es\.arb is not valid JSON/);
  rmSync(join(app, 'ui/common/lib/l10n/app_pt.arb'));
  const result = run('validate-localization.sh', stop(root));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /app_pt\.arb is missing\./);
});

test('validate-localization is a no-op outside a meta repo with muuvie', () => {
  const lonely = mkdtempSync(join(tmpdir(), 'lonely-'));
  assert.equal(run('validate-localization.sh', stop(lonely)).status, 0);
});

// ---------------------------------------------------------------- verify-di-registration

test('verify-di-registration does nothing when muuvie has no changes, even with no config', () => {
  const { root } = fixture({ config: false });
  assert.equal(run('verify-di-registration.sh', stop(root)).status, 0);
});

test('verify-di-registration blocks when the generated config is missing or stale', () => {
  const { root, app } = fixture({ config: false });
  write(app, { 'features/movies/domain/lib/usecases/new/brand_new_use_case.dart': 'class X {}\n' });
  let result = run('verify-di-registration.sh', stop(root));
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /injection\.config\.dart is missing/);
  assert.match(result.stderr, /dart run build_runner build --delete-conflicting-outputs/);

  setConfig(app, +1);
  assert.equal(run('verify-di-registration.sh', stop(root)).status, 0);

  setConfig(app, -1);
  result = run('verify-di-registration.sh', stop(join(app, 'lib')));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /- lib\/di\/movies_module\.dart/);
  assert.match(result.stderr, /- features\/movies\/data\/lib\/repositories\/movies_repository_impl\.dart/);
  assert.doesNotMatch(result.stderr, /injection\.dart/);
  assert.equal(run('verify-di-registration.sh', stop(root, { stop_hook_active: true })).status, 0);
});

test('verify-di-registration counts commits ahead of origin/dev as changes', () => {
  const { root, app } = fixture({ config: false });
  write(app, { 'lib/feature.dart': '\n' });
  git(app, 'add', '-A');
  git(app, 'commit', '-q', '-m', 'work');
  assert.equal(run('verify-di-registration.sh', stop(root)).status, 2);
});

// ---------------------------------------------------------------- regenerate-generated-files

test('regenerate-generated-files runs nothing without changes or when stop_hook_active', () => {
  const tools = fakeTools();
  const { root, app } = fixture({ config: false });
  assert.equal(run('regenerate-generated-files.sh', stop(root), { path: tools.path, env: { FAKE_LOG: tools.log } }).status, 0);
  write(app, { 'lib/di/news_module.dart': '@module\nabstract class NewsModule {}\n' });
  assert.equal(run('regenerate-generated-files.sh', stop(root, { stop_hook_active: true }), { path: tools.path, env: { FAKE_LOG: tools.log } }).status, 0);
  assert.deepEqual(tools.calls(), []);
});

test('regenerate-generated-files rebuilds the packages whose annotations changed, root last', () => {
  const tools = fakeTools();
  const { root, app } = fixture();
  write(app, {
    'features/movies/data/lib/datasources/remote/new_remote_data_source_impl.dart': '@Injectable(as: X)\nclass NewImpl {}\n',
    'ui/news/lib/detail/detail_page.dart': '@RoutePage()\nclass DetailPage {}\n',
    'features/movies/domain/lib/models/plain.dart': 'class Plain {}\n',
  });
  const result = run('regenerate-generated-files.sh', stop(root), { path: tools.path, env: { FAKE_LOG: tools.log } });
  assert.equal(result.status, 0, result.stderr);
  const appReal = git(app, 'rev-parse', '--show-toplevel');
  assert.deepEqual(tools.calls(), [
    `${appReal}/features/movies/data dart run build_runner build --delete-conflicting-outputs`,
    `${appReal}/ui/news dart run build_runner build --delete-conflicting-outputs`,
    `${appReal} dart run build_runner build --delete-conflicting-outputs`,
  ]);
});

test('regenerate-generated-files regenerates a missing config and localizations', () => {
  const tools = fakeTools();
  const { root, app } = fixture({ config: false });
  write(app, { 'ui/common/lib/l10n/app_en.arb': ARB(['title', 'save', 'extra']) });
  const result = run('regenerate-generated-files.sh', stop(app), { path: tools.path, env: { FAKE_LOG: tools.log } });
  assert.equal(result.status, 0, result.stderr);
  const appReal = git(app, 'rev-parse', '--show-toplevel');
  assert.deepEqual(tools.calls(), [
    `${appReal} dart run build_runner build --delete-conflicting-outputs`,
    `${appReal} flutter gen-l10n`,
  ]);
  assert.ok(existsSync(join(app, 'lib/di/injection.config.dart')));
});

test('regenerate-generated-files blocks with the generator output when a build fails', () => {
  const tools = fakeTools();
  const { root, app } = fixture();
  write(app, { 'lib/di/news_module.dart': '@module\nabstract class NewsModule {}\n' });
  const result = run('regenerate-generated-files.sh', stop(root), { path: tools.path, env: { FAKE_LOG: tools.log, FAKE_BUILD_FAIL: '1' } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /build_runner failed in muuvie\/\. \(exit 1\)/);
  assert.match(result.stderr, /injectable_generator: boom/);
});

test('regenerate-generated-files skips when the Flutter SDK is not on PATH', () => {
  const { root, app } = fixture({ config: false });
  write(app, { 'lib/di/news_module.dart': '@module\n' });
  const result = run('regenerate-generated-files.sh', stop(root));
  assert.equal(result.status, 0);
  assert.match(result.stderr, /not on PATH/);
});

// ---------------------------------------------------------------- validate-implementation

function implementation(cwd, tools, env = {}, extra = {}) {
  return run('validate-implementation.sh', stop(cwd, extra), { path: tools.path, env: { FAKE_LOG: tools.log, ...env } });
}

test('validate-implementation runs nothing when nothing relevant changed', () => {
  const tools = fakeTools();
  const { root, app } = fixture({ config: false });
  assert.equal(implementation(root, tools).status, 0);
  write(app, { 'docs/notes.md': 'x' });
  assert.equal(implementation(root, tools).status, 0);
  write(app, { 'lib/x.dart': '\n' });
  assert.equal(implementation(root, tools, {}, { stop_hook_active: true }).status, 0);
  assert.deepEqual(tools.calls(), []);
});

test('validate-implementation analyzes, then tests the root package for feature and lib changes', () => {
  const tools = fakeTools();
  const { root, app } = fixture();
  write(app, { 'features/movies/domain/lib/models/new/movie.dart': 'class Movie {}\n' });
  const result = implementation(root, tools);
  assert.equal(result.status, 0, result.stderr);
  const appReal = git(app, 'rev-parse', '--show-toplevel');
  assert.deepEqual(tools.calls(), [
    `${appReal} flutter analyze --no-fatal-infos --no-fatal-warnings`,
    `${appReal} flutter test`,
  ]);
});

test('validate-implementation tests a package in place when it has its own test/', () => {
  const tools = fakeTools();
  const { root, app } = fixture();
  write(app, { 'ui/search/lib/search_bloc.dart': '// changed\n' });
  assert.equal(implementation(root, tools).status, 0);
  const appReal = git(app, 'rev-parse', '--show-toplevel');
  assert.deepEqual(tools.calls().slice(1), [`${appReal}/ui/search flutter test`]);
});

test('validate-implementation blocks on analyzer errors (bullet format) and on failing tests', () => {
  const { root, app } = fixture();
  write(app, { 'lib/x.dart': '\n' });
  let tools = fakeTools();
  let result = implementation(root, tools, { FAKE_ANALYZE_ERROR: '1' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /error • Undefined name/);
  assert.equal(tools.calls().length, 1, 'tests must not run after analyze fails');

  tools = fakeTools();
  const appReal = git(app, 'rev-parse', '--show-toplevel');
  result = implementation(root, tools, { FAKE_TEST_FAIL_IN: appReal });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Some tests failed/);
  assert.match(result.stderr, /flutter test failed in: muuvie\/\./);
});

test('validate-implementation regenerates and checks DI before analyzing', () => {
  const { root, app } = fixture({ config: false });
  write(app, { 'lib/di/news_module.dart': '@module\nabstract class NewsModule {}\n' });
  let tools = fakeTools();
  let result = implementation(root, tools);
  assert.equal(result.status, 0, result.stderr);
  const appReal = git(app, 'rev-parse', '--show-toplevel');
  assert.deepEqual(tools.calls(), [
    `${appReal} dart run build_runner build --delete-conflicting-outputs`,
    `${appReal} flutter analyze --no-fatal-infos --no-fatal-warnings`,
    `${appReal} flutter test`,
  ]);

  rmSync(join(app, 'lib/di/injection.config.dart'));
  tools = fakeTools();
  result = implementation(root, tools, { FAKE_BUILD_FAIL: '1' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /build_runner failed/);
  assert.equal(tools.calls().length, 1, 'analyze must not run after a failed build');
});

test('validate-implementation skips when flutter is not on PATH', () => {
  const { root, app } = fixture();
  write(app, { 'lib/x.dart': '\n' });
  const result = run('validate-implementation.sh', stop(root));
  assert.equal(result.status, 0);
  assert.match(result.stderr, /flutter not on PATH/);
});

// ---------------------------------------------------------------- validate-module-structure

const structure = (cwd, extra) => run('validate-module-structure.sh', stop(cwd, extra));

test('validate-module-structure passes an untouched tree and touched modules without empty dirs', () => {
  const { root, app } = fixture();
  assert.equal(structure(root).status, 0);
  // movies has no domain/lib/models or data/lib/datasources dirs — still fine.
  write(app, { 'features/movies/domain/lib/usecases/get_movies_use_case.dart': '// changed\n' });
  write(app, { 'ui/news/lib/legacy/legacy_page.dart': '// legacy, incomplete, only modified\n' });
  assert.equal(structure(root).status, 0, structure(root).stderr);
});

test('validate-module-structure blocks a touched feature that lost a package or barrel', () => {
  const { root, app } = fixture();
  rmSync(join(app, 'features/movies/data/lib/data.dart'));
  const result = structure(root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /features\/movies is missing data\/lib\/data\.dart/);
});

test('validate-module-structure requires all four files for a new UI page set', () => {
  const { root, app } = fixture();
  write(app, { 'ui/news/lib/detail/detail_page.dart': '\n' });
  let result = structure(root);
  assert.equal(result.status, 2);
  for (const part of ['state', 'screen', 'bloc']) assert.match(result.stderr, new RegExp(`detail_${part}\\.dart`));
  assert.doesNotMatch(result.stderr, /detail_page\.dart/);
  write(app, { 'ui/news/lib/detail/detail_state.dart': '\n', 'ui/news/lib/detail/detail_cubit.dart': '\n', 'ui/news/lib/detail/detail_screen.dart': '\n' });
  result = structure(root, { stop_hook_active: false });
  assert.equal(result.status, 0, result.stderr);
});

test('validate-module-structure checks new UI modules and snake_case names', () => {
  const { root, app } = fixture();
  write(app, { 'ui/reviews_ui/pubspec.yaml': 'name: reviews_ui\n', 'lib/routes/BadName.dart': '\n' });
  const result = structure(root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /ui\/reviews_ui is missing its barrel lib\/reviews_ui\.dart/);
  assert.match(result.stderr, /no _ui suffix/);
  assert.match(result.stderr, /lib\/routes\/BadName\.dart: Dart filenames must be snake_case/);
  assert.equal(structure(root, { stop_hook_active: true }).status, 0);
});
