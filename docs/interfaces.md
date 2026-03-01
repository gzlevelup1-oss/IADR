# Interfaces - R&D Architecture Assistant

## 1. Project Interface
The `Project` interface represents the root container for all project-related information.
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

## 2. Knowledge Node Interface
The `KnowledgeNode` interface represents a single architectural insight, constraint, or design element.
- `id`: Unique identifier for the node.
- `text`: Description of the node.
- `category`: Category of the node (Use Case, System Design, Implementation, Ambition, Constraint).
- `layer`: Architectural layer (Infrastructure, Data, Logic, Interface, Cross-cutting).
- `status`: Status of the node (Proposed, Verified, Discarded, Ambitious).
- `confidence`: Confidence score (0-100).
- `sourceMessageId`: ID of the message from which the node was extracted.

## 3. Decision (ADR) Interface
The `Decision` interface represents an Architecture Decision Record.
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

## 4. Conflict Interface
The `Conflict` interface represents an architectural conflict or contradiction.
- `id`: Unique identifier for the conflict.
- `description`: Description of the conflict.
- `severity`: Severity level (Low, Medium, High).
- `nodeIds`: IDs of the conflicting knowledge nodes.

## 5. Trade-Off Interface
The `TradeOff` interface represents an architectural trade-off comparison.
- `id`: Unique identifier for the trade-off.
- `topic`: Topic of the trade-off.
- `optionA`: First architectural option.
- `optionB`: Second architectural option.
- `recommendation`: AI-recommended option.
- `strategyAlignment`: Alignment with the project strategy.

## 6. Message Interface
The `Message` interface represents a single chat message.
- `id`: Unique identifier for the message.
- `role`: Role of the message sender (User, Model).
- `text`: Text content of the message.
