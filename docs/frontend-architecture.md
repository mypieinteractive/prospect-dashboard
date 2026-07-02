# Sproute Dashboard - Frontend Architecture

The Sproute Dashboard is a map-based routing application. It utilizes vanilla JavaScript (ES6 modules), HTML, CSS, and Mapbox GL JS without a complex build system.

## File Breakdown

### 1. `app.js`
The central entry point for the frontend application.
- **Responsibility:** Handles initial data load via `window.location.search` parameters (`view`, `userId`, `routeId`). Initializes Mapbox, manages the global `AppState` and `Config` objects, and acts as the bridge connecting UI events, logic processing, and map rendering.
- **Key Mechanics:**
  - Establishes persistent connection to the backend initialization endpoint (`/`).
  - Sets up the `AppState` object which holds the core data models (`orders`, `routes`, `globalHistory`, `dirtyRoutes`).
  - Distinguishes between 'Inspector', 'Manager', and 'ManagerSmall' views by setting `Config.viewMode` and toggling `body` CSS classes.

### 2. `logic.js`
Contains pure data manipulation, routing algorithms, and geographic calculations.
- **Responsibility:** Pre-optimization processing and frontend state logic.
- **Key Functions:**
  - `calculateClusters()`: Initializes a K-Means algorithm using an Angular Sweep around a start coordinate to partition unassigned orders into route clusters. Includes a dynamic priority weighting logic that acts as a gravitational pull for urgent orders.
  - Nearest Neighbor/TSP Algorithm: Used to provide immediate estimated time of arrivals (ETAs) prior to server-side optimization. It relies on the Haversine formula combined with configured order service delays.
  - State differentiation: Strictly distinguishes between an 'altered' route (sequence differs from original) and a 'dirty' route (physical changes like moved stops or endpoints exist).

### 3. `map.js`
Encapsulates all Mapbox GL JS interactions.
- **Responsibility:** Managing map layers, markers, clusters, and drawing route lines.
- **Key Mechanics:**
  - Reads directly from `AppState` or receives filtered data arrays from `app.js` to render visual points on the map.
  - Handles map click events, hover states, and drag-and-drop boundary logic.

### 4. `ui.js`
Manages the primary user interface elements excluding modals and direct rendering templates.
- **Responsibility:** Attaches event listeners, manages UI state (e.g., active view toggles, empty state visibility, side panel expand/collapse), and handles slider adjustments.
- **Key Mechanics:**
  - order numbers (display index) remain completely static and globally sequential during the staging phase. They are tied to a persistent `_originalIndex` assigned in `app.js`.
  - Exposes functions required by inline HTML `onclick` attributes to the global `window` object.

### 5. `ui-render.js`
Handles the dynamic generation of HTML strings based on current state.
- **Responsibility:** Building the DOM elements for the stop list, route summaries, and header statistics.
- **Key Mechanics:**
  - Uses `getVisualStyle` from `logic.js` to derive `bg`, `border`, and `text` hex codes for matching map pin colors, applying them directly to the CSS attributes of the DOM elements.

### 6. `ui-modals.js`
Handles the display, population, and interaction logic for overlay modals.
- **Responsibility:** Managing the 'Add Order' manual entry modal, the 'Send Route' email confirmation modal, and the 'Unmatched Address' resolution flow.
