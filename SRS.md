# Software Requirements Specification (SRS)
## Product: R&D Architecture Assistant

### 1. Introduction
**1.1 Purpose**
The R&D Architecture Assistant is a web-based, AI-powered tool designed to help software architects, technical leads, and developers collaboratively design systems, track architectural knowledge, and manage Architecture Decision Records (ADRs). 

**1.2 Scope**
The system provides a conversational AI interface (powered by Google Gemini) that automatically extracts architectural insights, constraints, and decisions from natural language discussions. It visualizes these entities in an interactive Knowledge Graph and provides a dedicated management interface for tracking the lifecycle and lineage of ADRs.

**1.3 Technology Stack**
*   **Frontend:** React 18, TypeScript, Vite
*   **Styling:** Tailwind CSS, Lucide React (Icons), Motion (Animations)
*   **Visualization:** D3.js (Force-directed graph), Mermaid.js (Lineage diagrams)
*   **AI Integration:** `@google/genai` SDK (Gemini 3.1 Pro / Flash models)

---

### 2. Overall Description
**2.1 User Classes and Characteristics**
*   **Software Architects / Tech Leads:** Primary users who define system boundaries, make high-level decisions, and generate reports (SRS, Clarity Reports).
*   **Developers:** Users who consult the Knowledge Map and ADR Lineage to understand *why* certain technical choices were made.

**2.2 Operating Environment**
The application is a Client-Side Single Page Application (SPA) that runs in modern web browsers. It relies on local state management for session data and requires an active internet connection to communicate with the Gemini API.

---

### 3. System Features & Functional Requirements

**3.1 Project & Strategy Management**
*   **REQ-1.1:** The system shall allow users to create multiple projects.
*   **REQ-1.2:** Users shall be able to assign a strategic alignment to a project (`MVP`, `Scale`, or `Hybrid`), which influences AI recommendations.
*   **REQ-1.3:** The system shall allow users to switch between active projects and clear the current session.

**3.2 AI Conversational Interface**
*   **REQ-2.1:** The system shall provide a chat interface to communicate with the AI architect.
*   **REQ-2.2:** The system shall automatically extract structured data (Nodes, Decisions, Conflicts, Trade-offs) from the conversation in the background.
*   **REQ-2.3:** The system shall allow users to manually trigger a "Synthesis" to force the AI to process the latest chat history into the Knowledge Graph.

**3.3 Interactive Knowledge Graph**
*   **REQ-3.1:** The system shall visualize extracted architectural knowledge as a force-directed graph using D3.js.
*   **REQ-3.2:** Nodes shall be categorized by architectural layer (`Infrastructure`, `Data`, `Logic`, `Interface`, `Cross-cutting`).
*   **REQ-3.3:** The system shall provide a toggle between a visual "Graph View" and a structured "List View".
*   **REQ-3.4:** The system shall highlight nodes involved in architectural conflicts with a distinct visual indicator (red glowing stroke).

**3.4 Architecture Decision Records (ADR) Management**
*   **REQ-4.1:** The system shall allow users to Create, Read, Update, and Delete (CRUD) ADRs.
*   **REQ-4.2:** ADRs shall track Status (`proposed`, `accepted`, `deprecated`, `superseded`), Date, Deciders, Context, Rationale, Pros, Cons, and Confidence level.
*   **REQ-4.3 (Versioning):** The system shall allow users to create a new version of an existing ADR, automatically marking the previous version as `superseded` and linking them.
*   **REQ-4.4 (Lineage):** The system shall generate and render a Mermaid.js flowchart showing the chronological lineage of decisions (supersedes/amends relationships).

**3.5 Conflict Detection & Resolution**
*   **REQ-5.1:** The AI shall detect architectural conflicts (e.g., choosing a heavy relational DB for an edge-computing requirement).
*   **REQ-5.2:** The system shall display a dedicated UI for active conflicts.
*   **REQ-5.3:** Users shall be able to click "Ask Architect" to automatically prompt the AI for resolution strategies for a specific conflict.
*   **REQ-5.4:** Users shall be able to manually dismiss/resolve conflicts.

**3.6 Reporting and Exporting**
*   **REQ-6.1 (Synthesis Report):** The system shall generate and download a comprehensive Markdown report containing the Executive Summary, Mermaid Diagram, ADRs, Trade-offs, and Knowledge Map.
*   **REQ-6.2 (SRS Generation):** The system shall use the Gemini Pro model to generate a formal Software Requirements Specification based on the current graph state and download it as Markdown.
*   **REQ-6.3 (Clarity Report):** The system shall generate an "ADR Clarity & Health Report" that analyzes the decision log for missing rationales, orphaned decisions, and overall lineage health.
*   **REQ-6.4 (Gap Analysis):** The system shall analyze the current architecture against the chosen project strategy and report missing components or risks.

---

### 4. Non-Functional Requirements

**4.1 Usability**
*   The UI shall follow a dark-mode, technical aesthetic (using Tailwind CSS) optimized for high data density.
*   The system shall provide immediate visual feedback for AI processing states (e.g., "Synthesizing...", "Generating...").

**4.2 Performance**
*   The D3.js graph shall handle up to 100 concurrent nodes smoothly using `requestAnimationFrame` and optimized force simulations.
*   Background AI extractions shall not block the main UI thread.

**4.3 Security & Privacy**
*   The system shall require a valid Gemini API key to function.
*   API keys shall be handled securely via environment variables or the platform's secure key selection UI, never exposed in the client-side source code.
