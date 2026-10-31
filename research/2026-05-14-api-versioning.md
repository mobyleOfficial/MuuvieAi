---
date: 2026-05-14
author: Claude Haiku
status: approved
related:
  - api-changelog
tags: [api, versioning, backend, architecture]
---

# API Versioning Strategy for MuuvieBackend

## Executive Summary

MuuvieBackend currently exposes an unversioned API that will require versioning as the Muuvie ecosystem scales and the backend evolves. URI path versioning (`/api/v1/`, `/api/v2/`) is recommended: it is the industry standard [Source: https://google.aip.dev/versioning, https://stripe.com/docs/api/versioning], most discoverable in documentation and logs, and minimally impacts the frontend (URL configuration only). This strategy enables backward compatibility with existing clients (Flutter frontend) while supporting future breaking changes without coordination issues.

## Problem Statement

MuuvieBackend [Source: observed in backend/routes.kt] currently serves unversioned endpoints (e.g., `/movies/trending`, `/profile`, `/activities/{userId}`). As the product scales:

1. Breaking changes require coordinated frontend/backend deployments, increasing deployment risk
2. Multiple client versions cannot coexist simultaneously
3. Feature deprecation and gradual migration are impossible
4. A/B testing across API versions is unsupported

The Kotlin/Ktor 2.3.0 backend [Source: backend/build.gradle.kts] is organized into three routing modules (`MoviesRouting.kt`, `ProfileRouting.kt`, `ActivitiesRouting.kt`) [Source: observed in backend/ directory], and the Flutter frontend uses a repository pattern that abstracts the HTTP layer [Source: observed in muuvie/lib/data/repositories/], making version-aware client implementation feasible without UI changes.

This research identifies the optimal versioning strategy and implementation plan.

## Options Evaluated

### Option 1: No Versioning (Status Quo)

**Description**: Continue with unversioned API endpoints. Apply changes in-place, requiring clients to accept or reject updates.

**Pros**:
- Zero implementation cost
- Simpler URL structure
- Fewer deployment concerns

**Cons**:
- Breaking changes require coordinated frontend/backend deployments [Source: Analysis: tight coupling between client and server]
- No way to support multiple client versions simultaneously [Source: Analysis: single deployment model]
- Difficult to run A/B tests or feature flags across API versions [Source: Analysis: version-aware routing not supported]
- Higher risk of service interruptions [Source: Analysis: requires perfect deployment synchronization]
- Harder to deprecate features gradually [Source: Analysis: clients must handle abrupt changes]

**Verdict**: Unsustainable as the product grows and client diversity increases.

---

### Option 2: URI Path Versioning (`/v1/`, `/v2/`, etc.)

**Description**: Include version in the URL path. Routes become `/api/v1/movies/trending`, `/api/v2/movies/trending`.

```kotlin
fun Application.configureRouting() {
    routing {
        route("/api/v1") {
            getMoviesRouting()
            getProfileRouting()
            getActivitiesRouting()
        }
        route("/api/v2") {
            // future version routes
        }
    }
}
```

**Pros**:
- Most discoverable versioning strategy [Source: Google API Design Guide, https://google.aip.dev/versioning]
- Easy to implement in Ktor (route grouping) [Source: Ktor routing documentation, https://ktor.io/docs/routing.html]
- Clear in API documentation and client code [Source: Analysis: version is explicit in URL]
- Each version is independently cacheable [Source: RFC 7234: HTTP Caching, Section 2]
- Standard in industry [Source: https://google.aip.dev/versioning, https://stripe.com/docs/api/versioning, https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-versioning.html]

**Cons**:
- URL duplication if many routes don't change between versions [Source: Analysis: requires code organization strategy]
- Requires careful route organization to avoid code duplication [Source: Analysis: shared business logic must be factored]
- Migrations between versions are client-initiated (not transparent) [Source: Analysis: clients must explicitly update endpoints]

**Verdict**: Recommended. Clear, standard, easy to understand, and aligns with industry best practices.

---

### Option 3: Header-Based Versioning (`Accept` or `X-API-Version`)

**Description**: Clients specify version via HTTP header (e.g., `X-API-Version: 1`).

```kotlin
fun Route.getMoviesRouting() {
    val version = call.request.header("X-API-Version") ?: "1"
    // route logic based on version
}
```

**Pros**:
- URL structure remains clean [Source: Analysis: no path modifications needed]
- Can serve multiple versions from same endpoint [Source: Analysis: version routing at handler level]
- Useful for gradual migration [Source: Analysis: version negotiation is flexible]

**Cons**:
- Less visible in API docs and client code [Source: Analysis: version buried in HTTP header]
- Harder to debug (version not in URL logs) [Source: Analysis: requires header inspection in logs]
- Not RESTful (HTTP semantics don't define version in headers) [Source: RFC 7231: HTTP Semantics, Section 3.1]
- Clients may forget to include version header [Source: Analysis: error-prone without client-side enforcement]
- Caching complexity (cache keys must consider headers) [Source: RFC 7234: HTTP Caching, Section 4.1]

**Verdict**: Acceptable as secondary approach, but inferior to URI versioning for primary API.

---

### Option 4: Content Negotiation / Media Type Versioning

**Description**: Version via `Accept` header media type (e.g., `application/vnd.muuvie.v1+json`).

```kotlin
fun Route.getMoviesRouting() {
    val mediaType = call.request.header(HttpHeaders.Accept)
    // route logic based on media type
}
```

**Pros**:
- Technically pure (leverages HTTP semantics) [Source: RFC 7231: HTTP Semantics]
- Single URL for all versions [Source: Analysis: clean endpoint structure]

**Cons**:
- Poor discoverability (version hidden in media type) [Source: Analysis: version not visible in URL or logs]
- Complexity in Ktor routing (not built-in) [Source: Analysis: requires custom content negotiation]
- Client testing is harder (requires header manipulation) [Source: Analysis: developer experience impact]
- Not standard in the industry for API versioning [Source: https://google.aip.dev/versioning, https://stripe.com/docs/api/versioning]

**Verdict**: Overly complex for Muuvie's use case. Prefer simpler, industry-standard approaches.

---

### Option 5: Query Parameter Versioning (`?api-version=1`)

**Description**: Include version as query parameter (e.g., `GET /movies/trending?api-version=2&page=1`).

**Pros**:
- Version appears in URL (visible in logs) [Source: Analysis: visible in access logs]
- Can fall back to default version [Source: Analysis: provides sensible default]

**Cons**:
- Query parameters semantically shouldn't define API version [Source: RFC 3986: URI Specification, Section 3.4]
- Easily missed by clients [Source: Analysis: inconsistent application by clients]
- Cache key complexity [Source: RFC 7234: HTTP Caching, Section 4.1]
- Awkward in API documentation [Source: Analysis: version appears secondary to business logic parameters]

**Verdict**: Not recommended. Query parameters are for filtering/pagination, not API structure.

---

## Recommended Approach

**URI path versioning with structured rollout.**

Implement `/api/v{N}/` prefix pattern. This strategy:
- Follows industry standards [Source: https://google.aip.dev/versioning, https://stripe.com/docs/api/versioning]
- Maximizes discoverability in logs, docs, and client code
- Scales to support multiple concurrent versions with minimal overhead
- Provides clear migration path for clients

Organize routes to minimize duplication:

```kotlin
fun Application.configureVersionedRouting() {
    routing {
        route("/api/v1") {
            registerV1Routes()
        }
        // Future versions
        // route("/api/v2") { registerV2Routes() }
    }
}

fun Route.registerV1Routes() {
    getMoviesRoutingV1()
    getProfileRoutingV1()
    getActivitiesRoutingV1()
}
```

Share business logic (repositories, use cases) between versions; differ only in routing and model serialization.

## Implementation

### Phase 1: Prepare for Versioning (Weeks 1-2)

1. **Audit current API** [Source: backend/]: Document all endpoints, request/response schemas in `/research/api-v1-spec.yaml`
2. **Version the existing API as v1**: Establish baseline
3. **Extend Ktor routing** to support versioned routes without code duplication

### Phase 2: Implement v1 Versioning (Weeks 3-4)

1. **Reorganize routing** to use path-based versioning:
```kotlin
fun Application.configureRouting() {
    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
            ignoreUnknownKeys = true
        })
    }

    routing {
        route("/api/v1") {
            getMoviesRoutingV1()
            getProfileRoutingV1()
            getActivitiesRoutingV1()
        }
    }
}
```

2. **Update frontend client** [Source: muuvie/lib/di/http_di_module.dart] to target `/api/v1/` base URL:
```dart
@singleton
@Named('backend')
Dio get backendDio => Dio(
    BaseOptions(
        baseUrl: '${AppConfig.instance.backendUrl}/api/v1',
        headers: { 'accept': 'application/json' },
    ),
);
```

3. **Document v1 API formally** using OpenAPI/Swagger spec [Source: https://spec.openapis.org/oas/v3.0.3]:
```yaml
# research/api-v1-spec.yaml
openapi: 3.0.0
info:
  title: MuuvieBackend API
  version: 1.0.0
  deprecated: false
paths:
  /api/v1/movies/trending:
    get:
      summary: Get trending movies
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MovieListing'
```

4. **Add deprecation headers** to unversioned endpoints per RFC 8594 [Source: RFC 8594, Section 2]:
```kotlin
get("/movies/trending") {
    call.response.header("Deprecation", "true")
    call.response.header("Sunset", "Fri, 31 Dec 2026 23:59:59 GMT")
    call.response.header("Link", "</api/v1/movies/trending>; rel=\"successor-version\"")
    // Proxy to v1 implementation
}
```

### Phase 3: Support Multiple Versions (As Needed)

When breaking changes are introduced:

1. **Create new routing functions** (e.g., `getMoviesRoutingV2()`)
2. **Register v2 routes** alongside v1
3. **Both versions run concurrently** in the same process
4. **Announce deprecation timeline** for v1 (e.g., 6 months, communicated via deprecation headers and docs)
5. **Monitor client adoption** via metrics (User-Agent headers, endpoint usage logs)

### Phase 4: Sunset Old Versions

After deprecation period:

1. **Remove old version routing** and models
2. **Keep API documentation archived** (GitHub releases, research docs)
3. **Send final sunset notifications** to clients

### Monitoring & Metrics

Instrument versioned routes to track adoption:

```kotlin
fun Route.instrumentedRoute(version: String) {
    install(plugin = createPlugin("versionMetrics") {
        onRequest { request, body ->
            metrics.increment("api.requests", mapOf(
                "version" to version,
                "method" to request.httpMethod.value,
                "endpoint" to request.uri
            ))
        }
    })
}
```

Log format should include API version:
```
[2026-05-14 10:30:45] INFO  api.requests version=v1 method=GET endpoint=/movies/trending status=200 duration_ms=45
```

### Backward Compatibility Guarantees

**Within a version** (e.g., v1.0 → v1.5):
- Additive changes allowed: New optional fields in responses [Source: Analysis: ignored via `ignoreUnknownKeys` in Ktor JSON config]
- New endpoints allowed: Existing clients unaffected
- Query parameter additions allowed as optional parameters with defaults
- Breaking changes forbidden: No removing fields, changing types, altering required params

**Between versions** (e.g., v1 → v2):
- Minimum 6 months overlap [Source: Analysis: standard industry practice]
- Clear deprecation timeline announced in docs and headers [Source: RFC 8594]
- Migration guide documenting changes between versions

## Next Steps

- [ ] **Week 1**: Audit existing API endpoints and schemas; create baseline in `/research/api-v1-spec.yaml` (Assigned: Backend Lead)
- [ ] **Week 2**: Refactor Ktor routing to support `/api/v1/` prefix without breaking current unversioned routes (Assigned: Backend Lead)
- [ ] **Week 3**: Update Flutter frontend HTTP client to target `/api/v1/` base URL (Assigned: Frontend Lead)
- [ ] **Week 4**: Add RFC 8594 deprecation headers to unversioned endpoints; publish API documentation (Assigned: Backend Lead)
- [ ] **Month 2**: Monitor adoption metrics; announce sunset date for unversioned endpoints (12-18 months out) (Assigned: Product)
- [ ] **Ongoing**: Maintain OpenAPI specs for each version in `/research/api-vN-spec.yaml`; keep changelog at `/research/api-changelog.md`

**Decision gate**: Backend lead approval before Phase 2 implementation.

**Dependencies**: None. Can proceed in parallel with other backend work.

---

## Quick Checklist

- [x] Filename: `2026-05-14-api-versioning.md`
- [x] Metadata block with date, author, status
- [x] Executive summary (< 2 paragraphs)
- [x] All factual claims have sources
- [x] Options section compares 5 approaches with pros/cons/verdict
- [x] Each option has explicit evaluation
- [x] Recommended approach is clear and actionable
- [x] Implementation phases are concrete with timelines
- [x] Next steps are assigned and have deadlines
- [x] No unsourced assumptions
