# Replybek dashboard

The web app businesses use: sign in, agents, knowledge, Playground, Inbox, analytics and
settings. React 18 + Vite, plain JavaScript, no UI library: the component system is in
`src/components/` (dialogs, drawers, menus and selects with keyboard support, tables, toasts).

## Run

1. Start the API first (`replybek-backend`: `npm run db:up`, then `npm run dev`).
2. `npm install`, then `npm run dev`. Open http://localhost:5173.

The app calls the API through `/api` on its own address (Vite proxies it to
`http://localhost:3100`; set `REPLYBEK_API` to change that), so the session cookie stays first-party.

Build settings: `VITE_WIDGET_SRC` (where `replybek-widget.js` is hosted) and
`VITE_PUBLIC_API` (the API address websites call) fill in the embed code shown in Settings.

Screens refresh themselves: the Inbox every 5 s (an open conversation every 4 s), and knowledge
sources every 2 s while any are processing.
