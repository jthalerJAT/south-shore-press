/* South Shore Press — build an InDesign page from a layout spec + content data.
 * Exposes window.buildPage(spec, data, log). Pure InDesign UXP scripting DOM. */

(function () {
  const idsn = require('indesign');
  const uxp = require('uxp');
  const app = idsn.app;
  const {
    MeasurementUnits,
    FitOptions,
    Justification,
    VerticalJustification,
    ColorModel,
    ColorSpace,
    RulerOrigin,
    TextWrapModes,
  } = idsn;

  function hexToRgb(hex) {
    const h = String(hex).replace('#', '');
    return [
      parseInt(h.substr(0, 2), 16),
      parseInt(h.substr(2, 2), 16),
      parseInt(h.substr(4, 2), 16),
    ];
  }

  function color(doc, hex) {
    if (!hex) return null;
    const name = 'ssp_' + String(hex).replace('#', '').toLowerCase();
    let c = doc.colors.itemByName(name);
    if (!c.isValid) {
      c = doc.colors.add();
      try {
        c.name = name;
        c.model = ColorModel.PROCESS;
        c.space = ColorSpace.RGB;
        c.colorValue = hexToRgb(hex);
      } catch (e) {
        /* leave default */
      }
    }
    return c;
  }

  function resolve(data, path) {
    if (!path) return undefined;
    return String(path)
      .split('.')
      .reduce((o, k) => (o == null ? undefined : o[k]), data);
  }

  function justify(align) {
    if (align === 'center') return Justification.CENTER_ALIGN;
    if (align === 'right') return Justification.RIGHT_ALIGN;
    if (align === 'justify') return Justification.LEFT_JUSTIFIED;
    return Justification.LEFT_ALIGN;
  }

  // Collapse a plain-text body into clean InDesign paragraphs: each blank-line-
  // separated paragraph becomes one paragraph (return = \r), internal newlines
  // become spaces. Without this, "\n\n" makes empty paragraphs (blank lines).
  function toParagraphs(text) {
    return String(text)
      .split(/\n\s*\n/)
      .map((s) => s.replace(/\s*\n\s*/g, ' ').trim())
      .filter(function (s) {
        return s.length > 0;
      })
      .join('\r');
  }

  async function downloadToTemp(url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const buf = await resp.arrayBuffer();
      const tmp = await uxp.storage.localFileSystem.getTemporaryFolder();
      const m = /\.(jpg|jpeg|png|gif|tif|tiff|webp)(\?|$)/i.exec(url);
      const ext = m ? m[1].toLowerCase() : 'jpg';
      const name = 'ssp_' + Math.floor(Math.random() * 1e9) + '.' + ext;
      const file = await tmp.createFile(name, { overwrite: true });
      await file.write(buf, { format: uxp.storage.formats.binary });
      return file.nativePath;
    } catch (e) {
      return null;
    }
  }

  // geometricBounds is [y1, x1, y2, x2].
  function gb(x, y, w, h) {
    return [y, x, y + h, x + w];
  }

  function drawRect(doc, page, x, y, w, h, fillHex) {
    const r = page.rectangles.add();
    r.geometricBounds = gb(x, y, w, h);
    r.strokeWeight = 0;
    if (fillHex) r.fillColor = color(doc, fillHex);
    return r;
  }

  function drawText(doc, page, x, y, w, h, text, style) {
    const tf = page.textFrames.add();
    tf.geometricBounds = gb(x, y, w, h);
    try {
      tf.textFramePreferences.insetSpacing = [0, 0, 0, 0];
    } catch (e) {
      /* ignore */
    }
    const s = style || {};
    if (s.vAlign) {
      try {
        tf.textFramePreferences.verticalJustification =
          s.vAlign === 'center'
            ? VerticalJustification.CENTER_ALIGN
            : s.vAlign === 'bottom'
            ? VerticalJustification.BOTTOM_ALIGN
            : VerticalJustification.TOP_ALIGN;
      } catch (e) {
        /* ignore */
      }
    }
    const body = toParagraphs(text);
    tf.contents = s.uppercase ? body.toUpperCase() : body;
    const t = tf.parentStory.texts.item(0);
    try {
      t.hyphenation = false;
    } catch (e) {
      /* ignore */
    }
    if (s.firstLineIndent) {
      try {
        t.firstLineIndent = s.firstLineIndent;
      } catch (e) {
        /* ignore */
      }
    }
    try {
      if (s.font) {
        t.appliedFont = s.fontStyle ? s.font + '\t' + s.fontStyle : s.font;
      }
    } catch (e) {
      try {
        t.appliedFont = s.font;
      } catch (e2) {
        /* font missing — InDesign substitutes */
      }
    }
    if (s.size) t.pointSize = s.size;
    if (s.leading) {
      try {
        t.leading = s.leading;
      } catch (e) {
        /* auto leading */
      }
    }
    if (s.fill) t.fillColor = color(doc, s.fill);
    if (s.stroke) {
      t.strokeColor = color(doc, s.stroke);
      t.strokeWeight = s.strokeWeight || 1;
    }
    t.justification = justify(s.align);
    if (s.columns && s.columns > 1) {
      try {
        tf.textFramePreferences.textColumnCount = s.columns;
        if (s.columnGutter) tf.textFramePreferences.textColumnGutter = s.columnGutter;
      } catch (e) {
        /* ignore */
      }
    }
    return tf;
  }

  async function placeImage(doc, page, x, y, w, h, url, fit) {
    const r = page.rectangles.add();
    r.geometricBounds = gb(x, y, w, h);
    r.strokeWeight = 0;
    r.fillColor = color(doc, '#e4e4e7');
    const path = await downloadToTemp(url);
    if (!path) return r;
    try {
      r.place(path);
      r.fit(fit === 'contain' ? FitOptions.PROPORTIONALLY : FitOptions.FILL_PROPORTIONALLY);
      r.fit(FitOptions.CENTER_CONTENT);
      // Clear the grey placeholder fill so it doesn't show behind transparent
      // images (e.g. the logo PNG).
      try {
        const none = doc.swatches.itemByName('None');
        if (none && none.isValid) r.fillColor = none;
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      /* leave the grey placeholder */
    }
    return r;
  }

  async function renderElement(doc, page, el, value, x, y, w, h, log) {
    const isEmpty = value === undefined || value === null || String(value).trim() === '';
    if (el.skipIfEmpty && isEmpty && el.type !== 'rect' && el.type !== 'line') return;
    if (el.type === 'rect' && el.skipIfEmpty && isEmpty) return;

    try {
      let obj = null;
      if (el.type === 'rect' || el.type === 'line') {
        obj = drawRect(doc, page, x, y, w, h, el.style && el.style.fill);
      } else if (el.type === 'image') {
        if (isEmpty) return;
        obj = await placeImage(doc, page, x, y, w, h, value, el.fit);
      } else {
        if (isEmpty) return;
        const text = (el.prefix || '') + value;
        obj = drawText(doc, page, x, y, w, h, text, el.style);
      }
      // Text wrap (runaround): body text in overlapping frames flows around this
      // object — how InDesign natively wraps columns around a photo/byline.
      if (obj && el.textWrap) {
        try {
          obj.textWrapPreferences.textWrapMode = TextWrapModes.BOUNDING_BOX_TEXT_WRAP;
          obj.textWrapPreferences.textWrapOffset = el.textWrapOffset || [0, 0, 0, 0];
        } catch (e) {
          /* ignore */
        }
      }
    } catch (e) {
      if (log) log('  ! skipped a ' + el.type + ' element: ' + e.message);
    }
  }

  async function buildPage(spec, data, log) {
    // CRITICAL: make scripting interpret all numeric geometry as POINTS, and
    // set it BEFORE creating the doc (so pageWidth/Height are points too).
    // Otherwise InDesign uses the default ruler unit (often picas/inches) and
    // every frame lands far off the page.
    let prevUnit;
    try {
      prevUnit = app.scriptPreferences.measurementUnit;
      app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;
    } catch (e) {
      /* ignore */
    }

    const doc = app.documents.add();
    try {
      doc.documentPreferences.facingPages = false;
      doc.documentPreferences.pageWidth = spec.page.w;
      doc.documentPreferences.pageHeight = spec.page.h;
      doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.POINTS;
      doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.POINTS;
      doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
      doc.zeroPoint = [0, 0];
    } catch (e) {
      if (log) log('  ! could not set page size: ' + e.message);
    }

    const page = doc.pages.item(0);
    try {
      page.marginPreferences.top = 0;
      page.marginPreferences.left = 0;
      page.marginPreferences.right = 0;
      page.marginPreferences.bottom = 0;
    } catch (e) {
      /* ignore */
    }

    // Page-level elements.
    for (const el of spec.elements || []) {
      const value = el.value !== undefined ? el.value : resolve(data, el.bind);
      const [x, y, w, h] = el.bounds;
      await renderElement(doc, page, el, value, x, y, w, h, log);
    }

    // Tiles (one column per visible tile).
    const tilesSpec = spec.tiles;
    const tiles = (data && data.tiles) || [];
    if (tilesSpec && tiles.length) {
      const [rx, ry, rw, rh] = tilesSpec.region;
      const gap = tilesSpec.gap || 0;
      const n = tiles.length;
      if (tilesSpec.regionFill) drawRect(doc, page, rx, ry, rw, rh, tilesSpec.regionFill);
      const cellW = (rw - (n - 1) * gap) / n;
      for (let i = 0; i < n; i++) {
        const cellX = rx + i * (cellW + gap);
        const tile = tiles[i] || {};
        for (const el of tilesSpec.template || []) {
          const value = el.value !== undefined ? el.value : resolve(tile, el.bind);
          const ox = cellX + el.bounds[0];
          const oy = ry + el.bounds[1];
          const ow = el.bounds[2] <= 0 ? cellW + el.bounds[2] : el.bounds[2];
          const oh = el.bounds[3] <= 0 ? rh + el.bounds[3] : el.bounds[3];
          await renderElement(doc, page, el, value, ox, oy, ow, oh, log);
        }
      }
    }

    // Restore the user's measurement unit.
    try {
      if (prevUnit !== undefined) app.scriptPreferences.measurementUnit = prevUnit;
    } catch (e) {
      /* ignore */
    }
  }

  window.buildPage = buildPage;
})();
