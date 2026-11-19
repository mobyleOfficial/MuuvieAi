# Auth

> Mapped at backend@7b4270c muuvie@55b3e7b · source: code

Sign in with Apple or Google only. There is no e-mail and password, sign-up form or password recovery. The first sign-in creates the account, which then picks its nickname. A session is kept alive by refresh tokens, and the user can log out. Everything lives in one modal flow (`AuthFlowRoute`) that any gated action opens; the backend side is all of `AuthRouting.kt`.

## Sub-features
- **gate:** `AuthGate.check` opens the flow modally when there is no session. That happens on tapping Perfil, Social or Catálogo, and on actions in Programação, movie detail, watch logs, comments, maratonas, CineClubes and the intro's import. It answers true only when the sign-in, or the nickname step after it, finished; the X closes the modal with false and the action is dropped. "Logged in" = a stored token whose access token is still valid or that has a refresh token.
- **sign-in:** "Que bom te ver!" (`l10n:loginWelcomeTitle`), then "Continuar com Apple" (`l10n:continueWithApple`, iOS and macOS only) and "Continuar com Google" (`l10n:continueWithGoogle`). There are no buttons on web.
  - The native sheet returns an ID token, which goes to `POST /auth/social` (Apple also sends the raw nonce, whose SHA-256 the token carries).
  - Closing the sheet just returns to the buttons. Any failure, of the SDK or the server, shows "Algo deu errado, tente de novo mais tarde." (`l10n:loginGenericError`).
  - An existing account stores the tokens and closes the modal; the gated action continues.
- **account-resolution (server):** the provider account (`provider` + `sub`) linked in `user_identities` → its account. Otherwise, the account with the same **verified** e-mail, which gets linked (this keeps accounts made with a password before, and the same person on both providers). Otherwise, a new account (201) with a generated nickname like `cosmic_ripley_42`, no `@handle`, the Google picture as avatar, and `needsNickname: true`.
- **choose-nickname:** a new account is sent to `ChooseNicknameRoute`, with the name Apple or Google gave prefilled. Title "Como quer ser chamado?" (`l10n:chooseNicknameTitle`), field Apelido (`l10n:signUpNickname`), button Continuar (`l10n:chooseNicknameButton`).
  - Client checks: empty → `l10n:nicknameValidationError`; over 30 characters → `l10n:nicknameTooLongError`.
  - 700 ms after typing stops, `GET /auth/check-nickname`: "Verificando disponibilidade…" (`l10n:signUpNicknameChecking`), then "Apelido disponível" (`l10n:signUpNicknameAvailable`) or "Esse apelido já está em uso" (`l10n:nicknameTakenError`).
  - Submit: `PUT /auth/nickname`. A 409 marks the nickname as taken; 400, offline and 500 show `l10n:signUpBadRequestError`, `l10n:signUpNetworkError` and `l10n:signUpServerError`.
  - Success closes the modal. The nickname also becomes the `@handle` when it fits `^[a-z0-9_.]{5,30}$` and is free.
- **session:** `AuthInterceptor` adds `Bearer <access>` to every backend call. 30 s before expiry, or on a 401 sent with the current token, it calls `POST /auth/refresh` once (queued: concurrent requests wait) and retries. The server rotates the refresh token. A 400/401 on refresh clears the token, which ends the session (the shell leaves gated tabs); being offline keeps it.
- **logout:** Configurações › Sair (see [settings](settings.md)). Removes the push device, then `POST /auth/logout` with the refresh token (best effort), signs out of Google on the device, then clears local storage.

## How to get to it (user POV)
Logged out: tap Perfil, Social or Catálogo (or any gated button) › login modal › Continuar com Apple / Google. A new account then lands on "Como quer ser chamado?".

## Where it lives
### App
- Routes: `AuthFlowRoute` (modal host, slide-up), `LoginRoute` (initial child), `ChooseNicknameRoute`
- Screens and state: `muuvie/lib/routes/auth_flow_page.dart` (back/close bar), `muuvie/ui/auth/lib/login` (`LoginCubit`), `muuvie/ui/auth/lib/choose_nickname` (`ChooseNicknameCubit`), `muuvie/ui/auth/lib/widgets/social_sign_in_button.dart`, `muuvie/ui/common/lib/src/auth_gate.dart`
- Data: `muuvie/features/auth/data/lib/datasources/social_sign_in_data_source_impl.dart` (native SDKs, nonce), `muuvie/features/auth/data/lib/datasources/remote/auth_remote_data_source_impl.dart`, `muuvie/features/auth/data/lib/repositories/auth_repository_impl.dart`, `muuvie/features/auth/data/lib/datasources/secure_token_storage.dart` (secure storage key `auth_token`)
- Session: `muuvie/lib/di/auth_interceptor.dart`, `muuvie/lib/di/auth_module.dart` (`Logout` is `LogoutWithPush`; Google client ids from `GOOGLE_SERVER_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID`)
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `POST /auth/social` | none | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/SignInWithProvider.kt` |
| `PUT /auth/nickname` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/ChooseNickname.kt` |
| `GET /auth/check-nickname` | none | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/CheckNicknameAvailability.kt` |
| `POST /auth/refresh` | refresh token in body | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/RefreshToken.kt` |
| `POST /auth/logout` | required (Bearer) | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/LogoutUser.kt` |

The rules live in `backend/src/main/kotlin/org/mobyle/data/repository/AuthRepositoryImpl.kt`, token checks in `backend/src/main/kotlin/org/mobyle/data/remote/auth/social/SocialTokenVerifier.kt`, and identities in `backend/src/main/kotlin/org/mobyle/data/local/auth/UserIdentityDataSource.kt` (migration `backend/src/main/resources/db/migration/V22__social_identities.sql`). Token lifetimes are in `backend/src/main/kotlin/org/mobyle/data/di/DataModule.kt` and `backend/src/main/kotlin/org/mobyle/data/local/auth/RefreshTokenDataSource.kt`.

## Driving it
A real sign-in needs an ID token from Apple or Google, which only the native sheets give. The closest real path is the app on a device with the client ids configured. With curl, only the failures and the rest of the session can be driven:
```bash
B=localhost:8080/api/v1; J='Content-Type: application/json'
curl -s "$B/auth/check-nickname?nickname=ana"                      # {"nickname":"ana","available":true}
curl -s -X POST $B/auth/social -H "$J" -d '{"provider":"google","idToken":"x"}'
# 503 provider_not_configured without GOOGLE_CLIENT_IDS; 401 invalid_token with it
curl -s -X POST $B/auth/social -H "$J" -d '{"provider":"facebook","idToken":"x"}'   # 400 validation_failed
curl -s -X PUT $B/auth/nickname -H "Authorization: Bearer $TOKEN" -H "$J" -d '{"nickname":"Ana"}'   # {"nickname":"Ana"}
curl -s -X POST $B/auth/refresh -H "$J" -d "{\"refreshToken\":\"$REFRESH\"}"   # new pair; reuse old one → 401, all sessions revoked
curl -s -X POST $B/auth/logout -H "Authorization: Bearer $TOKEN" -H "$J" -d "{\"refreshToken\":\"$REFRESH\"}"   # 204
```
App: tap Perfil while logged out.

## Gotchas
- Each provider is off until the backend has its client ids: `GOOGLE_CLIENT_IDS` (the web, iOS and Android OAuth clients) and `APPLE_CLIENT_IDS` (the bundle ids `com.mobyle.muuvie`, `.dev`, `.staging`). Without them, `POST /auth/social` answers 503.
- Apple sends the e-mail (maybe a private relay) and the name only on the first sign-in, so the account e-mail can be empty. `GET /profile` and the session look the user up by id, never by e-mail.
- An e-mail is linked only when the provider marks it verified. An Apple relay address never matches a Google account, so the same person can end up with two accounts.
- Closing "Como quer ser chamado?" keeps the generated nickname: the session is already saved, and the next sign-in asks again (`needsNickname` stays true until `PUT /auth/nickname`).
- Access tokens last `JWT_EXPIRY_SECONDS` (default 86400, a day); refresh tokens `REFRESH_TOKEN_EXPIRY_DAYS` (default 30). Logout blocklists the access token until its expiry.
- Reusing a rotated refresh token is treated as theft: every refresh token of that user is revoked (all devices log out at their next refresh). The interceptor is a `QueuedInterceptor` for this reason.
- Nickname uniqueness is case-sensitive (`Ana` and `ana` can both exist). A nickname cannot have quotes, backslashes or control characters (400). The public `@handle` is a separate field, editable in Editar perfil (see [profile](profile.md)).
- No delete-account yet; with Sign in with Apple it must also revoke the Apple token.
