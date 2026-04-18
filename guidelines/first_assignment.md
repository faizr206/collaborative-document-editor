# Collaborative Document Editor with AI

# Writing Assistant

AI1220 Software, Web & Mobile Engineering - Assignment 1
Team Member: Faiz Ramadhan, Zainab Alhosani, Yara Alkendi, Guram Matcharashvili

## Part 2: System Architecture............................ ------------------------------------------------------

## 2.1 Architectural Drivers.............................

The architectural drivers are prioritized based on their impact on user experience and system feasibility.
Low-latency collaboration is ranked highest because real-time feedback is essential to usability—delays
beyond 500 ms significantly degrade the collaborative experience. Consistency is handled using eventual
consistency models (e.g., CRDT/OT), accepting temporary divergence in favor of responsiveness.
Availability and scalability ensure the system remains usable under failure and growth conditions, while AI
integration is treated as a core but non-blocking feature to avoid disrupting editing workflows.

```
No. Driver Related
Requirements
```
```
Description Impact on Architecture
```
```
1 Low-Latency
Real-Time
Collaboration
```
### NFR-LAT-01,

### FR-COL-

```
The system must
propagate edits
between users
within 500 ms to
enable seamless
real-time
collaboration.
```
```
Forces a push-based
communication model (e.g.,
WebSockets) over polling. Requires
a dedicated real-time
collaboration service maintaining
active sessions and in-memory
state. Introduces challenges in
horizontal scaling (connection
affinity, session distribution) and
requires efficient event
broadcasting mechanisms.
Trade-off: increased infrastructure
complexity vs superior user
experience.
```
```
2 Consistency &
Conflict
Resolution
```
### FR-COL-03,

### NFR-AVAIL-

### 3

```
The system must
ensure concurrent
edits do not result
in data loss or
inconsistent
document state.
```
```
Requires adoption of conflict
resolution algorithms (CRDT or
OT) and a structured document
model. CRDT enables offline
editing and eventual consistency
but increases memory and
implementation complexity; OT
simplifies transformation logic but
typically requires centralized
coordination. Trade-off: strong
consistency vs scalability and
offline capability.
```

3 Availability &
Graceful
Degradation

### NFR-AVAIL-0

### 2,

### NFR-AVAIL-0

### 3

```
The system must
remain functional
during partial
failures,
especially when
AI services are
unavailable.
```
```
Requires decoupled architecture
separating core editing from AI
services. Introduces fallback
mechanisms (disable AI features
while preserving editing), retry
strategies , and local state
buffering for reconnection.
Trade-off: additional system
complexity vs resilience and
uninterrupted user workflows.
```
4 Scalability NFR-SCALE-
01 to
NFR-SCALE-
04

```
The system must
support increasing
numbers of users,
documents, and
concurrent editing
sessions.
```
```
Requires stateless API services ,
horizontal scaling , and load
balancing. The real-time layer
must support distributed event
propagation (e.g., pub/sub
systems). Trade-off: distributed
system complexity vs ability to
handle growth and high
concurrency.
```
5 Security &
Access Control

### NFR-SEC-01

```
to
NFR-SEC-04,
FR-USER-02
```
```
The system must
protect sensitive
document data
and enforce
role-based access
control.
```
```
Requires authentication
mechanisms , role-based access
control (RBAC) , and encryption
in transit and at rest. AI
integration must include explicit
user consent and data handling
policies when interacting with
third-party services. Trade-off:
stricter security measures may
increase latency and system
complexity.
```

```
6 AI Integration
& Cost Control
```
```
FR-AI-01 to
FR-AI-08,
NFR-LAT-02
```
```
AI features must
be responsive,
cost-efficient, and
seamlessly
integrated without
disrupting editing.
```
```
Requires asynchronous processing
model (e.g., job queues or
event-driven workflows) to avoid
blocking the editor. Introduces AI
service abstraction layer , prompt
templating system , and context
selection strategies (e.g., partial
document vs full document).
Requires rate limiting, quotas, or
budgeting mechanisms. Trade-off:
richer AI capabilities vs latency,
cost, and system complexity.
```
```
7 Usability &
User
Experience
```
### NFR-USE-01

```
to
NFR-USE-03
```
```
The system must
provide an
intuitive interface
that supports
collaboration and
AI interaction
without
overwhelming
users.
```
```
Influences frontend architecture
and state management , including
handling multiple cursors,
presence indicators, and large
documents. Requires thoughtful AI
suggestion UX (inline suggestions,
accept/reject, partial edits).
Trade-off: richer features vs
increased UI complexity and
cognitive load.
```
These drivers directly influence the system’s architectural decisions and will be reflected in the modular
design presented in Section 2.2.

## 2.2 System Design using the C4 Model..................

**2.2.1 Level 1 — System Context Diagram**

This section presents the system architecture using the C4 model at three levels: system context, container,
and component. These diagrams illustrate how the system supports real-time collaboration, AI integration,
and document management.

**Explanation:**
Users interact with the system through a web application to create and edit documents. The system
communicates with an external AI service for writing assistance and uses an email service for notifications
and account-related actions.


**2.2.2 Level 2 — Container Diagram**

Explanation:
The frontend provides the user interface. The backend API handles business logic, authentication, and
document management. A real-time service manages live collaboration. The AI service handles
communication with the external AI provider. All data is stored in the database.

**2.2.3 Level 3 — Component Diagram (Backend)**

**Explanation:**
The backend is divided into components that handle authentication, document operations, user
management, AI requests, permissions, and versioning. All components access data through a repository
layer connected to the database.

**2.2.4 Feature Decomposition**

The system is decomposed into modular components to enable independent development, scalability, and
maintainability.

```
Module Responsibilities Dependencies Interfaces
```

```
Frontend
(Editor & UI
Layer)
```
- Render rich-text editor and
document UI
- Manage local editor state and
user interactions
- Display real-time updates
(cursor, presence, edits)
- Present AI suggestions (inline
/ side panel)
    - Backend API-
    Real-Time
    Service
    - AI Service (via
    backend)
       - REST/GraphQL API
       calls (documents, AI,
       auth)
       - WebSocket
       connection for live
       updates

```
Real-Time
Collaboration
Service
```
- Synchronize edits between
users in real time
- Manage document sessions
and active users
- Handle conflict resolution
(CRDT/OT)
    - Backend API
    - In-memory store
    (e.g., Redis)
       - WebSocket endpoints
       - Event streams (edit
       ops, cursor updates,
       presence)

```
Backend API
(Application
Layer)
```
- Handle business logic and
validation
- Manage document lifecycle
(CRUD, sharing)
- Orchestrate services- Enforce
authentication and authorization
    - Database
    - AI Service
    - Real-Time
    Service
       - REST/GraphQL
       endpoints

```
AI Service - Process AI requests
(summarize, rewrite, translate)
```
- Construct prompts and
manage context
- Communicate with external
LLM APIs
    - External LLM
    provider
    - Backend API
       - Internal API
       - Async responses
       (events/callbacks)

```
Database &
Storage
```
- Store documents, users,
permissions, versions
- Maintain version history
- Store AI interaction logs
    - Backend API - Data access layer
       (ORM / query
       interface)

```
Authentication
& Authorization
Module
```
- Handle login/session/token
management
- Enforce role-based access
(owner, editor, viewer)
- Validate permissions for
actions
    - Backend API
    - Identity provider
    (optional)
       - Auth endpoints
       - Middleware for
       request validation

**2.2.5 AI Integration Design**

The AI assistant is designed as an independent service integrated into the collaborative editing workflow
without disrupting core document editing.


**Context and Scope.** Only the user’s selected text is sent by default to the AI service to reduce token cost,
improve response relevance, and limit privacy exposure. For tasks such as restructuring or summarizing
larger sections, the system may also include the surrounding paragraph or section metadata as additional
context. For very long documents, the backend truncates or chunks context and sends only the most
relevant section rather than the full document.

**Suggestion UX.** AI output is returned as a suggestion rather than being applied automatically. Suggestions
are shown in a side panel and can also be previewed inline as proposed changes. Users may accept the full
suggestion, reject it, or manually edit the generated text before applying it. Accepted changes remain
undoable through normal editor history.

**AI During Collaboration.** If a user requests an AI rewrite on a region that is being edited by others, the
selected region is marked as “AI pending” for that user but not hard-locked for collaborators. Other users
may continue editing, and if the underlying text changes before the AI result is applied, the system warns
that the suggestion may be outdated and asks the user to review before applying it. This avoids blocking
collaboration while reducing the risk of applying stale AI output.

**Prompt Design.** Prompts are template-based rather than hardcoded directly into controller logic. Each AI
action such as rewrite, summarize, translate, or restructure uses a separate prompt template with variables
for selected text, tone, target language, or formatting intent. Templates are stored in a configurable prompt
layer so they can be adjusted without major backend changes.

**Model and Cost Strategy.** The system uses different AI models depending on the task. Lightweight and
cheaper models handle simple rewriting or summarization, while more capable models are reserved for
complex restructuring tasks. Cost is controlled through per-user request quotas or organization-level usage
limits. If a user exceeds the quota, the system rejects the request gracefully and returns a clear message
indicating that the AI limit has been reached while keeping normal editing fully available.

**2.2.6 API Design**

**1. Overview**
The system exposes a **hybrid API architecture** :
    ● **REST API (/api/v1)**
       ○ Handles authentication, document management, permissions, versioning, and AI request
          lifecycle
    ● **WebSocket (Real-Time Collaboration)**
       ○ Handles live document editing, synchronization, and presence awareness
This separation ensures:
    ● low-latency collaboration for editing
    ● clear and testable API contracts for application logic
    ● resilience when AI services are unavailable
**2. API Design Principles**
    ● All endpoints are prefixed with /api/v1
    ● JSON is used for all request and response bodies
    ● Authentication is required for all protected endpoints
    ● Authorization is enforced on the backend
    ● REST is used only for metadata and control operations
    ● Real-time document content updates are handled via WebSocket (Y.js)


**3. Standard Response Format**

```
Success Response Error Response
```
```
{
"data": {},
"meta": {}
}
```
### {

```
"error": {
"code": "FORBIDDEN",
"message": "You do not have
permission to access this resource.",
"details": null
}
}
```
**4. Authentication API**

```
POST /api/v1/auth/register
Purpose: Register a new user account. Authentication: Not required.
```
```
Request Body Response — 201 Created
```
```
{
"email": "user@example.com",
"password": "SecurePassword123",
"displayName": "Alice"
}
```
### {

```
"data": {
"user": {
"id": "usr_123",
"email": "user@example.com",
"displayName": "Alice"
}
}
}
```
```
POST /api/v1/auth/login
Purpose: Authenticate user and start session.
```
```
Response — 200 OK
```
```
{
"data": {
"user": {
"id": "usr_123",
"email": "user@example.com",
"displayName": "Alice"
}
}
}
```

```
POST /api/v1/auth/logout
Purpose: End user session.
```
**5. Document API**

```
POST /api/v1/documents
Purpose: Create a new document. Authentication: Required.
```
```
Request Body Response — 201 Created
```
```
{
"title": "Untitled
Document"
}
```
### {

```
"data": {
"document": {
"id": "doc_123",
"title": "Untitled Document",
"role": "owner",
"createdAt": "2026-03-31T08:00:00.000Z"
}
}
}
```
```
GET /api/v1/documents/{documentId}
Purpose: Retrieve document metadata.
```
```
Response — 200 OK
```
```
{
"data": {
"document": {
"id": "doc_123",
"title": "Project Proposal",
"role": "editor",
"ownerId": "usr_123",
"isAiEnabled": true,
"updatedAt": "2026-03-31T08:00:00.000Z"
}
}
}
```
```
PATCH /api/v1/documents/{documentId}
Purpose: Update document metadata (title, settings). Note: Document content is NOT updated via
REST.
```
```
Request Body
```

### {

```
"title": "Final Proposal",
"isAiEnabled": true
}
```
```
DELETE /api/v1/documents/{documentId}
Purpose: Delete or archive a document.
```
**6. Real-Time Collaboration API**

```
GET /api/v1/documents/{documentId}/bootstrap
Purpose: Initialize a collaboration session.
```
```
Request Body
```
```
{
"data": {
"collab": {
"roomId": "doc_123",
"websocketUrl": "wss://api.example.com/collab",
"token": "short-lived-token"
}
}
}
```
```
WebSocket Connection
Clients connect using:
wss://api.example.com/collab?token=...
```
```
This connection handles:
● real-time text synchronization (CRDT/Y.js)
● cursor presence
● reconnection and state recovery
```
**7. AI Assistant API**
AI operations are treated as **asynchronous jobs** to handle latency and cost variability. The client creates a
request and retrieves results via polling or events.

```
POST /api/v1/documents/{documentId}/ai/requests
Purpose: Create an AI processing request.
```

```
Request Body Response — 201 Created
```
```
{
"type": "rewrite",
"sourceText": "Original text",
"contextText": "Optional surrounding
context",
"instruction": "Make it more formal"
}
```
### {

```
"data": {
"request": {
"id": "ai_123",
"status": "queued"
}
}
}
```
```
GET /api/v1/documents/{documentId}/ai/requests/{requestId}
Purpose: Retrieve AI processing result.
```
```
Response — 200 OK
```
```
{
"data": {
"request": {
"id": "ai_123",
"status": "completed",
"resultText": "Rewritten text output"
}
}
}
```
**AI Status Model**

```
Status Description
```
```
queued Waiting in processing queue
```
```
processing AI is generating output
```
```
completed Result available
```
```
failed Error occurred
```
**8. Sharing and Permission API**

```
POST /api/v1/documents/{documentId}/members
Purpose: Share document with another user.
```
```
Request Body
```
```
{
```

```
"email": "user@example.com",
"role": "editor"
}
```
```
PATCH /api/v1/documents/{documentId}/members/{userId}
Purpose: Update user role.
```
```
DELETE /api/v1/documents/{documentId}/members/{userId}
Purpose: Remove user access.
```
**9. Versioning API**

```
GET /api/v1/documents/{documentId}/versions
Purpose: Retrieve version history.
```
```
POST /api/v1/documents/{documentId}/versions
Purpose: Create snapshot.
```
```
POST /api/v1/documents/{documentId}/versions/{versionId}/restore
Purpose: Restore previous version.
```
**10. Error Handling Strategy**
The system distinguishes between different failure scenarios:

```
Scenario Handling
```
```
AI processing delay Return status = processing
```
```
AI failure AI_PROVIDER_UNAVAILABLE
```
```
Permission error 403 FORBIDDEN
```
```
Resource not found 404 NOT_FOUND
```
```
Rate limit exceeded RATE_LIMITED
```
```
Example Error {
"error": {
"code": "AI_PROVIDER_UNAVAILABLE",
"message": "AI service is temporarily unavailable",
"details": null
}
```

### }

**11. Long-Running Operation Handling**

AI operations are handled asynchronously:

1. Client sends request → receives requestId
2. Backend processes request via worker queue
3. Client polls or subscribes for updates
4. Result is returned when completed
This ensures:
● responsiveness of the UI
● isolation from AI latency
● system stability under load

**2.2.7 Authentication and Authorization**

The system implements **role-based access control (RBAC)** to manage access to documents and system
features. Authentication ensures that only verified users can access the platform, while authorization
governs what actions each user is allowed to perform.

**Roles and Permissions**
The system defines four primary roles:

```
Role Permissions
```
```
Owner Full control: edit, delete, share, manage roles, access version history, and use all AI
features
```
```
Editor Edit document content, invoke AI features, and suggest changes
```
```
Commenter Add comments and view AI suggestions, but cannot directly modify content
```
```
Viewer Read-only access with no editing or AI invocation privileges
```
This separation ensures **fine-grained control** , especially important in collaborative and organizational
settings.

**AI Feature Authorization**
AI capabilities are treated as **privileged actions** :
● Only **editors and owners** can invoke AI features
● AI-generated suggestions are visible to all roles with read access
● Organizations may restrict AI usage based on policy (e.g., disable translation)

**Sharing and Access Control**
Documents can be shared via:
● Direct user invitations (mapped to roles)
● Optional link-based access with restricted permissions

**Privacy Considerations**


Since AI processing may involve third-party services:
● Only **selected text** is sent to AI APIs (not full documents)
● Users are informed when data is transmitted externally
● AI interaction logs are access-controlled and auditable

This design balances **security, usability, and compliance with data privacy expectations**.

**2.2.8 Communication Model**
The system adopts a **real-time, push-based communication model** to support collaborative editing.
**Communication Approach**
● Changes are propagated instantly to all connected users
● A persistent connection (e.g., WebSocket) enables low-latency updates
● This approach avoids polling overhead and ensures a responsive editing experience
**User Interaction Flow**
● **On document open** :
○ Client fetches the latest document state via API
○ A real-time session is established for live updates
● **During editing** :
○ Changes are broadcast to other users in near real-time (<500 ms target)
○ Presence indicators (cursor, selection) are synchronized
**Conflict Handling**
To maintain consistency during concurrent edits:
● The system uses a conflict resolution strategy (e.g., **CRDT or OT** )
● Edits from multiple users are merged deterministically without data loss
**Offline and Reconnection Handling**
● If connectivity is lost:
○ Edits are buffered locally
○ UI indicates offline mode
● Upon reconnection:
○ Local changes are synchronized with the server
○ Conflicts are resolved automatically
**AI Interaction During Collaboration**
● AI requests operate on a **snapshot of selected text**
● While AI is processing:
○ Other users can continue editing
○ The result is applied as a **suggestion** , not a forced overwrite
**Trade-offs**

```
Approach Advantage Disadvantage
```
```
Real-time push Low latency, better UX Higher complexity
```
```
Polling (not used) Simpler implementation Poor responsiveness
```
This model prioritizes **user experience and responsiveness** , which are critical for collaborative editing
systems.


## 2.3 Code Structure & Repository Organization.........

This section describes how the codebase is organized to support modular development, scalability, and
team collaboration.

**Repository Strategy**

The project will use a **monorepo** structure, where frontend, backend, and shared code are maintained in a
single repository.

**Justification:**

```
● Easier collaboration for a small team
● Simplifies dependency management
● Allows shared types and models between frontend and backend
● Easier to maintain consistency between API and UI
```
**Directory Structure**

The repository is organized as follows:

/project-root
│
├── frontend/ # Web application (UI, editor, components)
├── backend/ # API, business logic, services
├── realtime/ # Real-time collaboration service
├── ai-service/ # AI integration and prompt handling
├── shared/ # Shared types, constants, utilities
├── docs/ # Diagrams and documentation
└── README.md # Setup and usage instructions

**Explanation:**

```
● frontend/ handles the user interface and editor logic
● backend/ contains API endpoints, authentication, and document management
● realtime/ manages live collaboration and synchronization
● ai-service/ handles communication with external AI providers
● shared/ avoids duplication by storing common code
```
**Shared Code**

Shared code (e.g., data models, validation rules, constants) is placed in the **shared/** directory.

**Purpose:**


```
● Ensure consistency between frontend and backend
● Avoid duplicate definitions (e.g., document schema, user roles)
● Improve maintainability
```
**Configuration Management**

Sensitive data such as API keys, database credentials, and AI provider tokens are stored in environment
variables.

**Approach:**

```
● Use .env files for local development
● Never store secrets in the repository
● Use environment-based configuration for different environments
```
**Testing Strategy**

The system will include multiple levels of testing:

```
● Unit Tests: Test individual components and functions
● Integration Tests: Test interaction between services (e.g., API + database)
● End-to-End Tests: Test complete workflows (e.g., create and edit document)
```
For AI features, mock responses can be used to avoid repeated API calls during testing.

**Summary**

The chosen repository structure supports modular development, reduces duplication through shared code,
and enables efficient collaboration within the team. The monorepo approach aligns well with the project
scope and team size.

## 2.4 Data Model.......................................

The data model is designed to support collaborative document editing, version history, AI-assisted writing, and
flexible sharing mechanisms. The system must store not only document content, but also metadata related to
ownership, permissions, versioning, and AI interactions.

Entity-Relationship Diagram:


**Document Representation**

A document is stored in the **Document** entity, which includes both content and metadata.
In addition to current_content, it stores:

```
● owner_id (ownership)
● title (identification)
● timestamps (created_at, updated_at)
● ai_opt_out (privacy control)
```
This ensures documents are manageable, secure, and linked to users and permissions.

**Document Versioning**

Versioning is handled using the **DocumentVersion** entity. Each version stores a snapshot of the document content
with a version number and timestamp.


Users can:

```
● view version history
● revert to previous versions
```
When reverting, a new version is created instead of overwriting existing ones, preserving a complete history.

```
AI Interaction History
```
AI activity is modeled using **AIInteraction** and **AIResult**.

```
● AIInteraction stores metadata (user, document, feature type, status)
● AIResult stores the generated suggestion and whether it was applied
```
This allows the system to track whether AI suggestions were accepted, rejected, or partially applied, while linking
them to specific document context.

```
Permissions and Sharing
```
Permissions are managed using **DocumentPermission** , which assigns roles (owner, editor, viewer) per user per
document.

Link-based sharing is handled using **ShareLink** , which allows:

```
● controlled access via a token
● assigning roles through the link
● revoking access when needed
```
This supports both direct sharing and external access while maintaining security.

```
Summary
```
The data model:

```
● represents documents with metadata beyond content
● supports version history and safe reversion
● tracks AI interactions and outcomes
● enables flexible sharing and role-based access control
```
This design ensures scalability, security, and support for real-time collaboration features.


## 2.5 Architecture Decision Records (ADRs).............

**-The following ADRs capture key design decisions across different areas of the system.**

**ADR 1: Use WebSockets for Real-Time Collaboration**

**Status:**
Accepted

**Context:**
The system requires low-latency updates (≤ 500 ms) for multiple users editing simultaneously. HTTP-based
communication introduces delays and inefficiencies for continuous updates.

**Decision:**
Use WebSockets to enable bidirectional, real-time communication between clients and the collaboration service.

**Consequences:**

```
● Enables low-latency updates and seamless live collaboration
● Supports features such as presence indicators and cursor tracking
● Introduces additional complexity in scaling and connection management
```
**Alternatives considered:**

```
● HTTP polling — rejected due to high latency and inefficiency
● Server-Sent Events (SSE) — rejected because it does not support full bidirectional communication
```
**ADR 2: Separate AI into a Dedicated Service**

**Status:**
Accepted

**Context:**
AI features depend on external providers that may be slow, unreliable, or unavailable. The system must ensure that
core editing functionality continues even if AI services fail.

**Decision:**
Isolate all AI-related functionality in a dedicated AI service rather than embedding it within the main backend.

**Consequences:**

```
● Improves modularity and system resilience
● Allows easier replacement of AI providers
● Supports better control over cost and request handling
● Adds complexity due to inter-service communication
```
**Alternatives considered:**

```
● Backend-integrated AI — rejected due to tight coupling with core logic
● Frontend AI calls — rejected due to security risks and lack of control
```

**ADR 3: Use a Monorepo Structure**

**Status:**
Accepted

**Context:**
The system consists of multiple components (frontend, backend, real-time service, AI service) that share models and
require coordinated development within a small team.

**Decision:**
Use a monorepo structure with separate directories for each service and shared code.

**Consequences:**

```
● Simplifies collaboration and dependency management
● Enables reuse of shared models and utilities
● Reduces duplication across services
● Requires discipline to maintain clear module boundaries
```
**Alternatives considered:**

```
● Multiple repositories — rejected due to coordination overhead
● Single tightly coupled codebase — rejected due to poor modularity
```
**ADR 4: Use Role-Based Access Control per Document**

**Status:**
Accepted

**Context:**
Users require different permission levels (owner, editor, viewer) depending on the document. The system must
enforce permissions consistently across editing, sharing, and AI usage.

**Decision:**
Implement role-based access control (RBAC) at the document level.

**Consequences:**

```
● Provides clear and flexible permission management
● Supports secure sharing with different access levels
● Requires consistent permission checks across all actions
```
**Alternatives considered:**

```
● Global roles only — rejected because permissions vary per document
● Custom fine-grained permissions — rejected due to increased complexity
```

**Part 3: Project Management & Team Collaboration**

## 3.1 Team Structure & Ownership.......................

Our team consists of four members, with responsibilities distributed based on strengths to ensure efficient
development and high-quality output. Each member owns a core area while collaborating on cross-functional
features.

**Ownership Allocation**

● **Frontend & User Interface — Faiz Ramadhan**
Responsible for the frontend editor interface, client-side interactions, and presentation of collaboration and AI
features. Also contributes to frontend-related sections of the architecture and PoC.
● **Backend / API & Data Management — Guram Matcharashvili**
Responsible for backend APIs, authentication, document management, versioning, and database integration. Also
contributes to backend architecture, API design, and data model consistency.
● **AI Integration & Cross-Feature Coordination — Zainab Alhosani**
Responsible for AI workflow design, AI-related backend/frontend coordination, and ensuring AI suggestions align
with system requirements and user experience.
● **Testing, Integration & Validation — Yara Alkendi**
Responsible for integration testing, system validation, and ensuring consistency between requirements, architecture,
and proof of concept. Also supports debugging, final review, and submission readiness.

**Handling Cross-Component Features**

Some features span multiple components. For example, the AI assistant involves frontend interaction, backend
processing, and AI service integration.

To manage this:

```
● A primary owner leads the feature (e.g., AI features led by the AI integration owner).
● Other members contribute to their respective areas (frontend, backend, testing).
● Integration is coordinated through clear APIs and shared understanding of responsibilities.
● Features are tested collaboratively before completion.
```
```
Decision-Making Process
```
When disagreements arise, the team follows a structured approach:

1. **Discussion** — Each member presents their reasoning.
2. **Evaluation** — Options are compared based on simplicity, performance, and requirements.
3. **Consensus** — The team aims to agree on the best solution.
4. **Final Decision** — If needed, the owner of the affected component makes the final decision.

Key decisions are documented using ADRs to maintain consistency.


## 3.2 Development Workflow.............................

To ensure smooth collaboration, our team follows a structured development workflow covering branching, code
review, task tracking, and communication. This helps us work in parallel while keeping the codebase organized and
reducing integration issues.

**Branching Strategy**

We use a **feature-branch workflow**. The main branch is kept stable and contains only reviewed and approved work.
Each new task or feature is developed in a separate branch before being merged into main.

Branch names follow a simple and consistent format:

```
● feature/frontend-editor
● feature/auth-api
● feature/ai-suggestions
● fix/realtime-sync
● docs/part2-update
```
This naming approach makes branch purpose clear and helps the team quickly identify what each branch is for.

Our merge policy is:

```
● no direct commits to main
● all changes must go through a pull request
● branches are merged only after review and approval
● completed branches are deleted after merge to keep the repository clean
```
**Code Review**

We use pull requests for code review before merging any branch into main. The team member responsible for the
relevant area reviews the pull request first. For example:

```
● frontend-related changes are primarily reviewed by the frontend owner
● backend-related changes are reviewed by the backend owner
● AI and integration-related changes are reviewed by the relevant responsible member
```
For cross-component features, more than one member may review the pull request to ensure compatibility across the
system.

A pull request is approved only if:

```
● the code works as intended
● it matches the agreed requirements
● it does not break existing functionality
● naming and structure are clear and consistent
● any necessary documentation or comments are included
```

This process helps maintain code quality and reduces the chance of integration problems later.

**Issue Tracking and Task Assignment**

Work is broken down into smaller tasks based on system components and feature requirements. For example, a large
feature such as AI writing assistance may be divided into:

```
● frontend interaction
● backend request handling
● AI service integration
● testing and validation
```
Tasks are assigned according to each member’s ownership area, but members may support one another for shared
features. Each task has a clear owner to ensure accountability.

We track progress using a shared task board with columns such as:

```
● To Do
● In Progress
● Under Review
● Done
```
This allows the team to clearly see what is currently being worked on, what is waiting for review, and what has
already been completed.

**Communication**

For day-to-day communication, the team uses a group chat to discuss updates, blockers, and quick questions.
However, to make sure important decisions are not lost in chat messages, key technical decisions are documented
separately.

We document important decisions through:

```
● Architecture Decision Records (ADRs) for major design choices
● shared project notes for task planning and meeting summaries
● pull request descriptions and comments for implementation-specific discussions
```
This ensures that important reasoning remains accessible to all team members and can be referred to later when
needed.


## 3.3 Development Methodology..........................

Our team follows a lightweight Agile, sprint-based methodology inspired by Scrum. This approach is suitable
because the project includes multiple dependent components such as frontend, backend, real-time
collaboration, and AI integration, which need to be developed incrementally and tested together.

**Iteration Structure**

We organize our work into short iterations ( **sprints** ) lasting approximately **one week**. At the beginning of each sprint,
the team selects tasks from the backlog based on priority and feasibility.

Each sprint includes:

```
● Planning: defining goals and selecting tasks
● Development: implementing features and improvements
● Integration & Testing: ensuring components work together correctly
● Review: evaluating completed work and identifying issues
```
This iterative approach allows continuous progress and quick adaptation to changes.

**Backlog Prioritization**

Tasks in the backlog are prioritized based on:

● **Core functionality first:** essential features such as document editing, real-time collaboration, and
authentication are implemented before advanced features
● **Dependencies:** tasks that unblock other components (e.g., backend APIs before frontend integration) are
prioritized earlier
● **User impact:** features that directly affect user experience are given higher priority
● **Complexity and risk:** more complex or uncertain tasks are addressed earlier to reduce potential issues

This ensures that the system becomes usable early while minimizing development risks.

**Handling Non-User-Facing Work**

Not all critical work produces visible features. Tasks such as infrastructure setup, data model design, and testing are
essential for system stability and maintainability.


We handle these tasks by:

```
● including them explicitly in the backlog
● assigning clear ownership
● prioritizing foundational work early (e.g., data model design before implementation)
● integrating them within each sprint rather than postponing them
```
For example:

```
● the data model is designed early to support backend development
● testing and validation are performed continuously
● integration work is included in every sprint to prevent last-minute issues
```
## 3.4 Risk Assessment.................................

The following risks are specific to the system’s architecture, including real-time collaboration, AI integration, and
multi-component development.

**Risk 1: Real-Time Synchronization Conflicts**

**Description & Likelihood:**
Concurrent edits may lead to inconsistent document states if conflicts are not resolved correctly.
**Likelihood:** Medium

**Impact:**

```
● Conflicting or lost edits
● Inconsistent document state across users
```
**Mitigation Strategy:**

```
● Use a conflict resolution approach (e.g., OT/CRDT)
● Test overlapping edits and edge cases
```
**Contingency Plan:**

```
● Allow version rollback
● Provide manual conflict resolution if needed
```
**Risk 2: AI Service Latency or Failure**

**Description & Likelihood:**
External AI services may be slow or unavailable.
**Likelihood:** High

**Impact:**


```
● AI features become unusable
● Delays reduce user experience
```
**Mitigation Strategy:**

```
● Use asynchronous requests with loading indicators
● Implement timeouts and error handling
```
**Contingency Plan:**

```
● Disable AI features temporarily
● Provide retry options
```
**Risk 3: AI Cost and Token Limits**

**Description & Likelihood:**
Frequent usage or large inputs may exceed token limits or increase costs.
**Likelihood:** Medium

**Impact:**

```
● Increased operational cost
● Failed requests for large inputs
```
**Mitigation Strategy:**

```
● Limit AI input to selected text
● Apply request size limits
```
**Contingency Plan:**

```
● Restrict AI usage per user
● Use more cost-efficient models
```
**Risk 4: Integration Issues Between Components**

**Description & Likelihood:**
Frontend, backend, and services may not integrate correctly.
**Likelihood:** Medium

**Impact:**

```
● Features fail or behave incorrectly
● Increased debugging time
```
**Mitigation Strategy:**

```
● Define clear API contracts
● Perform regular integration testing
```

**Contingency Plan:**

```
● Use mock services
● Isolate and debug failing components
```
**Risk 5: Team Coordination and Code Organization Issues
Description & Likelihood:**
Because multiple team members are working on interconnected components, unclear ownership or inconsistent code
structure may lead to merge conflicts, duplicated work, or mismatched assumptions.
**Likelihood:** Medium
**Impact:**

● Slower development
● Increased bugs and integration issues
● Confusion over ownership and responsibilities
**Mitigation Strategy:**
● Use clear ownership areas and feature branches
● Maintain shared coding conventions and folder structure
● Review integration points regularly
**Contingency Plan:**
● Resolve overlaps collaboratively
● Refactor conflicting code
● Reassign ownership temporarily if blockers arise

**Risk 6: Real-Time Performance Degradation**

**Description & Likelihood:**
Performance may degrade with many concurrent users.
**Likelihood:** Medium

**Impact:**

```
● Delayed updates
● Poor collaboration experience
```
**Mitigation Strategy:**

```
● Optimize WebSocket handling
● Limit concurrent users per document
```
**Contingency Plan:**

```
● Reduce active users per session
● Disable non-critical features (e.g., live cursors)
```

## 3.5 Timeline and Milestones.........................

**The following timeline outlines the remaining development phases of the project. Each milestone includes clear
and measurable acceptance criteria to ensure progress is verifiable and aligned with system requirements.**

**Milestone 1: Backend Core API Completed**

**Timeline: Week 1**

**Scope:
Implement core backend functionality, including authentication and document management.**

**Acceptance Criteria:**

```
● User registration and login endpoints are implemented and functional
● Authentication (JWT/session-based) is enforced on protected routes
● Document CRUD operations (create, read, update, delete) are available via API
● API endpoints are tested using integration tests (e.g., successful requests and authorization checks)
● Data is correctly stored and retrieved from the database
```
**Milestone 2: Frontend Editor & Basic UI Integration**

**Timeline: Week 2**

**Scope:
Develop the user interface and connect it to backend APIs.**

**Acceptance Criteria:**

```
● Users can create and open documents through the UI
● Document content loads and displays correctly
● Users can edit and save documents via the frontend
● Frontend successfully communicates with backend APIs
● Basic error handling (e.g., failed requests) is displayed to users
```
**Milestone 3: Real-Time Collaboration Functional**

**Timeline: Week 3**

**Scope:
Enable real-time editing between multiple users.**

**Acceptance Criteria:**

```
● Multiple users can open the same document simultaneously
● Edits from one user appear to others within acceptable latency
```

```
● WebSocket connection is established and maintained
● Presence indicators (e.g., active users or cursors) are displayed
● Basic conflict handling prevents data loss during simultaneous edits
```
**Milestone 4: AI Writing Assistant Integration**

**Timeline: Week 4**

**Scope:
Integrate AI features into the system.**

**Acceptance Criteria:**

```
● Users can select text and trigger AI actions (e.g., summarize, rewrite)
● AI requests are sent to the backend and processed correctly
● AI-generated suggestions are displayed in the UI without modifying original text
● Users can accept, reject, or modify AI suggestions before applying
● AI failures are handled gracefully with error messages and retry options
```
**Milestone 5: Integration, Testing & Stabilization**

**Timeline: Week 5**

**Scope:
Ensure all system components work together reliably and meet requirements.**

**Acceptance Criteria:**

```
● End-to-end workflows (create → edit → collaborate → use AI) function correctly
● All major features are tested across frontend, backend, and real-time components
● Edge cases are handled (e.g., disconnection, AI failure, permission restrictions)
● No critical bugs remain that block core functionality
● System meets key non-functional requirements (latency, reliability) under normal usage
```
**Milestone 6: Submission Package Finalized
Timeline: Week 6
Scope: Finalize all written deliverables, diagrams, editable diagram source files, proof of concept repository,
README, and demo recording.
Acceptance Criteria:**

```
● PDF report is complete and internally consistent
● All required diagrams are included in the report and submitted as editable source files
● PoC repository link is ready and runnable
● README explains setup, execution, and PoC scope
● Demo video is recorded and shows frontend-backend communication
● Final review confirms alignment with assignment requirements
```

