# Roadmap: R&D Architecture Assistant

This document outlines the strategic vision and upcoming milestones for the R&D Architecture Assistant.

## Phase 1: Persistence & Security (Near-Term)
Currently, the application relies on local state for session management. The immediate goal is to make it a robust, multi-session tool.

*   [ ] **User Authentication:** Implement OAuth (GitHub, Google) for secure user login.
*   [ ] **Cloud Persistence:** Migrate from local state to a managed database (e.g., PostgreSQL or Firebase) to save projects, chat histories, and knowledge graphs across sessions.
*   [ ] **Project Workspaces:** Allow users to organize projects into team workspaces with role-based access control (Admin, Architect, Viewer).
*   [ ] **API Key Management:** Allow users to securely store their own Gemini API keys per workspace.

## Phase 2: Real-Time Collaboration (Mid-Term)
Architecture is a team sport. This phase focuses on bringing multiple minds together in the same context.

*   [ ] **Multiplayer Graph:** Implement WebSockets (e.g., Yjs or Socket.io) to allow multiple users to view and interact with the Knowledge Graph simultaneously.
*   [ ] **Live Chat & Presence:** Show active users in a project and allow team members to chat with each other alongside the AI.
*   [ ] **ADR Threading:** Add comment threads to specific Architecture Decision Records (ADRs) so teams can debate proposals before accepting them.
*   [ ] **Conflict Notifications:** Push notifications or email alerts when the AI detects a new architectural conflict based on recent team discussions.

## Phase 3: Advanced Integrations & Verification (Long-Term)
Bridge the gap between architectural design and actual implementation.

*   [ ] **VCS Integration (GitHub/GitLab):** Link ADRs directly to pull requests or commits. Automatically sync accepted ADRs to a `docs/adr` folder in the target repository.
*   [ ] **Codebase RAG (Retrieval-Augmented Generation):** Allow the AI to ingest the actual codebase and verify if the implemented code aligns with the accepted ADRs (Architecture Drift Detection).
*   [ ] **C4 Model Export:** Enhance the graph visualization to support standard C4 model exports (Context, Container, Component, Code).
*   [ ] **Jira/Linear Integration:** Automatically convert architectural "Insights" or "Decisions" into actionable tickets in project management tools.
