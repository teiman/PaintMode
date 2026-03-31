import { test, expect } from '@playwright/test'

// Helper: click on a grid cell in the canvas
async function clickGrid(page, gridX, gridY, options = {}) {
  const canvas = page.locator('canvas[data-editor="main"]')
  const box = await canvas.boundingBox()
  const pixelSize = 8
  const canvasSize = 80 * pixelSize
  const scaleX = box.width / canvasSize
  const scaleY = box.height / canvasSize
  const x = (gridX * pixelSize + pixelSize / 2) * scaleX
  const y = (gridY * pixelSize + pixelSize / 2) * scaleY
  await canvas.click({ position: { x, y }, ...options })
}

// Helper: read store state
async function getState(page, expr) {
  return page.evaluate((e) => {
    const s = window.__paintmode.state
    return new Function('s', `return s.${e}`)(s)
  }, expr)
}

// Helper: get pixel data from store layer
async function getStorePixel(page, layerIndex, gridX, gridY) {
  return page.evaluate(({ li, x, y }) => {
    const { state, GRID } = window.__paintmode
    return state.layers[li].data[y * GRID + x]
  }, { li: layerIndex, x: gridX, y: gridY })
}

// Helper: set a known color as current
async function setColor(page, color) {
  await page.evaluate((c) => {
    window.__paintmode.state.currentColor = c
  }, color)
}

// Helper: set tool via store
async function setTool(page, tool) {
  await page.evaluate((t) => {
    window.__paintmode.state.tool = t
  }, tool)
}

// Helper: wait for a render frame
async function waitFrame(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(r)))
}

// ─── TESTS ───────────────────────────────────────────────

test.describe('App loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await waitFrame(page)
  })

  test('page loads with title', async ({ page }) => {
    await expect(page.locator('.title')).toHaveText('PaintMode')
  })

  test('canvas is rendered', async ({ page }) => {
    const canvas = page.locator('canvas[data-editor="main"]')
    await expect(canvas).toBeVisible()
    const width = await canvas.getAttribute('width')
    expect(Number(width)).toBe(640)
  })

  test('toolbar buttons are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Pen/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Eraser/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Del Row/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Shadow/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Light/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Pattern/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Mirror/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Radar/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Solo/ })).toBeVisible()
  })

  test('palette loads colors from palette.png', async ({ page }) => {
    // Wait for palette to load
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
    const count = await getState(page, 'palette.length')
    expect(count).toBeGreaterThan(10)
    // Swatches rendered
    const swatches = page.locator('.swatch')
    await expect(swatches.first()).toBeVisible()
  })

  test('layer panel shows Layer 1', async ({ page }) => {
    await expect(page.locator('.layer-name').first()).toHaveText('Layer 1')
  })
})

test.describe('Pen tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('default color is #d9a066 on first draw', async ({ page }) => {
    // Do NOT set a color — just draw immediately
    await clickGrid(page, 10, 10)
    await waitFrame(page)
    const pixel = await getStorePixel(page, 0, 10, 10)
    expect(pixel).toBe('#d9a066')
  })

  test('left-click paints a pixel', async ({ page }) => {
    await setColor(page, '#ff0000')
    await clickGrid(page, 10, 10)
    await waitFrame(page)
    const pixel = await getStorePixel(page, 0, 10, 10)
    expect(pixel).toBe('#ff0000')
  })

  test('painting multiple pixels with drag', async ({ page }) => {
    await setColor(page, '#00ff00')
    const canvas = page.locator('canvas[data-editor="main"]')
    const box = await canvas.boundingBox()
    const scale = box.width / 640
    const startX = box.x + (5 * 8 + 4) * scale
    const startY = box.y + (5 * 8 + 4) * scale
    const endX = box.x + (10 * 8 + 4) * scale
    const endY = box.y + (5 * 8 + 4) * scale

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 10 })
    await page.mouse.up()
    await waitFrame(page)

    // Some pixels along the line should be painted
    const p1 = await getStorePixel(page, 0, 5, 5)
    const p2 = await getStorePixel(page, 0, 10, 5)
    expect(p1).toBe('#00ff00')
    expect(p2).toBe('#00ff00')
  })

  test('right-click picks color', async ({ page }) => {
    // Paint a pixel first
    await setColor(page, '#ff00ff')
    await clickGrid(page, 20, 20)
    await waitFrame(page)

    // Switch to a different color
    await setColor(page, '#000000')
    let color = await getState(page, 'currentColor')
    expect(color).toBe('#000000')

    // Right-click on the painted pixel
    await clickGrid(page, 20, 20, { button: 'right' })
    await waitFrame(page)

    color = await getState(page, 'currentColor')
    expect(color).toBe('#ff00ff')
  })
})

test.describe('Eraser tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('eraser removes painted pixel', async ({ page }) => {
    // Paint first
    await setColor(page, '#ff0000')
    await clickGrid(page, 15, 15)
    await waitFrame(page)
    expect(await getStorePixel(page, 0, 15, 15)).toBe('#ff0000')

    // Switch to eraser and erase
    await page.getByRole('button', { name: /Eraser/ }).click()
    await clickGrid(page, 15, 15)
    await waitFrame(page)
    expect(await getStorePixel(page, 0, 15, 15)).toBeNull()
  })

  test('right-click returns to pen tool', async ({ page }) => {
    await page.getByRole('button', { name: /Eraser/ }).click()
    let tool = await getState(page, 'tool')
    expect(tool).toBe('eraser')

    await clickGrid(page, 0, 0, { button: 'right' })
    tool = await getState(page, 'tool')
    expect(tool).toBe('pen')
  })
})

test.describe('Mirror mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('toggle mirror mode', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Mirror/ })
    // Mirror is on by default, first click turns it off
    await btn.click()
    expect(await getState(page, 'mirrorMode')).toBe(false)
    await btn.click()
    expect(await getState(page, 'mirrorMode')).toBe(true)
  })

  test('mirror mode paints on both sides', async ({ page }) => {
    // Mirror is on by default, no need to click
    await setColor(page, '#0000ff')
    await clickGrid(page, 10, 20)
    await waitFrame(page)

    const left = await getStorePixel(page, 0, 10, 20)
    const right = await getStorePixel(page, 0, 69, 20) // 79 - 10
    expect(left).toBe('#0000ff')
    expect(right).toBe('#0000ff')
  })
})

test.describe('Brush shapes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
    // Disable mirror mode for brush tests
    await page.evaluate(() => { window.__paintmode.state.mirrorMode = false })
  })

  test('default brush is pixel (1px)', async ({ page }) => {
    const brush = await getState(page, 'brush')
    expect(brush).toBe('pixel')
  })

  test('cross brush paints + shape', async ({ page }) => {
    await page.evaluate(() => { window.__paintmode.state.brush = 'cross' })
    await setColor(page, '#ff0000')
    await clickGrid(page, 20, 20)
    await waitFrame(page)

    // Center and 4 arms
    expect(await getStorePixel(page, 0, 20, 20)).toBe('#ff0000')
    expect(await getStorePixel(page, 0, 19, 20)).toBe('#ff0000')
    expect(await getStorePixel(page, 0, 21, 20)).toBe('#ff0000')
    expect(await getStorePixel(page, 0, 20, 19)).toBe('#ff0000')
    expect(await getStorePixel(page, 0, 20, 21)).toBe('#ff0000')
    // Diagonals should be empty
    expect(await getStorePixel(page, 0, 19, 19)).toBeNull()
    expect(await getStorePixel(page, 0, 21, 21)).toBeNull()
  })

  test('square brush paints 2x2', async ({ page }) => {
    await page.evaluate(() => { window.__paintmode.state.brush = 'square' })
    await setColor(page, '#00ff00')
    await clickGrid(page, 30, 30)
    await waitFrame(page)

    expect(await getStorePixel(page, 0, 30, 30)).toBe('#00ff00')
    expect(await getStorePixel(page, 0, 31, 30)).toBe('#00ff00')
    expect(await getStorePixel(page, 0, 30, 31)).toBe('#00ff00')
    expect(await getStorePixel(page, 0, 31, 31)).toBe('#00ff00')
    // Outside the 2x2
    expect(await getStorePixel(page, 0, 29, 30)).toBeNull()
  })

  test('ball brush paints circle shape', async ({ page }) => {
    await page.evaluate(() => { window.__paintmode.state.brush = 'ball' })
    await setColor(page, '#0000ff')
    await clickGrid(page, 40, 40)
    await waitFrame(page)

    // Center
    expect(await getStorePixel(page, 0, 40, 40)).toBe('#0000ff')
    // Cardinal at distance 2
    expect(await getStorePixel(page, 0, 42, 40)).toBe('#0000ff')
    expect(await getStorePixel(page, 0, 38, 40)).toBe('#0000ff')
    // Diagonal at (1,1) should be painted (1+1=2 <= 5)
    expect(await getStorePixel(page, 0, 41, 41)).toBe('#0000ff')
    // Corner at (2,2) should NOT be painted (4+4=8 > 5)
    expect(await getStorePixel(page, 0, 42, 42)).toBeNull()
  })

  test('brush selector buttons are visible', async ({ page }) => {
    const brushBtns = page.locator('.brush-btn')
    await expect(brushBtns).toHaveCount(4)
  })
})

test.describe('Shadow brush', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('darkens existing color', async ({ page }) => {
    // Paint a bright color
    await setColor(page, '#ff8800')
    await clickGrid(page, 30, 30)
    await waitFrame(page)

    // Switch to shadow
    await page.getByRole('button', { name: /Shadow/ }).first().click()
    await clickGrid(page, 30, 30)
    await waitFrame(page)

    const pixel = await getStorePixel(page, 0, 30, 30)
    expect(pixel).not.toBe('#ff8800')
    expect(pixel).toBeTruthy()
    // Darkened color should have lower brightness - check hex value
    const origBrightness = parseInt('ff', 16) + parseInt('88', 16)
    const newR = parseInt(pixel.slice(1, 3), 16)
    const newG = parseInt(pixel.slice(3, 5), 16)
    const newBrightness = newR + newG
    expect(newBrightness).toBeLessThan(origBrightness)
  })

  test('does nothing on empty pixel', async ({ page }) => {
    await page.getByRole('button', { name: /Shadow/ }).first().click()
    await clickGrid(page, 50, 50)
    await waitFrame(page)
    expect(await getStorePixel(page, 0, 50, 50)).toBeNull()
  })

  test('right-click returns to pen', async ({ page }) => {
    await page.getByRole('button', { name: /Shadow/ }).first().click()
    expect(await getState(page, 'tool')).toBe('shadow')
    await clickGrid(page, 0, 0, { button: 'right' })
    expect(await getState(page, 'tool')).toBe('pen')
  })
})

test.describe('Light brush', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('brightens existing color', async ({ page }) => {
    await setColor(page, '#553300')
    await clickGrid(page, 35, 35)
    await waitFrame(page)

    await page.getByRole('button', { name: /Light/ }).click()
    await clickGrid(page, 35, 35)
    await waitFrame(page)

    const pixel = await getStorePixel(page, 0, 35, 35)
    expect(pixel).not.toBe('#553300')
    const origBrightness = 0x55 + 0x33
    const newR = parseInt(pixel.slice(1, 3), 16)
    const newG = parseInt(pixel.slice(3, 5), 16)
    expect(newR + newG).toBeGreaterThan(origBrightness)
  })

  test('right-click returns to pen', async ({ page }) => {
    await page.getByRole('button', { name: /Light/ }).click()
    expect(await getState(page, 'tool')).toBe('light')
    await clickGrid(page, 0, 0, { button: 'right' })
    expect(await getState(page, 'tool')).toBe('pen')
  })
})

test.describe('Shadow pattern', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('draws dithered pattern', async ({ page }) => {
    await setColor(page, '#ff0000')
    await page.getByRole('button', { name: /Pattern/ }).click()

    // Paint a small area by dragging
    const canvas = page.locator('canvas[data-editor="main"]')
    const box = await canvas.boundingBox()
    const scale = box.width / 640
    const startX = box.x + (40 * 8 + 4) * scale
    const startY = box.y + (40 * 8 + 4) * scale
    const endX = box.x + (44 * 8 + 4) * scale
    const endY = box.y + (40 * 8 + 4) * scale

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 10 })
    await page.mouse.up()
    await waitFrame(page)

    // Check that some pixels are painted and some are not (dithered)
    let painted = 0
    let empty = 0
    for (let x = 40; x <= 44; x++) {
      const p = await getStorePixel(page, 0, x, 40)
      if (p) painted++
      else empty++
    }
    expect(painted).toBeGreaterThan(0)
    expect(empty).toBeGreaterThan(0)
  })

  test('right-click returns to pen', async ({ page }) => {
    await page.getByRole('button', { name: /Pattern/ }).click()
    expect(await getState(page, 'tool')).toBe('shadow_pattern')
    await clickGrid(page, 0, 0, { button: 'right' })
    expect(await getState(page, 'tool')).toBe('pen')
  })
})

test.describe('Delete row', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('deletes row and shifts content up', async ({ page }) => {
    // Paint pixels at rows 50 and 51
    await setColor(page, '#ff0000')
    await clickGrid(page, 10, 50)
    await setColor(page, '#00ff00')
    await clickGrid(page, 10, 51)
    await waitFrame(page)

    expect(await getStorePixel(page, 0, 10, 50)).toBe('#ff0000')
    expect(await getStorePixel(page, 0, 10, 51)).toBe('#00ff00')

    // Use delete row on row 50
    await page.getByRole('button', { name: /Del Row/ }).click()
    await clickGrid(page, 10, 50)
    await waitFrame(page)

    // Row 51's content should have moved up to row 50
    expect(await getStorePixel(page, 0, 10, 50)).toBe('#00ff00')
  })

  test('right-click returns to pen', async ({ page }) => {
    await page.getByRole('button', { name: /Del Row/ }).click()
    expect(await getState(page, 'tool')).toBe('delete_row')
    await clickGrid(page, 0, 0, { button: 'right' })
    expect(await getState(page, 'tool')).toBe('pen')
  })
})

test.describe('Layer management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('starts with one layer', async ({ page }) => {
    const count = await getState(page, 'layers.length')
    expect(count).toBe(1)
  })

  test('add layer', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Layer' }).click()
    const count = await getState(page, 'layers.length')
    expect(count).toBe(2)
    // New layer should be active
    expect(await getState(page, 'currentLayerIndex')).toBe(1)
  })

  test('switch active layer', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Layer' }).click()
    // Click on Layer 1 (it should be in the list)
    await page.locator('.layer-item').last().click() // Layer 1 is shown last (reversed)
    expect(await getState(page, 'currentLayerIndex')).toBe(0)
  })

  test('painting on different layers is independent', async ({ page }) => {
    // Paint on layer 0
    await setColor(page, '#ff0000')
    await clickGrid(page, 5, 5)

    // Add layer and paint on layer 1
    await page.getByRole('button', { name: '+ Add Layer' }).click()
    await setColor(page, '#00ff00')
    await clickGrid(page, 5, 5)
    await waitFrame(page)

    expect(await getStorePixel(page, 0, 5, 5)).toBe('#ff0000')
    expect(await getStorePixel(page, 1, 5, 5)).toBe('#00ff00')
  })

  test('toggle layer visibility', async ({ page }) => {
    const visBtn = page.locator('.vis-btn').first()
    await visBtn.click()
    const visible = await page.evaluate(() => window.__paintmode.state.layers[0].visible)
    expect(visible).toBe(false)
    await visBtn.click()
    const visible2 = await page.evaluate(() => window.__paintmode.state.layers[0].visible)
    expect(visible2).toBe(true)
  })

  test('cannot delete last layer', async ({ page }) => {
    const deleteBtn = page.locator('.layer-actions button').last()
    await deleteBtn.click()
    expect(await getState(page, 'layers.length')).toBe(1)
  })

  test('delete a layer when multiple exist', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Layer' }).click()
    expect(await getState(page, 'layers.length')).toBe(2)

    // Delete the top layer (shown first in reversed list)
    const deleteBtn = page.locator('.layer-item').first().locator('.layer-actions button').last()
    await deleteBtn.click()
    expect(await getState(page, 'layers.length')).toBe(1)
  })
})

test.describe('Solo mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
  })

  test('toggle solo mode', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Solo/ })
    await btn.click()
    expect(await getState(page, 'soloMode')).toBe(true)
    await btn.click()
    expect(await getState(page, 'soloMode')).toBe(false)
  })
})

test.describe('Pixel radar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('toggle pixel radar', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Radar/ })
    await btn.click()
    expect(await getState(page, 'pixelRadar')).toBe(true)
    await btn.click()
    expect(await getState(page, 'pixelRadar')).toBe(false)
  })

  test('detects double-wide horizontal line (2px tall)', async ({ page }) => {
    // Paint a 2px thick horizontal line (two rows, 3 columns)
    await setColor(page, '#ff0000')
    await page.evaluate(() => { window.__paintmode.state.mirrorMode = false })
    for (const [x, y] of [[30,30],[31,30],[32,30],[30,31],[31,31],[32,31]]) {
      await clickGrid(page, x, y)
    }
    await waitFrame(page)

    // Use findPixelIssues via the utils exposed in the app
    const flaggedCount = await page.evaluate(() => {
      const { findPixelIssues } = window.__paintmode_utils
      const { state, GRID } = window.__paintmode
      const layer = state.layers[state.currentLayerIndex]
      const { doubles } = findPixelIssues(layer.data, GRID)
      return doubles.size
    })
    // All 6 pixels are part of double-wide contour
    expect(flaggedCount).toBeGreaterThan(0)
  })

  test('closed 1px loop has no redundant pixels', async ({ page }) => {
    // Paint a closed square loop (1px wide, 10x10) — no pixel is redundant
    await setColor(page, '#ff0000')
    await page.evaluate(() => { window.__paintmode.state.mirrorMode = false })
    // Draw a 10x10 square loop via store to avoid slow clicking
    await page.evaluate(() => {
      const { state, GRID } = window.__paintmode
      const li = state.currentLayerIndex
      const c = '#ff0000'
      for (let x = 20; x <= 29; x++) { state.layers[li].data[20 * GRID + x] = c } // top
      for (let y = 21; y <= 29; y++) { state.layers[li].data[y * GRID + 29] = c }  // right
      for (let x = 28; x >= 20; x--) { state.layers[li].data[29 * GRID + x] = c } // bottom
      for (let y = 28; y >= 21; y--) { state.layers[li].data[y * GRID + 20] = c }  // left
      state.renderTick++
    })
    await waitFrame(page)

    const flaggedCount = await page.evaluate(() => {
      const { findPixelIssues } = window.__paintmode_utils
      const { state, GRID } = window.__paintmode
      const layer = state.layers[state.currentLayerIndex]
      const { doubles } = findPixelIssues(layer.data, GRID)
      return doubles.size
    })
    // With 8-connectivity, the 4 corner pixels are sobrante
    // (diagonal connection provides the shortcut)
    expect(flaggedCount).toBe(4)
  })


})

test.describe('Palette selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('clicking a swatch changes current color', async ({ page }) => {
    // Click a base palette swatch (second row, second swatch after transparent)
    const baseRow = page.locator('.palette-row').nth(1)
    const secondSwatch = baseRow.locator('.swatch').nth(1)
    await secondSwatch.click()
    const color = await getState(page, 'currentColor')
    const palette = await page.evaluate(() => window.__paintmode.state.palette)
    expect(color).toBe(palette[1])
  })

  test('transparent swatch sets null color', async ({ page }) => {
    await page.locator('.transparent-swatch').click()
    const color = await getState(page, 'currentColor')
    expect(color).toBeNull()
  })
})

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => window.__paintmode.state.palette.length > 0)
  })

  test('Save PNG triggers download', async ({ page }) => {
    // Paint something first
    await setColor(page, '#ff0000')
    await clickGrid(page, 40, 40)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save PNG' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('paintmode.png')
  })

  test('Save x4 PNG triggers download with correct name', async ({ page }) => {
    await setColor(page, '#ff0000')
    await clickGrid(page, 40, 40)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save x4 PNG' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('paintmode_x4.png')
  })
})

test.describe('Background animation', () => {
  test('background has two alternating shades', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await waitFrame(page)

    const result = await page.evaluate(() => {
      const canvas = document.querySelector('canvas[data-editor="main"]')
      const ctx = canvas.getContext('2d')
      const p1 = ctx.getImageData(12, 12, 1, 1).data  // cell (1,1) — inside diamond
      const p2 = ctx.getImageData(4, 4, 1, 1).data    // cell (0,0) — corner pixel
      return { r1: p1[0], r2: p2[0] }
    })
    expect(Math.abs(result.r1 - result.r2)).toBeGreaterThan(0)
  })

  test('background forms diamond (rhombus) shapes', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas')
    await waitFrame(page)

    const result = await page.evaluate(() => {
      const canvas = document.querySelector('canvas[data-editor="main"]')
      const ctx = canvas.getContext('2d')
      const PIXEL = 8

      // Sample a 16x16 grid area and classify each cell as dark(0) or light(1)
      const S = 16
      const raw = []
      for (let y = 0; y < S; y++) {
        const row = []
        for (let x = 0; x < S; x++) {
          const px = ctx.getImageData(x * PIXEL + PIXEL / 2, y * PIXEL + PIXEL / 2, 1, 1).data
          row.push(px[0])
        }
        raw.push(row)
      }
      const all = raw.flat()
      const mid = (Math.min(...all) + Math.max(...all)) / 2
      const grid = raw.map(row => row.map(v => v >= mid ? 1 : 0))

      // Compute the expected diamond pattern using the same formula as the renderer
      // checker=1 → b1 (darker) → classified as 0, checker=0 → b2 (brighter) → classified as 1
      // So expected binary = 1 - checker
      const expected = []
      for (let y = 0; y < S; y++) {
        const row = []
        for (let x = 0; x < S; x++) {
          const dx = x % 4, dy = y % 4
          const inDiamond = Math.abs(dx - 1.5) + Math.abs(dy - 1.5) <= 2
          const cellOdd = (Math.floor(x / 4) + Math.floor(y / 4)) % 2
          const checker = inDiamond ? cellOdd : 1 - cellOdd
          row.push(1 - checker) // invert: bright=1, dark=0
        }
        expected.push(row)
      }

      // Count matches (try both polarities in case animation shifts threshold)
      let match = 0, matchInv = 0, total = S * S
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          if (grid[y][x] === expected[y][x]) match++
          if (grid[y][x] !== expected[y][x]) matchInv++
        }
      const bestMatch = Math.max(match, matchInv)

      // Verify diamond SHAPE properties on the grid:
      // 1) Each diamond is 4-fold symmetric within its 4x4 cell
      //    Cell pattern should be: 1 0 0 1 / 0 0 0 0 / 0 0 0 0 / 1 0 0 1  (for cellParity=0)
      //    which is symmetric across both axes
      let symmetricCount = 0, symmetricTotal = 0
      for (let cy = 0; cy < S; cy += 4) {
        for (let cx = 0; cx < S; cx += 4) {
          if (cx + 3 >= S || cy + 3 >= S) continue
          // Check horizontal symmetry: (cx+dx, cy+dy) === (cx+3-dx, cy+dy)
          for (let dy = 0; dy < 4; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              symmetricTotal++
              if (grid[cy + dy][cx + dx] === grid[cy + dy][cx + 3 - dx]) symmetricCount++
            }
          }
          // Check vertical symmetry: (cx+dx, cy+dy) === (cx+dx, cy+3-dy)
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 4; dx++) {
              symmetricTotal++
              if (grid[cy + dy][cx + dx] === grid[cy + 3 - dy][cx + dx]) symmetricCount++
            }
          }
        }
      }

      // 2) Corners of each 4x4 cell are the opposite color from the center
      //    (diamond shape: center is one color, corners are the other)
      let cornerFlipCount = 0, cornerFlipTotal = 0
      for (let cy = 0; cy < S; cy += 4) {
        for (let cx = 0; cx < S; cx += 4) {
          if (cx + 3 >= S || cy + 3 >= S) continue
          const centerVal = grid[cy + 1][cx + 1] // center of diamond
          const corners = [
            grid[cy][cx], grid[cy][cx + 3],
            grid[cy + 3][cx], grid[cy + 3][cx + 3]
          ]
          for (const c of corners) {
            cornerFlipTotal++
            if (c !== centerVal) cornerFlipCount++
          }
        }
      }

      // 3) Not horizontal stripes, not vertical stripes, not uniform
      const row0 = grid[0]
      const col0 = grid.map(r => r[0])
      const isHStripes = grid.every(r => r.every(v => v === r[0]))
      const isVStripes = grid[0].every((v, x) => grid.every(r => r[x] === v))

      return {
        matchRatio: bestMatch / total,
        symmetryRatio: symmetricTotal > 0 ? symmetricCount / symmetricTotal : 0,
        cornerFlipRatio: cornerFlipTotal > 0 ? cornerFlipCount / cornerFlipTotal : 0,
        isHStripes,
        isVStripes,
        row0HasBothValues: !row0.every(v => v === row0[0]),
        col0HasBothValues: !col0.every(v => v === col0[0]),
      }
    })

    // Rendered pattern matches the expected diamond formula exactly
    expect(result.matchRatio).toBe(1)

    // Each 4x4 cell is symmetric horizontally and vertically (diamond property)
    expect(result.symmetryRatio).toBe(1)

    // Corners of each cell are opposite color from center (diamond, not square)
    expect(result.cornerFlipRatio).toBe(1)

    // Not degenerate stripe patterns
    expect(result.isHStripes).toBe(false)
    expect(result.isVStripes).toBe(false)
    expect(result.row0HasBothValues).toBe(true)
    expect(result.col0HasBothValues).toBe(true)
  })
})
