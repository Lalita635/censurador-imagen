import './style.css'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="page">

    <header class="topbar">

      <div>
        <div class="brand">
          Censurador <span>de imágenes</span>
        </div>

        <p class="subtitle">
          Oculta información sensible directamente en tu navegador.
        </p>
      </div>

      <div class="privacy">
        <span class="dot"></span>
        Procesamiento local
      </div>

    </header>


    <!-- PANTALLA DE CARGA -->

    <section class="card upload-card" id="uploadCard">

      <input
        id="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
      />

      <div class="upload-icon">
        ↑
      </div>

      <h1>
        Sube una imagen
      </h1>

      <p>
        Arrastra una imagen aquí o selecciónala desde tu dispositivo.
      </p>

      <button
        class="primary"
        id="chooseBtn"
      >
        Seleccionar imagen
      </button>

      <small>
        PNG, JPG, WEBP o GIF
      </small>

    </section>


    <!-- EDITOR -->

    <section
      class="editor hidden"
      id="editor"
    >

      <div class="toolbar">

        <!-- HERRAMIENTAS -->

        <div class="tool-group">

          <button
            class="tool active"
            data-tool="rectangle"
            title="Rectángulo"
          >
            ▭
            <span>Rectángulo</span>
          </button>

          <button
            class="tool"
            data-tool="ellipse"
            title="Círculo / elipse"
          >
            ◯
            <span>Círculo</span>
          </button>

        </div>


        <!-- EFECTOS -->

        <div class="tool-group">

          <label class="select-label">

            Efecto

            <select id="effect">

              <option value="pixelate">
                Pixelar
              </option>

              <option value="blur">
                Desenfocar
              </option>

              <option value="solid">
                Color sólido
              </option>

            </select>

          </label>


          <label
            class="range-label"
            id="strengthWrap"
          >

            Intensidad

            <input
              id="strength"
              type="range"
              min="4"
              max="40"
              value="14"
            />

            <output id="strengthValue">
              14
            </output>

          </label>


          <label
            class="color-label hidden"
            id="colorWrap"
          >

            Color

            <input
              id="color"
              type="color"
              value="#111827"
            />

          </label>

        </div>


        <!-- ACCIONES -->

        <div class="tool-group actions">

          <button
            class="secondary"
            id="undoBtn"
          >
            ↶ Deshacer
          </button>

          <button
            class="secondary"
            id="clearBtn"
          >
            Limpiar
          </button>

          <button
            class="secondary"
            id="newBtn"
          >
            Nueva imagen
          </button>

          <button
            class="download"
            id="downloadBtn"
          >
            ↓ Descargar
          </button>

        </div>

      </div>


      <div class="hint">
        Arrastra sobre la imagen para crear un área.
        Puedes crear tantas como quieras.
      </div>


      <!-- CANVAS -->

      <div
        class="canvas-shell"
        id="canvasShell"
      >

        <canvas id="canvas"></canvas>

        <div
          class="empty-state hidden"
          id="emptyState"
        >
          Carga una imagen para comenzar
        </div>

      </div>


      <!-- BOTÓN MÓVIL -->

      <div class="mobile-actions">

        <button
          class="download"
          id="downloadBtnMobile"
        >
          ↓ Descargar imagen
        </button>

      </div>

    </section>


    <footer>
      Tus imágenes no se suben a ningún servidor.
      Todo el procesamiento ocurre en tu navegador.
    </footer>

  </main>
`


/* -------------------------------------------------------
   REFERENCIAS
------------------------------------------------------- */

const $ = (selector) =>
  document.querySelector(selector)

const canvas = $('#canvas')

const ctx = canvas.getContext(
  '2d',
  {
    willReadFrequently: true
  }
)

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


/* -------------------------------------------------------
   ESTADO
------------------------------------------------------- */

let sourceImage = null

let sourceCanvas = null

let areas = []

let currentTool = 'rectangle'

let drawing = false

let start = null

let previewArea = null

let displayScale = 1

let renderedWidth = 0

let renderedHeight = 0


/* -------------------------------------------------------
   CARGAR IMAGEN
------------------------------------------------------- */

function loadFile(file) {

  if (
    !file ||
    !file.type.startsWith('image/')
  ) {
    return
  }


  const reader = new FileReader()


  reader.onload = () => {

    const img = new Image()


    img.onload = () => {

      sourceImage = img


      sourceCanvas =
        document.createElement('canvas')


      sourceCanvas.width =
        img.naturalWidth

      sourceCanvas.height =
        img.naturalHeight


      const sourceContext =
        sourceCanvas.getContext('2d')


      sourceContext.drawImage(
        img,
        0,
        0
      )


      areas = []

      previewArea = null


      uploadCard.classList.add(
        'hidden'
      )

      editor.classList.remove(
        'hidden'
      )


      render()
    }


    img.src = reader.result
  }


  reader.readAsDataURL(file)
}


/* -------------------------------------------------------
   CALCULAR TAMAÑO DEL CANVAS
------------------------------------------------------- */

function fitCanvas() {

  if (!sourceImage) {
    return
  }


  const maxWidth =
    Math.min(
      shell.clientWidth - 24,
      1400
    )


  const maxHeight =
    Math.max(
      window.innerHeight * 0.67,
      420
    )


  const ratio =
    Math.min(
      maxWidth / sourceImage.naturalWidth,
      maxHeight / sourceImage.naturalHeight,
      1
    )


  renderedWidth =
    Math.max(
      1,
      Math.round(
        sourceImage.naturalWidth * ratio
      )
    )


  renderedHeight =
    Math.max(
      1,
      Math.round(
        sourceImage.naturalHeight * ratio
      )
    )


  displayScale = ratio


  canvas.width =
    renderedWidth

  canvas.height =
    renderedHeight


  canvas.style.aspectRatio =
    `${sourceImage.naturalWidth} / ${sourceImage.naturalHeight}`
}


/* -------------------------------------------------------
   RENDERIZAR
------------------------------------------------------- */

function render() {

  if (!sourceImage) {
    return
  }


  fitCanvas()


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  )


  ctx.drawImage(
    sourceCanvas,
    0,
    0,
    canvas.width,
    canvas.height
  )


  for (const area of areas) {

    applyArea(
      ctx,
      area,
      displayScale
    )

  }


  if (previewArea) {

    drawSelection(
      previewArea
    )

  }

}


/* -------------------------------------------------------
   APLICAR ÁREA
------------------------------------------------------- */

function applyArea(
  context,
  area,
  scale
) {

  const x =
    area.x * scale

  const y =
    area.y * scale

  const w =
    area.w * scale

  const h =
    area.h * scale


  context.save()


  /*
   * Crear máscara de la zona.
   */

  if (area.shape === 'ellipse') {

    context.beginPath()

    context.ellipse(
      x + w / 2,
      y + h / 2,
      Math.abs(w / 2),
      Math.abs(h / 2),
      0,
      0,
      Math.PI * 2
    )

    context.clip()

  } else {

    context.beginPath()

    context.rect(
      x,
      y,
      w,
      h
    )

    context.clip()

  }


  /*
   * EFECTO
   */

  if (area.effect === 'solid') {

    context.fillStyle =
      area.color

    context.fillRect(
      x,
      y,
      w,
      h
    )

  }

  else if (
    area.effect === 'pixelate'
  ) {

    pixelateArea(
      context,
      sourceCanvas,
      area,
      scale
    )

  }

  else {

    blurArea(
      context,
      sourceCanvas,
      area,
      scale
    )

  }


  context.restore()
}


/* -------------------------------------------------------
   PIXELAR
------------------------------------------------------- */

function pixelateArea(
  context,
  original,
  area,
  scale
) {

  const sx =
    Math.max(
      0,
      Math.round(area.x)
    )


  const sy =
    Math.max(
      0,
      Math.round(area.y)
    )


  const sw =
    Math.max(
      1,
      Math.min(
        original.width - sx,
        Math.round(area.w)
      )
    )


  const sh =
    Math.max(
      1,
      Math.min(
        original.height - sy,
        Math.round(area.h)
      )
    )


  const block =
    Math.max(
      2,
      Math.round(area.strength)
    )


  const temp =
    document.createElement('canvas')


  const tw =
    Math.max(
      1,
      Math.ceil(sw / block)
    )


  const th =
    Math.max(
      1,
      Math.ceil(sh / block)
    )


  temp.width = tw

  temp.height = th


  const tempContext =
    temp.getContext('2d')


  tempContext.imageSmoothingEnabled =
    false


  tempContext.drawImage(
    original,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    tw,
    th
  )


  context.imageSmoothingEnabled =
    false


  context.drawImage(
    temp,
    0,
    0,
    tw,
    th,
    area.x * scale,
    area.y * scale,
    area.w * scale,
    area.h * scale
  )


  context.imageSmoothingEnabled =
    true
}


/* -------------------------------------------------------
   DESENFOCAR
------------------------------------------------------- */

function blurArea(
  context,
  original,
  area,
  scale
) {

  const sx =
    Math.max(
      0,
      Math.round(area.x)
    )


  const sy =
    Math.max(
      0,
      Math.round(area.y)
    )


  const sw =
    Math.max(
      1,
      Math.min(
        original.width - sx,
        Math.round(area.w)
      )
    )


  const sh =
    Math.max(
      1,
      Math.min(
        original.height - sy,
        Math.round(area.h)
      )
    )


  const temp =
    document.createElement('canvas')


  temp.width = sw

  temp.height = sh


  const tempContext =
    temp.getContext('2d')


  tempContext.filter =
    `blur(${area.strength}px)`


  tempContext.drawImage(
    original,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    sw,
    sh
  )


  context.drawImage(
    temp,
    0,
    0,
    sw,
    sh,
    area.x * scale,
    area.y * scale,
    area.w * scale,
    area.h * scale
  )
}


/* -------------------------------------------------------
   MOSTRAR SELECCIÓN
------------------------------------------------------- */

function drawSelection(area) {

  const x =
    area.x * displayScale

  const y =
    area.y * displayScale

  const w =
    area.w * displayScale

  const h =
    area.h * displayScale


  ctx.save()


  ctx.strokeStyle =
    '#ffffff'


  ctx.lineWidth = 2


  ctx.setLineDash([
    7,
    5
  ])


  ctx.shadowColor =
    'rgba(0,0,0,.45)'


  ctx.shadowBlur = 4


  if (
    area.shape === 'ellipse'
  ) {

    ctx.beginPath()

    ctx.ellipse(
      x + w / 2,
      y + h / 2,
      Math.abs(w / 2),
      Math.abs(h / 2),
      0,
      0,
      Math.PI * 2
    )

    ctx.stroke()

  }

  else {

    ctx.strokeRect(
      x,
      y,
      w,
      h
    )

  }


  ctx.restore()
}


/* -------------------------------------------------------
   POSICIÓN DEL MOUSE
------------------------------------------------------- */

function pointerPosition(e) {

  const rect =
    canvas.getBoundingClientRect()


  const x =
    (e.clientX - rect.left) /
    (rect.width / renderedWidth)


  const y =
    (e.clientY - rect.top) /
    (rect.height / renderedHeight)


  return {

    x: Math.max(
      0,
      Math.min(
        renderedWidth,
        x
      )
    ),

    y: Math.max(
      0,
      Math.min(
        renderedHeight,
        y
      )
    )

  }
}


/* -------------------------------------------------------
   NORMALIZAR ÁREA
------------------------------------------------------- */

function normalizeArea(
  a,
  b
) {

  const x =
    Math.min(
      a.x,
      b.x
    )


  const y =
    Math.min(
      a.y,
      b.y
    )


  const w =
    Math.abs(
      b.x - a.x
    )


  const h =
    Math.abs(
      b.y - a.y
    )


  return {

    x:
      x / displayScale,

    y:
      y / displayScale,

    w:
      w / displayScale,

    h:
      h / displayScale

  }
}


/* -------------------------------------------------------
   DIBUJAR ÁREAS
------------------------------------------------------- */

canvas.addEventListener(
  'pointerdown',
  (e) => {

    if (!sourceImage) {
      return
    }


    drawing = true


    canvas.setPointerCapture(
      e.pointerId
    )


    start =
      pointerPosition(e)


    previewArea = {

      ...normalizeArea(
        start,
        start
      ),

      shape:
        currentTool

    }


    render()

  }
)


canvas.addEventListener(
  'pointermove',
  (e) => {

    if (!drawing) {
      return
    }


    const pos =
      pointerPosition(e)


    previewArea = {

      ...normalizeArea(
        start,
        pos
      ),

      shape:
        currentTool

    }


    render()

  }
)


canvas.addEventListener(
  'pointerup',
  (e) => {

    if (!drawing) {
      return
    }


    drawing = false


    const pos =
      pointerPosition(e)


    const rect =
      normalizeArea(
        start,
        pos
      )


    if (
      rect.w > 4 &&
      rect.h > 4
    ) {

      areas.push({

        ...rect,

        shape:
          currentTool,

        effect:
          effect.value,

        strength:
          Number(
            strength.value
          ),

        color:
          color.value

      })

    }


    previewArea = null

    render()

  }
)


canvas.addEventListener(
  'pointercancel',
  () => {

    drawing = false

    previewArea = null

    render()

  }
)


/* -------------------------------------------------------
   SELECCIONAR HERRAMIENTA
------------------------------------------------------- */

document
  .querySelectorAll('.tool')
  .forEach((button) => {

    button.addEventListener(
      'click',
      () => {

        currentTool =
          button.dataset.tool


        document
          .querySelectorAll('.tool')
          .forEach((b) => {

            b.classList.toggle(
              'active',
              b === button
            )

          })

      }
    )

  })


/* -------------------------------------------------------
   INTENSIDAD
------------------------------------------------------- */

strength.addEventListener(
  'input',
  () => {

    strengthValue.value =
      strength.value

    strengthValue.textContent =
      strength.value

    render()

  }
)


/* -------------------------------------------------------
   CAMBIO DE EFECTO
------------------------------------------------------- */

effect.addEventListener(
  'change',
  () => {

    const solid =
      effect.value === 'solid'


    strengthWrap.classList.toggle(
      'hidden',
      solid
    )


    colorWrap.classList.toggle(
      'hidden',
      !solid
    )

  }
)


/* -------------------------------------------------------
   DESHACER
------------------------------------------------------- */

$('#undoBtn').addEventListener(
  'click',
  () => {

    areas.pop()

    render()

  }
)


/* -------------------------------------------------------
   LIMPIAR
------------------------------------------------------- */

$('#clearBtn').addEventListener(
  'click',
  () => {

    areas = []

    render()

  }
)


/* -------------------------------------------------------
   NUEVA IMAGEN
------------------------------------------------------- */

$('#newBtn').addEventListener(
  'click',
  () => {

    sourceImage = null

    sourceCanvas = null

    areas = []

    previewArea = null

    editor.classList.add(
      'hidden'
    )

    uploadCard.classList.remove(
      'hidden'
    )

    fileInput.value = ''

  }
)


/* -------------------------------------------------------
   SELECCIONAR ARCHIVO
------------------------------------------------------- */

$('#chooseBtn').addEventListener(
  'click',
  () => {

    fileInput.click()

  }
)


fileInput.addEventListener(
  'change',
  (event) => {

    loadFile(
      event.target.files[0]
    )

  }
)


/* -------------------------------------------------------
   DESCARGAR
------------------------------------------------------- */

function downloadImage() {

  if (!sourceImage) {
    return
  }


  const output =
    document.createElement(
      'canvas'
    )


  output.width =
    sourceImage.naturalWidth


  output.height =
    sourceImage.naturalHeight


  const outputContext =
    output.getContext('2d')


  /*
   * Empezamos siempre desde
   * la imagen original.
   */

  outputContext.drawImage(
    sourceCanvas,
    0,
    0
  )


  /*
   * Aplicamos todas las áreas
   * a resolución original.
   */

  for (const area of areas) {

    applyArea(
      outputContext,
      area,
      1
    )

  }


  const link =
    document.createElement('a')


  link.download =
    'imagen-censurada.png'


  link.href =
    output.toDataURL(
      'image/png'
    )


  link.click()
}


$('#downloadBtn').addEventListener(
  'click',
  downloadImage
)


$('#downloadBtnMobile').addEventListener(
  'click',
  downloadImage
)


/* -------------------------------------------------------
   DRAG & DROP
------------------------------------------------------- */

;[
  'dragenter',
  'dragover'
].forEach((type) => {

  uploadCard.addEventListener(
    type,
    (event) => {

      event.preventDefault()

      uploadCard.classList.add(
        'dragging'
      )

    }
  )

})


;[
  'dragleave',
  'drop'
].forEach((type) => {

  uploadCard.addEventListener(
    type,
    (event) => {

      event.preventDefault()

      uploadCard.classList.remove(
        'dragging'
      )

    }
  )

})


uploadCard.addEventListener(
  'drop',
  (event) => {

    loadFile(
      event.dataTransfer.files[0]
    )

  }
)


/* -------------------------------------------------------
   RESPONSIVE
------------------------------------------------------- */

window.addEventListener(
  'resize',
  () => {

    if (sourceImage) {
      render()
    }

  }
)