# Sproute Dashboard - UI Developer Guide

## View Modes

The dashboard supports three distinct visual paradigms governed by URL parameters (e.g., `?view=inspector`):
1. **Inspector (`view-inspector`)**: A read-only, streamlined view for drivers. It hides the side panel route view toggles, disables drag-and-drop ordering, and replaces the global header actions with a simple "Restore" button.
2. **Manager (`view-manager`)**: The full desktop dispatch view. Includes the left sidebar with order lists, route toggles, the main map interface, and comprehensive global action buttons (Add Order, Optimize, Send Route).
3. **ManagerSmall (`view-managersmall`)**: A mobile-optimized view for dispatchers. It hides the sidebar by default, utilizing a floating action button (FAB) to toggle between the map and list views.

These views are enforced via `<body>` CSS classes (e.g., `<body class="view-manager">`) which handle the structural display logic, combined with JavaScript `Config.isManagerView` checks to prevent unauthorized actions.

## DOM Structure Highlights

- `#app-body-wrapper`: The main flex container holding the map and sidebar.
- `#map-wrapper`: Contains the Mapbox instance and overlay controls.
- `#sidebar`: Contains the address list, search bar, and route toggles.
- `#global-header`: Fixed top navigation bar.

## State & UI Sync

The UI is entirely dependent on the global `AppState` object defined in `app.js`.
- **Order Numbers**: During the staging phase (before hitting 'Optimize'), the display numbers in the UI remain entirely static, tied to `_originalIndex`. They do not reorder when dragged; they only visually group. This prevents confusion during rapid multi-route adjustments.
- **Route Colors**: The UI elements (list backgrounds, borders, text) dynamically fetch hex values from `logic.js -> getVisualStyle()` to ensure 1:1 parity with the map markers.

## Event Handling

Because the frontend uses ES6 modules, functions defined inside `ui.js`, `app.js`, etc., are scoped locally. To allow the inline HTML attributes (like `onclick="handleGenerateRoute()"`) to function, these methods must be explicitly assigned to the `window` object within the Javascript files.
