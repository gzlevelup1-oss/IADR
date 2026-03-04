# Software Requirements Specification (SRS) - R&D Architecture Assistant

## 1. Introduction
### 1.1 Purpose
The R&D Architecture Assistant is an AI-powered, web-based tool designed to help software architects, technical leads, and developers collaboratively design systems, track architectural knowledge, and manage Architecture Decision Records (ADRs). It bridges the gap between conversational brainstorming and structured technical documentation.

### 1.2 Scope
The system provides a conversational AI interface (powered by Google Gemini) that automatically extracts architectural insights, constraints, and decisions from natural language discussions. It visualizes these entities in an interactive Knowledge Graph and provides dedicated management interfaces for ADRs, Trade-offs, and Conflict resolution.

### 1.3 Technology Stack
*   **Frontend:** React 18 (Hooks, Refs, Context-like patterns), TypeScript, Vite
*   **Styling:** Tailwind CSS, Lucide React (Icons), Motion (Animations)
*   **Visualization:** D3.js (Force-directed graph), Mermaid.js (Lineage and architecture diagrams)
*   **AI Integration:** `@google/genai` SDK (Gemini 3.1 Pro / Flash models)
*   **Persistence:** `localStorage` for client-side project storage and session management.

---

## 2. Overall Description
### 2.1 Product Perspective
A client-side Single Page Application (SPA) that interacts with the Google Gemini API. It maintains high data density and technical aesthetics, optimized for architectural workflows.

### 2.2 User Classes
*   **Software Architects / Tech Leads:** Primary users who define system boundaries, make high-level decisions, and generate reports.
*   **Developers:** Users who consult the Knowledge Map and ADR Lineage to understand the "why" behind technical choices.

### 2.3 Operating Environment
Modern web browsers (Chrome, Firefox, Safari, Edge). Requires an active internet connection for Gemini API calls.

---

## 3. System Features & Functional Requirements

### 3.1 Project & Strategy Management
*   **REQ-1.1:** The system shall support multiple projects with local persistence.
*   **REQ-1.2:** Users shall define a **Strategic Alignment** for each project:
    *   **MVP:** Priority on speed and "good enough" solutions.
    *   **Scale:** Priority on robustness and long-term maintainability.
    *   **Hybrid:** Balanced approach with clear migration paths.
*   **REQ-1.3:** The system shall allow importing/exporting project data as JSON.

### 3.2 AI Conversational Interface
*   **REQ-2.1:** High-fidelity chat interface with support for Gemini 3 Flash and 3.1 Pro models.
*   **REQ-2.2 (Knowledge Extraction):** The system shall background-process conversations to extract Nodes, Decisions, and Conflicts.
*   **REQ-2.3 (Synthesis):** Users can manually trigger "Synthesis" to update the graph from the latest chat history.
*   **REQ-2.4 (Model Comparison):** Support for comparing responses from different Gemini models.

### 3.3 Interactive Knowledge Graph
*   **REQ-3.1:** Force-directed D3.js visualization of the "Knowledge Map".
*   **REQ-3.2 (Layers):** Nodes categorized into Infrastructure, Data, Logic, Interface, and Cross-cutting layers.
*   **REQ-3.3 (Categories):** Nodes typed as Use-case, System Design, Implementation, Ambition, or Constraint.
*   **REQ-3.4 (Search & Filter):** Real-time search and layer-based filtering of the visual graph.

### 3.4 Architecture Decision Records (ADR)
*   **REQ-4.1:** CRUD operations for ADRs with fields for Rationale, Pros/Cons, Confidence, and Deciders.
*   **REQ-4.2 (Lineage):** Visualization of decision history (Supersedes/Amends) using Mermaid.js.
*   **REQ-4.3 (Status):** Lifecycle tracking: Proposed, Accepted, Deprecated, Superseded.

### 3.5 Conflict & Gap Analysis
*   **REQ-5.1:** AI-driven detection of architectural conflicts (contradicting constraints, etc.).
*   **REQ-5.2:** "Gap Analysis" report comparing current architecture against the chosen Strategy Alignment.

### 3.6 Reporting & Exports
*   **REQ-6.1:** Generate Markdown-based SRS, Synthesis Reports, and ADR Clarity Reports directly from the graph state.

---

## 4. Non-Functional Requirements
### 4.1 Usability
*   Strict adherence to a dark-mode technical aesthetic.
*   Micro-animations for state changes (Synthesis, extraction, modal transitions).

### 4.2 Performance
*   Optimized D3 simulations for up to 100 concurrent nodes.
*   Graceful handling of API rate limits (exponential backoff).

### 4.3 Security
*   API keys managed via environment variables or secure session pickers (AI Studio integration).

