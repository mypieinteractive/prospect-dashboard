# Sproute Dashboard - Database Schema

The application uses Google Cloud Firestore. The data architecture fundamentally separates active, editable dispatch sessions from fixed, read-only driver sessions.

## 1. `Users` Collection (Manager/ManagerSmall Views)
This collection holds the state for active dispatching. The dashboard accesses multiple documents within a user's subcollections.

**Structure:**
- `Users / {userId}`
  - **Document Fields:** Global configuration, user preferences, company details.
  - **Subcollections:**
    - `Orders`: Individual documents representing unassigned or actively staged stops.
    - `Routes`: Documents representing the current state of a route (e.g., driver assignment, vehicle capacity, start/end points).

## 2. `Dispatch` Collection (Inspector View)
This collection represents a finalized, "locked" route sent to a driver. It is heavily denormalized for rapid read access.

**Structure:**
- `Dispatch / {routeId}`
  - **Document Fields:** Contains *all* data required for the Inspector view in a single document.
    - `driverId`: The assigned driver.
    - `orders`: An array of order objects in their finalized, optimized sequence.
    - `metadata`: Route summary stats (total distance, time).
    - `mapSnapshot`: Base64 string of the route map preview.

## Key Concept: The Hand-off
When a Manager clicks "Send Route", the backend takes the data from the `Users/{userId}/Orders` and `Users/{userId}/Routes` subcollections, flattens the finalized sequence into an array, and creates a new document in the `Dispatch` collection. The URL sent to the driver uses this new `Dispatch` document ID, ensuring they see an isolated, immutable snapshot of the route.
