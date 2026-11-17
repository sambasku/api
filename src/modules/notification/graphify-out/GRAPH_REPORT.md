# Graph Report - notification  (2026-11-17)

## Corpus Check
- 25 files · ~7,158 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .bak 1)

## Summary
- 214 nodes · 423 edges · 7 communities
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `abf34432`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- NotificationPushCooldownRepository
- notification.routes.ts
- notify-word-owner-media.use-case.ts
- NotificationRepository
- notification.repository.impl.ts
- notification.e2e.test.ts
- review-push-cooldown-gate.ts

## God Nodes (most connected - your core abstractions)
1. `NotificationRepository` - 21 edges
2. `NotificationPushCooldownRepository` - 18 edges
3. `NotificationRepositoryImpl` - 10 edges
4. `NotificationController` - 9 edges
5. `WordMediaPushCooldownGate` - 8 edges
6. `CreateInboxNotificationInput` - 8 edges
7. `RecordInboxNotificationUseCase` - 7 edges
8. `MarkNotificationReadUseCase` - 6 edges
9. `ReviewPushCooldownGate` - 6 edges
10. `WordCommentPushCooldownGate` - 6 edges

## Surprising Connections (you probably didn't know these)
- `NotificationPushCooldownRepositoryImpl` --implements--> `NotificationPushCooldownRepository`  [EXTRACTED]
  api/src/modules/notification/infrastructure/notification-push-cooldown.repository.impl.ts → api/src/modules/notification/domain/repositories/notification-push-cooldown.repository.ts
- `NotificationRepositoryImpl` --implements--> `NotificationRepository`  [EXTRACTED]
  api/src/modules/notification/infrastructure/notification.repository.impl.ts → api/src/modules/notification/domain/repositories/notification.repository.ts
- `NotificationRoutesDeps` --references--> `NotificationController`  [EXTRACTED]
  api/src/modules/notification/presentation/v1/notification.routes.ts → api/src/modules/notification/presentation/v1/notification.controller.ts
- `RecordInboxNotificationCommand` --references--> `InboxNotificationType`  [EXTRACTED]
  api/src/modules/notification/application/use-cases/record-inbox-notification.use-case.ts → api/src/modules/notification/domain/entities/notification.entity.ts
- `RecordInboxNotificationCommand` --references--> `NotificationActionKind`  [EXTRACTED]
  api/src/modules/notification/application/use-cases/record-inbox-notification.use-case.ts → api/src/modules/notification/domain/entities/notification.entity.ts

## Import Cycles
- None detected.

## Communities (7 total, 0 thin omitted)

### Community 0 - "NotificationPushCooldownRepository"
Cohesion: 0.09
Nodes (14): log(), parseCooldownMinutes(), ReplyPushCooldownChannel, ReplyPushCooldownGate, CHANNEL, log(), parseCooldownMinutes(), WordCommentPushCooldownGate (+6 more)

### Community 1 - "notification.routes.ts"
Cohesion: 0.08
Nodes (15): NotificationController, createNotificationRoutes(), json(), NotificationRoutesDeps, inboxNotificationTypeSchema, ListNotificationsQuery, listNotificationsQuerySchema, listNotificationsResponseSchema (+7 more)

### Community 2 - "notify-word-owner-media.use-case.ts"
Cohesion: 0.09
Nodes (11): bodyFor(), logError(), NotifyWordOwnerMediaCommand, NotifyWordOwnerMediaUseCase, TITLE_BY_TYPE, WordOwnerMediaEntityType, RecordInboxNotificationUseCase, log() (+3 more)

### Community 3 - "NotificationRepository"
Cohesion: 0.10
Nodes (6): GetUnreadNotificationCountUseCase, ListMyNotificationsUseCase, MarkAllNotificationsReadUseCase, MarkNotificationReadUseCase, logError(), NotificationRepository

### Community 4 - "notification.repository.impl.ts"
Cohesion: 0.16
Nodes (13): RecordInboxNotificationCommand, inboxCopyFor(), InboxNotification, InboxNotificationType, NotificationActionKind, NotificationTargetKind, CreateInboxNotificationInput, NotificationListOptions (+5 more)

### Community 5 - "notification.e2e.test.ts"
Cohesion: 0.09
Nodes (7): NotificationPushCooldown, NotificationPushCooldownChannel, NotificationPushCooldownRepositoryImpl, IDN, NOMINA, { parsed }, SMB

### Community 6 - "review-push-cooldown-gate.ts"
Cohesion: 0.23
Nodes (4): log(), parseCooldownMinutes(), ReviewPushCooldownGate, ReviewPushCooldownChannel

## Knowledge Gaps
- **17 isolated node(s):** `{ parsed }`, `SMB`, `IDN`, `NOMINA`, `resolved` (+12 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 61 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NotificationRepository` connect `NotificationRepository` to `notify-word-owner-media.use-case.ts`, `notification.repository.impl.ts`?**
  _High betweenness centrality (0.184) - this node is a cross-community bridge._
- **Why does `NotificationPushCooldownRepository` connect `NotificationPushCooldownRepository` to `notify-word-owner-media.use-case.ts`, `notification.e2e.test.ts`, `review-push-cooldown-gate.ts`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `MarkNotificationReadUseCase` connect `NotificationRepository` to `notification.routes.ts`, `notify-word-owner-media.use-case.ts`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **What connects `{ parsed }`, `SMB`, `IDN` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `NotificationPushCooldownRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.08985507246376812 - nodes in this community are weakly interconnected._
- **Should `notification.routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08250355618776671 - nodes in this community are weakly interconnected._
- **Should `notify-word-owner-media.use-case.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._