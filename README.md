# Tide of Coral Hollow

Mobile-first canvas RPG set in a fallen coral city with Supabase-backed progression.

## What is included

- Artistic pseudo-3D reef arena with shadows, parallax bubbles, glowing coral props, and depth-sorted monsters.
- Full-screen game UI with HUD plaques, mission ribbon, joystick, strike button, compact shop cards, and no dashboard panels.
- Mobile-safe controls that prevent double-tap zoom and fit both portrait and horizontal mobile browsers.
- Four escalating levels with Glass Eels, Kelp Stalkers, Crab Wardens, and Crown Leviathans.
- Real-time canvas combat with keyboard fallback (`WASD` / arrow keys + space), touch joystick, and point rewards.
- A reef shop where players buy weapons and power-ups with earned pearl points.
- Supabase Auth plus a user-scoped progression table for saved points, max level, and loadout.
- Loading feedback during sign-in, sign-up, password recovery, and saved progress loading.

## Setup

Copy `.env.example` to `.env` and fill in the Supabase browser values:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_TABLE_PREFIX=...
```

Install and run:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Supabase table

The app reads and writes to `<VITE_TABLE_PREFIX>_diver_progress`. `supabase/schema.sql` contains the applied table definition, RLS policy, grants, and user-id index.
