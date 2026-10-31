# Feature Spec: Email/Password Authentication (Login & Register)

**Status:** Draft
**Date:** 2026-07-22
**Priority:** Critical — blocks other features
**Affects:** Backend only (frontend integration is a separate ticket)

---

## 1. Overview

### Problema

O sistema atual de autenticação usa OAuth (Google/GitHub via código de autorização). Não existe nenhum fluxo de email + senha, o que impede usuários de criarem contas diretamente na plataforma sem depender de um provider externo.

### Por que agora?

Bloqueia o trabalho do frontend de auth screen (`block-auth-screen`) e todas as features que requerem um usuário autenticado.

### Abordagem

Adicionar um endpoint unificado `POST /auth/login` que faz **upsert** de usuário por email + verifica/define senha. A sessão é mantida via **JWT** (o projeto já usa JWT; manter essa escolha é mais seguro e stateless do que session IDs em um ambiente de API REST).

> **Decisão sobre SESSION ID vs JWT:** O request menciona "SESSION ID" como mecanismo de autenticação. O projeto já possui uma implementação JWT completa e funcional (`JWTUtil`, `JWTAuth`, `AuthRepositoryImpl`). Session IDs baseados em servidor exigiriam armazenamento de estado (Redis ou tabela de sessões), o que aumenta a complexidade sem ganho de segurança neste contexto. **Recomendação: continuar com JWT**. O token JWT age como um "session token stateless" — mesma experiência para o cliente, menos complexidade operacional.

---

## 2. User Stories

1. **Como usuário novo**, quero me cadastrar com email e senha para acessar a plataforma sem precisar de conta Google ou GitHub.
2. **Como usuário existente**, quero fazer login com meu email e senha para retomar minha sessão.
3. **Como usuário autenticado**, quero que meu token expire automaticamente para que contas comprometidas não fiquem abertas indefinidamente.
4. **Como usuário autenticado**, quero receber meu perfil completo (incluindo filmes assistidos recentemente) no login para que o app possa inicializar o estado sem chamadas adicionais.

---

## 3. Acceptance Criteria

### AC-1: Fluxo de novo usuário (register)
- `POST /auth/login` com email + senha novos → cria usuário no banco
- Senha é armazenada como hash BCrypt (fator de custo mínimo 12)
- Retorna `201 Created` com `AuthTokenResponse` contendo `UserProfile`
- `UserProfile.recentlyWatchedMovies` é lista vazia para novo usuário

### AC-2: Fluxo de usuário existente (login)
- `POST /auth/login` com email + senha corretos → retorna `200 OK` com `AuthTokenResponse`
- `POST /auth/login` com senha incorreta → retorna `401 Unauthorized` com código `invalid_credentials`
- A resposta de senha incorreta não deve diferenciar de "usuário não encontrado" (evita user enumeration)

### AC-3: Logout
- `POST /auth/logout` com JWT válido no header `Authorization: Bearer <token>` → retorna `204 No Content`
- O token é adicionado a uma blocklist em memória (`ConcurrentHashMap`) até expirar
- Após logout, o mesmo token rejeitado por `ValidateToken` com código `token_revoked`

### AC-4: Resposta com UserProfile
- `AuthTokenResponse` inclui campo `profile: UserProfile`
- `UserProfile` inclui campo `recentlyWatchedMovies: List<Movie>` (máximo 10 itens, ordenado por `watchedAt` desc)
- Para novo usuário ou usuário sem filmes assistidos, `recentlyWatchedMovies` é `[]`

### AC-5: Segurança
- Campos `email` e `password` são trimados antes de qualquer operação
- Email é convertido para lowercase antes de busca/inserção
- Password tem comprimento mínimo de 8 caracteres e máximo de 72 (limite bcrypt)
- Payload de erro nunca expõe stack trace ou detalhe interno

### AC-6: Persistência
- Usuário é salvo na `UsersTable` (Exposed ORM + PostgreSQL) — não apenas no `UserLocalDataSourceImpl` (ConcurrentHashMap)
- `password_hash` é salvo em nova coluna `password_hash` na `UsersTable`
- `UserLocalDataSource` continua funcionando como cache L1 (evita roundtrip ao DB para usuários já carregados)

---

## 4. API Contract

### 4.1 Login / Register

```
POST /auth/login
Content-Type: application/json
```

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "s3cur3P@ssw0rd"
}
```

**Success — novo usuário (`201 Created`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "profile": {
    "photoUrl": null,
    "username": "user",
    "bio": null,
    "moviesWatched": [],
    "recentlyWatchedMovies": [],
    "following": [],
    "followers": []
  }
}
```

**Success — usuário existente (`200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "profile": {
    "photoUrl": "https://...",
    "username": "joao_cinefilo",
    "bio": "Amante de filmes noir",
    "moviesWatched": [...],
    "recentlyWatchedMovies": [
      {
        "id": 550,
        "title": "Fight Club",
        "posterPath": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
        "releaseDate": "1999-10-15",
        "voteAverage": 8.4
      }
    ],
    "following": [],
    "followers": []
  }
}
```

**Errors:**

| Cenário | HTTP | `error` |
|---|---|---|
| Campos ausentes/em branco | 400 | `invalid_request` |
| Senha < 8 ou > 72 chars | 400 | `invalid_password_length` |
| Senha incorreta | 401 | `invalid_credentials` |
| Erro interno | 500 | `internal_error` |

```json
{ "error": "invalid_credentials", "message": "Invalid email or password" }
```

---

### 4.2 Logout

```
POST /auth/logout
Authorization: Bearer <token>
```

**Success (`204 No Content`):** body vazio

**Errors:**

| Cenário | HTTP | `error` |
|---|---|---|
| Token ausente/inválido | 401 | `missing_token` / `invalid_token` |

---

## 5. Technical Notes

### 5.1 Modelo de domínio — mudanças

**`domain/model/UserProfile.kt`** — adicionar campo:
```kotlin
val recentlyWatchedMovies: List<Movie> = emptyList()
```

**`domain/model/User.kt`** — adicionar campo (não exposto via API, apenas interno):
```kotlin
val passwordHash: String? = null  // null para usuários OAuth
```

### 5.2 Database — mudanças na `UsersTable`

Nova coluna em `data/local/database/Tables.kt`:
```kotlin
val passwordHash = varchar("password_hash", 255).nullable()
```

Migração SQL necessária:
```sql
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
```

### 5.3 Novos arquivos

| Caminho | Descrição |
|---|---|
| `domain/model/LoginRequest.kt` | DTO de request (email, password) |
| `domain/model/LoginResponse.kt` | DTO de response (accessToken, tokenType, expiresIn, profile) |
| `domain/usecase/auth/LoginUser.kt` | Use case: upsert user + verify/hash password + gerar JWT |
| `domain/usecase/auth/LogoutUser.kt` | Use case: adicionar token à blocklist |
| `data/local/user/UserDatabaseDataSource.kt` | Datasource Exposed para UsersTable (leitura/escrita com DB) |
| `data/local/auth/TokenBlocklistDataSource.kt` | Blocklist em memória para tokens revogados |

### 5.4 Arquivos modificados

| Caminho | Mudança |
|---|---|
| `domain/model/UserProfile.kt` | + `recentlyWatchedMovies: List<Movie>` |
| `domain/model/User.kt` | + `passwordHash: String? = null` |
| `domain/repository/AuthRepository.kt` | + `loginUser(email, password): Result<AuthToken>`, + `logoutUser(token): Result<Unit>` |
| `data/repository/AuthRepositoryImpl.kt` | Implementar `loginUser` e `logoutUser` |
| `data/local/database/Tables.kt` | + coluna `password_hash` na `UsersTable` |
| `data/local/user/UserLocalDataSource.kt` | Nenhuma mudança de interface; implementação pode se manter como cache |
| `data/di/DataModule.kt` | Registrar `UserDatabaseDataSource`, `TokenBlocklistDataSource` |
| `di/AppModule.kt` | Registrar `LoginUser`, `LogoutUser` |
| `routing/AuthRouting.kt` | + rotas `POST /login` e `POST /logout` |

### 5.5 Dependência BCrypt

Adicionar ao `build.gradle.kts`:
```kotlin
implementation("at.favre.lib:bcrypt:0.10.2")
```

Uso:
```kotlin
// Hash na criação/registro
val hash = BCrypt.withDefaults().hashToString(12, password.toCharArray())

// Verificação no login
val result = BCrypt.verifyer().verify(password.toCharArray(), storedHash)
result.verified // true/false
```

### 5.6 Fluxo de LoginUser (lógica do use case)

```
1. Trim + lowercase email; trim password
2. Validar comprimento de password (8–72)
3. Buscar usuário por email no DB (UserDatabaseDataSource)
4. SE não existe:
   a. Hash da senha com BCrypt (cost 12)
   b. Criar User com UUID, email, username derivado do email (parte antes do @), createdAt
   c. Salvar no DB + cache local
   d. Retornar 201 + JWT + UserProfile vazio
5. SE existe:
   a. Verificar hash BCrypt
   b. SE não bate → Result.failure("invalid_credentials")
   c. SE bate → carregar UserProfile (com recentlyWatchedMovies últimos 10)
   d. Gerar JWT
   e. Retornar 200 + JWT + UserProfile
```

### 5.7 Token Blocklist (logout)

Implementação simples em memória para MVP:
```kotlin
class TokenBlocklistDataSource {
    private val blocklist = ConcurrentHashMap<String, Long>() // token -> expiresAt

    fun revoke(token: String, expiresAt: Long) { blocklist[token] = expiresAt }
    fun isRevoked(token: String): Boolean = blocklist.containsKey(token)
    fun cleanup() { // remover tokens já expirados
        val now = System.currentTimeMillis() / 1000
        blocklist.entries.removeIf { it.value < now }
    }
}
```

`ValidateToken` use case deve checar a blocklist após validar a assinatura.

> **Limitação conhecida:** blocklist em memória não persiste após restart do servidor. Para MVP é aceitável. Fase 2: mover para Redis ou tabela `revoked_tokens`.

### 5.8 Username gerado automaticamente

Para novos usuários, `username` = parte do email antes de `@`, com caracteres inválidos substituídos por `_`, e sufixo numérico se já existir conflito.

Exemplo: `joao.silva@gmail.com` → `joao.silva` → conflito → `joao.silva_1`

---

## 6. Cross-Repo Impact

| Repo | Impacto |
|---|---|
| `backend/` | Sim — todas as mudanças são aqui |
| `muuvie/` (Flutter) | Nenhuma mudança necessária nesta fase. O frontend já tem `AuthRepository` apontando para o backend; o novo endpoint é drop-in. A tela de login (`block-auth-screen`) já foi especificada separadamente. |

---

## 7. Out of Scope

- Email verification / confirmação por email
- "Esqueci minha senha" / reset de senha
- Rate limiting avançado (ex: Redis + Lua) — a validação básica de campos é suficiente para MVP
- Migração de usuários OAuth existentes para senha (fase futura)
- Refresh token para o fluxo email/password (o JWT de 1h é suficiente para MVP; usar o mesmo `RefreshToken` use case existente em fase 2)
- 2FA / MFA
- Persistência da blocklist em Redis (fase 2)
- Logs de auditoria de login em tabela separada

---

## 8. Security Considerations

| Risco | Mitigação |
|---|---|
| User enumeration via timing | Sempre executar `BCrypt.verify()` mesmo quando usuário não existe (verificar contra hash dummy) |
| Password em plaintext em logs | Nunca logar o campo `password`; logar apenas `email` (mascarado nos ambientes de prod) |
| Brute force | Validação de comprimento mínimo/máximo; em fase 2 adicionar rate limiting por IP + account lockout |
| BCrypt timing attack | `BCrypt.verifyer()` usa comparação constant-time internamente |
| JWT secret fraco | `JWT_SECRET` deve ter >= 32 bytes de entropia (já documentado no `DataModule.kt`) |
| SQL injection | Exposed ORM usa prepared statements — não há SQL dinâmico |
| Token reutilização pós-logout | Blocklist em memória valida tokens revogados antes de autorizar qualquer request |

---

## 9. Open Questions

| # | Pergunta | Impacto | Responsável |
|---|---|---|---|
| Q1 | `recentlyWatchedMovies`: buscar do `UserMoviesTable` filtrando por `status = 'watched'` e ordenando por `watchedAt DESC LIMIT 10`? Ou deve incluir status `want_to_watch`? | Lógica do use case | PM / Backend |
| Q2 | Username gerado automaticamente: aceitar duplicatas com sufixo numérico ou forçar o usuário a escolher um username na primeira sessão? | UX + modelo de dados | PM / Frontend |
| Q3 | O `DataModule.kt` tem `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_PROVIDER_URL` como required env vars — isso bloqueia o start do servidor quando não configurados. Ao adicionar login por email, essas vars devem se tornar opcionais? | DevX / CI | Backend |
| Q4 | O campo `User.passwordHash` deve ser excluído da serialização JSON (não deve vazar na resposta)? Assumimos sim — confirmar que `@Transient` ou exclusão manual será aplicado. | Segurança | Backend |
| Q5 | Blocklist em memória: há planos de deploy com múltiplas instâncias (horizontal scaling) no curto prazo? Se sim, Redis precisa ser priorizado desde o início. | Infra / Ops | DevOps |
