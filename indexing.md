# Disha Diagnostics Phlebotomy Suite - Codebase Indexing

This document provides a comprehensive index of the application's codebase, organized by functional area.

## 1. Core Application Logic
*   **`App.tsx`**: The central nervous system of the app. It handles:
    *   Authentication and session management.
    *   Global state for calls, phlebotomists, labs, and system config.
    *   Routing between **Field Ops** (Phlebo), **Dispatch** (Dashboard), and **Admin** views.
*   **`types.ts`**: The source of truth for data structures. Defines enums like `CallStatus`, `PaymentMode`, and interfaces for `CollectionCall`, `Phlebotomist`, and `SystemConfig`.
*   **`constants.ts`**: Stores static data including the diagnostic test catalog, default system rates, geofence settings, and initial mock users.

## 2. User Interfaces (Views)
*   **`PhleboApp.tsx`**: The mobile-first interface for field staff. Features include:
    *   Task acceptance and GPS-verified arrival (geofencing).
    *   Evidence capture (Visit/Sample photos).
    *   **Voice Note** recording for field context.
    *   UPI payment integration and appointment scheduling.
*   **`Dashboard.tsx`**: The Dispatcher portal. Used for:
    *   Deploying new collection calls.
    *   Monitoring the active queue in real-time.
    *   Quotation generation for diagnostic tests.
*   **`AdminPanel.tsx`**: The high-level management suite. Includes:
    *   **Fleet Radar**: Visual tracking of phlebotomist nodes.
    *   **Staff Roster**: Onboarding and access control.
    *   **Finance Ledger**: Revenue tracking and PDF report generation.
    *   **System Config**: Adjusting TAT (Turnaround Time) brackets and incentive rates.

## 3. Utilities & Services
*   **`geoUtils.ts`**: Contains the mathematical logic for the geofencing engine, including distance calculations (Haversine formula) and coordinate validation.
*   **`geminiService.ts`**: (Located in `/services/`) Provides integration with the Gemini API for intelligent data processing or assistance features.
*   **`pdfUtils.ts`**: (Located in `/utils/`) Helper functions for generating structured PDF documents (like the Finance Ledger).

## 4. Infrastructure & Configuration
*   **`index.html`**: The entry point, configured with mobile-specific meta tags for iOS/Android "Add to Home Screen" support (PWA).
*   **`manifest.json`** & **`sw.js`**: PWA (Progressive Web App) configuration for offline capability and app-like behavior.
*   **`vite.config.ts`**: Build system configuration, including environment variable injection for API keys.
*   **`capacitor.config.ts`**: Settings for wrapping the web app into a native mobile binary using Capacitor.

## 5. Visual Assets
*   **`LogoBird.tsx`**: A custom SVG component that renders the "Disha Bird" logo used throughout the branding.

---

## Data Flow Summary
1.  **Dispatcher** creates a call in `Dashboard.tsx`.
2.  **App.tsx** broadcasts the new call to the global state.
3.  **Phlebotomist** sees the call in `PhleboApp.tsx`, accepts it, and navigates to the patient.
4.  **GeoUtils** validates the phlebotomist's location against the geofence.
5.  **Admin** monitors performance and revenue in `AdminPanel.tsx` based on completed tasks.
