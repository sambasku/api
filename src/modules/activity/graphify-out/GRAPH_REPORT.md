# Graph Report - activity  (2026-11-21)

## Corpus Check
- 26 files · ~21,067 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 270 nodes · 593 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e606ee15`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- activity.routes.ts
- activity-event-feed.repository.impl.ts
- ActivityItem
- verification-consolidation.e2e.test.ts
- activity-event.repository.impl.ts
- ActivityEventFeedRepositoryImpl
- merge-activity.ts
- activity.repository.impl.ts
- activity-body-snippet.ts

## God Nodes (most connected - your core abstractions)
1. `ActivityItem` - 32 edges
2. `ActivityCursor` - 28 edges
3. `ActivityEventFeedRepositoryImpl` - 21 edges
4. `ActivityRepositoryImpl` - 18 edges
5. `ActivityEventKind` - 16 edges
6. `ActivityRepository` - 15 edges
7. `ActivityEventRepository` - 11 edges
8. `occurredAtSql()` - 11 edges
9. `keysetBefore()` - 10 edges
10. `secondsToDate()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `RecordActivityEventCommand` --references--> `ActivityEventKind`  [EXTRACTED]
  api/src/modules/activity/application/use-cases/record-activity-event.use-case.ts → api/src/modules/activity/domain/entities/activity-event.entity.ts
- `jinyeCopyFromRow()` --calls--> `jinyeFeedPayload()`  [EXTRACTED]
  api/src/modules/activity/infrastructure/activity-event-feed.repository.impl.ts → api/src/modules/activity/application/utils/activity-body-snippet.ts
- `ActivityEventRepositoryImpl` --implements--> `ActivityEventRepository`  [EXTRACTED]
  api/src/modules/activity/infrastructure/activity-event.repository.impl.ts → api/src/modules/activity/domain/repositories/activity-event.repository.ts
- `ActivityRepositoryImpl` --implements--> `ActivityRepository`  [EXTRACTED]
  api/src/modules/activity/infrastructure/activity.repository.impl.ts → api/src/modules/activity/domain/repositories/activity.repository.ts

## Import Cycles
- None detected.

## Communities (10 total, 1 thin omitted)

### Community 0 - "activity.routes.ts"
Cohesion: 0.08
Nodes (13): RecordCardShareUseCase, ActivityController, toWire(), createActivityRoutes(), createCardShareRoutes(), json(), activityActorSchema, activityItemSchema (+5 more)

### Community 1 - "activity-event-feed.repository.impl.ts"
Cohesion: 0.05
Nodes (12): cursorFromEventId(), FeedRow, jinyeForComment, jinyeImageCount(), KIND_BODY, KIND_TO_WIRE, MERGED_PROFILE_KINDS, parentPantuns (+4 more)

### Community 2 - "ActivityItem"
Cohesion: 0.18
Nodes (11): ActivityItem, ActivityCursor, ActivityRepository, ActivityRepositoryImpl, feedVisibleWordSql(), keysetBefore(), notSelfSql(), occurredAtSql() (+3 more)

### Community 3 - "verification-consolidation.e2e.test.ts"
Cohesion: 0.12
Nodes (7): { parsed }, { parsed }, { parsed }, { parsed }, { parsed }, { parsed }, { parsed }

### Community 4 - "activity-event.repository.impl.ts"
Cohesion: 0.08
Nodes (6): RecordActivityEventUseCase, AppendActivityEventInput, ActivityEventRepository, AppendResult, ActivityEventRepositoryImpl, resolveContributionWordId()

### Community 5 - "ActivityEventFeedRepositoryImpl"
Cohesion: 0.13
Nodes (8): RecordActivityEventCommand, ACTIVITY_EVENT_KINDS, ActivityEventKind, ActivityEventRow, ActivityEventCursor, ActivityEventFeedRepositoryImpl, jinyeCopyFromRow(), voteEntityTypeOfKind()

### Community 6 - "merge-activity.ts"
Cohesion: 0.12
Nodes (18): ListActivityInput, ListActivityPage, ListActivityUseCase, ActivityActor, ActivityKind, ActivityTarget, ACTIVITY_DEFAULT_LIMIT, ACTIVITY_MAX_LIMIT (+10 more)

### Community 7 - "activity.repository.impl.ts"
Cohesion: 0.08
Nodes (8): CONTRIB_BODY, isFulfilledLemmaSql, matchesExcludedLemmaSql, notMyWordVoteSql(), notSelfOrNullSql(), saneTs(), searchMissBody(), WORD_BOUND_VOTE_TYPES

### Community 8 - "activity-body-snippet.ts"
Cohesion: 0.90
Nodes (3): discussionCreatedPayload(), jinyeFeedPayload(), snippetActivityBody()

## Knowledge Gaps
- **32 isolated node(s):** `{ parsed }`, `{ parsed }`, `{ parsed }`, `{ parsed }`, `{ parsed }` (+27 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 101 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ActivityItem` connect `ActivityItem` to `activity.routes.ts`, `activity-event-feed.repository.impl.ts`, `verification-consolidation.e2e.test.ts`, `ActivityEventFeedRepositoryImpl`, `merge-activity.ts`, `activity.repository.impl.ts`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Why does `ActivityEventKind` connect `ActivityEventFeedRepositoryImpl` to `activity-event-feed.repository.impl.ts`, `activity-event.repository.impl.ts`, `merge-activity.ts`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `ActivityCursor` connect `ActivityItem` to `activity-event-feed.repository.impl.ts`, `verification-consolidation.e2e.test.ts`, `ActivityEventFeedRepositoryImpl`, `merge-activity.ts`, `activity.repository.impl.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `{ parsed }`, `{ parsed }`, `{ parsed }` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `activity.routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07539118065433854 - nodes in this community are weakly interconnected._
- **Should `activity-event-feed.repository.impl.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `verification-consolidation.e2e.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._