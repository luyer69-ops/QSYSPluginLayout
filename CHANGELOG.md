# Changelog

## 1.0.1
### Fixes
- Button controls with an `Icon` property now render it in the canvas preview.
- Base64 icons (IconType = `Image` or `Svg`) are shown as an `<img>` element.
- Path-type icons (IconType = `Icon`) show a placeholder symbol (✦).
- Icon + Legend text layout uses flexbox column with 2px gap.
- `renderLed()` now explicitly sets `border-radius: 50%`, ensuring a circular preview regardless of CSS cascade.
- `lp.Padding` and `lp.Margin` from layout properties are now applied as inline CSS `padding` / `margin` on the control body, so the canvas reflects the configured values.
- Both are reset in `cleanupStyleElements()` when switching between control styles.
- The `object:updated` handler now only triggers a full re-render when the object kind or visible text has changed, avoiding unnecessary DOM rebuilds on every property change.
- **`gp.Text` unescaped in Lua codegen** — Labels and GroupBox text containing `\`, `"`, or newlines were emitted verbatim, producing invalid Lua. Fixed by wrapping with `luaEscape()` in `js/lua-codegen.js`.
- **`gp.Image` unescaped in Lua codegen** — Same issue for Image/SVG `Image` property. Fixed in `js/lua-codegen.js`.
- **`luaEscape` not exported** — Was a private function in `lua-codegen.js`; needed by `lua-importer.js`. Fixed by adding `export` keyword.
- **LED not explicitly circular** — `renderLed()` relied on CSS class for `border-radius`; explicit `50%` added for robustness.
- **Button icons never rendered on canvas** — `renderButton()` ignored `lp.Icon` entirely. Now renders base64 and path-type icons.
- **Stale inline styles after control style switch** — `padding`, `margin`, `flexDirection`, and `gap` were not reset in `cleanupStyleElements()`, causing style bleed between control types. Fixed.

### New Features
- New **Import .qplug** toolbar button imports existing Q-SYS plugin files.
- Static text parser (no Lua execution): reads `PluginInfo`, `GetControls`, `GetControlLayout`, `GetPins`.
- Detects control arrays (Count > 1 or "Name N" layout entries).
- Reconstructs multi-page layouts (best-effort; multi-page controls assigned to "All Pages" with warning toast).
- Non-fatal issues logged as `_warnings` and surfaced as a warning toast in the UI.
- New **⌨ Shortcuts** button in the toolbar opens a reference modal.
- Groups: Selection, Editing, Movement & Resize, Alignment, Z-Order, Pages.
- Dismissible via Escape or clicking the overlay.
- Visual `#save-indicator` element in the toolbar shows **Saving…** → **Saved ✓** → idle cycle.
- On LocalStorage write error: displays **Save error** in red.
- Clears back to idle 3 seconds after a successful save.
- `showToast(message, type, duration)` — types: `info` (blue), `success` (green), `warning` (orange), `error` (red).
- Auto-dismisses after `duration` ms (default 3500). Click-to-dismiss supported.
- Stacks vertically in bottom-right corner; CSS transition animation.
- Search input added to the top of the Outline panel.
- Filters items by name in real time; hides empty group headers.
- Escape key clears the filter.
- `isValidLuaIdentifier(name)` rejects characters that break Lua string literals: `\`, `"`, newlines, tabs.
- Name field in the Properties panel shows an inline red border + error message for invalid input; does not apply the value until valid.
- Duplicate name detection now shows an error toast instead of `alert()`.
- `FIELD_LIMITS` constant defines min/max for all numeric properties:
  `FontSize`, `StrokeWidth`, `CornerRadius`, `Margin`, `Padding`, `X`, `Y`, `Width`, `Height`, `ZOrder`, `Count`.
- All numeric rows in the Properties panel clamp input to these limits.
- New optional **ClassName** field in the Advanced section of control properties.
- Emitted as `ClassName = "value"` in `GetControlLayout` when non-empty.

### Still Deferred (Known Limitations that remain)
|     Limitation                           |     Reason                                                       |
|------------------------------------------|------------------------------------------------------------------|
| `CustomButtonUp` / `CustomButtonDown`    | Requires knowing exact Q-SYS base64 format and interaction model |
| `Media` layout style                     | Requires reference documentation on Q-SYS Media control behavior |
| Pixel-accurate canvas rendering          | Q-SYS uses a proprietary rendering engine                        |
| Dark/light color inversion               | Internal Q-SYS Designer behavior; not publicly documented        |
| Font rendering differences               | Browser font engine vs Q-SYS native engine                       |
| Meter/Fader static preview               | Runtime state cannot be simulated in a layout editor             |
|------------------------------------------|------------------------------------------------------------------|


## 1.0.0
### Main Features
- Wireframe canvas editor with drag, resize, and snap-to-grid
- Control types: Button, Knob/Fader, Indicator, Text (ComboBox, ListBox, Meter)
- Graphic types: Label, GroupBox, Header, Image, SVG
- Multi-page support with per-page canvas sizing
- Control arrays (Count > 1) with automatic sibling expansion
- Properties panel with full control/layout/graphic property editing
- RGBA color support: alpha channel (0–100%) for Color, Fill, and StrokeColor properties
- Outline view grouped by page, mirroring canvas selection
- Alignment, distribution, packing, sizing, and centering operations
- Configurable alignment anchor (first-selected or last-selected)
- Z-order management (bring to front, send to back)
- Lua code generation: `PluginInfo`, `GetProperties`, `GetControls`, `GetControlLayout`, `GetPages`, `EventHandler` stubs
- PluginInfo and GetProperties always emitted (required by Q-SYS); warning indicators when PluginInfo is incomplete
- Lua syntax highlighting in output panel with auto-generation (manual refresh available via icon)
- Save/load projects as JSON
- Auto-save to localStorage
- Undo/redo with coalesced drag and keyboard movement batching
- Keyboard shortcuts: arrow move/resize, delete, duplicate, select all, page navigation, alignment, z-order, undo/redo
- Shift+click toolbox items to add at canvas center
- Double-click canvas objects to focus Name/Text property
- Hold Ctrl/Cmd while dragging to bypass grid snapping
- Two-row toolbar: file/modal buttons on top, alignment/arrangement on bottom
- Dark/light canvas theme toggle for previewing layouts against both backgrounds
- Auto-generated Status control placed on canvas for new projects (configurable in settings)
- Improved control rendering: Knob (semicircle pie chart), Fader (orientation-aware with proportional track/thumb), Button (gloss effect), LED (circle), Meter (vertical bar fill)
- GroupBox renders with fieldset/legend style (text inset into top border), matching Q-SYS appearance
- DOM structure: outer `.canvas-object` (positioning, selection, resize handles) wrapping inner `.control-body` (visual content with overflow:hidden)
- Properties panel values apply on blur (click off) as well as Enter
- StrokeWidth validated to 0–64 range
- Grid, snap, and canvas size settings in Settings modal
- Application settings with persistent storage
- Audio/serial pin editor (`GetPins`) with toolbar modal
- Design-time property editor (`GetProperties` / `RectifyProperties` stub) with card-based modal
- Header comments in generated Lua (plugin name, author, auto-generated date)
- Persistent author name setting, auto-filled into PluginInfo Author
- Lua code highlighting when a control or graphic is selected on the canvas
- Toolbar buttons disable when selection count is insufficient for the operation
- Startup disclaimer modal with "Don't show again" option
- Known limitations section in help documentation
- Privacy policy page
- Emergency localStorage reset via `?reset=true` URL parameter
