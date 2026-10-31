# Localization

All user-visible strings must be defined in ARB files and accessed through `AppLocalizations`.

## Where strings live

- ARB files: `ui/common/lib/l10n/app_en.arb` (English template), `app_es.arb`, `app_pt.arb`
- Generated Dart class: `ui/common/lib/app_localizations.dart` (do not edit — run `flutter gen-l10n` to regenerate)
- Exported from: `package:common/common.dart` via `AppLocalizations`

## Adding a new string

1. Add the key + metadata to `app_en.arb`:
   ```json
   "myKey": "My string",
   "@myKey": { "description": "What this string is for" }
   ```
2. Add the translated value to `app_es.arb` and `app_pt.arb`.
3. Run `flutter gen-l10n` from the project root to regenerate the Dart class.
4. Use it in any widget: `AppLocalizations.of(context)!.myKey`

## Strings with parameters

Use ICU placeholders in the ARB:
```json
"movieRelease": "Release: {date}",
"@movieRelease": {
  "description": "Movie release date label",
  "placeholders": { "date": { "type": "String" } }
}
```
Call it in Dart as: `AppLocalizations.of(context)!.movieRelease(detail.releaseDate)`

## Rules

- Never hardcode user-visible strings directly in widgets.
- Every string added to the English ARB must also be added to `app_es.arb` and `app_pt.arb`.
- UI modules access `AppLocalizations` via `package:common/common.dart` — add `common` as a dependency if it is not already present.
- Do not import `app_localizations.dart` directly; always import through `package:common/common.dart`.