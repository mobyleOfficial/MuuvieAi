---
date: 2026-11-10
author: Bruno Bacelar Abe
status: approved
related:
  - feature-map
tags: [backend, frontend, imports, letterboxd, filmow, csv]
---

# Feature Spec: Import from a file (Filmow CSV and Letterboxd export)

**Status:** Implemented (backend `93e9431`, muuvie `209a2f7`)
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

As built (backend `93e9431`):

- `domain/usecase/imports`: `StartFileImport(userId, source, files)` next to `StartImport`. It reads the files through the `ImportFileReader` contract first (a bad file raises before any job exists), creates the job, and moves it `pending → reading → preview` with `saveRead` in the same request. The background runner is not involved: there is nothing slow left to read, and confirming the preview goes through `ConfirmImport` and the runner's write step as before.
- `data/imports/` (pure, no I/O besides the bytes given): `Csv` (RFC 4180 reader, no new dependency), `FileImportReader` (zip expansion, limits, classification of §3.3), `ImportBundleBuilder` (§3.1 and §3.2 into one `ImportBundle`) and the cell helpers in `ImportCsvFile.kt`.
- Errors: `InvalidFileException` (400, codes `empty_file` / `unsupported_file` / `ambiguous_file`) and `PayloadTooLargeException` (413, `file_too_large`), mapped in `configureStatusPages`.
- The route reads the multipart parts with Ktor 3's `provider()` (the build resolves Ktor 3.1.1 through the Ktor plugin's BOM, whatever the dependency lines say).
- `knownTmdbId(LETTERBOXD, …)` already looks up `letterboxd_id` [Source: backend/src/main/kotlin/org/mobyle/data/local/imports/ImportDataSource.kt:217].
- `enrichment.enrichImported(source, externalIds)` returned early for any source but Filmow [Source: backend/src/main/kotlin/org/mobyle/data/service/MovieEnrichmentService.kt:87]. It now finds Letterboxd movies by `letterboxd_id` (`findDbIdsByLetterboxdIds`). Movies with a `title:` key are left to the background loop; they went through the resolver before writing, so the confident matches already carry their TMDB id.
- Tests: parser tests against fixture files under `src/test/resources/imports/` (a real filmow_to_letterboxd output, a trimmed Letterboxd export zip, each loose file, malformed and ambiguous cases, BOM, quoted commas/newlines); a routing test for the multipart branch and its 400/413s.

## 6. App design

- **Dependency:** `file_picker` (`.csv` and `.zip`, multiple), in `ui/imports`.
- **Data:** `ImportsRemoteDataSource.startFileImport(source, files)` sends `FormData` through `HttpClient`, one `file` part per file; use case `StartFileImport` in `features/imports/domain`, registered `@injectable`. 413 maps to the new `AppError.payloadTooLarge`.
- **Start screen** (`ImportStartRoute`), under the current button:
  - "Enviar arquivo do Filmow" → a sheet explaining how to get it (run filmow_to_letterboxd, with a link to the repository) → picker (`.csv`, multiple).
  - "Enviar arquivo do Letterboxd" → a sheet: "No Letterboxd, vá em Settings › Data › Export your data e envie o .zip" (link `https://letterboxd.com/settings/data/`) → picker (`.zip` or `.csv`).
  - On 202 the screen is replaced by `ImportJobRoute`, as the Filmow login does. `AppError` carries no server code, so every 400 shows one message ("Não conseguimos ler esse arquivo…"), a 413 another, and a 409 keeps `l10n:importInProgress`.
- **History rows:** "Letterboxd · {inputRef}" works already; the source label needs a pt-BR string for `letterboxd`.
- **Entry points:** show the hidden "Importar dados do Letterboxd" in Editar perfil [Source: muuvie/ui/profile/lib/edit_profile/edit_profile_screen.dart:14]; it opens `ImportStartRoute`.
- **Preview for a Filmow file:** watchlist, favorites and lists are always 0 and the preview shows them as 0 with "Nenhuma lista encontrada no seu perfil.". Hiding the empty sections is left for later (§7).
- Strings in the three ARBs (`app_en.arb` template, `app_es.arb`, `app_pt.arb`) and the generated Dart classes, edited by hand in this change. The file buttons are 48 dp outlined buttons with a text label.

## 7. Decisions on the open questions (2026-11-10)

1. **Several sessions per movie → import them all.** `ImportedMovie.watchDates` holds every diary date (and import-format `WatchedDate`); `watchedOn` stays the latest, for the date on "Já assisti". The writer creates one log per date; imported logs are unique per movie and day, whichever import or source brought them. Each session is a viewing (follow-up decision, same day): in date order the imported logs take cycles 1, 2, 3…, and `user_movies.currentCycle` / `rewatches` follow, so the stats count the rewatches. Cycles are left as they are on a row the user owns, on a movie with sessions logged in the app, or when the user already started a new cycle in the app.
2. **Reviews → ratings.** `reviews.csv` (joined by title and year, as the diary) and the import format's `Review` column become `user_movies.review`, the review of the movie's rating; the latest one wins. A review needs a label to be shown on the rating, so for a movie without one (follow-up decision, same day) the review becomes the comment of the imported session of its date (`ImportedMovie.reviewOn`, the review's `Watched Date`), else of the latest imported session; with no session at all it is dropped. Comments are cut at 5 000 characters, the app's limit. The preview and the report say "N resenhas" for both. Truncated at 10 000 characters, the limit of a review written in the app. `preview.reviews` and `counts.reviews` count them.
3. **Per-code errors → yes.** `Failure` carries the envelope's `error` key (`Failure.code`), filled by `DioHttpClient`. The import start maps `ambiguous_file`, `empty_file` and `file_too_large` to their own messages; other features can use the code the same way.
4. **Preview → hide empty sections.** The preview and the report hide every count of 0, and the lists section when there are no lists (for every import, the Filmow login included).
5. **Duplicates → the last import wins.** A movie TMDB did not match reuses the placeholder (no TMDB id) an earlier import made for the same normalized title and year, from any source, preferring one the user has. The last import takes it over: its source id is added, and on an imported `user_movies` row its rating, review, watch date and source replace the earlier ones (a row the user made in the Muuvie is still only filled, never overwritten). An earlier pending item of the same movie in the confirmation queue is marked `skipped`. This also keeps file reimports of movies keyed by title from making new placeholders.

As built: backend `52203a1`, muuvie `c5a3668`.

## 8. Delivery

1. **Backend** (`backend`, branch `feature/csv-movie-import`): parsers + tests, `StartFileImport`, multipart route, generalised queue input, drop the 503.
2. **App** (`muuvie`, same branch name): file picker, datasource/use case, start-screen buttons and sheets, Letterboxd entry in Editar perfil, l10n, cubit tests.
3. **Meta-repo:** bump both submodules; update the feature-map page `imports.md` (new sub-feature, endpoint behaviour, gotchas) and `profile.md`; README/CLAUDE.md if anything public changes.
