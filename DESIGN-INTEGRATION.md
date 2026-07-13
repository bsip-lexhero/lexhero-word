# Lexhero design integration audit

Inspected source: `https://gitlab.com/lexhero-public/design.git`.

The design app uses Next.js 14, React 18, Panda CSS with the Park UI preset, Tailwind utilities, Ark UI, Lucide icons, and Motion. Its theme defines DM Sans intent; neutral ink/canvas/surface colors; pink accents (`#e93d82`, `#c72f70`, `#9b1b55`); success, warning, error, and info states; 4–8px radii; and light shadows.

Relevant inspected UI includes `auth-flow`, `app-shell`, `sidebar`, `prompt-box`, `ai-chat`, `chat-history`, `button`, `input`, `status-badge`, and Lexhero logo components. The source contains authentication, assistant/prompt, legal tools, history, buttons, forms, loading/error treatment, and branded assets. Citation/tool-call details required for the Office MVP were not complete task-pane components, so they were created consistently from the source tokens.

The Office task pane uses a single column, compact sticky brand header, selection excerpt, stacked controls, collapsed tool details, card-like treatment only where the selection/citation is an actual interaction unit, and a 2×2 action layout at narrow widths. Long citations use wrapping instead of tables. All controls have semantic labels, focus rings, keyboard access, text status in addition to color, and reduced-motion support.

Assets copied into the add-in are limited to the wordmark and three icon variants. The Panda generated runtime, desktop shell, editor, pricing, marketplace, and large media were intentionally excluded.
