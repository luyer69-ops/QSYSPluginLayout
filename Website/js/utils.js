let _nextId = 1;

export function generateId() {
  return 'obj_' + (_nextId++);
}

export function resetIdCounter(startFrom = 1) {
  _nextId = startFrom;
}

/** Ensure the ID counter is past all existing IDs */
export function syncIdCounter(ids) {
  let max = 0;
  for (const id of ids) {
    const m = id.match(/^obj_(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  if (max >= _nextId) _nextId = max + 1;
}

export function snapToGrid(value, gridSize) {
  if (!gridSize || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Convert {r,g,b,a?} array to CSS rgba string */
export function colorToCSS(arr) {
  if (!arr || arr.length < 3) return 'transparent';
  const [r, g, b, a] = arr;
  if (a !== undefined) {
    return `rgba(${r},${g},${b},${a / 255})`;
  }
  return `rgb(${r},${g},${b})`;
}

/** Convert CSS hex (#rrggbb) to [r,g,b] array */
export function hexToRGB(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

/** Convert [r,g,b] array to hex string */
export function rgbToHex(arr) {
  if (!arr || arr.length < 3) return '#000000';
  const [r, g, b] = arr;
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

/** Check if point {x,y} is inside rect {x,y,w,h} */
export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w &&
         py >= rect.y && py <= rect.y + rect.h;
}

/** Check if two rects overlap */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

/** @param {any} obj @returns {any} */
export function deepClone(obj) {
  return structuredClone(obj);
}

/**
 * Returns true if the string is safe to use as a Q-SYS control name in generated Lua.
 * @param {string} name
 * @returns {boolean}
 */
export function isValidLuaIdentifier(name) {
  if (!name || !name.trim()) return false;
  // Allow letters, digits, spaces, underscores — the editor supports spaces in control names
  // but disallows characters that break Lua string literals: backslash, double-quote, newline
  return !/[\\"\n\r\t]/.test(name);
}

/** Field limits for numeric inputs in the properties panel */
export const FIELD_LIMITS = {
  FontSize:     { min: 1,  max: 200 },
  StrokeWidth:  { min: 0,  max: 64  },
  CornerRadius: { min: 0,  max: 500 },
  Margin:       { min: 0,  max: 500 },
  Padding:      { min: 0,  max: 500 },
  X:            { min: 0,  max: 9999 },
  Y:            { min: 0,  max: 9999 },
  Width:        { min: 8,  max: 9999 },
  Height:       { min: 8,  max: 9999 },
  ZOrder:       { min: 0,  max: 9999 },
  Count:        { min: 1,  max: 999  },
};
