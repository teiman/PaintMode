/**
 * Minimal GIF89a encoder for pixel art animations.
 * Supports up to 256 colors per frame, transparency, and animation delay.
 */

export function encodeGif(frames, width, height, delay = 180) {
  // frames: array of ImageData or {data: Uint8ClampedArray, width, height}
  // delay in ms (will be converted to centiseconds)

  const delayCentisecs = Math.round(delay / 10)
  const buf = []

  function writeByte(b) { buf.push(b & 0xff) }
  function writeShort(s) { writeByte(s & 0xff); writeByte((s >> 8) & 0xff) }
  function writeStr(s) { for (let i = 0; i < s.length; i++) buf.push(s.charCodeAt(i)) }

  // Build global color table from all frames
  const colorMap = new Map()
  let colorIndex = 0

  // Reserve index 0 for transparency
  colorMap.set('transparent', 0)
  colorIndex = 1

  for (const frame of frames) {
    const d = frame.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue
      const key = `${d[i]},${d[i+1]},${d[i+2]}`
      if (!colorMap.has(key) && colorIndex < 256) {
        colorMap.set(key, colorIndex++)
      }
    }
  }

  // Color table size must be power of 2
  let tableBits = 1
  while ((1 << tableBits) < colorIndex) tableBits++
  const tableSize = 1 << tableBits

  // Header
  writeStr('GIF89a')
  writeShort(width)
  writeShort(height)
  writeByte(0x80 | ((tableBits - 1) & 7)) // GCT flag + color resolution
  writeByte(0) // background color index (transparent)
  writeByte(0) // pixel aspect ratio

  // Global Color Table
  const entries = Array.from(colorMap.entries())
  const colorTable = new Array(tableSize).fill(null).map(() => [0, 0, 0])
  for (const [key, idx] of entries) {
    if (key === 'transparent') continue
    const [r, g, b] = key.split(',').map(Number)
    colorTable[idx] = [r, g, b]
  }
  for (const [r, g, b] of colorTable) {
    writeByte(r); writeByte(g); writeByte(b)
  }

  // Netscape extension for looping
  writeByte(0x21) // extension
  writeByte(0xff) // app extension
  writeByte(11)   // block size
  writeStr('NETSCAPE2.0')
  writeByte(3)    // sub-block size
  writeByte(1)    // loop sub-block id
  writeShort(0)   // loop count (0 = infinite)
  writeByte(0)    // terminator

  // Write each frame
  for (const frame of frames) {
    // Graphic Control Extension
    writeByte(0x21) // extension
    writeByte(0xf9) // GCE
    writeByte(4)    // block size
    writeByte(0x09) // disposal: restore to bg + transparent flag
    writeShort(delayCentisecs)
    writeByte(0)    // transparent color index
    writeByte(0)    // terminator

    // Image Descriptor
    writeByte(0x2c) // image separator
    writeShort(0)   // left
    writeShort(0)   // top
    writeShort(width)
    writeShort(height)
    writeByte(0)    // no local color table

    // LZW compressed pixels
    const minCodeSize = Math.max(2, tableBits)
    const pixels = new Uint8Array(width * height)
    const d = frame.data
    for (let i = 0; i < width * height; i++) {
      const pi = i * 4
      if (d[pi + 3] < 128) {
        pixels[i] = 0 // transparent
      } else {
        const key = `${d[pi]},${d[pi+1]},${d[pi+2]}`
        pixels[i] = colorMap.get(key) || 0
      }
    }

    const compressed = lzwEncode(pixels, minCodeSize)
    writeByte(minCodeSize)

    // Write in sub-blocks of up to 255 bytes
    let pos = 0
    while (pos < compressed.length) {
      const chunk = Math.min(255, compressed.length - pos)
      writeByte(chunk)
      for (let i = 0; i < chunk; i++) buf.push(compressed[pos++])
    }
    writeByte(0) // block terminator
  }

  writeByte(0x3b) // trailer
  return new Uint8Array(buf)
}

function lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1
  let codeSize = minCodeSize + 1
  let nextCode = eoiCode + 1

  // Build initial dictionary
  let dict = new Map()
  for (let i = 0; i < clearCode; i++) {
    dict.set(String(i), i)
  }

  const output = []
  let bitBuf = 0
  let bitCount = 0

  function emit(code) {
    bitBuf |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) {
      output.push(bitBuf & 0xff)
      bitBuf >>= 8
      bitCount -= 8
    }
  }

  emit(clearCode)

  let current = String(pixels[0])
  for (let i = 1; i < pixels.length; i++) {
    const next = current + ',' + pixels[i]
    if (dict.has(next)) {
      current = next
    } else {
      emit(dict.get(current))
      if (nextCode < 4096) {
        dict.set(next, nextCode++)
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++
        }
      } else {
        // Reset dictionary
        emit(clearCode)
        dict = new Map()
        for (let j = 0; j < clearCode; j++) {
          dict.set(String(j), j)
        }
        codeSize = minCodeSize + 1
        nextCode = eoiCode + 1
      }
      current = String(pixels[i])
    }
  }

  emit(dict.get(current))
  emit(eoiCode)

  // Flush remaining bits
  if (bitCount > 0) output.push(bitBuf & 0xff)

  return output
}
