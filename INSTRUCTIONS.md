# Pulse Implementation Notes

Pulse is an office work-management product. Treat it as a Monday-style workspace for planning, dashboards, boards, automations, and multiple execution views.

## Product Direction
- The app should feel like a work operating system for office teams.
- Boards should support planning and execution workflows, not backend demos.
- Default workflows include operations, launches, approvals, recruiting, and cross-functional projects.
- Views should support table, Kanban, and Gantt-style planning where possible.

## Routing
- The app uses `HashRouter`.
- Internal routes currently used by the SPA:
  - `#/app/dashboard`
  - `#/app/boards`
  - `#/app/automations`
  - `#/app/settings`

## Writing Rules
- Keep all user-facing copy in English unless the user explicitly requests another language.
- Keep the product name as `Pulse`.

## Data Layer
- Do not reintroduce backend-specific coupling or integration-branding into the product copy.
- Prefer local workspace state or product-oriented abstractions over integration demo code.
