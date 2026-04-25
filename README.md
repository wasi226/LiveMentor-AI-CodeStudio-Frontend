# LiveMentor AI CodeStudio Frontend

![AI Pair Programmer](https://img.shields.io/badge/AI%20Pair%20Programmer-Implemented-22c55e)

Frontend application for LiveMentor, built with React and Vite.

This app provides role-based dashboards for students and faculty, classroom participation workflows, and a coding-first UI connected to the backend API.

## Highlights

- React 19 with Vite
- Role-based auth flows
- Student and faculty dashboards
- Classroom join via invite code
- React Query server state management
- Component-driven UI with Tailwind and Radix
- AI Pair Programmer panel with explain, review, and smart completion actions

## AI Pair Programmer Status

The AI Pair Programmer features documented in the project are now implemented in the classroom AI panel.

- AI-based code explanation
- Bug detection and optimization suggestions
- Smart code completion and logic recommendations

Frontend integration points:

- src/components/classroom/AIAssistant.jsx
- src/services/aiPairProgrammer.js

## Tech Stack

- React 19
- Vite
- React Router
- TanStack React Query
- Tailwind CSS
- Radix UI
- Framer Motion

## Project Structure

- src/App.jsx: app shell and routing
- src/pages: route pages and dashboards
- src/components: reusable UI and feature components
- src/lib/AuthContext.jsx: auth state and backend communication
- src/services: feature-level service helpers

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- Running backend API

## Environment Setup

Create a .env file in Frontend and set:

```env
VITE_API_BASE_URL=http://localhost:3001
```

Use your deployed backend URL in production.

## Install and Run

```bash
npm install
npm run dev
```

Default local URL:

- http://localhost:5173

## Available Scripts

- npm run dev: start Vite dev server
- npm run build: production build
- npm run preview: preview built app
- npm run lint: run eslint

## Backend Connection

Auth and API requests use VITE_API_BASE_URL from src/lib/AuthContext.jsx and page-level requests.

If login, classroom loading, or joins fail in production, first confirm:

- Frontend env points to the correct backend URL
- Backend CORS_ORIGIN includes your frontend domain
- Backend service is healthy at /health

## Deployment

Recommended free option:

- Vercel Hobby

Vercel settings:

- Root directory: Frontend
- Build command: npm run build
- Output directory: dist
- Environment variable: VITE_API_BASE_URL=<your-backend-url>

Because this is a React SPA, configure a rewrite so all non-file routes resolve to index.html.

## Troubleshooting

- Blank data after deploy: usually wrong VITE_API_BASE_URL.
- 401 responses: user token expired or backend JWT settings mismatch.
- Route 404 on refresh: missing SPA rewrite rule in host configuration.

## License

MIT
