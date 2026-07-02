# Sproute Dashboard - Backend Architecture

The backend is built on Node.js using Express, functioning primarily as an API gateway and webhook handler for the frontend dashboard, Glide applications, and Google Apps Script workers. It leverages Firebase Admin SDK to interact with Firestore.

## File Breakdown

### 1. `index.js`
The primary Express server entry point.
- **Responsibility:** Initializes Firebase Admin, configures Express middleware (CORS, JSON parsing), and acts as a central router routing incoming GET/POST requests to modular controller functions.
- **Key Mechanics:**
  - Exposes `GET /` for initial dashboard load (`getDashboardInit`).
  - Exposes `GET /dispatchData/:id` specifically tailored to serve large, base64-heavy Dispatch documents to Google Apps Script.
  - Exposes `POST /` utilizing a switch statement on `req.body.action` to route requests to specific handlers.

### 2. `/backend/glideWebhooks.js`
Handles inbound webhooks from the Glide Admin portal.
- **Responsibility:** Syncing configuration data (users, companies, CSV settings, endpoints) from the Glide UI into the Firestore database.

### 3. `/backend/initialization.js`
Handles the initial data request when the dashboard loads.
- **Responsibility:** Returns the necessary initial state (orders, user configs, route settings) based on the provided `userId` or `routeId` and `view` mode.

### 4. `/backend/preOptimization.js`
Handles data ingestion and preparation.
- **Responsibility:** Parsing uploaded CSVs (`uploadCsv`), handling unmatched addresses via geographic lookups or user correction (`resolveUnmatchedAddress`), and general CRUD operations on orders before they are committed to a route.

### 5. `/backend/optimization.js`
The core external routing integration file.
- **Responsibility:** Constructs payloads and communicates with the external Route Optimization engine (e.g., OSRM, OR-Tools, or a proprietary solver) via `generateRoute`. Includes logic for `calculate` to update ETAs based on existing sequences.

### 6. `/backend/postOptimization.js`
Handles data persistence after routes are generated.
- **Responsibility:** Saving the optimized state to Firestore (`saveRoute`), reverting states (`resetRoute`, `restoreOriginalRoute`), and moving the confirmed data into the `Dispatch` collection for the driver view (`dispatchRoute`).

### 7. `/backend/zeptoMailer.js`
Utility module for email communications.
- **Responsibility:** Formatting and dispatching emails via ZeptoMail containing the finalized route summaries and driver links.

## API Structure

The application heavily utilizes a single `POST /` endpoint design pattern, differentiating operations via an `action` string in the request body payload.

**Request Format:**
```json
{
  "action": "updateOrder",
  "payload": {
    "orderId": "123",
    "status": "completed"
  }
}
```
