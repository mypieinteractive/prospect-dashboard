# Sproute Dashboard

The Sproute Dashboard is a comprehensive, map-based routing and dispatch application. It provides distinct views for dispatchers (desktop/mobile) to upload orders, optimize routes using K-Means clustering and TSP algorithms, and a streamlined view for drivers to execute those routes.

This repository encompasses both the vanilla JavaScript/Mapbox frontend and the Node.js/Express/Firebase backend API.

## Documentation Reference

For detailed context, architecture breakdowns, and schema definitions, please refer to the following documentation files located in the `docs/` folder:

- **[Frontend Architecture](docs/frontend-architecture.md)**: Detailed breakdown of the core client-side JavaScript files (`app.js`, `logic.js`, `map.js`, etc.) and their specific responsibilities.
- **[UI Developer Guide](docs/ui-developer-guide.md)**: Explanation of the view modes (Inspector, Manager, ManagerSmall), DOM structure, state synchronization, and event handling nuances.
- **[Backend Architecture](docs/backend-architecture.md)**: Overview of the Express server (`index.js`), the webhook handlers, pre/post optimization flows, and the unified API structure.
- **[Database Schema](docs/database-schema.md)**: Details the separation of concerns within Firestore between active `Users` configurations and locked `Dispatch` documents.

## Tech Stack Overview

**Frontend:**
- HTML / CSS
- Vanilla JavaScript (ES6 Modules)
- Mapbox GL JS (v3.0.1)
- SortableJS (Drag and Drop)

**Backend:**
- Node.js (v20)
- Express.js
- Firebase Admin SDK (Firestore Database)
- Google Cloud Build / Trivy (CI/CD)

*Note: The frontend operates without a complex build step (e.g., Webpack/Vite) and should be served via a local HTTP server during development due to ES6 module CORS restrictions.*
