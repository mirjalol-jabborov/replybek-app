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

## Dashboard workflows

The sidebar groups pages by workspace, setup, monitoring and management. Use its
collapse button to switch to icons; the choice is remembered in this browser. Small
screens use a separate navigation drawer. The sidebar stays fixed, with tighter spacing
and a compact usage display on shorter screens so account controls remain visible. **Quick search** (`⌘K` / `Ctrl+K`) opens
pages, agents and common setup tasks without navigating through menus.

Overview highlights the selected agent's next setup task. Agents supports search,
status filters, cards and a list view. Knowledge, Playground and Website widget share
an agent picker and a three-step setup bar. Knowledge provides direct website, file
and Q&A imports; Playground puts settings beside the test conversation; Website widget
combines customization, preview and installation. Playground uses the top breadcrumb
as its title to leave more vertical space for settings and chat. Existing Settings → Widget links still work.

Setup's test-completed marker is remembered per agent in this browser. Publication
and knowledge counts come from the API. The interface supports English, Uzbek and
Russian, and light/dark appearance. The sibling browser journey checks these flows,
sidebar persistence and layouts at desktop, tablet and phone widths. Sidebar transitions,
mobile drawer entry/exit, page transitions and button feedback respect reduced-motion settings.

## Integration setup

Open **Integrations → Add integration**. Start with forms, a cURL request, an OpenAPI
definition or an exported Replybek package. The workspace walks through connection,
actions, procedures, tests and review. The action editor has collapsible sections and a
live configuration summary; advanced JSON is optional.

Save a disabled draft to test it. Request previews and simulations send no business
requests. Live tests support GET reads; writes and POST reads use mock responses.
Saving a draft of an enabled integration disables it until **Save and enable** is used.
Connection changes invalidate earlier tests and customer sign-ins. Exported packages
exclude stored credentials; re-enter authentication and fixed values after import.

Run the backend migration when upgrading. `npm run build` checks the dashboard build;
the sibling `e2e` project exercises imports, mapping, procedures, test results, activation,
search and the desktop/mobile editors with a local fixture API.

### AI setup and admin-managed suggested questions

Playground → Agent settings → Suggested questions has English, Uzbek and Russian tabs with multiline editors, ordering and removal. Admins choose a fallback language. Missing translations use the fallback; explicitly clearing a language hides its questions. AI generation and translation are optional previews and never run on navigation. Save changes publishes the edited language lists to the widget.

Integrations → Add integration accepts documentation and a description of the tasks, users and access mechanism. “Prepare integration plan” proposes relevant actions and either a server connection, browser cookies or a frontend-supplied user credential. Ambiguous access requirements ask for clarification; the catalog is an optional expandable review list. Selection is no longer limited to ten actions. Generation runs in persisted batches with progress, cancel and retry; closing the modal does not discard the job. Review documentation coverage, generated actions and missing setup, then configure and test the connection before enabling it.

Frontend-token connections show the host callback contract in Connection. A developer must connect it to the application's current-user credential provider; the AI cannot implement or discover that function inside a separate business application. The credential must match the documented authentication scheme, and browser requests must target the widget's own origin.
