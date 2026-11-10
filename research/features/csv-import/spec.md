---
date: 2026-11-10
author: Bruno Bacelar Abe
status: draft
related:
  - feature-map
tags: [backend, frontend, imports, letterboxd, filmow, csv]
---

# Feature Spec: Import from a file (Filmow CSV and Letterboxd export)

**Status:** Draft
**Scope:** Backend (`backend/`) and frontend (`muuvie/`)
**Date:** 2026-11-10

---

## 1. Executive summary

Today the only way to bring a history into Muuvie is the Filmow login: the app captures the Filmow session and the server scrapes the profile ([feature map: imports](../../.claude/skills/muuvie-feature-map/features/imports.md)). Letterboxd exists in the vocabulary but `POST /imports` refuses it with a 503 `import_source_unavailable`, "until the input format is decided (roadmap A1)" [Source: backend/src/main/kotlin/org/mobyle/domain/usecase/imports/ImportUseCases.kt:39].

This spec decides that format: **files**. The user uploads either

1. the CSV produced by [filmow_to_letterboxd](https://github.com/yanari/filmow_to_letterboxd) — which is Letterboxd's *import* format (`Title, Directors, Year, Rating`), or any CSV in that format; or
2. Letterboxd's own *export*: the `.zip` from Settings › Data, or individual CSVs taken out of it.

The server parses the files into the existing neutral `ImportBundle` and the job continues through the pipeline that already exists — preview, confirm, TMDB matching, unmatched review, progress over WebSocket. Nothing after the read step changes.

## 2. Decisions taken

| # | Decision | Why |
|---|---|---|
| D1 | The user picks the origin: "Arquivo do Filmow" or "Arquivo do Letterboxd". | The filmow_to_letterboxd CSV is byte-for-byte Letterboxd's import format; the file cannot tell where it came from. The origin drives the history row, the feed (`importou_filmes`) and who owns the rows. |
| D2 | Accept a `.zip` and one or more loose `.csv` files. | The Letterboxd zip carries watchlist, likes, diary dates and lists in one go; loose CSVs cover the filmow_to_letterboxd output, which is split into several files above 1900 movies (`CSV_LIMIT`). |
| D3 | Parse on the **server**, at request time. | One parser, unit-tested in Kotlin; a bad file is a 400 before any job exists; the app stays a thin uploader; the background runner is reused as is. |
| D4 | Keep the Filmow login flow. | It is the only path that brings Filmow lists, watchlist and favorites. The file flow is an alternative, not a replacement. |

## 3. Input formats

Headers are matched case-insensitively, trimmed, in any column order. Files are UTF-8 (a BOM is stripped); fields follow RFC 4180 (quotes, embedded commas and newlines).

### 3.1 Letterboxd import format (filmow_to_letterboxd output)

Recognised by a `Title` column (or `LetterboxdURI` / `imdbID` / `tmdbID`, which Letterboxd also accepts as the key). Optional columns: `Year`, `Directors`, `Rating` (0.5–5), `Rating10` (1–10, halved), `WatchedDate`, `Rewatch`, `Tags`, `Review`, `imdbID`, `tmdbID`, `LetterboxdURI`.

filmow_to_letterboxd writes `Title` (the original title when Filmow shows one), `Directors` (comma-joined), `Year`, `Rating` (`0.5`–`5`, empty when unrated).

| Column | `ImportedMovie` field |
|---|---|
| `Title` | `title` and `originalTitle` |
| `Year` | `year` |
| `Directors` | `director` (the whole string; the resolver compares it) |
| `Rating` / `Rating10 ÷ 2` | `stars` |
| `WatchedDate` (YYYY-MM-DD) | `watchedOn` |
| `tmdbID` | `tmdbId` (matched, method `tmdb`) |
| `imdbID` | `imdbUrl` (`https://www.imdb.com/title/<id>/`) |

Every row goes to **Já assisti** — that is what the format means on Letterboxd too. No watchlist, favorites or lists.

### 3.2 Letterboxd export (`letterboxd-<user>-<date>-utc.zip`)

| File in the zip | Header | Goes to |
|---|---|---|
| `watched.csv` | `Date,Name,Year,Letterboxd URI` | watched |
| `ratings.csv` | `Date,Name,Year,Letterboxd URI,Rating` | `stars` of the watched movie |
| `diary.csv` | `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date` | `watchedOn` of the watched movie |
| `watchlist.csv` | `Date,Name,Year,Letterboxd URI` | watchlist |
| `likes/films.csv` | `Date,Name,Year,Letterboxd URI` | favorites |
| `lists/*.csv` | see below | lists → shelves |
| everything else (`profile.csv`, `reviews.csv`, `comments.csv`, `likes/lists.csv`, `likes/reviews.csv`, `deleted/`, `orphaned/`) | — | ignored |

Gotchas of the export, which the parser must handle:

- `Date` is when the row was **logged on Letterboxd**, not when the movie was watched. Only `diary.csv`'s `Watched Date` becomes `watchedOn`.
- The `Letterboxd URI` of `watched`, `ratings`, `watchlist`, `likes` and list rows is the **film** link (`https://boxd.it/xxxx`) and is the movie's `externalId`. In `diary.csv` (and `reviews.csv`) it is the link of the **diary entry**, so diary rows are joined to watched movies by normalised `Name` + `Year`, not by URI.
- A movie can have many diary entries. The bundle keeps one `watchedOn` per movie: the **latest** `Watched Date`. (Several logs per movie is §7, open question 1.)
- A rated or diaried movie missing from `watched.csv` is still added to watched.
- List files start with a preamble:
  ```
  Letterboxd list export v7
  Date,Name,Tags,URL,Description
  2024-01-02,Best of 2023,,https://letterboxd.com/user/list/best-of-2023/,My favorites
  
  Position,Name,Year,URL,Description
  1,Past Lives,2023,https://boxd.it/xxxx,
  ```
  The list's `URL` is its `externalId`; `Name` and `Description` become the shelf title and description; movies keep `Position` order.

### 3.3 Loose Letterboxd CSVs

A loose file is classified by its header first, then its file name:

| Header | Kind |
|---|---|
| first line starts with `Letterboxd list export` | list |
| has `Watched Date` | diary |
| has `Rating` and `Letterboxd URI` | ratings |
| exactly `Date,Name,Year,Letterboxd URI` | by file name: `watched.csv` → watched, `watchlist.csv` → watchlist, `films.csv` → likes; any other name → **400** (`ambiguous_file`), because reading a watchlist as watched would mark unseen movies as seen |
| a `Title` (import format) column | import format, as §3.1 |

The **Filmow** origin accepts only the import format (§3.1); a Letterboxd export file sent as Filmow is a 400 `unsupported_file`.

### 3.4 Movie identity

- Letterboxd export rows: `externalId` = the `boxd.it` URI, stored in `movies.letterboxd_id` as the reader of the Filmow side does with `filmow_id`. A re-import of the same export finds the same movies.
- Import-format rows: `LetterboxdURI` when present, else `title:<MovieMatchPolicy.normalize(title)>:<year>` — the key `FilmowImportReader` already falls back to [Source: backend/src/main/kotlin/org/mobyle/data/repository/FilmowImportReader.kt:59].
- A `title:` key is **not** an id on the source: `ensureMovie` must not write it into `filmow_id` / `letterboxd_id` (today it would, for the rare Filmow movie without an id) [Source: backend/src/main/kotlin/org/mobyle/data/local/imports/ImportDataSource.kt:296].

## 4. API

### `POST /imports` with `multipart/form-data`

| Part | Value |
|---|---|
| `source` | `filmow` or `letterboxd` |
| `file` | one or more parts; `.csv` or `.zip` (`.zip` only for `letterboxd`, at most one) |

The JSON body (`source`, `username`, `cookies`) keeps working for the Filmow login. The route branches on `Content-Type`.

- **202** — the job, as today. `inputRef` is the first file's name (e.g. `letterboxd-maria-2026-11-10-utc.zip`, `maria-1.csv`), shown in the history instead of a username.
- **400** `validation_error` / `unsupported_file` / `ambiguous_file` / `empty_file` — the message names the file. No job is created.
- **409** `import_in_progress` — unchanged: one active job per user and source.
- **413** `file_too_large` — limits below.

Limits (defensive, all configurable): 10 files; 10 MB per request; for a zip, 50 MB uncompressed and 2000 entries (zip-bomb guard); 50 000 rows in total. A 500-movie Letterboxd export is ~60 KB zipped, so these are far from real use.

The file contents are parsed in the request and only the resulting bundle is stored (in `import_jobs.bundle`, as today). The uploaded bytes are never written to disk or to the database.

### Removed

- The 503 `import_source_unavailable` for `letterboxd`. A JSON `POST /imports` with `source: letterboxd` becomes a 400 (`letterboxd imports need a file`).

No migration: `import_jobs.source` already allows `letterboxd` [Source: backend/src/main/resources/db/migration/V7__import_jobs.sql:15].

## 5. Backend design

- `domain/usecase/imports`: `StartFileImport(source, files)` next to `StartImport`; same `ImportRepository.createJob` and `ImportJobQueue`.
- `data/repository/imports/` (new, pure, no I/O besides the bytes given):
  - `CsvReader` — RFC 4180 tokenizer (or `kotlin-csv`/`commons-csv` if the dependency is preferred; decide in the plan).
  - `LetterboxdImportFormatParser` (§3.1), `LetterboxdExportParser` (§3.2 / §3.3), both → `ImportBundle`.
  - `ImportFileClassifier` (§3.3).
- The runner's read step needs the parsed bundle instead of a scrape. Generalise the queue input from `credentials: String` to a sealed `ImportInput` (`FilmowSession(cookies)` | `Parsed(bundle)`); the `ImportSourceReader` for files returns the bundle it is handed. Everything from `saveRead` on is untouched.
- `knownTmdbId(LETTERBOXD, …)` already looks up `letterboxd_id` [Source: backend/src/main/kotlin/org/mobyle/data/local/imports/ImportDataSource.kt:217].
- `enrichment.enrichImported(source, externalIds)` returns early for any source but Filmow and looks movies up by `filmow_id` [Source: backend/src/main/kotlin/org/mobyle/data/service/MovieEnrichmentService.kt:87]. It must find Letterboxd movies by `letterboxd_id`, and file-imported movies with a `title:` key by their catalog id (the writer's `movieIds` map), or they wait for the background loop.
- Tests: parser tests against fixture files under `src/test/resources/imports/` (a real filmow_to_letterboxd output, a trimmed Letterboxd export zip, each loose file, malformed and ambiguous cases, BOM, quoted commas/newlines); a routing test for the multipart branch and its 400/413s.

## 6. App design

- **Dependency:** `file_picker` (`.csv` and `.zip`, multiple), in `ui/imports`.
- **Data:** `ImportsRemoteDataSource.startFileImport(source, files)` sends `FormData` through `HttpClient`; use case `StartFileImport` in `features/imports/domain`, registered `@injectable`.
- **Start screen** (`ImportStartRoute`), under the current button:
  - "Enviar arquivo do Filmow" → a sheet explaining how to get it (run filmow_to_letterboxd, with a link to the repository) → picker (`.csv`, multiple).
  - "Enviar arquivo do Letterboxd" → a sheet: "No Letterboxd, vá em Settings › Data › Export your data e envie o .zip" (link `https://letterboxd.com/settings/data/`) → picker (`.zip` or `.csv`).
  - On 202 the screen is replaced by `ImportJobRoute`, as the Filmow login does. A 400 shows the server's reason mapped to a pt-BR message per code; a 409 keeps `l10n:importInProgress`.
- **History rows:** "Letterboxd · {inputRef}" works already; the source label needs a pt-BR string for `letterboxd`.
- **Entry points:** show the hidden "Importar dados do Letterboxd" in Editar perfil [Source: muuvie/ui/profile/lib/edit_profile/edit_profile_screen.dart:14]; it opens `ImportStartRoute`.
- **Preview for a Filmow file:** watchlist, favorites and lists are always 0 — the preview hides empty sections instead of listing zeros, and "Nenhuma lista encontrada no seu perfil." is replaced by nothing.
- All strings in `app_pt.arb` + both Dart classes; the picker buttons and sheets get semantic labels and 48 dp targets.

## 7. Open questions

1. **Several sessions per movie.** A Letterboxd diary can log the same movie many times (rewatches). The bundle holds one `watchedOn` per movie, so only the latest becomes a watch log. Supporting all of them means `ImportedMovie.watchLogs: List<…>` and a change to `upsertLog`. Phase 2?
2. **Reviews and tags** (`reviews.csv`, diary `Tags`, import-format `Review`). Do watch logs have a place for review text in Muuvie? Ignored for now.
3. **Re-importing Filmow by file after a login import.** File rows have no Filmow id, so a movie TMDB could not match becomes a second placeholder next to the one the login import created. Acceptable (both end up in the unmatched review), or match placeholders by `title:` key too?

## 8. Delivery

1. **Backend** (`backend`, branch `feature/csv-movie-import`): parsers + tests, `StartFileImport`, multipart route, generalised queue input, drop the 503.
2. **App** (`muuvie`, same branch name): file picker, datasource/use case, start-screen buttons and sheets, Letterboxd entry in Editar perfil, l10n, cubit tests.
3. **Meta-repo:** bump both submodules; update the feature-map page `imports.md` (new sub-feature, endpoint behaviour, gotchas) and `profile.md`; README/CLAUDE.md if anything public changes.
