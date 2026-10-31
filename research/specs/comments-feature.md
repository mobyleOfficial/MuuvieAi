# Comments Feature Specification

## Overview

This specification describes the implementation of a comments system that allows users to view paginated comments on movie reviews, movie lists, and other content throughout the application. Comments will be managed through a dedicated domain feature with remote data fetching, full pagination support, and standardized mock data across the application.

### Why This Matters

Comments enable user engagement and social interaction within the Muuvie ecosystem. By exposing comments on reviews and lists, we:
- Increase user trust through community feedback
- Encourage content discovery and discussion
- Provide aggregated sentiment and insights
- Enable future features like comment moderation and user interactions

---

## User Stories

### User Story 1: View Comments on Movie Reviews
**As a** viewer of a movie review
**I want to** see paginated comments from other users
**So that** I can understand community feedback and context around the review

### User Story 2: View Comments on Movie Lists
**As a** viewer of a curated movie list
**I want to** see paginated comments discussing the list
**So that** I can see how other users view the selection and recommendations

### User Story 3: Comments Display on Additional Content Screens
**As a** user browsing various screens
**I want to** see contextual comments where applicable
**So that** the entire platform supports social interaction

---

## Acceptance Criteria

### Functional Requirements

- Comments include: `id`, `authorName`, `authorAvatar`, `content`, `createdAt`, `rating` (optional)
- Default page size: 10 comments per page
- Comments API accepts: `id` (content identifier), `page` (0-indexed), `pageSize`
- Comments API returns: `comments: List<CommentModel>`, `totalCount: int`, `hasMore: bool`
- All comments fetched via remote HTTP data source only (NO local caching)
- All comments mocked in remote data source (at least 30 mocks across 3+ content types)
- All existing comment mocks replaced with new consolidated mock data
- Get comments use case accepts content ID parameter for filtering
- Comments are fully typed, no `dynamic`
- All public use cases have unit tests
- Code passes `dart analyze` and follows Dart/Flutter conventions

---

## Technical Notes

### Architecture Overview

**Features Package:**
- `features/comments/` — Main feature package
  - `domain/` — Business logic contracts (repositories, use cases, entities)
  - `data/` — Implementation (datasources, models, repository implementations)
  - `lib/comments.dart` — Barrel file re-exporting domain + data

**UI Module:**
- `ui/comments/` — Complete UI module
  - `comments_state.dart` — Sealed state classes (Loading, Success, Error)
  - `comments_bloc.dart` — Cubit managing pagination and state
  - `comments_screen.dart` — @RoutePage widget displaying comments

### Domain Models

**Comment Entity:**
- `id: String`
- `authorName: String`
- `authorAvatar: String`
- `content: String`
- `createdAt: DateTime`
- `rating: double?` (optional)

**CommentResponse Envelope:**
- `comments: List<Comment>`
- `totalCount: int`
- `hasMore: bool` (for pagination tracking)

### Data Flow

1. Parent screen passes content ID to CommentsScreen
2. CommentsCubit calls GetCommentsUseCase(id, page)
3. UseCase delegates to CommentsRepository
4. Repository calls CommentsRemoteDataSource
5. Remote data source returns mocked data wrapped in `Result<T>`
6. Data flows back through layers with domain mapping (`.toDomain()`)
7. Cubit emits Success/Error state
8. Screen rebuilds with comments and pagination controls

### Dependency Injection

- Create `lib/di/comments_module.dart` with `@module` registrations
- Register CommentsRemoteDataSource as `@injectable`
- Register CommentsRepository as `@LazySingleton(as: CommentsRepository)`
- Register GetCommentsUseCase as `@injectable` (factory)
- Update `lib/di/injection.config.dart` with imports and module instantiation

### Remote Data Source (Mocked)

Mock comments organized by content ID (reviews, lists, other screens). Each content ID has 10+ associated comments. Mocks include:
- Realistic author names and avatar URLs
- Varied comment lengths (short, medium, long)
- Timestamps spread across dates
- Rating values from 1.0 to 5.0
- Pagination logic: `page * pageSize` indexing with `hasMore` calculation

### Integration Points

**Review Detail Screen:**
- Add CommentsScreen widget below review content
- Pass review ID as content identifier
- Handle loading/error states gracefully

**List Detail Screen:**
- Add CommentsScreen widget below list content
- Pass list ID as content identifier
- Same loading/error handling

**Other Screens (Future):**
- Follow same pattern: CommentsScreen(contentId: id)
- No cross-feature dependencies needed

### Backend API Contract (Future)

When backend implements comments endpoint:

**Endpoint:** `GET /api/v1/comments?id={contentId}&page={page}&pageSize={pageSize}`

**Response Format:**
```json
{
  "comments": [
    {
      "id": "comment-123",
      "authorName": "John Doe",
      "authorAvatar": "https://...",
      "content": "Excellent review!",
      "createdAt": "2026-05-14T10:30:00Z",
      "rating": 4.5
    }
  ],
  "totalCount": 42,
  "hasMore": true
}
```

---

## Cross-Repo Impact

### Frontend (Muuvie) - Changes Required
- ✅ Create `features/comments/` with domain, data, UI modules
- ✅ Integrate CommentsScreen into review detail and list detail pages
- ✅ Update main `pubspec.yaml` to depend on comments feature + UI module
- ✅ Add DI module registration in `lib/di/injection.config.dart`
- ✅ Create unit tests for use cases
- ✅ Create widget tests for CommentsScreen

### Backend (MuuvieBackend) - No Changes (MVP)
- Backend will implement real endpoint in Phase 2
- For now: Frontend uses mocked data source
- Future: Real endpoint should match API contract above

---

## Out of Scope

- Comment creation/editing (read-only MVP)
- Comment moderation or reporting
- User profile navigation from author names
- Nested replies (flat structure only)
- Comment sorting (chronological order only)
- Real-time updates
- Local caching or offline access
- Search/filtering
- Backend integration (mocked for MVP)

---

## Open Questions

1. **Visual Design** — Comments section layout on review/list screens? Tab or inline display?
2. **Pagination UX** — "Load More" button or infinite scroll?
3. **Avatar Loading** — Placeholder on failure or lazy-load with shimmer?
4. **Rating Display** — Stars, numerical, or hidden on some screens?
5. **Backend Timeline** — When will backend implement real endpoint?
6. **Content Types** — Which other screens beyond reviews/lists need comments?
7. **Comment Length** — Max length? Truncate with "read more"?
8. **Localization** — Author names localized? Comment content translatable?
