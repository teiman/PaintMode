export function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  ).join('')
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, l * 100]
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1/6) return p + (q - p) * 6 * t
  if (t < 1/2) return q
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
  return p
}

export function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100
  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0, s = max === 0 ? 0 : d / max, v = max
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, v * 100]
}

export function hsvToRgb(h, s, v) {
  h /= 360; s /= 100; v /= 100
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r, g, b
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export function hexToHsv(hex) {
  return rgbToHsv(...hexToRgb(hex))
}

export function hsvToHex(h, s, v) {
  return rgbToHex(...hsvToRgb(h, s, v))
}

export function darkenColor(hex, amount = 20) {
  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  // Clamp to minimum 5% lightness to avoid collapsing to pure black
  const minL = l > 5 ? 5 : 0
  const [nr, ng, nb] = hslToRgb(h, s, Math.max(minL, l - amount))
  return rgbToHex(nr, ng, nb)
}

export function saddenColor(hex) {
  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  // Desaturate heavily, darken, shift hue slightly toward blue (240°)
  const hueShift = 15
  const newH = h + (240 - h) * (hueShift / 100)
  const newS = s * 0.45
  const newL = Math.max(5, l * 0.55)
  const [nr, ng, nb] = hslToRgb(newH, newS, newL)
  return rgbToHex(nr, ng, nb)
}

export function brightenColor(hex, amount = 20) {
  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  const [nr, ng, nb] = hslToRgb(h, s, Math.min(100, l + amount))
  return rgbToHex(nr, ng, nb)
}

export function computeAAColor(neighborColors) {
  if (neighborColors.length === 0) return null
  // Average in HSL to preserve vibrancy
  let th = 0, ts = 0, tl = 0
  // Handle hue averaging with circular mean
  let sinH = 0, cosH = 0
  for (const hex of neighborColors) {
    const [r, g, b] = hexToRgb(hex)
    const [h, s, l] = rgbToHsl(r, g, b)
    const rad = h * Math.PI / 180
    sinH += Math.sin(rad)
    cosH += Math.cos(rad)
    ts += s; tl += l
  }
  const n = neighborColors.length
  const avgH = ((Math.atan2(sinH / n, cosH / n) * 180 / Math.PI) + 360) % 360
  const avgS = ts / n
  const avgL = tl / n
  const [r, g, b] = hslToRgb(avgH, avgS, avgL)
  return rgbToHex(r, g, b)
}

export function plotLine(x0, y0, x1, y1, callback) {
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  while (true) {
    callback(x0, y0)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

export function findPixelIssues(layerData, GRID, targetColor) {
  const issues = new Set()
  const R = 2 // search radius for local BFS (5x5 box)

  function sameColor(ax, ay, c) {
    if (ax < 0 || ax >= GRID || ay < 0 || ay >= GRID) return false
    return layerData[ay * GRID + ax] === c
  }

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const c = layerData[y * GRID + x]
      if (!c) continue
      if (targetColor && c !== targetColor) continue

      // Gather same-color neighbors (8 directions: cardinal + diagonal)
      const neighbors = []
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          if (sameColor(x+dx, y+dy, c)) neighbors.push([x+dx, y+dy])
        }
      }

      if (neighbors.length === 0) continue

      // --- 1 neighbor: always sobrante (leaf pixel) ---
      // With 8-connectivity, a pixel with only 1 neighbor out of 8 possible
      // is clearly an isolated bump — removing it never disconnects anything.
      if (neighbors.length === 1) {
        issues.add(y * GRID + x)
        continue
      }

      // --- 2+ neighbors: local BFS ---
      // Can all neighbors reach each other WITHOUT this pixel,
      // within a small local box? If yes → pixel is sobrante.
      const minX = Math.max(0, x - R), maxX = Math.min(GRID - 1, x + R)
      const minY = Math.max(0, y - R), maxY = Math.min(GRID - 1, y + R)

      const visited = new Set()
      visited.add(neighbors[0][1] * GRID + neighbors[0][0])
      const queue = [neighbors[0]]

      while (queue.length > 0) {
        const [cx, cy] = queue.pop()
        const adj = [
          [cx-1,cy-1],[cx,cy-1],[cx+1,cy-1],
          [cx-1,cy],            [cx+1,cy],
          [cx-1,cy+1],[cx,cy+1],[cx+1,cy+1],
        ]
        for (const [ax, ay] of adj) {
          if (ax < minX || ax > maxX || ay < minY || ay > maxY) continue
          if (ax === x && ay === y) continue
          const key = ay * GRID + ax
          if (visited.has(key)) continue
          if (layerData[key] !== c) continue
          visited.add(key)
          queue.push([ax, ay])
        }
      }

      let allReachable = true
      for (let i = 1; i < neighbors.length; i++) {
        if (!visited.has(neighbors[i][1] * GRID + neighbors[i][0])) {
          allReachable = false
          break
        }
      }

      if (allReachable) issues.add(y * GRID + x)
    }
  }

  return { doubles: issues }
}
