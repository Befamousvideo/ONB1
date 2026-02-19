# Architecture Decisions Log

## ADR-001: Initial stack selection

- Status: Accepted
- Date: 2026-02-07
- Decision:
  - Use Next.js + TypeScript for frontend.
  - Use FastAPI for backend API.
  - Keep OpenAPI contract at repository root.
- Rationale:
  - Fast iteration with strong ecosystem support.
  - Clear separation between UI and API services.
- Consequences:
  - Mixed Node.js + Python toolchains required locally and in CI.
