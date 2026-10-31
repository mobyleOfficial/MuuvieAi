# Accessibility

Every UI component must be built with accessibility in mind from the start — not as an afterthought.

## Color Contrast

- Text and icons must meet WCAG AA contrast ratios: **4.5:1** for normal text, **3:1** for large text and UI components.
- Never rely on color alone to convey information (e.g. error states, selected states) — always pair color with an icon, label, or shape change.
- When using `colorScheme` pairs (e.g. `secondary` on `onSecondary`, `primaryContainer` on `onPrimaryContainer`), always use the matching `on*` color for content drawn on top — these pairs are guaranteed to meet contrast requirements.
- Avoid placing text on image backgrounds without a scrim or overlay.

## Screen Reader Support

- Every interactive widget must have a semantic label. Use `Tooltip`, `Semantics`, or `MergeSemantics` when the visual label is insufficient or absent.
- Icon-only buttons must always wrap their `Icon` in a `Tooltip` or use `Semantics(label: ...)`.
- Decorative images and icons that carry no information must be excluded from the semantic tree: `Icon(..., semanticLabel: null)` or `ExcludeSemantics`.
- Use `Semantics(button: true)` for custom tappable widgets that are not standard `Button` or `InkWell` descendants.
- List items with repeated trailing chevrons (e.g. `ListTile`) should carry a unique `Semantics(label: ...)` that includes the item title so screen readers can differentiate them.

## Focus & Navigation

- Ensure logical focus order matches the visual reading order.
- Do not suppress focus with `Focus(canRequestFocus: false)` unless the element is truly decorative.
- Modal sheets and dialogs must trap focus within themselves when open.

## Touch Targets

- Minimum tappable area is **48×48 dp** per Material and Apple HIG guidelines.
- Use `InkWell` / `GestureDetector` padding or `SizedBox` wrappers to meet this minimum when the visual element is smaller.

## General Rules

- Run `flutter analyze` — fix any accessibility-related lint warnings before considering work complete.
- When in doubt, test with TalkBack (Android) or VoiceOver (iOS) mentally by reading the semantic tree from top to bottom and confirming every interactive element is reachable and clearly labeled.