# Roadmap - R&D Architecture Assistant

This roadmap outlines the planned features and improvements for the R&D Architecture Assistant.

## Phase 1: Enhanced Visualization & Analysis
- [ ] **Interactive Graph View (D3.js):** Upgrade the current graph view with a force-directed layout, node dragging, and zoom/pan capabilities for better exploration of large systems.
- [ ] **Advanced Mermaid Integration:** Automatically generate Sequence, Class, and ER diagrams based on the extracted Knowledge Map.
- [ ] **Context-Aware Suggestions:** AI-driven suggestions for architectural patterns (e.g., Microservices, Event-driven) based on the current requirements and constraints.
- [ ] **Multi-Model Comparison:** Allow users to run the same architectural query against different models (e.g., Gemini 3 Flash vs. Pro) to compare design trade-offs.

## Phase 2: Knowledge & Data Integration
- [ ] **Document Ingestion:** Support for uploading existing documentation (PDF, Markdown, Text) to provide deeper context for the AI during brainstorming sessions.
- [ ] **Cloud Pricing Integration:** Estimate infrastructure costs based on the designed architecture by integrating with public cloud pricing APIs.
- [ ] **Design Pattern Library:** A built-in library of common architectural patterns and best practices that can be applied to the current project.

## Phase 3: Ecosystem & Workflow
- [ ] **Git Integration:** Synchronize ADRs and generated documentation directly with GitHub or GitLab repositories.
- [ ] **Issue Tracker Export:** Export architectural requirements and tasks directly to Jira, Linear, or GitHub Issues.
- [ ] **VS Code Extension:** A companion extension to view the Knowledge Map and ADRs directly within the IDE.
- [ ] **Custom Export Templates:** Allow users to define their own Markdown templates for SRS and ADR reports.

---
*Note: Authentication and Cloud Persistence are currently deferred as per user request.*
