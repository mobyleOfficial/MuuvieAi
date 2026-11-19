# Moderation and account deletion

> Mapped at backend@f9dec9f muuvie@5bcd4b6 · source: code + app (2026-11-19)

What the App Store and Google Play require of an app with accounts and user-generated content: deleting the account, reporting accounts and content, and blocking accounts. Report and block live in the ⋮ of a profile and of other people's feed cards; blocked accounts and account deletion live in Configurações.

## Sub-features
- **report:** a sheet "Por que você está denunciando?" (`l10n:reportTitle`) with eight reasons (`l10n:reportReasonSpam` … `l10n:reportReasonOther`), an optional text "Conte mais (opcional)" (`l10n:reportDetailsHint`, ≤ 1000) and "Enviar denúncia" (`l10n:reportSend`, off until a reason is picked). Success: snackbar "Denúncia enviada. Nossa equipe analisa em até 24 horas." (`l10n:reportSent`); failure `l10n:reportError`. Entry points: profile ⋮ › "Denunciar perfil" (`l10n:reportProfile`) and a card ⋮ › "Denunciar atividade" (`l10n:reportActivity`, only on other people's activities; a guest signs in first through `AuthGate`). Shared widget: `MuuvieReportSheet`.
- **block:** profile ⋮ › "Bloquear" (`l10n:blockAction`) › dialog "Bloquear {name}?" (`l10n:blockConfirmTitle`, `l10n:blockConfirmMessage`) › snackbar "Conta bloqueada." (`l10n:blockedSnack`). A blocked profile shows "Desbloquear" (`l10n:unblockAction`) instead of Seguir and the line "Você bloqueou esta conta." (`l10n:profileBlockedBanner`); unblocking says "Conta desbloqueada." (`l10n:unblockedSnack`).
- **blocked-accounts:** Configurações › "Contas bloqueadas" (`l10n:settingsBlockedAccounts`) › `BlockedAccountsRoute`: the list, newest first, each row with "Desbloquear"; empty "Você não bloqueou ninguém." (`l10n:blockedAccountsEmpty`); error state with retry. Pages load as you scroll.
- **delete-account:** Configurações › "Excluir conta" (`l10n:settingsDeleteAccount`, red) › dialog "Excluir sua conta?" (`l10n:settingsDeleteAccountTitle`, `l10n:settingsDeleteAccountMessage`), "Cancelar" / "Excluir para sempre". Success: the session ends, Configurações closes and the snackbar "Sua conta foi excluída." (`l10n:settingsDeleteAccountDone`) shows; failure `l10n:settingsDeleteAccountError`. An account that signs in with Apple re-confirms in the Apple sheet on iOS; closing it keeps the account.

## How to get to it (user POV)
- Someone's profile › ⋮ › Denunciar perfil / Bloquear.
- Any feed or Atividade card of someone else › ⋮ › Denunciar atividade.
- Perfil › engrenagem › Contas bloqueadas / Excluir conta.

## Where it lives
### App
- Routes: `BlockedAccountsRoute` (root)
- Screens and state: `muuvie/ui/profile/lib/blocked_accounts/blocked_accounts_page.dart`, `muuvie/ui/profile/lib/blocked_accounts/blocked_accounts_bloc.dart`; profile menu in `muuvie/ui/profile/lib/member/member_profile_view.dart` (`MemberProfileCubit.setBlocked`); card menu in `muuvie/ui/social/lib/feed/activity_card.dart`; sheet `muuvie/ui/common/lib/src/muuvie_report_sheet.dart`; deletion in `muuvie/ui/profile/lib/settings/settings_bloc.dart` (`SettingsCubit.deleteAccount`)
- Data: `muuvie/features/social_network/data/lib/datasources/social_network_remote_data_source.dart` (block, blocks, report), `muuvie/features/auth/data/lib/repositories/auth_repository_impl.dart` (`deleteAccount`, Apple re-auth), `muuvie/features/auth/data/lib/datasources/remote/auth_remote_data_source_impl.dart`
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `DELETE /users/me` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/users/DeleteAccount.kt` |
| `GET /users/me/blocks` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/moderation/ModerationUseCases.kt` (`GetBlockedUsers`) |
| `POST /users/{userId}/block` | required | same file (`BlockUser`) |
| `DELETE /users/{userId}/block` | required | same file (`UnblockUser`) |
| `POST /reports` | required | same file (`ReportContent`) |

Routes: `backend/src/main/kotlin/org/mobyle/routing/ModerationRouting.kt`; data: `backend/src/main/kotlin/org/mobyle/data/local/moderation/ModerationDataSource.kt`, `backend/src/main/kotlin/org/mobyle/data/local/user/AccountDataSource.kt`; schema `V23__account_deletion_and_moderation.sql`.

## Driving it
```bash
curl -s -X POST "$API/reports" -H "$H" -H 'Content-Type: application/json' \
  -d '{"targetType":"user","targetId":"@handle","reason":"spam","details":"..."}'   # 201 {id}
curl -s -X POST "$API/users/$OTHER/block" -H "$H"        # {"blocked":true}
curl -s "$API/users/me/blocks" -H "$H"
curl -s -X DELETE "$API/users/me" -H "$H" -w '%{http_code}\n'   # 204; then the token is a 401
```
App: push `BlockedAccountsRoute()` (root).

## Gotchas
- A block deletes the follows both ways and is silent. The blocked user gets 404 on the blocker's profile and 403 `blocked` on follow; both leave each other's feeds, movie activities, comments, user search and conversation list. Follows do not come back on unblock.
- Report targets: `user` (id or @handle), `activity`, `comment`, `message`, `shelf`, `locadora`, `maratona` and `cineclube` (id or slug), `watch_log`. An unknown target is a 404, reporting yourself a 400, more than 20 an hour a 429. Reports go to `reports` and to `REPORTS_WEBHOOK_URL` when set; no admin screen exists, the team reviews them in the database.
- Deletion cascades through every user foreign key (V23) and also removes the comments others left on the account's sessions and ratings. Reports stay with `reporter_id` null.
- Apple revocation needs `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`; without them the server deletes without asking for a code. With them, an Apple account without `appleAuthorizationCode` gets 409 `apple_reauth_required`; the app answers with a code on iOS and `skipAppleRevocation` elsewhere.
