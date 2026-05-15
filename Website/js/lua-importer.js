/**
 * Parses a .qplug (Lua) file and returns a DataModel-compatible JSON object.
 * Uses static text parsing — does not execute Lua.
 *
 * Returns null if GetControlLayout cannot be found.
 * Attaches a `_warnings` array to the result for non-fatal issues.
 */

import { generateId } from './utils.js';

const VALID_CONTROL_TYPES = new Set(['Button', 'Knob', 'Indicator', 'Text']);
const VALID_GRAPHIC_TYPES = new Set(['Label', 'GroupBox', 'Header', 'Image', 'Svg']);

// ── Entry point ──────────────────────────────────────────────────────────────

export function importFromQplug(luaText) {
  const warnings = [];

  const pi = parsePluginInfo(luaText, warnings);
  const controls = parseGetControls(luaText, warnings);
  const { pageNames, layoutMap, graphicsByPage, unassignedGraphics } =
    parseGetControlLayout(luaText, warnings);

  if (!layoutMap) return null;

  const pins = parseGetPins(luaText, warnings);

  // Build page objects
  const pageW = 400, pageH = 300;
  const pages = pageNames.length > 0
    ? pageNames.map(name => ({ id: generateId(), name, canvasWidth: pageW, canvasHeight: pageH }))
    : [{ id: generateId(), name: 'Page 1', canvasWidth: pageW, canvasHeight: pageH }];

  const pageIdByName = new Map(pages.map(p => [p.name, p.id]));

  const objects = buildObjects(
    controls, layoutMap, graphicsByPage, unassignedGraphics,
    pageIdByName, pages, warnings
  );

  const result = {
    pages,
    currentPageId: pages[0].id,
    objects,
    pluginInfo: pi,
    pins,
    designProperties: [],
    _warnings: warnings,
  };

  return result;
}

// ── PluginInfo parser ─────────────────────────────────────────────────────────

function parsePluginInfo(text, warnings) {
  const blockMatch = text.match(/PluginInfo\s*=\s*\{([\s\S]*?)\}/);
  if (!blockMatch) return {};
  const body = blockMatch[1];
  const pi = {};
  const strFields = ['Name', 'Version', 'Id', 'Description', 'BuildVersion', 'Author', 'Manufacturer', 'Model', 'Type'];
  for (const f of strFields) {
    const m = body.match(new RegExp(`${f}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    if (m) pi[f] = unescapeLuaString(m[1]);
  }
  if (/IsManaged\s*=\s*true/.test(body)) pi.IsManaged = true;
  if (/ShowDebug\s*=\s*true/.test(body)) pi.ShowDebug = true;
  return pi;
}

// ── GetControls parser ────────────────────────────────────────────────────────

function parseGetControls(text, warnings) {
  const fnBlock = extractFunctionBody(text, 'GetControls');
  if (!fnBlock) return [];

  const controls = [];
  for (const tableText of extractTableInserts(fnBlock, 'ctrls')) {
    const entry = parseLuaTable(tableText);
    if (!entry.Name) continue;
    if (!VALID_CONTROL_TYPES.has(entry.ControlType)) {
      warnings.push(`Unknown ControlType "${entry.ControlType}" for "${entry.Name}" — skipped.`);
      continue;
    }
    controls.push({
      Name: entry.Name,
      ControlType: entry.ControlType,
      ButtonType: entry.ButtonType,
      ControlUnit: entry.ControlUnit,
      IndicatorType: entry.IndicatorType,
      Min: numOrUndef(entry.Min),
      Max: numOrUndef(entry.Max),
      Count: entry.Count ? Math.max(1, parseInt(entry.Count)) : 1,
      UserPin: entry.UserPin === 'true' || entry.UserPin === true,
      PinStyle: entry.PinStyle || 'Both',
      Icon: entry.Icon,
      IconType: entry.IconType,
    });
  }
  return controls;
}

// ── GetControlLayout parser ───────────────────────────────────────────────────

function parseGetControlLayout(text, warnings) {
  const fnBlock = extractFunctionBody(text, 'GetControlLayout');
  if (!fnBlock) return { pageNames: [], layoutMap: null, graphicsByPage: {}, unassignedGraphics: [] };

  // Detect multi-page by looking for page conditionals
  const pagePattern = /if\s+CurrentPage\s*==\s*"((?:[^"\\]|\\.)*)"\s*then|elseif\s+CurrentPage\s*==\s*"((?:[^"\\]|\\.)*)"\s*then/g;
  const pageNames = [];
  let pm;
  while ((pm = pagePattern.exec(fnBlock)) !== null) {
    const name = unescapeLuaString(pm[1] || pm[2]);
    if (!pageNames.includes(name)) pageNames.push(name);
  }

  const layoutMap = new Map(); // controlName → layoutProps + position
  const graphicsByPage = {};   // pageName → array of graphic objects
  const unassignedGraphics = [];

  if (pageNames.length === 0) {
    // Single-page: parse flat
    parseLayoutBlock(fnBlock, layoutMap, unassignedGraphics, warnings);
  } else {
    // Multi-page: split by page conditionals
    const unassignedBlock = extractUnassignedBlock(fnBlock);
    if (unassignedBlock) {
      parseLayoutBlock(unassignedBlock, layoutMap, unassignedGraphics, warnings);
    }

    for (const pageName of pageNames) {
      const block = extractPageBlock(fnBlock, pageName);
      if (!block) continue;
      const pageGraphics = [];
      parseLayoutBlock(block, layoutMap, pageGraphics, warnings);
      graphicsByPage[pageName] = pageGraphics;
    }
  }

  return { pageNames, layoutMap, graphicsByPage, unassignedGraphics };
}

function extractUnassignedBlock(fnBlock) {
  // Everything before the first if/elseif CurrentPage block
  const firstIf = fnBlock.search(/\bif\s+CurrentPage\s*==/);
  if (firstIf <= 0) return null;
  return fnBlock.slice(0, firstIf);
}

function extractPageBlock(fnBlock, pageName) {
  const escaped = pageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startRe = new RegExp(`(?:if|elseif)\\s+CurrentPage\\s*==\\s*"${escaped}"\\s*then`);
  const startMatch = startRe.exec(fnBlock);
  if (!startMatch) return null;

  const startPos = startMatch.index + startMatch[0].length;
  // End at next elseif / else / end at same depth
  const rest = fnBlock.slice(startPos);
  const endRe = /\belseif\b|\belse\b(?!\s*if)|\bend\b/g;
  let depth = 1;
  let match;
  while ((match = endRe.exec(rest)) !== null) {
    const kw = match[0];
    if (kw === 'end') {
      depth--;
      if (depth <= 0) return rest.slice(0, match.index);
    } else if (kw === 'elseif' || kw === 'else') {
      if (depth === 1) return rest.slice(0, match.index);
    }
  }
  return rest;
}

function parseLayoutBlock(block, layoutMap, graphicsOut, warnings) {
  // Parse layout["Name"] = { ... } entries
  const layoutRe = /layout\["((?:[^"\\]|\\.)*)"\]\s*=\s*\{/g;
  let lm;
  while ((lm = layoutRe.exec(block)) !== null) {
    const rawName = unescapeLuaString(lm[1]);
    const tableStart = lm.index + lm[0].length - 1;
    const tableBody = extractBraceContent(block, tableStart);
    if (!tableBody) continue;
    const entry = parseLuaTable(tableBody);
    layoutMap.set(rawName, entry);
  }

  // Parse table.insert(graphics, { ... }) entries
  const gfxRe = /table\.insert\s*\(\s*graphics\s*,\s*\{/g;
  let gm;
  while ((gm = gfxRe.exec(block)) !== null) {
    const tableStart = gm.index + gm[0].length - 1;
    const tableBody = extractBraceContent(block, tableStart);
    if (!tableBody) continue;
    const entry = parseLuaTable(tableBody);
    if (!entry.Type || !VALID_GRAPHIC_TYPES.has(entry.Type)) {
      warnings.push(`Unknown graphic Type "${entry.Type}" — skipped.`);
      continue;
    }
    const pos = parseNumArray(entry.Position);
    const size = parseNumArray(entry.Size);
    graphicsOut.push({
      x: pos[0] || 0, y: pos[1] || 0,
      w: size[0] || 100, h: size[1] || 30,
      graphicProps: {
        Type: entry.Type,
        Text: entry.Text || undefined,
        Color: parseColorArray(entry.Color),
        Fill: parseColorArray(entry.Fill),
        Font: entry.Font,
        FontStyle: entry.FontStyle,
        FontSize: entry.FontSize ? parseFloat(entry.FontSize) : undefined,
        IsBold: entry.IsBold === 'true' || undefined,
        HTextAlign: entry.HTextAlign,
        VTextAlign: entry.VTextAlign,
        StrokeColor: parseColorArray(entry.StrokeColor),
        StrokeWidth: entry.StrokeWidth !== undefined ? parseFloat(entry.StrokeWidth) : undefined,
        CornerRadius: entry.CornerRadius !== undefined ? parseFloat(entry.CornerRadius) : undefined,
        Image: entry.Image || undefined,
        Margin: entry.Margin !== undefined ? parseFloat(entry.Margin) : undefined,
        Padding: entry.Padding !== undefined ? parseFloat(entry.Padding) : undefined,
      },
    });
  }
}

// ── GetPins parser ────────────────────────────────────────────────────────────

function parseGetPins(text, warnings) {
  const fnBlock = extractFunctionBody(text, 'GetPins');
  if (!fnBlock) return [];
  const pins = [];
  for (const tableText of extractTableInserts(fnBlock, 'pins')) {
    const entry = parseLuaTable(tableText);
    if (!entry.Name) continue;
    pins.push({
      Name: entry.Name,
      Direction: entry.Direction || 'input',
      Domain: entry.Domain || 'audio',
    });
  }
  return pins;
}

// ── Build objects ─────────────────────────────────────────────────────────────

function buildObjects(controls, layoutMap, graphicsByPage, unassignedGraphics, pageIdByName, pages, warnings) {
  const objects = [];
  let zOrder = 0;

  // Group controls by array: detect "Name N" patterns in layoutMap
  const arrayGroups = new Map(); // baseName → [{name, index, layoutEntry}]
  const standaloneControls = [];

  for (const ctrl of controls) {
    if (ctrl.Count > 1) {
      const group = [];
      for (let i = 1; i <= ctrl.Count; i++) {
        const key = `${ctrl.Name} ${i}`;
        const layoutEntry = layoutMap.get(key);
        group.push({ ctrl, index: i, layoutEntry });
      }
      arrayGroups.set(ctrl.Name, group);
    } else {
      // Also check if layout has "Name 1", "Name 2" pattern (implied array from layout)
      if (layoutMap.has(`${ctrl.Name} 1`)) {
        const group = [];
        let i = 1;
        while (layoutMap.has(`${ctrl.Name} ${i}`)) {
          group.push({ ctrl, index: i, layoutEntry: layoutMap.get(`${ctrl.Name} ${i}`) });
          i++;
        }
        arrayGroups.set(ctrl.Name, group);
      } else {
        standaloneControls.push({ ctrl, layoutEntry: layoutMap.get(ctrl.Name) });
      }
    }
  }

  // Determine page context for a layout entry
  // Single page → all objects on pages[0]
  // Multi-page → need to determine which page the layout entry belongs to
  const pageCount = pages.length;

  const getPageId = (controlName) => {
    if (pageCount <= 1) return pages[0].id;
    // Check which page block contains this control
    for (const [pageName, gfxList] of Object.entries(graphicsByPage)) {
      // graphicsByPage only has graphics; for controls we check layoutMap context
      // Since we parsed per-page blocks, we don't have per-control page info directly.
      // Use a heuristic: controls unassigned to any page use null
    }
    // Default: assign to first page; importer can't reliably determine per-control page
    // without re-parsing each page block specifically for controls
    return pages[0].id;
  };

  // Build per-page control sets from the pageBlocks (if multi-page)
  // This requires re-parsing to get which controls are on which page
  const controlPageMap = new Map(); // controlName → pageId

  if (pageCount > 1) {
    // We'll do a secondary pass to determine page assignment
    // Controls in layoutMap that are in graphicsByPage source pages
    // are assigned to those pages. For controls not in any page-specific block,
    // assign null (all pages).
    // Since we already have per-page graphics, we can infer page blocks contain controls too.
    // Do a simple: all controls default to null (all pages) — the user can reassign
    warnings.push('Multi-page import: all controls assigned to "All Pages" — reassign pages as needed.');
    for (const { ctrl } of standaloneControls) {
      controlPageMap.set(ctrl.Name, null);
    }
    for (const [name] of arrayGroups) {
      controlPageMap.set(name, null);
    }
  } else {
    for (const { ctrl } of standaloneControls) {
      controlPageMap.set(ctrl.Name, pages[0].id);
    }
    for (const [name] of arrayGroups) {
      controlPageMap.set(name, pages[0].id);
    }
  }

  // Emit standalone controls
  for (const { ctrl, layoutEntry } of standaloneControls) {
    if (!layoutEntry) {
      warnings.push(`Control "${ctrl.Name}" has no layout entry — using defaults.`);
    }
    const pos = layoutEntry ? parseNumArray(layoutEntry.Position) : [0, 0];
    const size = layoutEntry ? parseNumArray(layoutEntry.Size) : [100, 30];
    objects.push({
      id: generateId(),
      kind: 'control',
      pageId: controlPageMap.get(ctrl.Name) ?? pages[0].id,
      x: pos[0] || 0,
      y: pos[1] || 0,
      w: size[0] || 100,
      h: size[1] || 30,
      zOrder: zOrder++,
      controlDef: buildControlDef(ctrl),
      layoutProps: layoutEntry ? buildLayoutProps(layoutEntry) : { Style: defaultStyle(ctrl.ControlType) },
    });
  }

  // Emit array controls
  for (const [name, group] of arrayGroups) {
    const groupId = generateId();
    for (const { ctrl, index, layoutEntry } of group) {
      if (!layoutEntry) warnings.push(`Array member "${ctrl.Name} ${index}" has no layout entry — using defaults.`);
      const pos = layoutEntry ? parseNumArray(layoutEntry.Position) : [0, (index - 1) * 34];
      const size = layoutEntry ? parseNumArray(layoutEntry.Size) : [100, 30];
      objects.push({
        id: generateId(),
        kind: 'control',
        pageId: controlPageMap.get(name) ?? pages[0].id,
        x: pos[0] || 0,
        y: pos[1] || 0,
        w: size[0] || 100,
        h: size[1] || 30,
        zOrder: zOrder++,
        arrayGroup: groupId,
        arrayIndex: index,
        controlDef: buildControlDef(ctrl),
        layoutProps: layoutEntry ? buildLayoutProps(layoutEntry) : { Style: defaultStyle(ctrl.ControlType) },
      });
    }
  }

  // Emit unassigned graphics (all pages)
  for (const gfx of unassignedGraphics) {
    objects.push({
      id: generateId(),
      kind: 'graphic',
      pageId: null,
      x: gfx.x, y: gfx.y, w: gfx.w, h: gfx.h,
      zOrder: zOrder++,
      graphicProps: cleanProps(gfx.graphicProps),
    });
  }

  // Emit per-page graphics
  for (const [pageName, gfxList] of Object.entries(graphicsByPage)) {
    const pageId = pageIdByName.get(pageName) || pages[0].id;
    for (const gfx of gfxList) {
      objects.push({
        id: generateId(),
        kind: 'graphic',
        pageId,
        x: gfx.x, y: gfx.y, w: gfx.w, h: gfx.h,
        zOrder: zOrder++,
        graphicProps: cleanProps(gfx.graphicProps),
      });
    }
  }

  return objects;
}

function buildControlDef(ctrl) {
  const cd = {
    Name: ctrl.Name,
    ControlType: ctrl.ControlType,
    UserPin: ctrl.UserPin,
    PinStyle: ctrl.PinStyle || 'Both',
  };
  if (ctrl.ButtonType) cd.ButtonType = ctrl.ButtonType;
  if (ctrl.ControlUnit) cd.ControlUnit = ctrl.ControlUnit;
  if (ctrl.IndicatorType) cd.IndicatorType = ctrl.IndicatorType;
  if (ctrl.Min !== undefined) cd.Min = ctrl.Min;
  if (ctrl.Max !== undefined) cd.Max = ctrl.Max;
  if (ctrl.Icon) { cd.Icon = ctrl.Icon; cd.IconType = ctrl.IconType || 'Icon'; }
  return cd;
}

function buildLayoutProps(entry) {
  const lp = {
    Style: entry.Style || 'Button',
  };
  if (entry.PrettyName) lp.PrettyName = entry.PrettyName;
  if (entry.Color) lp.Color = parseColorArray(entry.Color);
  if (entry.TextColor) lp.TextColor = parseColorArray(entry.TextColor);
  if (entry.Font) lp.Font = entry.Font;
  if (entry.FontStyle) lp.FontStyle = entry.FontStyle;
  if (entry.FontSize) lp.FontSize = parseFloat(entry.FontSize);
  if (entry.IsBold === 'true') lp.IsBold = true;
  if (entry.HTextAlign) lp.HTextAlign = entry.HTextAlign;
  if (entry.VTextAlign) lp.VTextAlign = entry.VTextAlign;
  if (entry.IsReadOnly === 'true') lp.IsReadOnly = true;
  if (entry.Margin) lp.Margin = parseFloat(entry.Margin);
  if (entry.Padding) lp.Padding = parseFloat(entry.Padding);
  if (entry.CornerRadius) lp.CornerRadius = parseFloat(entry.CornerRadius);
  if (entry.StrokeColor) lp.StrokeColor = parseColorArray(entry.StrokeColor);
  if (entry.StrokeWidth !== undefined) lp.StrokeWidth = parseFloat(entry.StrokeWidth);
  if (entry.ButtonStyle) lp.ButtonStyle = entry.ButtonStyle;
  if (entry.ButtonVisualStyle) lp.ButtonVisualStyle = entry.ButtonVisualStyle;
  if (entry.Legend) lp.Legend = entry.Legend;
  if (entry.Icon) { lp.Icon = entry.Icon; lp.IconType = entry.IconType || 'Icon'; }
  if (entry.UnlinkOffColor === 'true') lp.UnlinkOffColor = true;
  if (entry.OffColor) lp.OffColor = parseColorArray(entry.OffColor);
  if (entry.IconColor) lp.IconColor = parseColorArray(entry.IconColor);
  if (entry.WordWrap === 'true') lp.WordWrap = true;
  if (entry.ShowTextbox === 'true') lp.ShowTextbox = true;
  if (entry.MeterStyle) lp.MeterStyle = entry.MeterStyle;
  if (entry.BackgroundColor) lp.BackgroundColor = parseColorArray(entry.BackgroundColor);
  if (entry.TextBoxStyle) lp.TextBoxStyle = entry.TextBoxStyle;
  return lp;
}

function defaultStyle(controlType) {
  const defaults = { Button: 'Button', Knob: 'Knob', Indicator: 'Led', Text: 'Text' };
  return defaults[controlType] || 'Button';
}

function cleanProps(obj) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) result[k] = v;
  }
  return result;
}

// ── Lua parsing utilities ─────────────────────────────────────────────────────

/** Extract the body of a named Lua function (between `function Name(...)\n` and `end`) */
function extractFunctionBody(text, fnName) {
  const re = new RegExp(`function\\s+${fnName}\\s*\\([^)]*\\)[\\s\\S]*?\\n((?:[\\s\\S]*?))(?=\\nfunction\\s|\\n[A-Za-z_]|$)`);
  // Simpler approach: find function start and matching end
  const startRe = new RegExp(`\\bfunction\\s+${fnName}\\b`);
  const startMatch = startRe.exec(text);
  if (!startMatch) return null;

  let depth = 0;
  let i = startMatch.index;
  // Track depth using keywords
  const keywords = /\b(function|if|for|while|do|repeat)\b|\bend\b/g;
  keywords.lastIndex = startMatch.index;
  let m;
  while ((m = keywords.exec(text)) !== null) {
    if (m[0] === 'end') {
      depth--;
      if (depth <= 0) {
        return text.slice(startMatch.index, m.index + 3);
      }
    } else {
      depth++;
    }
  }
  return null;
}

/** Find all `table.insert(arrayName, {...})` calls and return the table content strings */
function extractTableInserts(text, arrayName) {
  const results = [];
  const re = new RegExp(`table\\.insert\\s*\\(\\s*${arrayName}\\s*,\\s*\\{`, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const tableStart = m.index + m[0].length - 1;
    const body = extractBraceContent(text, tableStart);
    if (body) results.push(body);
  }
  return results;
}

/**
 * Extract content between braces starting at `pos` (which points at the opening `{`).
 * Returns the string from `{` to matching `}` inclusive.
 */
function extractBraceContent(text, pos) {
  if (text[pos] !== '{') return null;
  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let i = pos; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === stringChar) inString = false;
    } else if (ch === '"' || ch === "'") {
      inString = true; stringChar = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(pos, i + 1);
    }
  }
  return null;
}

/**
 * Parse a flat Lua table `{ Key = value, ... }` into a plain JS object.
 * Handles: string values, number values, boolean values, nested `{n, n, ...}` tables (as raw string).
 */
function parseLuaTable(tableText) {
  // Strip outer braces
  const inner = tableText.slice(1, -1);
  const result = {};

  // Match Key = value pairs
  // Value types: "string", number, true/false, {nested}
  const kvRe = /(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}|true|false|-?\d+(?:\.\d+)?)/g;
  let m;
  while ((m = kvRe.exec(inner)) !== null) {
    const key = m[1];
    const rawVal = m[2];
    if (rawVal.startsWith('"')) {
      result[key] = unescapeLuaString(rawVal.slice(1, -1));
    } else if (rawVal === 'true') {
      result[key] = 'true';
    } else if (rawVal === 'false') {
      result[key] = 'false';
    } else if (rawVal.startsWith('{')) {
      result[key] = rawVal; // Keep raw for arrays
    } else {
      result[key] = rawVal; // number as string
    }
  }
  return result;
}

/** Parse a Lua array `{n, n, n}` into a JS number array */
function parseNumArray(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const inner = raw.replace(/^\{|\}$/g, '').trim();
  return inner.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
}

/** Parse a color array `{r, g, b}` or `{r, g, b, a}` */
function parseColorArray(raw) {
  if (!raw) return undefined;
  const arr = parseNumArray(raw);
  if (arr.length < 3) return undefined;
  return arr.slice(0, 4);
}

/** Unescape a Lua string (handles \", \\, \n) */
function unescapeLuaString(s) {
  return s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function numOrUndef(val) {
  if (val === undefined || val === null || val === '') return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}
