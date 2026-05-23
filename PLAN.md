# Goal
Rebuild Tide of Coral Hollow with an artistic 3D game aesthetic, full-screen game UI instead of dashboard UI, mobile landscape fit, double-tap zoom prevention, and visible loading feedback during sign-in/sign-up.

# Files to touch
- `index.html` for viewport rules that prevent double-tap zoom on mobile.
- `src/main.js` for the rebuilt pseudo-3D canvas game, game HUD, combat, shop interactions, auth loading states, and mobile input handling.
- `src/styles.css` for the artistic game UI, landscape layout, safe-area sizing, and loading indicators.
- `README.md` for updated gameplay and mobile notes.
- `package.json`, `.env.example`, `.gitignore`, `vite.config.js`, and `supabase/schema.sql` for build/backend configuration.

# Verification approach
- Confirm the existing prefixed Supabase progression table still has RLS and grants.
- Run a production build.
- Drive real Supabase auth and RLS checks against the progression table.
- Use Playwright against the built app in mobile portrait and landscape viewports to verify loading UI, sign-up/sign-in, joystick movement, combat, shop purchase, level progression, no console/network failures, and no double-click zoom.
- Deploy the verified `dist/` preview.

# Out of scope
- True WebGL/Three.js rendering, multiplayer, server-authoritative combat, paid purchases, and custom audio assets.
