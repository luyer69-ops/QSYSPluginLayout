# Q-SYS Plugin Layout Editor

<img width="1202" height="793" alt="image" src="https://github.com/user-attachments/assets/18ff4dc5-dfac-4aba-aa5d-19c4bb6c646e" />

A browser-based visual editor for designing Q-SYS plugin control layouts. Drag controls and graphics onto a canvas, configure their properties, and the editor generates the boilerplate Lua code required for a `.qplug` file.
All project data is stored locally in your browser. Nothing is sent to or stored on any server.

## Features 
- Drag-and-drop canvas with snap-to-grid and smart alignment guides
- Control types: Button, Knob / Fader, Indicator (LED, Meter, Status), Text / ComboBox / ListBox
- Graphic types: Label, GroupBox, Header, Image, SVG
- Multi-page layouts with per-page object scoping
- Lua code generation (GetControls + GetControlLayout + runtime stubs)
- Import existing `.qplug` files (static Lua parser — no execution)
- Undo / redo (50 levels), copy / paste, duplicate
- 23 alignment and distribution operations
- Auto-save to LocalStorage with visual save indicator
- Toast notifications replacing browser `alert()` dialogs
- Keyboard shortcuts dialog (press ⌨ Shortcuts in the toolbar)

## Running Locally

No build step required. Open `layout.html` in a modern browser (Chrome 98+, Firefox 94+, Safari 15.4+).

```
# Serve with any static file server, e.g.:
npx serve .
# or
python -m http.server
```

> Direct `file://` opens may block ES module imports in some browsers. Use a local server.

## Project Structure

```
QSYSLayoutEditor/
├── layout.html           Main HTML entry point
├── style.css             Application styles (dark theme)
├── js/
│   ├── main.js           App initialization and keyboard shortcuts
│   ├── data-model.js     Central data management (objects, pages, undo)
│   ├── canvas.js         Canvas rendering, drag, resize, smart guides
│   ├── canvas-object.js  DOM element creation for each control/graphic type
│   ├── event-bus.js      Pub/sub event system
│   ├── settings.js       LocalStorage-based user preferences
│   ├── schema.js         Control/graphic type definitions and defaults
│   ├── selection.js      Selection state management
│   ├── undo-manager.js   Snapshot-based undo/redo with batch support
│   ├── lua-codegen.js    Lua code generation
│   ├── lua-highlight.js  Syntax highlighting for Lua output
│   ├── lua-importer.js   Static parser for importing .qplug files
│   ├── notifications.js  Toast notification system
│   ├── properties-panel.js  Dynamic property editor panel
│   ├── toolbox.js        Drag-drop control creation from toolbox
│   ├── alignment.js      Alignment and distribution functions (23 ops)
│   ├── toolbar.js        Toolbar button handlers
│   ├── page-tabs.js      Multi-page UI
│   ├── outline.js        Tree view of objects with filter
│   ├── utils.js          Shared utilities (deepClone, colors, validation)
│   ├── modal-settings.js
│   ├── modal-plugin-info.js
│   ├── modal-pins.js
│   ├── modal-design-props.js
│   └── modal-shortcuts.js   Keyboard shortcuts reference modal
└── help/help.html        User documentation
```

## Importing `.qplug` Files

Click **Import .qplug** in the toolbar and select a `.qplug` or `.lua` file. The importer performs static text parsing of:

- `PluginInfo` → plugin metadata
- `GetControls` → control definitions
- `GetControlLayout` → positions, sizes, and visual properties
- `GetPins` → audio/serial pin definitions

**Limitations of static import:**
- Dynamic Lua expressions in position/size fields are not evaluated
- Controls in multi-page layouts are assigned to "All Pages" and must be reassigned manually
- Highly customised or reformatted Lua may not match expected patterns

## Keyboard Shortcuts

Press **⌨ Shortcuts** in the toolbar for a full reference, or see `js/modal-shortcuts.js`.

## License

GNU General Public License v3. See `COPYING` for details.
Not affiliated with, endorsed by, or sponsored by QSC, LLC, Q-SYS, or Acuity Brands.


## Known Limitations

- Control appearance is a wireframe approximation, not pixel-accurate. Verify in Q-SYS Designer.
- Generated Lua code is a starting point — always review and test before deploying.
- Some layout properties are not yet supported (e.g., `ClassName`, `WordWrap`, `IconColor`, `CustomButtonUp/Down`). The `Media` layout style is not supported.
- Q-SYS Designer inverts certain colors between dark and light mode; this editor does not replicate that behavior.
- Font rendering may differ from Q-SYS Designer (browser fonts vs. Q-SYS font engine).
- Meter and fader previews are static and do not reflect signal levels or control positions.

See the [full known limitations list](Website/help/help.html#known-limitations) for more details.

## Troubleshooting

If the editor fails to load or behaves unexpectedly due to corrupted local storage, append `?reset=true` to the URL (e.g. `layout.html?reset=true`). This clears all saved data and settings, then redirects back to the clean URL.

## Potential Future Updates
- Icons in buttons displayed in editor (not just the property field)
- Actual WYSIWYG
- Boilerplate download to go straight to the plugin compiler tool (instead of just one qplug file)

## Disclaimer

This tool is provided as-is with no warranty, expressed or implied. Not affiliated with, endorsed by, or sponsored by QSC, LLC, Q-SYS, or Acuity Brands.

## AI Disclosure
Portions of this software was developed with the assisntance of an artificial intelligence agent.
