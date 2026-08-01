# DocuMind

**Multi-Workspace Document Management Platform with AI-Powered Chat & Real-Time Collaboration**

DocuMind is a full-stack SaaS platform that lets teams organize, search, and collaborate on documents — with an AI assistant that can answer questions grounded in your own files. Built as my final year engineering project (PFE) during my internship at Trinovatech, and awarded the highest distinction on defense.

---

## 🚀 Overview

DocuMind solves a problem every team runs into: documents pile up across folders and nobody can find or reason over them fast enough. DocuMind combines a permission-aware document workspace with a Retrieval-Augmented Generation (RAG) pipeline, so users can chat with a single document, multiple documents, or an entire workspace and get answers grounded in the actual content — not hallucinations.

It's a production-shaped system: multi-tenant data isolation, real-time collaborative editing, subscription billing, and a full CI/CD pipeline — not a toy demo.

---

## ✨ Core Features

### 🔐 Multi-Workspace Access Control (RBAC)
- Workspace-based multi-tenancy with data fully isolated per workspace, folder, and member
- Granular role-based permissions (owner / admin / member) enforced at the API and query level
- Invitation system for onboarding teammates into a workspace

### 🤖 AI Chat (RAG Pipeline)
- Chat with a **single document**, a **selection of documents**, or an **entire workspace**
- Hybrid search combining `pgvector` semantic embeddings with PostgreSQL full-text search for more relevant retrieval
- Embeddings generated via Gemini, inference served through Groq (Llama models) for low-latency responses
- Answers are grounded in retrieved chunks, with source documents traceable

### 📝 Real-Time Collaborative Editing
- Multi-user collaborative document editing built on TipTap
- Live sync and conflict handling powered by Socket.IO
- Presence and concurrent edit state managed in real time

### 💳 Subscription Billing
- Stripe integration with Free / Pro / Enterprise tiers
- Plan-gated features and usage limits enforced server-side

### 🛠️ Platform & Ops
- Folder-based document organization with fine-grained sharing
- Admin activity logs for auditability
- PWA support for installable, app-like access

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React, TypeScript, TailwindCSS |
| Backend | NestJS, TypeScript, REST APIs |
| Database | PostgreSQL + `pgvector`, Prisma ORM |
| AI / RAG | Gemini (embeddings), Groq / Llama (inference), hybrid vector + full-text search |
| Real-time | Socket.IO, TipTap collaborative editor |
| Payments | Stripe (subscriptions, webhooks) |
| Infra | Docker, GitHub Actions (CI/CD), deployed on Render (backend) + Vercel (frontend) |
| Testing | Jest, Vitest, React Testing Library, Playwright (E2E) |

---

## 🏗️ Architecture

```
documind/
├── backend/          # NestJS API — auth, RBAC, RAG pipeline, billing, websockets
└── frontend/         # Next.js 15 app — dashboard, editor, chat UI
```

- **Backend**: NestJS with a modular architecture (auth, workspaces, documents, chat, billing, admin). Prisma manages the PostgreSQL schema; `pgvector` stores document embeddings alongside relational data for hybrid retrieval.
- **Frontend**: Next.js 15 (App Router) with server and client components, TipTap for the collaborative editor, and a Socket.IO client for real-time state.
- **Containerization**: Both services are Dockerized, with a `docker-compose` setup for local development matching production topology.

---

## ✅ Testing

The project ships with a full automated test suite rather than manual QA only:
- **Unit & integration tests** with Jest and Vitest across backend business logic and frontend components
- **Component tests** with React Testing Library
- **End-to-end tests** with Playwright covering critical user flows (auth, workspace access, document chat, billing)

---

## 🔄 CI/CD

Every push runs through a GitHub Actions pipeline that:
1. Installs dependencies and runs linting
2. Runs the automated test suite (unit, integration, E2E)
3. Builds both frontend and backend
4. Deploys automatically — backend to **Render**, frontend to **Vercel**

This kept the app deployable at all times during development and caught regressions before they reached production.

---

## 🐳 Docker

The full stack (frontend, backend, and PostgreSQL with `pgvector`) is containerized and can be spun up locally with Docker Compose, mirroring the production environment and removing "works on my machine" issues.

---

## 📌 Project Context

DocuMind was built as my End-of-Studies Project (PFE) for my Software Engineering degree at EPI International Multidisciplinary School, developed during my internship at **Trinovatech**. It was awarded the highest distinction on academic defense.

---

## 📄 License

**All rights reserved.**

This project and its source code are proprietary. No part of this repository may be copied, modified, distributed, or used in any form without explicit written permission from the author.

© Safwen Ben Mabrouk

---

## 📬 Contact

**Safwen Ben Mabrouk** — Full-Stack Software Engineer
- Email: safwenbenmabrouk@gmail.com
- LinkedIn: [linkedin.com/in/safwen-ben-mabrouk](https://linkedin.com/in/safwen-ben-mabrouk)
- GitHub: [@Safwen-bm](https://github.com/Safwen-bm)