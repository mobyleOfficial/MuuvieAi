// Tests for the backend-implementer Stop hooks: validate-backend-structure.sh,
// validate-kotlin-code.sh and verify-koin-di-registration.sh. Each test builds
// a meta repo with a nested `backend` git repo (registered as a gitlink, like
// the real submodule) holding a small convention-clean Ktor/Koin codebase,
// then changes it and runs the hook the way Claude Code does: Stop JSON on
// stdin, under macOS /bin/bash 3.2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { HOOKS, META_ROOT } from './helpers.mjs';

const STRUCTURE = 'validate-backend-structure.sh';
const KOTLIN = 'validate-kotlin-code.sh';
const KOIN = 'verify-koin-di-registration.sh';
const ALL_HOOKS = [STRUCTURE, KOTLIN, KOIN];
const M = 'src/main/kotlin/org/mobyle';

function git(cwd, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=dev', ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

/** Runs a Stop hook with `cwd` as the session cwd; the process runs elsewhere. */
function runStop(name, { cwd, stopHookActive = false, env = {} }) {
  const result = spawnSync('/bin/bash', [`${HOOKS}${name}`], {
    cwd: tmpdir(),
    input: JSON.stringify({ hook_event_name: 'SubagentStop', cwd, stop_hook_active: stopHookActive }),
    encoding: 'utf8',
    env: { ...process.env, BACKEND_HOOK_SCOPE: '', ...env },
  });
  return { status: result.status, stderr: result.stderr };
}

function expectBlocked(name, cwd, ...needles) {
  const result = runStop(name, { cwd });
  assert.equal(result.status, 2, `${name} should block\n${result.stderr}`);
  for (const needle of needles) assert.ok(result.stderr.includes(needle), `${name}: stderr lacks ${JSON.stringify(needle)}\n${result.stderr}`);
  return result;
}

function expectAllowed(name, cwd) {
  const result = runStop(name, { cwd });
  assert.equal(result.status, 0, `${name} should pass\n${result.stderr}`);
}

const CLEAN = {
  [`${M}/Main.kt`]: `package org.mobyle

import org.koin.ktor.ext.inject
import org.mobyle.data.di.dataModule
import org.mobyle.di.appModule
import org.mobyle.domain.repository.MoviesRepository

fun Application.configureKoin() {
    install(Koin) { modules(dataModule, appModule) }
}

fun Application.configureJobs() {
    val moviesRepository by inject<MoviesRepository>()
}
`,
  [`${M}/di/AppModule.kt`]: `package org.mobyle.di

import org.koin.dsl.module
import org.mobyle.domain.usecase.movies.GetTrendingMovies
import org.mobyle.domain.usecase.movies.SearchMovies as SearchMoviesV1

val appModule = module {
    factory { GetTrendingMovies(repository = get()) }
    factory { SearchMoviesV1(repository = get()) }
}
`,
  [`${M}/di/Utils.kt`]: `package org.mobyle.di

inline fun <reified T : Any> Route.injection() = lazy { GlobalContext.get().get<T>() }
`,
  [`${M}/data/di/DataModule.kt`]: `package org.mobyle.data.di

import org.koin.dsl.module
import org.mobyle.data.remote.tmdb.TmdbDataSource
import org.mobyle.data.remote.tmdb.TmdbDataSourceImpl
import org.mobyle.data.repository.MoviesRepositoryImpl
import org.mobyle.domain.repository.MoviesRepository

val dataModule = module {
    single<TmdbDataSource> { TmdbDataSourceImpl() }
    single<MoviesRepository> { MoviesRepositoryImpl(tmdbDataSource = get()) }
}
`,
  [`${M}/domain/model/Movie.kt`]: `package org.mobyle.domain.model

data class Movie(val id: Int = 0, val title: String = "")
`,
  [`${M}/domain/repository/MoviesRepository.kt`]: `package org.mobyle.domain.repository

import org.mobyle.domain.model.Movie

interface MoviesRepository {
    suspend fun getTrendingMovies(page: Int): List<Movie>
}
`,
  [`${M}/domain/usecase/movies/GetTrendingMovies.kt`]: `package org.mobyle.domain.usecase.movies

import kotlinx.coroutines.runBlocking
import org.mobyle.domain.model.Movie
import org.mobyle.domain.repository.MoviesRepository

class GetTrendingMovies(private val repository: MoviesRepository) {
    operator fun invoke(page: Int): List<Movie> = runBlocking {
        repository.getTrendingMovies(page)
    }
}

data class TrendingPage(val movies: List<Movie>)

class TrendingUnavailable(message: String) : IllegalStateException(message)
`,
  [`${M}/domain/usecase/movies/SearchMovies.kt`]: `package org.mobyle.domain.usecase.movies

import org.mobyle.domain.repository.MoviesRepository

class SearchMovies(private val repository: MoviesRepository) {
    operator fun invoke(query: String): String = query
}
`,
  [`${M}/data/remote/tmdb/TmdbDataSource.kt`]: `package org.mobyle.data.remote.tmdb

interface TmdbDataSource {
    suspend fun trending(page: Int): List<String>
}

class TmdbDataSourceImpl : TmdbDataSource {
    override suspend fun trending(page: Int): List<String> = emptyList()
}
`,
  [`${M}/data/repository/MoviesRepositoryImpl.kt`]: `package org.mobyle.data.repository

import org.mobyle.data.remote.tmdb.TmdbDataSource
import org.mobyle.domain.model.Movie
import org.mobyle.domain.repository.MoviesRepository

class MoviesRepositoryImpl(
    private val tmdbDataSource: TmdbDataSource,
) : MoviesRepository {
    override suspend fun getTrendingMovies(page: Int): List<Movie> {
        // Thread.sleep(10) would block here; a comment is not code.
        val note = "never runBlocking { } or Thread.sleep(1) in here"
        return tmdbDataSource.trending(page).map { Movie(title = it) }
    }
}
`,
  [`${M}/routing/MoviesRouting.kt`]: `package org.mobyle.routing

import org.mobyle.di.injection
import org.mobyle.domain.usecase.movies.GetTrendingMovies
import org.mobyle.domain.usecase.movies.SearchMovies

fun Route.getMoviesRouting() {
    val getTrendingMovies by injection<GetTrendingMovies>()
    val searchMovies by injection<SearchMovies>()

    get("/movies/trending") {
        call.respond(getTrendingMovies(1))
    }
}
`,
  ['src/test/kotlin/org/mobyle/domain/usecase/movies/GetTrendingMoviesTest.kt']: `package org.mobyle.domain.usecase.movies

import kotlinx.coroutines.runBlocking

class GetTrendingMoviesTest {
    fun \`returns the trending page\`() = runBlocking {
        Thread.sleep(1)
    }
}
`,
  'build.gradle.kts': 'plugins { kotlin("jvm") }\n',
};

/** A meta repo whose `backend` is a nested, committed git repo with origin/dev at HEAD. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'backend-hooks-'));
  const backend = join(root, 'backend');
  for (const [name, text] of Object.entries(CLEAN)) write(backend, name, text);
  git(backend, 'init', '-q');
  git(backend, 'add', '-A');
  git(backend, 'commit', '-q', '-m', 'base');
  git(backend, 'update-ref', 'refs/remotes/origin/dev', 'HEAD');
  git(root, 'init', '-q');
  writeFileSync(join(root, 'CLAUDE.md'), 'meta');
  git(root, 'add', 'CLAUDE.md', 'backend');
  git(root, 'commit', '-q', '-m', 'meta');
  return { root, backend };
}

function write(base, name, text) {
  mkdirSync(dirname(join(base, name)), { recursive: true });
  writeFileSync(join(base, name), text);
}

function edit(base, name, from, to) {
  const path = join(base, name);
  const text = readFileSync(path, 'utf8');
  assert.ok(text.includes(from), `${name} lacks ${JSON.stringify(from)}`);
  writeFileSync(path, text.replace(from, to));
}

// ---------------------------------------------------------------- all hooks

test('backend hooks pass when nothing changed, from the meta root, backend/ or a subdirectory', () => {
  const { root, backend } = fixture();
  for (const hook of ALL_HOOKS) {
    for (const cwd of [root, backend, join(backend, M, 'routing')]) expectAllowed(hook, cwd);
  }
});

test('backend hooks pass on every file of the clean fixture (BACKEND_HOOK_SCOPE=all)', () => {
  const { root } = fixture();
  for (const hook of ALL_HOOKS) {
    const result = runStop(hook, { cwd: root, env: { BACKEND_HOOK_SCOPE: 'all' } });
    assert.equal(result.status, 0, `${hook}\n${result.stderr}`);
  }
});

test('backend hooks report zero false positives on the real backend (BACKEND_HOOK_SCOPE=all)', (t) => {
  if (!existsSync(join(META_ROOT, 'backend', M, 'Main.kt'))) return t.skip('backend submodule not checked out');
  for (const hook of ALL_HOOKS) {
    const result = runStop(hook, { cwd: META_ROOT, env: { BACKEND_HOOK_SCOPE: 'all' } });
    assert.equal(result.status, 0, `${hook} flags the current backend:\n${result.stderr}`);
  }
});

test('backend hooks stand down when stop_hook_active is set, and without a backend checkout', () => {
  const { root, backend } = fixture();
  write(backend, `${M}/data/repository/Stray.kt`, 'package wrong\nclass FooImpl { suspend fun x() { Thread.sleep(1) } }\n');
  for (const hook of ALL_HOOKS) {
    assert.equal(runStop(hook, { cwd: root }).status, 2, `${hook} should block first`);
    assert.equal(runStop(hook, { cwd: root, stopHookActive: true }).status, 0, `${hook} must not loop`);
  }
  const bare = mkdtempSync(join(tmpdir(), 'no-backend-'));
  git(bare, 'init', '-q');
  mkdirSync(join(bare, 'backend')); // uninitialised submodule: an empty directory
  for (const hook of ALL_HOOKS) {
    assert.equal(runStop(hook, { cwd: bare }).status, 0, `${hook} (empty backend/)`);
    assert.equal(runStop(hook, { cwd: tmpdir() }).status, 0, `${hook} (not a repo)`);
  }
});

test('backend hooks judge commits ahead of origin/dev, not the ones already there', () => {
  const { root, backend } = fixture();
  write(backend, `${M}/domain/usecase/movies/GetPopular.kt`, 'package org.mobyle.domain.usecase.movies\n\nclass GetPopular {\n    suspend fun load() { Thread.sleep(5) }\n}\n');
  git(backend, 'add', '-A');
  git(backend, 'commit', '-q', '-m', 'popular');
  expectBlocked(KOTLIN, root, 'GetPopular.kt:4');
  expectBlocked(KOIN, root, 'GetPopular');
  git(backend, 'update-ref', 'refs/remotes/origin/dev', 'HEAD');
  expectAllowed(KOTLIN, root);
  expectAllowed(KOIN, root);
});

// ---------------------------------------------------------------- structure

test('structure: a package that does not match its directory is blocked with file:line', () => {
  const { root, backend } = fixture();
  edit(backend, `${M}/domain/usecase/movies/SearchMovies.kt`, 'package org.mobyle.domain.usecase.movies', 'package org.mobyle.domain.usecase');
  expectBlocked(STRUCTURE, root, 'backend/src/main/kotlin/org/mobyle/domain/usecase/movies/SearchMovies.kt:1', 'package org.mobyle.domain.usecase.movies');
  const { root: r2, backend: b2 } = fixture();
  edit(b2, 'src/test/kotlin/org/mobyle/domain/usecase/movies/GetTrendingMoviesTest.kt', 'package org.mobyle.domain.usecase.movies', 'package org.mobyle.usecase');
  expectBlocked(STRUCTURE, r2, 'GetTrendingMoviesTest.kt:1');
});

test('structure: files outside the known layers, untracked in new directories, are blocked', () => {
  const cases = [
    [`${M}/presentation/routing/FooRouting.kt`, 'package org.mobyle.presentation.routing\n', 'not in a known layer'],
    [`${M}/domain/usecase/GetFoo.kt`, 'package org.mobyle.domain.usecase\n', 'feature sub-package'],
    ['src/main/kotlin/com/acme/Foo.kt', 'package com.acme\n', 'outside the org.mobyle package root'],
    ['src/main/java/Foo.kt', 'class Foo\n', 'belong under src/main/kotlin/org/mobyle/'],
    [`${M}/routing/stats_routing.kt`, 'package org.mobyle.routing\n', 'PascalCase'],
    [`${M}/routing/NoPackage.kt`, 'fun x() = 1\n', 'no package declaration'],
  ];
  for (const [file, text, needle] of cases) {
    const { root, backend } = fixture();
    write(backend, file, text);
    expectBlocked(STRUCTURE, root, needle, file);
  }
});

test('structure: the domain layer may not import data, routing, di, Ktor or Exposed; data may not import routing', () => {
  const imports = ['org.mobyle.data.remote.tmdb.TmdbDataSource', 'org.mobyle.routing.Foo', 'org.mobyle.di.injection', 'io.ktor.server.routing.Route', 'org.jetbrains.exposed.sql.Table'];
  for (const imp of imports) {
    const { root, backend } = fixture();
    edit(backend, `${M}/domain/usecase/movies/SearchMovies.kt`, 'import org.mobyle.domain.repository.MoviesRepository', `import org.mobyle.domain.repository.MoviesRepository\nimport ${imp}`);
    expectBlocked(STRUCTURE, root, 'SearchMovies.kt:4', imp);
  }
  const { root, backend } = fixture();
  edit(backend, `${M}/data/repository/MoviesRepositoryImpl.kt`, 'import org.mobyle.domain.model.Movie', 'import org.mobyle.domain.model.Movie\nimport org.mobyle.routing.MoviePayload');
  expectBlocked(STRUCTURE, root, 'MoviesRepositoryImpl.kt:5', 'must not depend on routing');
});

test('structure: well-placed new files pass', () => {
  const { root, backend } = fixture();
  write(backend, `${M}/domain/model/vocabulary/Mood.kt`, 'package org.mobyle.domain.model.vocabulary\n\nenum class Mood { HAPPY }\n');
  write(backend, `${M}/domain/policy/RatingPolicy.kt`, 'package org.mobyle.domain.policy\n\nimport org.mobyle.model.MovieListing\n\nobject RatingPolicy\n');
  write(backend, `${M}/data/service/Clock.kt`, 'package org.mobyle.data.service\n\nobject Clock\n');
  write(backend, `${M}/model/MovieListing.kt`, 'package org.mobyle.model\n\ndata class MovieListing(val page: Int = 1)\n');
  write(backend, 'src/test/kotlin/org/mobyle/data/util/Fixtures.kt', 'package org.mobyle.data.util\n\nobject Fixtures\n');
  expectAllowed(STRUCTURE, root);
});

// ---------------------------------------------------------------- kotlin code

test('kotlin: Thread.sleep inside a suspend function or in routing is blocked', () => {
  const { root, backend } = fixture();
  edit(backend, `${M}/data/repository/MoviesRepositoryImpl.kt`, '        return tmdbDataSource', '        Thread.sleep(100)\n        return tmdbDataSource');
  expectBlocked(KOTLIN, root, 'MoviesRepositoryImpl.kt:13', 'delay()');
  const { root: r2, backend: b2 } = fixture();
  edit(b2, `${M}/routing/MoviesRouting.kt`, '        call.respond(getTrendingMovies(1))', '        Thread.sleep(1)\n        call.respond(getTrendingMovies(1))');
  expectBlocked(KOTLIN, r2, 'MoviesRouting.kt:12', 'routing');
});

test('kotlin: modifiers between suspend and fun (operator, inline, override …) still count', () => {
  // The common use case shape — found by a live run, where the check missed it.
  for (const signature of ['suspend operator fun invoke()', 'suspend inline fun run()', 'suspend override fun load()', 'override suspend fun load()', 'private suspend fun load()']) {
    const { root, backend } = fixture();
    write(backend, `${M}/domain/usecase/movies/Sleepy.kt`, `package org.mobyle.domain.usecase.movies\n\nclass Sleepy {\n    ${signature} {\n        Thread.sleep(10)\n    }\n}\n`);
    expectBlocked(KOTLIN, root, 'Sleepy.kt:5', 'delay()');
  }
});

test('kotlin: suspend tracking follows multi-line signatures and expression bodies', () => {
  const { root, backend } = fixture();
  write(backend, `${M}/data/service/Poller.kt`, `package org.mobyle.data.service

class Poller {
    fun plain() { Thread.sleep(1) }
    suspend fun poll(
        times: Int,
    ): Int =
        runBlocking { times }
    fun alsoPlain(): Int = runBlocking { 1 }
    suspend fun oneLine() = withContext(Dispatchers.IO) { Thread.sleep(1) }
    fun afterwards() { Thread.sleep(2) }
}

interface Source {
    suspend fun fetch(): Int
    fun sync(): Int
}

class Bridge(private val source: Source) : Source {
    override suspend fun fetch(): Int = 1
    override fun sync(): Int = runBlocking { source.fetch() }
}
`);
  const result = expectBlocked(KOTLIN, root, 'Poller.kt:8', 'Poller.kt:10');
  for (const line of [4, 9, 11, 21]) assert.ok(!result.stderr.includes(`Poller.kt:${line}:`), `line ${line} wrongly flagged\n${result.stderr}`);
});

test('kotlin: runBlocking inside a suspend function or in routing is blocked; use case bridges pass', () => {
  const { root, backend } = fixture();
  edit(backend, `${M}/domain/usecase/movies/GetTrendingMovies.kt`, 'repository.getTrendingMovies(page)\n', 'repository.getTrendingMovies(page + 1)\n');
  expectAllowed(KOTLIN, root);
  edit(backend, `${M}/data/repository/MoviesRepositoryImpl.kt`, '        return tmdbDataSource.trending(page)', '        return runBlocking { tmdbDataSource.trending(page) }');
  expectBlocked(KOTLIN, root, 'MoviesRepositoryImpl.kt:13', 'runBlocking inside a suspend function');
  const { root: r2, backend: b2 } = fixture();
  edit(b2, `${M}/routing/MoviesRouting.kt`, 'call.respond(getTrendingMovies(1))', 'call.respond(runBlocking { getTrendingMovies(1) })');
  expectBlocked(KOTLIN, r2, 'MoviesRouting.kt:12', 'runBlocking in routing');
});

test('kotlin: Future and CompletableFuture are blocked; tests may block threads', () => {
  for (const sig of ['fun load(): CompletableFuture<Int> = TODO()', 'fun load(): java.util.concurrent.Future<Int> = TODO()']) {
    const { root, backend } = fixture();
    write(backend, `${M}/data/service/Loader.kt`, `package org.mobyle.data.service\n\nclass Loader {\n    ${sig}\n}\n`);
    expectBlocked(KOTLIN, root, 'Loader.kt:4', 'suspend fun');
  }
  const { root, backend } = fixture();
  edit(backend, 'src/test/kotlin/org/mobyle/domain/usecase/movies/GetTrendingMoviesTest.kt', 'Thread.sleep(1)', 'Thread.sleep(2)');
  expectAllowed(KOTLIN, root);
});

test('kotlin: Koin service location in domain/ or data/ is blocked, DI modules may import Koin', () => {
  const { root, backend } = fixture();
  edit(backend, `${M}/data/repository/MoviesRepositoryImpl.kt`, 'import org.mobyle.domain.model.Movie', 'import org.mobyle.domain.model.Movie\nimport org.koin.core.component.KoinComponent');
  expectBlocked(KOTLIN, root, 'MoviesRepositoryImpl.kt:5', 'constructor injection');
  const { root: r2, backend: b2 } = fixture();
  edit(b2, `${M}/data/di/DataModule.kt`, 'val dataModule', '// edited\nval dataModule');
  expectAllowed(KOTLIN, r2);
});

// ---------------------------------------------------------------- koin

test('koin: an unregistered use case is blocked until it is added to appModule', () => {
  const { root, backend } = fixture();
  write(backend, `${M}/domain/usecase/movies/GetUpcoming.kt`, `package org.mobyle.domain.usecase.movies

import org.mobyle.domain.repository.MoviesRepository

class GetUpcoming(
    private val repository: MoviesRepository,
) {
    operator fun invoke(): Int = 1
}

data class UpcomingPage(val page: Int = 1)

class UpcomingMissing : RuntimeException()
`);
  const result = expectBlocked(KOIN, root, 'GetUpcoming.kt:5', '`GetUpcoming`', 'factory { GetUpcoming(...) }', 'AppModule.kt');
  assert.ok(!result.stderr.includes('UpcomingPage') && !result.stderr.includes('UpcomingMissing'), result.stderr);
  edit(backend, `${M}/di/AppModule.kt`, 'val appModule = module {', 'val appModule = module {\n    factory { GetUpcoming(repository = get()) }');
  expectAllowed(KOIN, root);
});

test('koin: data-layer implementations must be bound in dataModule', () => {
  const { root, backend } = fixture();
  write(backend, `${M}/data/local/watch/WatchDataSource.kt`, `package org.mobyle.data.local.watch

interface WatchDataSource {
    fun all(): List<Int>
}

class WatchDataSourceImpl : WatchDataSource {
    override fun all(): List<Int> = emptyList()
}
`);
  expectBlocked(KOIN, root, 'WatchDataSource.kt:7', 'single<WatchDataSource> { WatchDataSourceImpl(...) }', 'DataModule.kt');

  const { root: r2, backend: b2 } = fixture();
  write(b2, `${M}/domain/repository/RateLimiter.kt`, 'package org.mobyle.domain.repository\n\ninterface RateLimiter\n');
  write(b2, `${M}/data/service/InMemoryRateLimiter.kt`, `package org.mobyle.data.service

import org.mobyle.domain.repository.RateLimiter

class InMemoryRateLimiter(private val limit: Int = 5) : RateLimiter
`);
  write(b2, `${M}/data/remote/auth/JwtPrincipal.kt`, 'package org.mobyle.data.remote.auth\n\nclass JwtPrincipal(val name: String) : java.security.Principal\n');
  const result = expectBlocked(KOIN, r2, 'InMemoryRateLimiter.kt:5', 'single<RateLimiter>');
  assert.ok(!result.stderr.includes('JwtPrincipal'), `a plain helper class is not a binding\n${result.stderr}`);
});

test('koin: injection points must name a registered type; aliased registrations count', () => {
  const { root, backend } = fixture();
  edit(backend, `${M}/routing/MoviesRouting.kt`, '    val searchMovies by injection<SearchMovies>()', '    val searchMovies by injection<SearchMovies>()\n    val lookup by injection<LookupMovie>()');
  const result = expectBlocked(KOIN, root, 'MoviesRouting.kt:10', '`LookupMovie`');
  assert.ok(!result.stderr.includes('`SearchMovies`'), `SearchMovies is registered through an alias\n${result.stderr}`);
});

test('koin: changing a module re-checks every injection point and use case', () => {
  const { root, backend } = fixture();
  edit(backend, `${M}/di/AppModule.kt`, '    factory { GetTrendingMovies(repository = get()) }\n', '');
  expectBlocked(KOIN, root, 'GetTrendingMovies.kt:7', 'MoviesRouting.kt:8');
  const { root: r2, backend: b2 } = fixture();
  edit(b2, `${M}/di/AppModule.kt`, '    factory { GetTrendingMovies(repository = get()) }\n', '    // factory { GetTrendingMovies(repository = get()) }\n');
  expectBlocked(KOIN, r2, 'GetTrendingMovies.kt:7');
});

test('koin: a new module must be installed in modules(...)', () => {
  const { root, backend } = fixture();
  write(backend, `${M}/di/JobsModule.kt`, 'package org.mobyle.di\n\nimport org.koin.dsl.module\n\nval jobsModule = module {\n}\n');
  expectBlocked(KOIN, root, 'JobsModule.kt:5', '`jobsModule` is never installed', 'Main.kt');
  edit(backend, `${M}/Main.kt`, 'modules(dataModule, appModule)', 'modules(dataModule, appModule, jobsModule)');
  expectAllowed(KOIN, root);
});

test('koin: a deleted file is not judged', () => {
  const { root, backend } = fixture();
  unlinkSync(join(backend, M, 'domain/usecase/movies/SearchMovies.kt'));
  edit(backend, `${M}/routing/MoviesRouting.kt`, '    val searchMovies by injection<SearchMovies>()\n', '');
  for (const hook of ALL_HOOKS) expectAllowed(hook, root);
});
