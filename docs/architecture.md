# Architecture - R&D Architecture Assistant

## 1. Frontend Architecture
The R&D Architecture Assistant is a single-page application (SPA) built with React, Vite, and TypeScript. It follows a modular architecture for components, services, and state management.

### 1.1 Component Structure
- **Root Component (`App.tsx`):** Manages the overall application state, routing (tabs), and project lifecycle.
- **UI Components:** Reusable components for buttons, inputs, modals, and layouts.
- **Specialized Components:**
    - `KnowledgeGraphView`: Visualizes architectural nodes and their relationships.
    - `Mermaid`: Renders architectural diagrams using Mermaid.js syntax.
    - `ReactMarkdown`: Renders chat messages and reports in Markdown.

### 1.2 State Management
- **Local State:** React `useState` and `useEffect` for managing project data, messages, and UI states.
- **Persistence:** `localStorage` for saving project data between sessions.
- **Refs:** `useRef` for managing chat sessions and synchronization indices.

## 2. Data Flow
1. **User Input:** User sends a message in the chat interface.
2. **AI Response:** Gemini API processes the message and returns a response.
3. **Knowledge Synthesis:** The application prompts Gemini to extract structured JSON (nodes, decisions, conflicts) from the chat history.
4. **Graph Update:** The extracted data is merged into the local `KnowledgeGraph` state.
5. **UI Update:** The chat, map, and decision views are updated to reflect the new state.
6. **Persistence:** The updated project data is saved to `localStorage`.

## 3. Key Services
- **`synthesizeKnowledge`:** Prompts Gemini to extract structured architectural information from the chat history.
- **`handleSend`:** Manages user input, AI response, and knowledge synthesis.
- **`handleGenerateSRS`:** Generates a comprehensive Software Requirements Specification (SRS) report using Gemini.
- **`handleGenerateClarityReport`:** Analyzes ADRs for clarity and health using Gemini.
- **`handleExport`:** Generates and exports architectural reports in Markdown format.

## 4. Technology Stack
- **Frontend:** React 18+, Vite, TypeScript.
- **Styling:** Tailwind CSS.
- **Icons:** Lucide-react.
- **Animations:** Motion (Framer Motion).
- **Markdown:** React-markdown, remark-gfm.
- **AI Integration:** `@google/genai` (Gemini API).
- **Diagrams:** Mermaid.js.
