---
date: 2026-11-10
author: Edson Toma
status: draft
related:
  - https://github.com/mobyleOfficial/AbbayiOS/issues/166
tags: [frontend, design, ios, android, liquid-glass, material3]
---

# Liquid Glass redesign: mockups for review

## Executive Summary

These are first-pass HTML mockups for a redesign of the Muuvie app on iOS and Android. They follow the Liquid Glass redesign of AbbayiOS (issue #166), adapted to a movie diary. Nothing is decided yet: the mockups are here so we can pick a direction for each screen before writing a design spec.

**How to view:** open [`mockups.html`](mockups.html) in a browser. On GitHub, use *Raw* and save the file, or check out this branch and open it locally. Click a phone to mark it as your pick (the highlight is local to your browser and not saved).

## Problem Statement

The app paints opaque fills over everything:
- every bar and panel is a solid surface; nothing uses blur or glass [Source: no `BackdropFilter` anywhere in `muuvie/ui` or `muuvie/lib`; the only blur is an `ImageFiltered` in `muuvie/ui/gamification/lib/poster/poster_game_screen.dart:124`];
- three card styles live side by side: theme `Card`, outlined `surfaceContainerLow` boxes, and flat rows with dividers;
- poster corner radii vary between 6, 8 and 12;
- there are two search-field styles and two copies of `_TabBarDelegate` (`muuvie/ui/movies_ui/lib/movie_detail/movie_detail_screen.dart:249`, `muuvie/ui/profile/lib/member/member_profile_view.dart:269`);
- iOS uses the same Material bottom bar as Android (`muuvie/ui/common/lib/src/muuvie_bottom_navigation_bar.dart:36`).

On movie detail, the main actions ("Já assisti", "Avaliar", "Registrar sessão") sit about 450 px down the page, inside an opaque panel (`muuvie/ui/watch_logs/lib/movie_panel/movie_watch_panel.dart:124`).

## Principles taken from the Abbay redesign

- **Subtraction first:** stop painting opaque fills over everything.
- **Colour from content:** the poster tints movie detail (`ColorScheme.fromImageProvider`), and the user's accent colour tints Perfil.
- **Glass only on controls that float over content:** buttons, pills, the tab bar and action bars. Content is never stacked glass on glass.
- **One poster widget** everywhere, plus one helper file that is the only place branching on platform.

## What the mockups show

| § | Screen | Options |
|---|---|---|
| 1 | Movie detail | iOS A (poster-tinted hero), Android A, iOS B (full-bleed backdrop and a floating action bar) |
| 2 | Catálogo | iOS A (shelves and an "Assistindo agora" card), iOS B (hero carousel), Android A |
| 3 | Perfil | iOS dark, iOS light, Android |
| 4 | Shared pieces | the poster widget, the glass helper, the Flutter glass question |
| 5 | Android watch actions | button group (first pass), labelled icon buttons, inline stars, floating toolbar and FAB |
| 6 | Android Perfil shortcuts | assist chips, 2×2 tiles, labelled icon buttons |

Feedback so far: the pills in the Android mockups felt off, so sections 5 and 6 add more conventional Material 3 options.

## Open questions

1. Movie detail: A (hero at the top) or B (actions in a floating bar)?
2. Catálogo: shelves with a "continue" card, or a hero carousel?
3. Light mode: keep it (the app follows the system today) or go dark-only like Abbay?
4. Android: which action shape (§5 and §6)?
5. Glass in Flutter: Flutter has no native Liquid Glass. `BackdropFilter` blur imitates it everywhere at some GPU cost; a shader package or native platform views get closer on iOS but are less mature. Analysis: start with `BackdropFilter`, and evaluate native views for the tab bar only.

## Next Steps

- [ ] Pick a direction for each screen (§1–3, §5–6).
- [ ] Mock the remaining screens (Social, Programação, Notícias, the actions sheet, the rating screen) in the chosen direction.
- [ ] Write `spec.md` in this folder from the picks, then a plan.
