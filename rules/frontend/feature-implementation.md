---
description: Rules for implementing feature code in Dart/Flutter
globs: features/**/*.dart
---

# Feature Implementation

## Naming Conventions

- Classes: `PascalCase`
- Files and directories: `snake_case`
- Variables and functions: `camelCase`
- Constants: `camelCase` (prefer `const` declarations)
- Private members: prefix with `_`

## State Management

- Use the project's chosen state management approach consistently within a feature.
- Controllers/Blocs live in `presentation/controllers/`.
- Keep business logic out of widgets — delegate to use cases or controllers.

## Models & Entities

- Models (in `data/models/`) handle serialization (`fromJson`, `toJson`) and extend or map to domain entities.
- Entities (in `domain/entities/`) are pure Dart classes with no framework dependencies.

## Repositories

- Define abstract repository contracts in `domain/repositories/`.
- Implement them in `data/repositories/`, injecting data sources via constructor.

## Use Cases

- One use case per file, one public method (`call`).
- Use cases depend only on domain-layer repository contracts.
- Always register use cases as **factory** (`@injectable`) in DI modules — never as singletons or lazy singletons.

## General

- Prefer `const` constructors wherever possible.
- Always add `const` to widget constructors that support it.
- Use `final` for variables that are not reassigned.
- Avoid `dynamic` types — always provide explicit types.
- Run `dart format` and `dart analyze` before considering work complete.