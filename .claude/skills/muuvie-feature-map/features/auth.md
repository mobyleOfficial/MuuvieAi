# Auth

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

E-mail and password accounts: log in, sign up with a nickname checked as you type, a session kept alive by refresh tokens, and logout. Login and sign up live in one modal flow (`AuthFlowRoute`) that any gated action opens; the backend side is all of `AuthRouting.kt`.

## Sub-features
- **gate:** `AuthGate.check` opens the flow modally when there is no session (tapping Perfil, Social or Catálogo, and actions in Programação, movie detail, watch logs, comments, maratonas, CineClubes, the intro's import). It answers true only when login or sign up succeeded; the X closes it with false and the action is dropped. "Logged in" = a stored token whose access token is still valid or that has a refresh token.
- **login:** "Que bom te ver!" (`l10n:loginWelcomeTitle`), E-mail (`l10n:loginEmail`), Senha (`l10n:loginPassword`) with a show/hide toggle, Entrar (`l10n:loginButton`).
  - Client checks: empty → "Este campo é obrigatório" (`l10n:fieldRequired`); e-mail regex → "Por favor digite um e-mail válido" (`l10n:emailValidationError`); password < 8 → "A senha deve ter pelo menos 8 caracteres" (`l10n:passwordValidationError`). Field errors show only after leaving the field or submitting.
  - Server 401 → banner "Usuário ou senha incorretos." (`l10n:loginError`); anything else → "Algo deu errado, tente de novo mais tarde." (`l10n:loginGenericError`).
  - Success stores the tokens and closes the modal; the gated action continues.
- **sign-up:** from login, "Novo no Muuvie?" › "Crie uma conta" (`l10n:loginNoAccount`, `l10n:loginCreateAccountLink`). "Pegue seu ingresso" (`l10n:signUpHeadline`): Apelido (`l10n:signUpNickname`), E-mail, Senha, Criar Conta (`l10n:createAccountButton`). Back or "Já tem uma conta?" › Entrar returns to login.
  - Client checks: nickname empty → `l10n:nicknameValidationError`, > 30 → "O apelido deve ter no máximo 30 caracteres" (`l10n:nicknameTooLongError`); password 8 to 72 (`l10n:passwordTooLongError`).
  - Server errors: 409 → "Esse email ou apelido já está em uso." (`l10n:signUpConflictError`), 400 → `l10n:signUpBadRequestError`, offline → `l10n:signUpNetworkError`, 500 → `l10n:signUpServerError`.
  - Success logs straight in (tokens in the 201) and closes the modal. It does not open the intro: that is per install (see [onboarding](onboarding.md)).
- **nickname-check:** 700 ms after typing stops, `GET /auth/check-nickname`: "Verificando disponibilidade…" (`l10n:signUpNicknameChecking`), then "Apelido disponível" (`l10n:signUpNicknameAvailable`) or "Esse apelido já está em uso" (`l10n:nicknameTakenError`, shown even before the field is left). A failed check just clears the spinner.
- **session:** `AuthInterceptor` adds `Bearer <access>` to every backend call. 30 s before expiry, or on a 401 sent with the current token, it calls `POST /auth/refresh` once (queued: concurrent requests wait) and retries. The server rotates the refresh token. A 400/401 on refresh clears the token, which ends the session (shell leaves gated tabs); being offline keeps it.
- **logout:** Configurações › Sair (see [settings](settings.md)). Removes the push device, then `POST /auth/logout` with the refresh token (best effort), then clears local storage.
- **oauth:** Google/Facebook code exists in `LoginCubit` but no button calls it, and its data source is a mock that never hits the backend.

## How to get to it (user POV)
Logged out: tap Perfil, Social or Catálogo (or any gated button) › login modal › "Crie uma conta" for sign up.

## Where it lives
### App
- Routes: `AuthFlowRoute` (modal host, slide-up), `LoginRoute` (initial child), `SignUpRoute`
- Screens and state: `muuvie/lib/routes/auth_flow_page.dart` (back/close bar), `muuvie/ui/auth/lib/login` (`LoginCubit`), `muuvie/ui/auth/lib/sign_up` (`SignUpCubit`), `muuvie/ui/common/lib/src/auth_gate.dart`
- Data: `muuvie/features/auth/data/lib/datasources/remote/auth_remote_data_source_impl.dart`, `muuvie/features/auth/data/lib/repositories/auth_repository_impl.dart`, `muuvie/features/auth/data/lib/datasources/secure_token_storage.dart` (secure storage key `auth_token`), `muuvie/features/auth/data/lib/datasources/oauth_remote_data_source_impl.dart` (mock)
- Session: `muuvie/lib/di/auth_interceptor.dart`, `muuvie/lib/di/auth_module.dart` (`Logout` is `LogoutWithPush`)
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `POST /auth/login` | none | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/LoginUser.kt` |
| `POST /auth/signup` | none | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/SignUpUser.kt` |
| `GET /auth/check-nickname` | none | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/CheckNicknameAvailability.kt` |
| `POST /auth/refresh` | refresh token in body | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/RefreshToken.kt` |
| `POST /auth/logout` | required (Bearer) | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/LogoutUser.kt` |
| `POST /auth/oauth/callback` (not called by the app) | none | `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/ProcessOAuthCallback.kt` |

Rules in `backend/src/main/kotlin/org/mobyle/data/repository/AuthRepositoryImpl.kt`; token lifetimes in `backend/src/main/kotlin/org/mobyle/data/di/DataModule.kt` and `backend/src/main/kotlin/org/mobyle/data/local/auth/RefreshTokenDataSource.kt`.

## Driving it
```bash
B=localhost:8080/api/v1; J='Content-Type: application/json'
curl -s "$B/auth/check-nickname?nickname=ana"                      # {"nickname":"ana","available":true}
curl -s -X POST $B/auth/signup -H "$J" -d '{"email":"ana@x.co","password":"secret123","nickname":"ana"}'
# 201 {accessToken, tokenType:"Bearer", expiresIn, refreshToken, profile}; again → 409 email_already_exists
TOKEN=$(curl -s -X POST $B/auth/login -H "$J" -d '{"email":"ANA@x.co ","password":"secret123"}' | jq -r .accessToken)
curl -s -X POST $B/auth/login -H "$J" -d '{"email":"ana@x.co","password":"wrongpass"}'   # 401 invalid_credentials
curl -s -X POST $B/auth/refresh -H "$J" -d "{\"refreshToken\":\"$REFRESH\"}"   # new pair; reuse old one → 401, all sessions revoked
curl -s -X POST $B/auth/logout -H "Authorization: Bearer $TOKEN" -H "$J" -d "{\"refreshToken\":\"$REFRESH\"}"   # 204
```
App: tap Perfil while logged out.

## Gotchas
- Access tokens last `JWT_EXPIRY_SECONDS` (default 86400, a day); refresh tokens `REFRESH_TOKEN_EXPIRY_DAYS` (default 30). Logout blocklists the access token until its expiry.
- Reusing a rotated refresh token is treated as theft: every refresh token of that user is revoked (all devices log out at their next refresh). The interceptor is a `QueuedInterceptor` for this reason.
- The server lowercases and trims the e-mail and trims the password before checking 8 to 72 characters, so " secret123 " and "secret123" are the same password.
- Nickname uniqueness is case-sensitive (`Ana` and `ana` can both exist). The nickname becomes `username`; the public `@handle` is a separate field picked in Editar perfil (`GET /handles/{handle}/available`, see [profile](profile.md)).
- `POST /auth/login` answers 400 `invalid_password_length` for a password over 72; the app shows the generic error (it only checks the minimum on login).
- `POST /auth/oauth/callback` needs `OAUTH_*` env vars; the app's OAuth path is a mock, so nothing reaches it.
