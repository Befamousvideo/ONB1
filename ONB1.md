# ONB1 Living Specification

## Purpose

This document is the single source of truth for project scope, architecture, and implementation decisions during early bootstrapping.

## Architecture Overview

- Frontend: Next.js (App Router) + TypeScript under web/.
- Backend API: FastAPI (Python) under server/.
- API Contract: openapi.yaml at repository root (initial stub).
- Documentation: Project docs in docs/.
- Data Layer: Reserved db/ directory for schema/migrations.

## Chosen Stack

- Frontend: Next.js 14, React 18, TypeScript 5.
- Backend: FastAPI + Uvicorn, Python 3.11+.
- CI/CD: GitHub Actions workflow for documentation discipline.

## Folder Structure

- web/ — Next.js frontend scaffold.
- server/ — FastAPI API scaffold.
- db/ — placeholder for database artifacts.
- docs/ — architecture/decision documents.
- .github/workflows/ — CI checks.
- openapi.yaml — API spec stub.
- .env.example — planned environment variables.

## Development Rules

- No feature work should begin until this document and decision logs are updated.
- Any change under server/ or db/ must include an ONB1.md update.

## Changelog

- _No entries yet._
