import './style.css'
import { jsPDF } from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const app = document.querySelector('#app')

app.innerHTML = `
<main class="page">
  <header class="topbar">
    <div>
      <div class="brand">Censurador <span>de imágenes</span></div>
      <p class="subtitle">Oculta información sensible directamente en tu navegador.</p>
    </div>
    <div class="privacy"><span class="dot"></span>Procesamiento local</div>
  </header>

  <section class="card upload-card" id="uploadCard">
    <input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf" hidden />
    <div class="upload-icon">↑</div>
    <h1>Sube una imagen o PDF</h1>
    <p>Arrastra un archivo aquí o selecciónalo desde tu dispositivo.</p>
    <button class="primary" id="chooseBtn">Seleccionar archivo</button>
    <small>PNG, JPG, WEBP, GIF o PDF</small>
  </section>

  <section class="editor hidden" id="editor">
    <div class="toolbar">
      <div class="tool-group">
        <button class="tool active" data-tool="rectangle" title="Rectángulo">▭ <span>Rectángulo</span></button>
        <button class="tool" data-tool="ellipse" title="Círculo / elipse">◯ <span>Círculo</span></button>
        <button class="tool" data-tool="text" title="Agregar texto">T <span>Texto</span></button>
      </div>

      <div class="tool-group">
        <label class="select-label">Efecto
          <select id="effect">
            <option value="pixelate">Pixelar</option>
            <option value="blur">Desenfocar</option>
            <option value="solid">Color sólido</option>
          </select>
        </label>
        <label class="range-label" id="strengthWrap">Intensidad
          <input id="strength" type="range" min="4" max="40" value="14" />
          <output id="strengthValue">14</output>
        </label>
        <label class="color-label hidden" id="colorWrap">Color
          <input id="color" type="color" value="#111827" />
        </label>
      </div>

      <div class="zoom-group">
        <button class="zoom-btn" id="zoomOut" title="Alejar">−</button>
        <button class="zoom-value" id="zoomReset" title="Restablecer zoom">100%</button>
        <button class="zoom-btn" id="zoomIn" title="Acercar">+</button>
      </div>

      <div class="tool-group actions">
        <button class="secondary" id="undoBtn">↶ Deshacer</button>
        <button class="secondary" id="clearBtn">Limpiar</button>
        <button class="secondary" id="newBtn">Nueva</button>
        <button class="download" id="downloadImageBtn">↓ Imagen</button>
        <button class="download" id="downloadPdfBtn">↓ PDF</button>
      </div>
    </div>

    <div class="text-panel hidden" id="textPanel">
      <label>Texto <input id="textContent" type="text" value="Texto" maxlength="500" /></label>
      <label>Tamaño <input id="textSize" type="number" min="8" max="300" value="32" /></label>
      <label>Color <input id="textColor" type="color" value="#111827" /></label>
      <div class="format-buttons">
        <button class="format-btn" data-format="bold" title="Negrita"><strong>N</strong></button>
        <button class="format-btn" data-format="italic" title="Itálica"><em>I</em></button>
        <button class="format-btn" data-format="underline" title="Subrayado"><u>U</u></button>
      </div>
      <div class="format-buttons">
        <button class="format-btn" data-align="left" title="Alinear izquierda">≡</button>
        <button class="format-btn" data-align="center" title="Centrar">≡</button>
        <button class="format-btn" data-align="right" title="Alinear derecha">≡</button>
      </div>
      <button class="secondary" id="deleteTextBtn">Eliminar texto</button>
    </div>

    <div class="page-bar hidden" id="pageBar">
      <button class="secondary" id="prevPage">←</button>
      <span>Página <strong id="pageNumber">1</strong> de <strong id="pageCount">1</strong></span>
      <button class="secondary" id="nextPage">→</button>
    </div>

    <div class="hint" id="hint">Arrastra sobre la imagen para crear un área. Puedes crear tantas como quieras.</div>

    <div class="canvas-shell" id="canvasShell">
      <canvas id="canvas"></canvas>
    </div>

    <div class="mobile-actions">
      <button class="download" id="downloadImageBtnMobile">↓ Descargar imagen</button>
      <button class="download" id="downloadPdfBtnMobile">↓ Descargar PDF</button>
    </div>
  </section>

  <footer>Tus archivos no se suben a ningún servidor. Todo el procesamiento ocurre en tu navegador.</footer>
</main>
`

const $ = (selector) => document.querySelector(selector)
const canvas = $('#canvas')
const ctx = canvas.getContext('2d', { willReadFrequently: true })
const shell = $('#canvasShell')
const editor = $('#editor')
const uploadCard = $('#uploadCard')
const fileInput = $('#fileInput')
const effect = $('#effect')
const strength = $('#strength')
const strengthValue = $('#strengthValue')
const strengthWrap = $('#strengthWrap')
const colorWrap = $('#colorWrap')
const color = $('#color')
const textPanel = $('#textPanel')
const textContent = $('#textContent')
const textSize = $('#textSize')
const textColor = $('#textColor')
const zoomReset = $('#zoomReset')
const pageBar = $('#pageBar')
const pageNumber = $('#pageNumber')
const pageCount = $('#pageCount')
const hint = $('#hint')

let pages = []
let currentPage = 0
let currentTool = 'rectangle'
let drawing = false
let start = null
let previewArea = null
let displayScale = 1
let renderedWidth = 0
let renderedHeight = 0
let zoom = 1
let selectedTextId = null
let draggingText = false
let textDragOffset = null
let pdfDocument = null

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const currentPageData = () => pages[currentPage]

function createPage(sourceCanvas, name = 'imagen') {
  return { sourceCanvas, name, areas: [], texts: [] }
}

function resetEditorState() {
  currentPage = 0
  selectedTextId = null
  drawing = false
  start = null
  previewArea = null
  zoom = 1
  pdfDocument = null
  textPanel.classList.add('hidden')
}

function showEditor() {
  uploadCard.classList.add('hidden')
  editor.classList.remove('hidden')
  updatePageBar()
  render()
}

function loadImageFile(file) {
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = img.naturalWidth
      sourceCanvas.height = img.naturalHeight
      sourceCanvas.getContext('2d').drawImage(img, 0, 0)
      resetEditorState()
      pages = [createPage(sourceCanvas, file.name.replace(/\.[^.]+$/, '') || 'imagen')]
      showEditor()
    }
    img.src = reader.result
  }
  reader.readAsDataURL(file)
}

async function loadPdfFile(file) {
  const buffer = await file.arrayBuffer()
  pdfDocument = await pdfjsLib.getDocument({ data: buffer }).promise
  pages = []
  resetEditorState()
  pages = Array.from({ length: pdfDocument.numPages }, (_, i) => ({
    sourceCanvas: null,
    name: file.name.replace(/\.pdf$/i, '') || 'documento',
    areas: [],
    texts: [],
    pdfPageNumber: i + 1
  }))
  await ensurePdfPageRendered(0)
  showEditor()
}

async function ensurePdfPageRendered(index) {
  const pageData = pages[index]
  if (!pdfDocument || !pageData || pageData.sourceCanvas) return

  const pdfPage = await pdfDocument.getPage(index + 1)
  const viewport = pdfPage.getViewport({ scale: 2 })
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = Math.ceil(viewport.width)
  sourceCanvas.height = Math.ceil(viewport.height)
  await pdfPage.render({
    canvasContext: sourceCanvas.getContext('2d'),
    viewport
  }).promise
  pageData.sourceCanvas = sourceCanvas
}

async function changePage(index) {
  if (!pages.length) return
  currentPage = clamp(index, 0, pages.length - 1)
  selectedTextId = null
  textPanel.classList.add('hidden')
  zoom = 1
  await ensurePdfPageRendered(currentPage)
  updatePageBar()
  render()
}

function updatePageBar() {
  const isPdf = pages.length > 1 || Boolean(pdfDocument)
  pageBar.classList.toggle('hidden', !isPdf)
  pageNumber.textContent = String(currentPage + 1)
  pageCount.textContent = String(pages.length || 1)
  $('#prevPage').disabled = currentPage <= 0
  $('#nextPage').disabled = currentPage >= pages.length - 1
}

function fitCanvas() {
  const page = currentPageData()
  if (!page?.sourceCanvas) return

  const naturalWidth = page.sourceCanvas.width
  const naturalHeight = page.sourceCanvas.height
  const maxWidth = Math.min(Math.max(shell.clientWidth - 24, 280), 1400)
  const maxHeight = Math.max(window.innerHeight * 0.67, 420)
  const fitScale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1)
  displayScale = fitScale * zoom
  renderedWidth = Math.max(1, Math.round(naturalWidth * displayScale))
  renderedHeight = Math.max(1, Math.round(naturalHeight * displayScale))
  canvas.width = renderedWidth
  canvas.height = renderedHeight
  canvas.style.width = `${renderedWidth}px`
  canvas.style.height = `${renderedHeight}px`
}

function render() {
  const page = currentPageData()
  if (!page?.sourceCanvas) return
  fitCanvas()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(page.sourceCanvas, 0, 0, canvas.width, canvas.height)
  for (const area of page.areas) applyArea(ctx, area, displayScale, page.sourceCanvas)
  for (const text of page.texts) drawText(ctx, text, displayScale, selectedTextId === text.id)
  if (previewArea) drawSelection(previewArea)
  zoomReset.textContent = `${Math.round(zoom * 100)}%`
  updateHint()
}

function updateHint() {
  if (currentTool === 'text') {
    hint.textContent = 'Haz clic sobre la imagen para agregar texto. Luego puedes moverlo y editar su formato.'
  } else if (zoom > 1) {
    hint.textContent = 'Zoom activo. Puedes desplazarte por la imagen usando las barras de desplazamiento.'
  } else {
    hint.textContent = 'Arrastra sobre la imagen para crear un área. Puedes crear tantas como quieras.'
  }
}

function applyArea(context, area, scale, original) {
  const x = area.x * scale
  const y = area.y * scale
  const w = area.w * scale
  const h = area.h * scale
  context.save()
  if (area.shape === 'ellipse') {
    context.beginPath()
    context.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
    context.clip()
  } else {
    context.beginPath()
    context.rect(x, y, w, h)
    context.clip()
  }
  if (area.effect === 'solid') {
    context.fillStyle = area.color
    context.fillRect(x, y, w, h)
  } else if (area.effect === 'pixelate') {
    pixelateArea(context, original, area, scale)
  } else {
    blurArea(context, original, area, scale)
  }
  context.restore()
}

function pixelateArea(context, original, area, scale) {
  const sx = clamp(Math.round(area.x), 0, original.width - 1)
  const sy = clamp(Math.round(area.y), 0, original.height - 1)
  const sw = clamp(Math.round(area.w), 1, original.width - sx)
  const sh = clamp(Math.round(area.h), 1, original.height - sy)
  const block = Math.max(2, Math.round(area.strength))
  const temp = document.createElement('canvas')
  const tw = Math.max(1, Math.ceil(sw / block))
  const th = Math.max(1, Math.ceil(sh / block))
  temp.width = tw
  temp.height = th
  const tctx = temp.getContext('2d')
  tctx.imageSmoothingEnabled = false
  tctx.drawImage(original, sx, sy, sw, sh, 0, 0, tw, th)
  context.imageSmoothingEnabled = false
  context.drawImage(temp, 0, 0, tw, th, area.x * scale, area.y * scale, area.w * scale, area.h * scale)
  context.imageSmoothingEnabled = true
}

function blurArea(context, original, area, scale) {
  const sx = clamp(Math.round(area.x), 0, original.width - 1)
  const sy = clamp(Math.round(area.y), 0, original.height - 1)
  const sw = clamp(Math.round(area.w), 1, original.width - sx)
  const sh = clamp(Math.round(area.h), 1, original.height - sy)
  const temp = document.createElement('canvas')
  temp.width = sw
  temp.height = sh
  const tctx = temp.getContext('2d')
  tctx.filter = `blur(${area.strength}px)`
  tctx.drawImage(original, sx, sy, sw, sh, 0, 0, sw, sh)
  context.drawImage(temp, 0, 0, sw, sh, area.x * scale, area.y * scale, area.w * scale, area.h * scale)
}

function drawSelection(area) {
  const x = area.x * displayScale
  const y = area.y * displayScale
  const w = area.w * displayScale
  const h = area.h * displayScale
  ctx.save()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(1, 2 * displayScale)
  ctx.setLineDash([7, 5])
  ctx.shadowColor = 'rgba(0,0,0,.45)'
  ctx.shadowBlur = 4
  if (area.shape === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
    ctx.stroke()
  } else ctx.strokeRect(x, y, w, h)
  ctx.restore()
}

function fontForText(text) {
  const weight = text.bold ? '700' : '400'
  const style = text.italic ? 'italic' : 'normal'
  return `${style} ${weight} ${text.size}px Arial, sans-serif`
}

function getTextMetrics(text) {
  const measureCanvas = document.createElement('canvas')
  const mctx = measureCanvas.getContext('2d')
  mctx.font = fontForText(text)
  return mctx.measureText(text.content || 'Texto')
}

function getTextBounds(text) {
  const metrics = getTextMetrics(text)
  const width = metrics.width
  const height = text.size * 1.25
  let left = text.x
  if (text.align === 'center') left -= width / 2
  if (text.align === 'right') left -= width
  return { left, top: text.y - text.size, right: left + width, bottom: text.y + height * 0.25 }
}

function drawText(context, text, scale, selected = false) {
  context.save()
  context.font = fontForText({ ...text, size: text.size * scale })
  context.fillStyle = text.color
  context.textAlign = text.align
  context.textBaseline = 'alphabetic'
  context.fillText(text.content || 'Texto', text.x * scale, text.y * scale)
  if (text.underline) {
    const metrics = context.measureText(text.content || 'Texto')
    let startX = text.x * scale
    if (text.align === 'center') startX -= metrics.width / 2
    if (text.align === 'right') startX -= metrics.width
    context.beginPath()
    context.lineWidth = Math.max(1, text.size * scale * 0.06)
    context.moveTo(startX, (text.y + text.size * 0.12) * scale)
    context.lineTo(startX + metrics.width, (text.y + text.size * 0.12) * scale)
    context.strokeStyle = text.color
    context.stroke()
  }
  if (selected) {
    const b = getTextBounds(text)
    context.strokeStyle = '#6d7cff'
    context.lineWidth = 1.5
    context.setLineDash([5, 4])
    context.strokeRect(b.left * scale, b.top * scale, (b.right - b.left) * scale, (b.bottom - b.top) * scale)
  }
  context.restore()
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: clamp((event.clientX - rect.left) / (rect.width / renderedWidth), 0, renderedWidth) / displayScale,
    y: clamp((event.clientY - rect.top) / (rect.height / renderedHeight), 0, renderedHeight) / displayScale
  }
}

function normalizeArea(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y)
  }
}

function findTextAt(x, y) {
  const page = currentPageData()
  if (!page) return null
  for (let i = page.texts.length - 1; i >= 0; i--) {
    const text = page.texts[i]
    const b = getTextBounds(text)
    if (x >= b.left - 8 && x <= b.right + 8 && y >= b.top - 8 && y <= b.bottom + 8) return text
  }
  return null
}

function selectText(text) {
  selectedTextId = text?.id ?? null
  if (!text) {
    textPanel.classList.add('hidden')
    render()
    return
  }
  textPanel.classList.remove('hidden')
  textContent.value = text.content
  textSize.value = text.size
  textColor.value = text.color
  document.querySelectorAll('.format-btn[data-format]').forEach(btn => btn.classList.toggle('active', Boolean(text[btn.dataset.format])))
  document.querySelectorAll('.format-btn[data-align]').forEach(btn => btn.classList.toggle('active', text.align === btn.dataset.align))
  render()
}

function getSelectedText() {
  return currentPageData()?.texts.find(text => text.id === selectedTextId) || null
}

function addTextAt(position) {
  const text = {
    id: crypto.randomUUID(),
    content: 'Texto',
    x: position.x,
    y: position.y,
    size: 32,
    color: '#111827',
    bold: false,
    italic: false,
    underline: false,
    align: 'left'
  }
  currentPageData().texts.push(text)
  selectText(text)
}

function setZoom(nextZoom) {
  zoom = clamp(nextZoom, 0.5, 3)
  render()
}

canvas.addEventListener('pointerdown', event => {
  const page = currentPageData()
  if (!page?.sourceCanvas) return
  const pos = pointerPosition(event)

  if (currentTool === 'text') {
    const existing = findTextAt(pos.x, pos.y)
    if (existing) {
      selectText(existing)
      draggingText = true
      textDragOffset = { x: pos.x - existing.x, y: pos.y - existing.y }
    } else {
      addTextAt(pos)
    }
    canvas.setPointerCapture(event.pointerId)
    return
  }

  const existingText = findTextAt(pos.x, pos.y)
  if (existingText && event.shiftKey) {
    selectText(existingText)
    draggingText = true
    textDragOffset = { x: pos.x - existingText.x, y: pos.y - existingText.y }
    canvas.setPointerCapture(event.pointerId)
    return
  }

  selectedTextId = null
  textPanel.classList.add('hidden')
  drawing = true
  canvas.setPointerCapture(event.pointerId)
  start = pos
  previewArea = { ...normalizeArea(start, start), shape: currentTool }
  render()
})

canvas.addEventListener('pointermove', event => {
  if (!drawing && !draggingText) return
  const pos = pointerPosition(event)
  if (draggingText) {
    const text = getSelectedText()
    if (text) {
      text.x = Math.max(0, pos.x - textDragOffset.x)
      text.y = Math.max(text.size, pos.y - textDragOffset.y)
      render()
    }
    return
  }
  previewArea = { ...normalizeArea(start, pos), shape: currentTool }
  render()
})

function finishPointer(event) {
  if (draggingText) {
    draggingText = false
    textDragOffset = null
    return
  }
  if (!drawing) return
  drawing = false
  const pos = pointerPosition(event)
  const rect = normalizeArea(start, pos)
  if (rect.w > 4 && rect.h > 4) {
    currentPageData().areas.push({
      ...rect,
      shape: currentTool,
      effect: effect.value,
      strength: Number(strength.value),
      color: color.value
    })
  }
  previewArea = null
  render()
}

canvas.addEventListener('pointerup', finishPointer)
canvas.addEventListener('pointercancel', finishPointer)

// Herramientas

document.querySelectorAll('.tool').forEach(button => {
  button.addEventListener('click', () => {
    currentTool = button.dataset.tool
    document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b === button))
    if (currentTool !== 'text') {
      selectedTextId = null
      textPanel.classList.add('hidden')
    }
    render()
  })
})

// Controles de censura

strength.addEventListener('input', () => {
  strengthValue.value = strength.value
  strengthValue.textContent = strength.value
})

effect.addEventListener('change', () => {
  const solid = effect.value === 'solid'
  strengthWrap.classList.toggle('hidden', solid)
  colorWrap.classList.toggle('hidden', !solid)
})

// Controles de texto

textContent.addEventListener('input', () => {
  const text = getSelectedText()
  if (!text) return
  text.content = textContent.value
  render()
})

textSize.addEventListener('input', () => {
  const text = getSelectedText()
  if (!text) return
  text.size = clamp(Number(textSize.value) || 32, 8, 300)
  render()
})

textColor.addEventListener('input', () => {
  const text = getSelectedText()
  if (!text) return
  text.color = textColor.value
  render()
})

document.querySelectorAll('.format-btn[data-format]').forEach(button => {
  button.addEventListener('click', () => {
    const text = getSelectedText()
    if (!text) return
    text[button.dataset.format] = !text[button.dataset.format]
    selectText(text)
  })
})

document.querySelectorAll('.format-btn[data-align]').forEach(button => {
  button.addEventListener('click', () => {
    const text = getSelectedText()
    if (!text) return
    text.align = button.dataset.align
    selectText(text)
  })
})

$('#deleteTextBtn').addEventListener('click', () => {
  const page = currentPageData()
  if (!page || !selectedTextId) return
  page.texts = page.texts.filter(text => text.id !== selectedTextId)
  selectedTextId = null
  textPanel.classList.add('hidden')
  render()
})

// Zoom

$('#zoomIn').addEventListener('click', () => setZoom(zoom + 0.25))
$('#zoomOut').addEventListener('click', () => setZoom(zoom - 0.25))
zoomReset.addEventListener('click', () => setZoom(1))

shell.addEventListener('wheel', event => {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  setZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1))
}, { passive: false })

// Historial básico

$('#undoBtn').addEventListener('click', () => {
  const page = currentPageData()
  if (!page) return
  if (selectedTextId) {
    page.texts = page.texts.filter(text => text.id !== selectedTextId)
    selectedTextId = null
    textPanel.classList.add('hidden')
  } else {
    page.areas.pop()
  }
  render()
})

$('#clearBtn').addEventListener('click', () => {
  const page = currentPageData()
  if (!page) return
  page.areas = []
  page.texts = []
  selectedTextId = null
  textPanel.classList.add('hidden')
  render()
})

$('#newBtn').addEventListener('click', () => {
  pages = []
  resetEditorState()
  editor.classList.add('hidden')
  uploadCard.classList.remove('hidden')
  fileInput.value = ''
})

$('#chooseBtn').addEventListener('click', () => fileInput.click())

fileInput.addEventListener('change', async event => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      await loadPdfFile(file)
    } else if (file.type.startsWith('image/')) {
      loadImageFile(file)
    } else {
      alert('Formato no compatible.')
    }
  } catch (error) {
    console.error(error)
    alert('No se pudo abrir el archivo.')
  }
})

;['dragenter', 'dragover'].forEach(type => {
  uploadCard.addEventListener(type, event => {
    event.preventDefault()
    uploadCard.classList.add('dragging')
  })
})

;['dragleave', 'drop'].forEach(type => {
  uploadCard.addEventListener(type, event => {
    event.preventDefault()
    uploadCard.classList.remove('dragging')
  })
})

uploadCard.addEventListener('drop', async event => {
  const file = event.dataTransfer.files?.[0]
  if (!file) return
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) await loadPdfFile(file)
  else if (file.type.startsWith('image/')) loadImageFile(file)
})

$('#prevPage').addEventListener('click', () => changePage(currentPage - 1))
$('#nextPage').addEventListener('click', () => changePage(currentPage + 1))

function createOutputCanvas(page) {
  const output = document.createElement('canvas')
  output.width = page.sourceCanvas.width
  output.height = page.sourceCanvas.height
  const outputContext = output.getContext('2d')
  outputContext.drawImage(page.sourceCanvas, 0, 0)
  for (const area of page.areas) applyArea(outputContext, area, 1, page.sourceCanvas)
  for (const text of page.texts) drawText(outputContext, text, 1, false)
  return output
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadCurrentImage() {
  const page = currentPageData()
  if (!page?.sourceCanvas) return
  const output = createOutputCanvas(page)
  output.toBlob(blob => downloadBlob(blob, `${page.name}-censurado.png`), 'image/png')
}

async function downloadPdf() {
  if (!pages.length) return
  const originalPage = currentPage
  const originalZoom = zoom
  await ensurePdfPageRendered(0)
  const firstOutput = createOutputCanvas(pages[0])
  const firstWidthPt = firstOutput.width * 72 / 96
  const firstHeightPt = firstOutput.height * 72 / 96
  const firstOrientation = firstOutput.width >= firstOutput.height ? 'landscape' : 'portrait'
  const doc = new jsPDF({ unit: 'pt', format: [firstWidthPt, firstHeightPt], orientation: firstOrientation, compress: true })

  try {
    doc.addImage(firstOutput.toDataURL('image/png'), 'PNG', 0, 0, firstWidthPt, firstHeightPt, undefined, 'FAST')

    for (let i = 1; i < pages.length; i++) {
      await ensurePdfPageRendered(i)
      const output = createOutputCanvas(pages[i])
      const widthPt = output.width * 72 / 96
      const heightPt = output.height * 72 / 96
      const orientation = output.width >= output.height ? 'landscape' : 'portrait'
      doc.addPage([widthPt, heightPt], orientation)
      doc.addImage(output.toDataURL('image/png'), 'PNG', 0, 0, widthPt, heightPt, undefined, 'FAST')
    }
    doc.save(`${pages[0].name}-censurado.pdf`)
  } finally {
    currentPage = originalPage
    zoom = originalZoom
    updatePageBar()
    render()
  }
}

$('#downloadImageBtn').addEventListener('click', downloadCurrentImage)
$('#downloadImageBtnMobile').addEventListener('click', downloadCurrentImage)
$('#downloadPdfBtn').addEventListener('click', downloadPdf)
$('#downloadPdfBtnMobile').addEventListener('click', downloadPdf)

window.addEventListener('resize', () => {
  if (currentPageData()?.sourceCanvas) render()
})
