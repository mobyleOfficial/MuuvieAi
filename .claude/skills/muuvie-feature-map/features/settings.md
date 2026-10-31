# Settings

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Configurações: a full-screen modal from the own profile with shortcuts to edit the profile and import, the five push-notification switches, the device push-permission warning, the intro replay and logout. There is no delete-account or change-password action anywhere in the app. Lives in `muuvie/ui/profile/lib/settings`; backend side is the notification-prefs and device endpoints in `MessagesRouting.kt` plus `POST /auth/logout`.

## Sub-features
- **loading:** spinner until prefs are read. If `GET /users/me/notification-prefs` fails, the whole Notificações section is hidden; the rest still works.
- **conta:** section "Conta" (`l10n:settingsAccount`): "Editar perfil" (`l10n:profileEditProfile`) opens `EditProfileRoute` (see [profile](profile.md)); "Importar filmes" (`l10n:settingsImport`, hint "Do Filmow, sem sobrescrever o que você fez aqui", `l10n:settingsImportHint`) opens `ImportStartRoute` (see [imports](imports.md)). A saved profile edit makes the profile reload when Configurações closes.
- **notifications:** section "Notificações" (`l10n:settingsNotifications`), five switches, all on by default:
  - "Sussurros" (`l10n:settingsNotifyMessages`) → `messages`
  - "Novos seguidores" (`l10n:settingsNotifyFollowers`) → `newFollowers`
  - "Amei nas minhas atividades" (`l10n:settingsNotifyLoves`) → `loves`
  - "Maratonas em que entrei" (`l10n:settingsNotifyMaratonas`) → `maratonas`
  - "Dia de debate dos meus CineClubes" (`l10n:settingsNotifyCineclubes`) → `cineclubes`

  Each toggle is optimistic: it flips at once and `PUT /users/me/notification-prefs` sends all five. On failure it flips back with the snackbar "Não deu certo. Tente de novo." (`l10n:maratonaActionError`). Switches gate push only; WebSocket events still arrive (see [app-shell](app-shell.md)).
- **push-blocked:** only when Firebase is on and the OS denies notifications: a red row "As notificações estão desligadas neste aparelho" (`l10n:settingsPushOff`) with hint `l10n:settingsPushOffHint` and "Permitir" (`l10n:settingsPushAllow`). Permitir asks the OS again; if allowed, `PUT /users/me/devices` registers this device right away and the row disappears.
- **intro:** section "Muuvie" (`l10n:settingsAbout`) › "Ver a introdução de novo" (`l10n:settingsShowIntro`) resets the seen mark and opens `OnboardingRoute` (see [onboarding](onboarding.md)).
- **logout:** "Sair" (`l10n:settingsLogout`, red) › dialog "Sair do Muuvie?" (`l10n:settingsLogoutTitle`), Sair / Manter (`l10n:maratonaKeep`). Confirm: `DELETE /users/me/devices?token=` and FCM token deletion, then `POST /auth/logout`, then local tokens cleared (all best effort; local logout always happens). Configurações closes and the shell moves from Perfil to Programação.

## How to get to it (user POV)
Perfil › gear icon (tooltip "Configurações", `l10n:settingsTitle`) at the right of the banner. Only on your own profile. Close with the X.

## Where it lives
### App
- Routes: `SettingsRoute` (root, slide-up; argument `profile`)
- Screens and state: `muuvie/ui/profile/lib/settings/settings_page.dart`, `muuvie/ui/profile/lib/settings/settings_screen.dart`, `muuvie/ui/profile/lib/settings/settings_bloc.dart` (`SettingsCubit`), `muuvie/ui/profile/lib/settings/settings_state.dart`; entry in `muuvie/ui/profile/lib/member/member_profile_view.dart` and `muuvie/ui/profile/lib/member/profile_header.dart`
- Data: `muuvie/features/social_network/data/lib/datasources/social_network_remote_data_source.dart` (prefs, devices), `muuvie/features/social_network/domain/lib/usecases/push_devices.dart`, `muuvie/lib/push/logout_with_push.dart`, `muuvie/features/auth/data/lib/datasources/remote/auth_remote_data_source_impl.dart` (logout)
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `GET /users/me/notification-prefs` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/notifications/NotificationUseCases.kt` (`GetNotificationPrefs`) |
| `PUT /users/me/notification-prefs` | required | same file (`SaveNotificationPrefs`, answers the saved prefs) |
| `PUT /users/me/devices` | required | same file (`RegisterDevice`) |
| `DELETE /users/me/devices` | required | same file (`RemoveDevice`) |
| `POST /auth/logout` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/LogoutUser.kt` (see [auth](auth.md)) |

Prefs model: `backend/src/main/kotlin/org/mobyle/domain/model/Notification.kt`; where they gate push: `backend/src/main/kotlin/org/mobyle/data/service/SocialNotifierImpl.kt` (`allowed`).

## Driving it
```bash
B=localhost:8080/api/v1; A="Authorization: Bearer $TOKEN"; J='Content-Type: application/json'
curl -s $B/users/me/notification-prefs -H "$A"     # {"messages":true,"newFollowers":true,"loves":true,"maratonas":true,"cineclubes":true}
curl -s -X PUT $B/users/me/notification-prefs -H "$A" -H "$J" -d '{"loves":false}'   # omitted fields become true
curl -s -X DELETE "$B/users/me/devices?token=fake" -H "$A"                             # 204, even for an unknown token
```
App: Perfil › gear.

## Gotchas
- `PUT` replaces the whole object and missing fields default to `true`, so a partial body turns the others back on. The app always sends all five.
- `import_updated` pushes ignore every preference; system Sussurros are never pushed; `unread`, `watch_party` and the sender's own `message` are WebSocket only.
- `RegisterDevice` rejects a platform outside android/ios/web or a token empty or over 500 chars (400); the locale is cut to 10 chars and picks the push language.
- Without Firebase (dev builds without config, web) the push-blocked row never shows and logout skips the device call (no token).
- The pref-save error and the logout cancel button reuse maratona strings (`maratonaActionError`, `maratonaKeep`).
