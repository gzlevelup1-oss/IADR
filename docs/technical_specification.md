# Technical Specification - R&D Architecture Assistant

## 1. Data Models & Type Definitions

The application uses a strict TypeScript type system to ensure consistency between the conversational AI and the structured visualization logic.

### 1.1 Core Entities
- **Project:** The root aggregate. Contains `messages[]`, `graph`, `tradeOffs[]`, and `strategy`.
- **KnowledgeNode:** A single unit of architectural knowledge. 
    - `id`: unique identifier.
    - `category`: `use-case`, `system-design`, `implementation`, `ambition`, `constraint`.
    - `layer`: `infrastructure`, `data`, `logic`, `interface`, `cross-cutting`.
    - `status`: `proposed`, `verified`, `discarded`, `ambitious`.
- **Decision (ADR):** Represents a formal architectural decision.
    - `rationale`: Detailed "Why".
    - `supersedes/amends`: Linkages for chronological lineage.
- **TradeOff:** Binary comparison between two technical options (Option A vs Option B).

## 2. AI Integration & Synthesis Logic

### 2.1 Prompt Engineering
The synthesis process uses a multi-stage prompting strategy:
1. **Context Injection:** Injects the current `Project Strategy` and `Existing Graph` into the prompt.
2. **Delta Extraction:** Instructs the model to only identify *changes* (additions, modifications, or deletions) since the last `syncIndex`.
3. **Structured Output:** Enforces a JSON schema via the `@google/genai` Object/Array types to ensure the response can be directly merged into the application state.

### 2.2 Error Handling & Resilience
- **Exponential Backoff:** The `callGeminiWithRetry` utility handles `429 RESOURCE_EXHAUSTED` errors.
- **Schema Validation:** In-built JSON schema Enforcement in the Gemini SDK prevents "hallucinated" fields.

## 3. Visualization Engine

### 3.1 D3.js Force-Simulation
Located in `KnowledgeGraph.tsx`, the simulation uses the following forces:
- **`forceLink`:** Connects Decisions to their related KnowledgeNodes.
- **`forceCollide`:** Prevents visual overlapping.
- **`forceX/forceY`:** Targets specific coordinates based on the `layerCenters` map, creating visual clusters for Infrastructure, Data, Logic, etc.

### 3.2 Mermaid Rendering
- Uses the `mermaid.js` library for rendering diagrams in a React-friendly way.
- Supports dynamic diagram types: `layers`, `lineage`, and `sequence`.
- Implementation utilizes a dedicated `Mermaid` component with D3-powered zoom and pan capabilities.

## 4. Persistence Layer

### 4.1 LocalStorage Strategy
- The entire `projects` array is serialized to JSON and stored under the key `archbot_projects`.
- `currentProjectId` is stored separately to maintain session continuity on refresh.
- **Migration Logic:** On application startup, the `useEffect` hook perform basic data migrations (e.g., ensuring all projects have a `strategy` field).

## 5. UI/UX Interaction Patterns
- **Glassmorphism:** Use of backdrop-blur and semi-transparent backgrounds for overlays.
- **Micro-interactions:** Framer Motion (`motion`) is used for tab transitions, modal fades, and list reordering animations.
- **Data Density:** Technical aesthetic optimized for software architects, using monospaced fonts for metadata and identifiers.
