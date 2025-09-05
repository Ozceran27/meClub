# Manual Tests

## Sidebar initial state

1. Start the web client:
   ```bash
   npm run web --prefix meClub
   ```
2. Log in as a club user so that the `Dashboard` screen renders.
3. Confirm the following:
   - In the sidebar, the **Inicio** item is highlighted on first load.
   - The main content shows the **Inicio** screen summary.
4. Click another sidebar item such as **Reservas** and verify the highlight moves accordingly.
5. Reload the page or navigate away and back to the dashboard. The **Inicio** item should again be highlighted by default.
