# Data Structures and Algorithms (DSA) - R&D Architecture Assistant

## 1. Data Structures
The application uses several key data structures to represent architectural knowledge and project state.

### 1.1 `Project`
The root container for all project-related information.
- `id`: Unique identifier for the project.
- `name`: Name of the project.
- `strategy`: Architectural strategy (MVP, Scale, Hybrid).
- `createdAt`: Timestamp of project creation.
- `updatedAt`: Timestamp of the last update.
- `messages`: Array of chat messages.
- `graph`: The current `KnowledgeGraph`.
- `tradeOffs`: Array of architectural trade-offs.
- `executiveSummary`: AI-generated executive summary.
- `syncIndex`: Index of the last message synchronized with the knowledge graph.

### 1.2 `KnowledgeGraph`
Represents the extracted architectural knowledge.
- `nodes`: Array of `KnowledgeNode` objects.
- `decisions`: Array of `Decision` (ADR) objects.
- `conflicts`: Array of `Conflict` objects.

### 1.3 `KnowledgeNode`
Represents a single architectural insight, constraint, or design element.
- `id`: Unique identifier for the node.
- `text`: Description of the node.
- `category`: Category of the node (Use Case, System Design, Implementation, Ambition, Constraint).
- `layer`: Architectural layer (Infrastructure, Data, Logic, Interface, Cross-cutting).
- `status`: Status of the node (Proposed, Verified, Discarded, Ambitious).
- `confidence`: Confidence score (0-100).
- `sourceMessageId`: ID of the message from which the node was extracted.

### 1.4 `Decision` (ADR)
Represents an Architecture Decision Record.
- `id`: Unique identifier for the decision.
- `title`: Title of the decision.
- `status`: Status of the decision (Proposed, Accepted, Deprecated, Superseded).
- `date`: Date of the decision.
- `deciders`: List of people involved in the decision.
- `summary`: Summary of the context and problem.
- `rationale`: Rationale for the decision.
- `pros`: List of advantages.
- `cons`: List of disadvantages.
- `layer`: Architectural layer.
- `confidence`: Confidence score (0-100).
- `relatedNodeIds`: IDs of related knowledge nodes.
- `supersedes`: ID of the decision this one supersedes.
- `amends`: ID of the decision this one amends.
- `sourceMessageId`: ID of the message from which the decision was extracted.

### 1.5 `Conflict`
Represents an architectural conflict or contradiction.
- `id`: Unique identifier for the conflict.
- `description`: Description of the conflict.
- `severity`: Severity level (Low, Medium, High).
- `nodeIds`: IDs of the conflicting knowledge nodes.

## 2. Algorithms
The application uses several algorithms for data processing and AI integration.

### 2.1 Knowledge Synthesis
The `synthesizeKnowledge` algorithm extracts structured architectural information from the chat history.
1. **Input:** The current chat history and the existing knowledge graph.
2. **Prompting:** Gemini is prompted to identify new nodes, decisions, and conflicts based on the latest messages.
3. **Merging:** The extracted data is merged with the existing knowledge graph, avoiding duplicates and updating existing nodes.
4. **Output:** An updated `KnowledgeGraph`.

### 2.2 Conflict Detection
The `synthesizeKnowledge` algorithm also includes conflict detection.
1. **Input:** The current knowledge nodes and decisions.
2. **Analysis:** Gemini analyzes the nodes and decisions for potential contradictions or overlaps.
3. **Output:** A list of `Conflict` objects.

### 2.3 Mermaid Generation
The `generateMermaid` algorithm converts the knowledge graph into Mermaid.js syntax for diagram rendering.
1. **Input:** The current `KnowledgeGraph`.
2. **Mapping:** Nodes and decisions are mapped to Mermaid syntax strings based on their categories and layers.
3. **Output:** A Mermaid.js diagram string.

### 2.4 Retry Logic
The `callGeminiWithRetry` algorithm handles Gemini API quota errors with exponential backoff.
1. **Input:** The API call parameters and retry configuration.
2. **Execution:** The API call is executed.
3. **Error Handling:** If a quota error (429) occurs, the algorithm waits for a specified delay (with exponential backoff) and retries the call.
4. **Output:** The successful API response or the last error.
