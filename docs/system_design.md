# System Design - R&D Architecture Assistant

## 1. Overview
The R&D Architecture Assistant is a client-side web application built with React, Vite, and TypeScript. It leverages the Google Gemini API for natural language processing and architectural synthesis.

## 2. High-Level Design
### 2.1 Frontend Architecture
- **Framework:** React 18+ for building the user interface.
- **Styling:** Tailwind CSS for responsive and modern design.
- **Icons:** Lucide-react for consistent iconography.
- **Animations:** Motion (Framer Motion) for smooth transitions and interactive elements.
- **Markdown Rendering:** React-markdown with remark-gfm for documentation and chat messages.

### 2.2 State Management
- **Local State:** React `useState` and `useEffect` for managing project data, messages, and UI states.
- **Persistence:** `localStorage` for saving project data between sessions.
- **Refs:** `useRef` for managing chat sessions and synchronization indices.

### 2.3 External API Integration
- **Gemini API:** Integration via `@google/genai` for chat and knowledge extraction.
- **API Key Management:** Supports both environment-provided keys and user-selected keys via `window.aistudio`.

## 3. Component Design
### 3.1 Main Application (`App.tsx`)
- Root component managing the overall application state, routing (tabs), and project lifecycle.
- Handles chat interactions, knowledge synthesis, and report generation.

### 3.2 Knowledge Graph (`KnowledgeGraph.tsx`)
- Visualizer for the architectural nodes and their relationships.
- Categorizes nodes into layers (Infrastructure, Data, Logic, Interface, Cross-cutting).

### 3.3 Mermaid Renderer (`Mermaid.tsx`)
- Renders architectural diagrams using Mermaid.js syntax.
- Dynamically generates diagram code based on the current knowledge graph.

## 4. Data Flow
1. **User Input:** User sends a message in the chat interface.
2. **AI Response:** Gemini API processes the message and returns a response.
3. **Knowledge Synthesis:** The application prompts Gemini to extract structured JSON (nodes, decisions, conflicts) from the chat history.
4. **Graph Update:** The extracted data is merged into the local `KnowledgeGraph` state.
5. **UI Update:** The chat, map, and decision views are updated to reflect the new state.
6. **Persistence:** The updated project data is saved to `localStorage`.
