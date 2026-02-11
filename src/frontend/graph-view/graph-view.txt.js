/**
 * ============================================
 * Graph View - Official Obsidian Publish Architecture
 * Adapted from app.js for standalone exported sites
 *
 * Dependencies:
 *   - PIXI.js (v7.2.4)
 *   - sim.js (Force simulation Web Worker, d3-force based)
 *   - graphData (global variable with node/link data)
 * ============================================
 */

/* ==========================================================
   Section 1: Helper / Utility Functions
   ========================================================== */

var RGBA_REGEX = /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)$/i;

function parseColor(colorStr) {
  var match = colorStr.match(RGBA_REGEX);
  if (!match) return null;
  var clampByte = function (val) { return 255 & parseInt(val); };
  return {
    r: clampByte(match[1]),
    g: clampByte(match[2]),
    b: clampByte(match[3]),
    a: match[4] ? Math.min(Math.max(parseFloat(match[4].substring(1)), 0), 1) : 1,
  };
}

function lerp(current, target, factor) {
  if (factor === undefined) factor = 0.9;
  return current * factor + target * (1 - factor);
}

function blendColor(colorA, colorB) {
  return (
    (lerp((colorA >> 16) & 255, (colorB >> 16) & 255) << 16) +
    (lerp((colorA >> 8) & 255, (colorB >> 8) & 255) << 8) +
    (0 | lerp(colorA & 255, colorB & 255))
  );
}

function rectsDisjoint(a, b) {
  return b.right < a.left || b.left > a.right || b.bottom < a.top || b.top > a.bottom;
}

function rectFromPoint(x, y, size) {
  return { left: x - size, right: x + size, top: y - size, bottom: y + size };
}

function rectUnion(a, b) {
  return {
    left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right),
    top: Math.min(a.top, b.top),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

function fillParent(el) {
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.border = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
}

/* ==========================================================
   Section 2: Constants
   ========================================================== */

var DEFAULT_FADE_ALPHA = 0.2;

var COLOR_CLASS_MAP = {
  fill:           "color-fill",
  fillFocused:    "color-fill-focused",
  fillTag:        "color-fill-tag",
  fillUnresolved: "color-fill-unresolved",
  fillAttachment: "color-fill-attachment",
  arrow:          "color-arrow",
  circle:         "color-circle",
  line:           "color-line",
  text:           "color-text",
  fillHighlight:  "color-fill-highlight",
  lineHighlight:  "color-line-highlight",
};

var CIRCLE_RADIUS = 100;

var GRAPH_FONT_FAMILY =
  'ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, ' +
  '"Segoe UI", Roboto, "Inter", "Apple Color Emoji", "Segoe UI Emoji", ' +
  '"Segoe UI Symbol", "Microsoft YaHei Light", sans-serif';

/* ==========================================================
   Section 3: GraphNode Class
   ========================================================== */

var GraphNode = (function () {
  function GraphNode(renderer, id, type) {
    this.x = null;
    this.y = null;
    this.fx = null;
    this.fy = null;
    this.forward = {};
    this.reverse = {};
    this.weight = 0;
    this.color = null;
    this.rendered = false;
    this.fadeAlpha = 0;
    this.moveText = 0;
    this.fontDirty = false;
    this.renderer = renderer;
    this.id = id;
    this.type = type;
  }

  GraphNode.prototype.initGraphics = function () {
    var self = this;
    if (this.rendered) return false;
    this.rendered = true;

    var renderer = this.renderer;
    var circle;

    circle = this.circle = new PIXI.Graphics();
    circle.eventMode = "static";
    circle.beginFill(0xffffff);
    circle.drawCircle(CIRCLE_RADIUS, CIRCLE_RADIUS, CIRCLE_RADIUS);
    circle.endFill();

    // Larger touch target on mobile
    if ("ontouchstart" in window) {
      circle.beginFill(0xffffff, 1e-4);
      circle.drawCircle(CIRCLE_RADIUS, CIRCLE_RADIUS, 500);
      circle.endFill();
    }

    circle.pivot.x = CIRCLE_RADIUS;
    circle.pivot.y = CIRCLE_RADIUS;
    circle.cursor = "pointer";
    circle.zIndex = 1;

    circle
      .on("pointerdown", function (evt) { return renderer.onPointerDown(self, evt); })
      .on("pointerover", function (evt) { return renderer.onPointerOver(self, evt); })
      .on("pointerout", function () { return renderer.onPointerOut(); });

    var fillColor = this.getFillColor();
    circle.alpha = fillColor.a;
    circle.tint = fillColor.rgb;
    renderer.hanger.addChild(circle);

    var textStyle = new PIXI.TextStyle(this.getTextStyle());
    var text = (this.text = new PIXI.Text(this.getDisplayText(), textStyle));
    text.eventMode = "none";
    text.resolution = 2;
    text.anchor.set(0.5, 0);
    text.zIndex = 2;
    renderer.hanger.addChild(text);

    this.fadeAlpha = 0;
    return true;
  };

  GraphNode.prototype.clearGraphics = function () {
    if (!this.rendered) return;
    this.rendered = false;

    var circle = this.circle;
    var highlight = this.highlight;
    var text = this.text;

    if (circle) {
      this.circle = null;
      if (circle.parent) circle.parent.removeChild(circle);
      circle.destroy();
    }
    if (highlight) {
      this.highlight = null;
      if (highlight.parent) highlight.parent.removeChild(highlight);
      highlight.destroy();
    }
    if (text) {
      this.text = null;
      if (text.parent) text.parent.removeChild(text);
      text.destroy();
    }
  };

  GraphNode.prototype.getTextStyle = function () {
    var renderer = this.renderer;
    var size = this.getSize();
    return new PIXI.TextStyle({
      fontSize: 14 + size / 4,
      fill: renderer.colors.text.rgb,
      fontFamily: GRAPH_FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: 300,
      align: "center",
    });
  };

  GraphNode.prototype.render = function () {
    if (!this.rendered) return;

    var self = this;
    var renderer = self.renderer;
    var x = self.x;
    var y = self.y;
    var circle = self.circle;
    var highlight = self.highlight;
    var text = self.text;
    var fadeAlpha = self.fadeAlpha;
    var moveText = self.moveText;

    var nodeSize = this.getSize();
    var fillColor = this.getFillColor();
    var textColor = renderer.colors.text;
    var highlightNode = renderer.getHighlightNode();
    var isFocused = highlightNode === this;
    var nodeScale = renderer.nodeScale;
    var wasTextVisible = text.visible;

    var targetFade = DEFAULT_FADE_ALPHA;
    if (
      !highlightNode ||
      isFocused ||
      this.forward.hasOwnProperty(highlightNode.id) ||
      this.reverse.hasOwnProperty(highlightNode.id)
    ) {
      targetFade = 1;
    }

    var alpha = (fadeAlpha = this.fadeAlpha = lerp(fadeAlpha, targetFade));
    var circleAlpha = alpha * fillColor.a;

    var textAlpha = renderer.textAlpha;
    textAlpha *= alpha;
    if (isFocused) textAlpha = 1;
    textAlpha *= textColor.a;

    var targetMoveText = isFocused ? 15 : 0;
    moveText = this.moveText = wasTextVisible ? lerp(moveText, targetMoveText) : targetMoveText;

    var showText = textAlpha > 0.001;
    var viewport = renderer.viewport;
    var showCircle = isFocused || !rectsDisjoint(viewport, rectFromPoint(x, y, nodeSize * nodeScale + 1));

    if (showText) {
      showText = isFocused || !rectsDisjoint(viewport, {
        left: x - 300, right: x + 300, top: y, bottom: y + 200,
      });
    }

    circle.tint = blendColor(circle.tint, fillColor.rgb);
    circle.visible = showCircle;
    if (showCircle) {
      circle.x = x;
      circle.y = y;
      circle.scale.x = circle.scale.y = nodeSize / 100 * nodeScale;
      circle.alpha = circleAlpha;
    }

    text.visible = showText;
    if (showText) {
      text.x = x;
      text.y = y + (nodeSize + 5) * nodeScale + moveText / renderer.scale;
      text.scale.x = text.scale.y = nodeScale;
      if (isFocused && renderer.scale < 1) {
        text.scale.x = text.scale.y = 1 / renderer.scale;
      }
      text.alpha = textAlpha;
    }

    if (isFocused) {
      if (!highlight) {
        highlight = this.highlight = new PIXI.Graphics();
        highlight.eventMode = "none";
        highlight.zIndex = 1;
        renderer.hanger.addChild(highlight);
      }
      highlight.x = x;
      highlight.y = y;
      highlight.scale.x = highlight.scale.y = nodeScale;
      highlight.clear();
      var lineWidth = Math.max(1, 1 / renderer.scale / nodeScale);
      var circleColor = renderer.colors.circle;
      highlight.alpha = circleColor.a;
      highlight.lineStyle(lineWidth, circleColor.rgb, 1);
      highlight.drawCircle(0, 0, nodeSize + lineWidth / 2);
    } else if (highlight) {
      highlight.parent.removeChild(highlight);
      highlight.destroy();
      this.highlight = null;
    }

    if (this.fontDirty) {
      this.fontDirty = false;
      text.style = this.getTextStyle();
    }
  };

  GraphNode.prototype.getFillColor = function () {
    var renderer = this.renderer;
    var type = this.type;
    var customColor = this.color;

    if (renderer.getHighlightNode() === this) return renderer.colors.fillHighlight;

    if (type === "focused") {
      var focusedColor = renderer.colors.fillFocused;
      if (focusedColor.a > 0) return focusedColor;
    } else {
      if (customColor) return customColor;
      if (type === "tag") return renderer.colors.fillTag;
      if (type === "unresolved") return renderer.colors.fillUnresolved;
      if (type === "attachment") return renderer.colors.fillAttachment;
    }
    return renderer.colors.fill;
  };

  GraphNode.prototype.getSize = function () {
    return this.renderer.fNodeSizeMult * Math.max(8, Math.min(3 * Math.sqrt(this.weight + 1), 30));
  };

  GraphNode.prototype.getDisplayText = function () {
    return this._displayText || this.id;
  };

  GraphNode.prototype.getRelated = function () {
    return Object.keys(this.forward).concat(Object.keys(this.reverse));
  };

  return GraphNode;
})();

/* ==========================================================
   Section 4: GraphLink Class
   ========================================================== */

var GraphLink = (function () {
  function GraphLink(renderer, source, target) {
    this.rendered = false;
    this.renderer = renderer;
    this.source = source;
    this.target = target;
  }

  GraphLink.prototype.initGraphics = function () {
    if (this.rendered) return;
    if (!this.source.rendered || !this.target.rendered) return;

    this.rendered = true;
    var renderer = this.renderer;

    var container = (this.px = new PIXI.Container());
    renderer.hanger.addChild(container);

    var line = (this.line = new PIXI.Sprite(PIXI.Texture.WHITE));
    line.eventMode = "none";
    var lineColor = renderer.colors.line;
    line.alpha = DEFAULT_FADE_ALPHA * lineColor.a;
    line.tint = lineColor.rgb;
    container.addChild(line);

    var arrow = (this.arrow = new PIXI.Graphics());
    arrow.eventMode = "none";
    var textColor = renderer.colors.text;
    arrow.alpha = DEFAULT_FADE_ALPHA * textColor.a;
    arrow.tint = textColor.rgb;
    arrow.beginFill(0xffffff);
    arrow.moveTo(0, 0);
    arrow.lineTo(-4, -2);
    arrow.lineTo(-3, 0);
    arrow.lineTo(-4, 2);
    arrow.lineTo(0, 0);
    arrow.endFill();
    arrow.zIndex = 1;
    renderer.hanger.addChild(arrow);
  };

  GraphLink.prototype.clearGraphics = function () {
    if (!this.rendered) return;
    this.rendered = false;

    var container = this.px;
    var line = this.line;
    var arrow = this.arrow;

    if (container) {
      this.px = null;
      if (container.parent) container.parent.removeChild(container);
      container.destroy();
    }
    if (line) {
      this.line = null;
      line.destroy();
    }
    if (arrow) {
      this.arrow = null;
      if (arrow.parent) arrow.parent.removeChild(arrow);
      arrow.destroy();
    }
  };

  GraphLink.prototype.render = function () {
    if (!this.rendered) return;

    var container = this.px;
    var line = this.line;
    var arrow = this.arrow;
    var renderer = this.renderer;
    var source = this.source;
    var target = this.target;

    var highlightNode = renderer.getHighlightNode();
    var isHighlighted = source === highlightNode || target === highlightNode;

    var fadeTarget = DEFAULT_FADE_ALPHA;
    if (!highlightNode || isHighlighted) fadeTarget = 1;

    var arrowAlpha = fadeTarget * Math.min(Math.max(2 * (renderer.scale - 0.3), 0), 1);

    var lineColorObj = renderer.colors.line;
    if (isHighlighted) lineColorObj = renderer.colors.lineHighlight;
    var arrowColorObj = renderer.colors.arrow;

    var showLine = !(
      source.reverse.hasOwnProperty(target.id) &&
      source.id.localeCompare(target.id) < 0
    );
    var showArrow = renderer.fShowArrow;
    var lineWidth = renderer.fLineSizeMult / renderer.scale;

    var viewport = renderer.viewport;
    var sourceRect = rectFromPoint(source.x, source.y, lineWidth);
    var targetRect = rectFromPoint(target.x, target.y, lineWidth);
    var inView = !rectsDisjoint(viewport, rectUnion(sourceRect, targetRect));

    fadeTarget *= lineColorObj.a;
    arrowAlpha *= arrowColorObj.a;
    line.alpha = lerp(line.alpha, fadeTarget);
    arrow.alpha = lerp(arrow.alpha, arrowAlpha);

    showLine = showLine && inView;
    showArrow = showArrow && inView && arrow.alpha > 0.001;

    line.visible = showLine;
    arrow.visible = showArrow;

    if (!showLine && !showArrow) return;

    var dx = target.x - source.x;
    var dy = target.y - source.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var sourceSize = source.getSize() * renderer.nodeScale;
    var targetSize = target.getSize() * renderer.nodeScale;

    arrow.visible = showArrow = showArrow && dist > lineWidth;

    if (showLine) {
      container.x = source.x + (dx * sourceSize) / dist;
      container.y = source.y + (dy * sourceSize) / dist;
      container.pivot.set(0, 0);
      container.rotation = Math.atan2(dy, dx);
      line.x = 0;
      line.y = -lineWidth / 2;
      line.width = Math.max(0, dist - sourceSize - targetSize);
      line.height = lineWidth;
      line.tint = blendColor(line.tint, lineColorObj.rgb);
    }

    arrow.visible = showArrow;
    if (showArrow) {
      var arrowOffset = targetSize + 1;
      arrow.x = target.x - (dx * arrowOffset) / dist;
      arrow.y = target.y - (dy * arrowOffset) / dist;
      arrow.pivot.set(0, 0);
      arrow.rotation = Math.atan2(dy, dx);
      arrow.scale.x = arrow.scale.y = 2 * Math.sqrt(renderer.fLineSizeMult) / renderer.scale;
      arrow.tint = arrowColorObj.rgb;
    }
  };

  return GraphLink;
})();

/* ==========================================================
   Section 5: GraphRenderer Class (Core rendering engine)
   ========================================================== */

var GraphRenderer = (function () {
  function GraphRenderer(containerEl, worker) {
    var self = this;

    this.interactiveEl = null;
    this.onNodeClick = null;
    this.onNodeHover = null;
    this.onNodeUnhover = null;
    this.workerResults = null;

    this.nodeLookup = {};
    this.nodes = [];
    this.links = [];

    this.dragNode = null;
    this.highlightNode = null;

    this.px = null;
    this.hanger = null;

    this.scale = 1;
    this.nodeScale = 1;
    this.textAlpha = 1;
    this.targetScale = 1;
    this.panX = 0;
    this.panY = 0;
    this.panvX = 0;
    this.panvY = 0;
    this.panning = false;

    this.width = 0;
    this.height = 0;
    this.viewport = null;

    this.zoomCenterX = 0;
    this.zoomCenterY = 0;

    this.fNodeSizeMult = 1;
    this.fLineSizeMult = 1;
    this.fTextShowMult = 1;
    this.fShowArrow = false;

    this.mouseX = null;
    this.mouseY = null;

    this.colors = {};
    this.renderTimer = null;
    this.idleFrames = 0;

    this.containerEl = containerEl;
    this.testCSS();

    var canvas = (this.interactiveEl = document.createElement("canvas"));
    containerEl.appendChild(canvas);
    containerEl.style.padding = "0";
    containerEl.style.overflow = "hidden";
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    fillParent(canvas);

    canvas.addEventListener("mousedown", function (e) { return e.preventDefault(); });
    canvas.addEventListener("wheel", this.onWheel.bind(this), { passive: false });
    canvas.addEventListener("mousemove", this.onMouseMove.bind(this), { passive: true });
    canvas.addEventListener("mouseout", this.onMouseMove.bind(this));

    this.worker = worker;
    worker.onmessage = function (e) {
      if (!e.data.ignore) {
        self.workerResults = e.data;
        self.changed();
      }
    };

    var renderCanvas = document.createElement("canvas");
    containerEl.appendChild(renderCanvas);
    fillParent(renderCanvas);
    setTimeout(function () {
      try {
        self.initGraphics(renderCanvas);
      } catch (err) {
        setTimeout(function () { self.initGraphics(renderCanvas); }, 300);
      }
    }, 50);
  }

  /* ------ Lifecycle ------ */

  GraphRenderer.prototype.destroy = function () {
    this.worker.terminate();
    this.workerResults = null;
    this.destroyGraphics();
  };

  /* ------ Input Handlers ------ */

  GraphRenderer.prototype.onWheel = function (e) {
    e.preventDefault();
    if (!this.px) return;

    var deltaY = e.deltaY;
    if (e.deltaMode === 1) deltaY *= 40;
    else if (e.deltaMode === 2) deltaY *= 800;

    var newScale = this.targetScale;
    newScale *= Math.pow(1.5, -deltaY / 120);
    this.targetScale = newScale;

    if (newScale < this.scale) {
      this.zoomCenterX = 0;
      this.zoomCenterY = 0;
    } else {
      var dpr = window.devicePixelRatio;
      this.zoomCenterX = e.offsetX * dpr;
      this.zoomCenterY = e.offsetY * dpr;
    }
    this.changed();
  };

  GraphRenderer.prototype.onMouseMove = function (e) {
    if (e.type === "mouseout") {
      this.mouseX = this.mouseY = null;
    } else {
      this.mouseX = e.offsetX;
      this.mouseY = e.offsetY;
    }
  };

  /* ------ Graphics Initialization ------ */

  GraphRenderer.prototype.initGraphics = function (canvasEl) {
    var pixiApp;
    var self = this;
    var interactiveEl = this.interactiveEl;
    var worker = this.worker;

    PIXI.settings.RENDER_OPTIONS.hello = false;

    pixiApp = this.px = new PIXI.Application({
      view: canvasEl,
      antialias: true,
      backgroundAlpha: 0,
      autoStart: false,
    });

    pixiApp.renderer.events.setTargetElement(interactiveEl);

    // --- Node Drag Interaction ---
    var clickOrigin = null;

    this.onPointerDown = function (node, pointerEvent) {
      if (pointerEvent.nativeEvent.target === interactiveEl) {
        if (!multiTouchB) {
          self.dragNode = node;
          clickOrigin = pointerEvent.getLocalPosition(pixiApp.stage);
        }
      }
    };

    var onPointerUp = function (pointerEvent) {
      if (pointerEvent.nativeEvent instanceof TouchEvent) {
        touchHandler(pointerEvent.nativeEvent);
      }
      var dragNode = self.dragNode;
      if (dragNode) {
        var nativeEvt = pointerEvent.nativeEvent;
        if (clickOrigin && self.onNodeClick) {
          if (
            (nativeEvt instanceof MouseEvent &&
              (nativeEvt.button === 0 || nativeEvt.button === 1)) ||
            nativeEvt instanceof TouchEvent
          ) {
            self.onNodeClick(nativeEvt, dragNode.id, dragNode.type);
          }
        }
        dragNode.fx = null;
        dragNode.fy = null;
        worker.postMessage({
          alphaTarget: 0,
          forceNode: { id: dragNode.id, x: null, y: null },
        });
        clickOrigin = null;
        self.dragNode = null;
        self.changed();
      }
    };

    pixiApp.stage
      .on("pointermove", function (pointerEvent) {
        var dragNode = self.dragNode;
        if (!dragNode) return;

        if (multiTouchB) {
          clickOrigin = null;
          self.dragNode = null;
          return;
        }

        if (clickOrigin) {
          var pos = pointerEvent.getLocalPosition(pixiApp.stage);
          var dx = pos.x - clickOrigin.x;
          var dy = pos.y - clickOrigin.y;
          if (dx * dx + dy * dy > 25) clickOrigin = null;
        }

        var worldPos = pointerEvent.getLocalPosition(self.hanger);
        dragNode.fx = worldPos.x;
        dragNode.fy = worldPos.y;
        worker.postMessage({
          alpha: 0.3,
          alphaTarget: 0.3,
          run: true,
          forceNode: { id: dragNode.id, x: worldPos.x, y: worldPos.y },
        });
        self.changed();
      })
      .on("pointerup", onPointerUp)
      .on("pointerupoutside", onPointerUp).eventMode = "static";

    // --- Hover ---
    this.onPointerOver = function (node, pointerEvent) {
      if (pointerEvent.pointerType === "touch") return;
      self.highlightNode = node;
      self.changed();
      var nativeEvt = pointerEvent.nativeEvent;
      if (nativeEvt instanceof MouseEvent) {
        self.mouseX = nativeEvt.offsetX;
        self.mouseY = nativeEvt.offsetY;
      }
      if (self.onNodeHover) self.onNodeHover(nativeEvt, node.id, node.type);
    };

    this.onPointerOut = function () {
      self.highlightNode = null;
      self.changed();
      if (self.onNodeUnhover) self.onNodeUnhover();
    };

    // --- Scene Setup ---
    var hanger = (this.hanger = new PIXI.Container());
    hanger.eventMode = "static";

    this.onResize();
    this.resetPan();

    var bgRect = new PIXI.Graphics();
    bgRect.eventMode = "static";
    bgRect.beginFill(0);
    bgRect.drawRect(0, 0, 1e4, 1e4);
    bgRect.endFill();
    bgRect.alpha = 0;

    // --- Touch Panning & Pinch Zoom ---
    var panStart = null;
    var panOrigin = null;
    var lastTime = performance.now();
    var smoothDt = 0;
    var touchA = null;
    var multiTouchB = null;
    var velocityX = 0;
    var velocityY = 0;

    var touchHandler = function (touchEvent) {
      var now = performance.now();
      var dt = now - lastTime;
      var touches = Array.prototype.slice.call(touchEvent.touches);
      var newA = null;
      var newB = null;

      for (var i = 0; i < touches.length; i++) {
        var t = touches[i];
        if (touchA && t.identifier === touchA.identifier) newA = t;
        if (multiTouchB && t.identifier === multiTouchB.identifier) newB = t;
      }

      if (newB && !newA) {
        touchA = multiTouchB;
        newA = newB;
        multiTouchB = null;
        newB = null;
      }

      if (newA) { var idx = touches.indexOf(newA); if (idx >= 0) touches.splice(idx, 1); }
      else if (touches.length > 0) { newA = touches[0]; touches.splice(0, 1); }
      if (newB) { var idx2 = touches.indexOf(newB); if (idx2 >= 0) touches.splice(idx2, 1); }
      else if (touches.length > 0) { newB = touches[0]; touches.splice(0, 1); }

      if (!clickOrigin && !self.dragNode && touchA && newA && touchA.identifier === newA.identifier) {
        var dpr = window.devicePixelRatio;

        if (multiTouchB && newB && multiTouchB.identifier === newB.identifier) {
          var rect = self.interactiveEl.getBoundingClientRect();
          var oldMidX = ((touchA.clientX + multiTouchB.clientX) / 2 - rect.x) * dpr;
          var oldMidY = ((touchA.clientY + multiTouchB.clientY) / 2 - rect.y) * dpr;
          var newMidX = ((newA.clientX + newB.clientX) / 2 - rect.x) * dpr;
          var newMidY = ((newA.clientY + newB.clientY) / 2 - rect.y) * dpr;

          var oldDx = touchA.clientX - multiTouchB.clientX;
          var oldDy = touchA.clientY - multiTouchB.clientY;
          var newDx = newA.clientX - newB.clientX;
          var newDy = newA.clientY - newB.clientY;
          var oldDist = oldDx * oldDx + oldDy * oldDy;
          var newDist = newDx * newDx + newDy * newDy;

          if (oldDist !== 0 && newDist !== 0) {
            var ratio = Math.sqrt(newDist / oldDist);
            var newScale = self.targetScale * ratio;
            var newPanX = self.panX + (newMidX - oldMidX);
            var newPanY = self.panY + (newMidY - oldMidY);
            self.zoomCenterX = newMidX;
            self.zoomCenterY = newMidY;
            self.setPan(newPanX, newPanY);
            self.targetScale = newScale;
            self.changed();
          }
          velocityX = 0;
          velocityY = 0;
        } else {
          var panDx = (newA.clientX - touchA.clientX) * dpr;
          var panDy = (newA.clientY - touchA.clientY) * dpr;
          smoothDt = lerp(smoothDt, dt, 0.8);
          lastTime = now;
          velocityX = lerp(velocityX, panDx, 0.8);
          velocityY = lerp(velocityY, panDy, 0.8);
          self.setPan(self.panX + panDx, self.panY + panDy);
          self.changed();
        }
      } else {
        smoothDt = lerp(smoothDt, dt, 0.8);
        if (dt < 100) {
          self.panvX = velocityX / smoothDt;
          self.panvY = velocityY / smoothDt;
        }
        velocityX = velocityY = 0;
      }

      touchA = newA;
      multiTouchB = newB;
    };

    var onBgPointerUp = function (pointerEvent) {
      if (pointerEvent.nativeEvent instanceof TouchEvent) {
        touchHandler(pointerEvent.nativeEvent);
      } else {
        panStart = null;
        document.body.classList.remove("is-grabbing");
        self.panning = false;
        var dt = performance.now() - lastTime;
        smoothDt = lerp(smoothDt, dt, 0.8);
        if (dt > 100) {
          self.panvX = self.panvY = 0;
        } else {
          self.panvX /= smoothDt;
          self.panvY /= smoothDt;
        }
      }
    };

    bgRect.on("pointerdown", function (pointerEvent) {
      if (pointerEvent.nativeEvent instanceof TouchEvent) {
        touchHandler(pointerEvent.nativeEvent);
      } else {
        panStart = pointerEvent.getLocalPosition(pixiApp.stage);
        panOrigin = { x: hanger.x, y: hanger.y };
        document.body.classList.add("is-grabbing");
        self.panning = true;
      }
    });

    pixiApp.stage
      .on("pointermove", function (pointerEvent) {
        if (pointerEvent.nativeEvent instanceof TouchEvent) {
          touchHandler(pointerEvent.nativeEvent);
        } else if (panStart) {
          var pos = pointerEvent.getLocalPosition(pixiApp.stage);
          var newX = panOrigin.x + pos.x - panStart.x;
          var newY = panOrigin.y + pos.y - panStart.y;
          var now = performance.now();
          smoothDt = lerp(smoothDt, now - lastTime, 0.8);
          lastTime = now;
          self.panvX = lerp(self.panvX, newX - self.panX, 0.8);
          self.panvY = lerp(self.panvY, newY - self.panY, 0.8);
          self.setPan(newX, newY);
          self.changed();
        }
      })
      .on("pointerup", onBgPointerUp)
      .on("pointerupoutside", onBgPointerUp).eventMode = "static";

    pixiApp.stage.addChild(bgRect);
    pixiApp.stage.addChild(hanger);
    this.updateZoom();

    // ==========================================
    // Main Render Loop (requestAnimationFrame)
    // ==========================================
    this.renderCallback = function () {
      self.renderTimer = null;
      if (!self.px) return;
      if (self.idleFrames > 60) return;

      var nodes = self.nodes;
      var links = self.links;

      // --- Process worker results (force simulation positions) ---
      var results = self.workerResults;
      if (results) {
        var nodeIds = results.id;
        var buffer = results.buffer;
        var shouldUpdate = true;

        if (buffer instanceof ArrayBuffer) {
          self.workerResults = null;
        } else {
          var versionView = new Uint32Array(buffer, buffer.byteLength - 4, 1);
          if (versionView[0] === results.v) {
            shouldUpdate = false;
          } else {
            results.v = versionView[0];
          }
        }

        if (shouldUpdate) {
          var positions = new Float32Array(buffer);
          for (var i = 0; i < nodeIds.length; i++) {
            var node = self.nodeLookup[nodeIds[i]];
            if (node) {
              node.x = positions[2 * i];
              node.y = positions[2 * i + 1];
              if (node.fx) node.x = node.fx;
              if (node.fy) node.y = node.fy;
            }
          }
        }
      }

      // --- Keyboard-driven panning & zooming ---
      var isPanning = self.panning;
      var pvx = self.panvX;
      var pvy = self.panvY;

      if (!isPanning) {
        self.panX += (1000 * pvx) / 60;
        self.panY += (1000 * pvy) / 60;
        self.panvX = lerp(pvx, 0, 0.9);
        self.panvY = lerp(pvy, 0, 0.9);
      }

      self.updateZoom();

      // --- Compute viewport in world coordinates ---
      var scale = self.scale;
      var viewLeft = -self.panX / scale;
      var viewTop = -self.panY / scale;
      var dpr2 = window.devicePixelRatio;
      var viewRight = viewLeft + (self.width / scale) * dpr2;
      var viewBottom = viewTop + (self.height / scale) * dpr2;
      self.viewport = { left: viewLeft, right: viewRight, top: viewTop, bottom: viewBottom };

      var centerX = (viewLeft + viewRight) / 2;
      var centerY = (viewTop + viewBottom) / 2;

      // --- Lazy init: find closest un-rendered nodes ---
      var toInit = [];
      var distCompare = function (a, b) { return a.dist - b.dist; };
      for (var j = 0; j < nodes.length; j++) {
        var nd = nodes[j];
        if (!nd.rendered) {
          var ddx = nd.x - centerX;
          var ddy = nd.y - centerY;
          var dist2 = ddx * ddx + ddy * ddy;
          if (toInit.length < 50 || dist2 < toInit[toInit.length - 1].dist) {
            toInit.push({ node: nd, dist: dist2 });
            toInit.sort(distCompare);
            if (toInit.length > 50) toInit.pop();
          }
        }
      }
      if (toInit.length > 0) {
        for (var k = 0; k < toInit.length; k++) {
          toInit[k].node.initGraphics();
        }
        self.idleFrames = 0;
      }

      for (var li = 0; li < links.length; li++) {
        links[li].initGraphics();
      }

      for (var ni = 0; ni < nodes.length; ni++) {
        nodes[ni].render();
      }

      for (var ei = 0; ei < links.length; ei++) {
        links[ei].render();
      }

      hanger.sortChildren();
      pixiApp.render();

      self.idleFrames++;
      self.queueRender();

      // --- Hover detection: unhover if mouse moved away ---
      var mx = self.mouseX;
      var my = self.mouseY;
      var hn = self.highlightNode;
      if (mx !== null && my !== null && hn) {
        var worldX = (mx * dpr2 - self.panX) / scale;
        var worldY = (my * dpr2 - self.panY) / scale;
        var hdx = hn.x - worldX;
        var hdy = hn.y - worldY;
        var hSize = hn.getSize() * self.nodeScale + 2;
        if (hdx * hdx + hdy * hdy > hSize * hSize) {
          self.highlightNode = null;
          self.idleFrames = 0;
          if (self.onNodeUnhover) self.onNodeUnhover();
        }
      }
    };

    this.queueRender();
  };

  /* ------ Graphics Teardown ------ */

  GraphRenderer.prototype.destroyGraphics = function () {
    var px = this.px;
    var links = this.links;
    var nodes = this.nodes;

    this.hanger = null;

    for (var i = 0; i < links.length; i++) links[i].clearGraphics();
    for (var j = 0; j < nodes.length; j++) nodes[j].clearGraphics();

    if (px) {
      px.renderer.events.setTargetElement(null);
      px.destroy(true, { children: true, texture: true, baseTexture: true });
      this.px = null;
    }

    window.cancelAnimationFrame(this.renderTimer);
    this.renderTimer = null;
    this.renderCallback = null;
    document.body.classList.remove("is-grabbing");
  };

  /* ------ View Transform ------ */

  GraphRenderer.prototype.zoomTo = function (targetScale, center) {
    this.targetScale = targetScale;
    if (center) {
      this.zoomCenterX = center.x;
      this.zoomCenterY = center.y;
    } else {
      this.zoomCenterX = this.zoomCenterY = 0;
    }
  };

  GraphRenderer.prototype.onResize = function () {
    var px = this.px;
    var hanger = this.hanger;
    var container = this.containerEl;
    var canvas = this.interactiveEl;
    var dpr = window.devicePixelRatio;

    var w = container.clientWidth;
    var h = container.clientHeight;
    this.width = w;
    this.height = h;

    if (px) {
      var pixelW = Math.round(w * dpr);
      var pixelH = Math.round(h * dpr);
      var renderer = px.renderer;
      var oldW = renderer.width;
      var oldH = renderer.height;

      renderer.view.style.width = w + "px";
      renderer.view.style.height = h + "px";
      renderer.resize(pixelW, pixelH);
      canvas.width = w;
      canvas.height = h;
      px.renderer.events.resolutionChange(1 / dpr);

      if (hanger) {
        this.setPan(this.panX + (pixelW - oldW) / 2, this.panY + (pixelH - oldH) / 2);
      }
    }
    this.changed();
  };

  GraphRenderer.prototype.resetPan = function () {
    var dpr = window.devicePixelRatio;
    this.setPan((this.width / 2) * dpr, (this.height / 2) * dpr);
  };

  /* ------ Data Management ------ */

  GraphRenderer.prototype.setData = function (data) {
    var self = this;
    var existingNodes = self.nodes;
    var nodeLookup = self.nodeLookup;
    var existingLinks = self.links;
    var newNodeMap = data.nodes;

    var removedLinks = [];
    var removedNodes = [];
    var changed = false;
    var colorChanged = false;
    var maxDistSq = 0;

    for (var i = 0; i < existingNodes.length; i++) {
      var node = existingNodes[i];
      if (newNodeMap.hasOwnProperty(node.id)) {
        maxDistSq = Math.max(maxDistSq, node.x * node.x + node.y * node.y);
      } else {
        removedNodes.push(node);
        changed = true;
      }
    }
    var maxDist = Math.sqrt(maxDistSq);

    var addedNodes = [];
    for (var id in newNodeMap) {
      if (!newNodeMap.hasOwnProperty(id)) continue;
      var nodeData = newNodeMap[id];

      if (nodeLookup.hasOwnProperty(id)) {
        var existingNode = nodeLookup[id];
        var newColor = nodeData.color || null;
        if (existingNode.color !== newColor) {
          existingNode.color = newColor;
          colorChanged = true;
        }
        if (existingNode.type !== nodeData.type) {
          existingNode.type = nodeData.type;
          colorChanged = true;
        }
      } else {
        var newNode = new GraphNode(this, id, nodeData.type);
        newNode.color = nodeData.color || null;
        newNode._displayText = nodeData.displayText || id;
        existingNodes.push(newNode);
        nodeLookup[id] = newNode;
        changed = true;
        addedNodes.push(newNode);
      }
    }

    for (var id2 in newNodeMap) {
      if (!newNodeMap.hasOwnProperty(id2) || !nodeLookup.hasOwnProperty(id2)) continue;
      var node2 = nodeLookup[id2];
      var targetLinks = newNodeMap[id2].links;

      for (var fwdId in node2.forward) {
        if (node2.forward.hasOwnProperty(fwdId) && !targetLinks.hasOwnProperty(fwdId)) {
          removedLinks.push(node2.forward[fwdId]);
          changed = true;
        }
      }

      for (var targetId in targetLinks) {
        if (
          targetLinks.hasOwnProperty(targetId) &&
          !node2.forward.hasOwnProperty(targetId) &&
          nodeLookup.hasOwnProperty(targetId)
        ) {
          var targetNode = nodeLookup[targetId];
          var link = new GraphLink(this, node2, targetNode);
          existingLinks.push(link);
          node2.forward[targetNode.id] = link;
          targetNode.reverse[node2.id] = link;
          changed = true;
        }
      }
    }

    var removeLink = function (lnk) {
      lnk.clearGraphics();
      var idx = existingLinks.indexOf(lnk);
      if (idx >= 0) existingLinks.splice(idx, 1);
      delete lnk.source.forward[lnk.target.id];
      delete lnk.target.reverse[lnk.source.id];
    };

    for (var ri = 0; ri < removedLinks.length; ri++) {
      removeLink(removedLinks[ri]);
    }

    for (var rn = 0; rn < removedNodes.length; rn++) {
      var rmNode = removedNodes[rn];
      rmNode.clearGraphics();
      var rmIdx = existingNodes.indexOf(rmNode);
      if (rmIdx >= 0) existingNodes.splice(rmIdx, 1);
      delete nodeLookup[rmNode.id];

      for (var fId in rmNode.forward) {
        if (rmNode.forward.hasOwnProperty(fId)) removeLink(rmNode.forward[fId]);
      }
      for (var rId in rmNode.reverse) {
        if (rmNode.reverse.hasOwnProperty(rId)) removeLink(rmNode.reverse[rId]);
      }
    }

    var numAdded = addedNodes.length;
    if (numAdded > 0) {
      var area = 60 * numAdded * 60;
      var ringRadius = Math.sqrt(area / Math.PI + maxDist * maxDist) - maxDist;
      var scatterSize = Math.sqrt(area);

      for (var ai = 0; ai < addedNodes.length; ai++) {
        var addNode = addedNodes[ai];
        var sumX = 0, sumY = 0, neighborCount = 0;

        var related = addNode.getRelated();
        for (var ri2 = 0; ri2 < related.length; ri2++) {
          var neighborId = related[ri2];
          if (nodeLookup.hasOwnProperty(neighborId)) {
            var neighbor = nodeLookup[neighborId];
            if (neighbor.x !== null && neighbor.y !== null) {
              sumX += neighbor.x;
              sumY += neighbor.y;
              neighborCount++;
            }
          }
        }

        if (neighborCount > 0) {
          addNode.x = sumX / neighborCount + (Math.random() - 0.5) * scatterSize;
          addNode.y = sumY / neighborCount + (Math.random() - 0.5) * scatterSize;
        } else {
          var angle = 2 * Math.random() * Math.PI;
          var dist = maxDist + Math.sqrt(Math.random()) * ringRadius;
          addNode.x = dist * Math.cos(angle);
          addNode.y = dist * Math.sin(angle);
        }
      }
    }

    var weights = data.weights;
    for (var wid in nodeLookup) {
      if (!nodeLookup.hasOwnProperty(wid)) continue;
      var wNode = nodeLookup[wid];
      var newWeight;
      newWeight = weights
        ? (weights.hasOwnProperty(wid) ? weights[wid] : 0)
        : wNode.getRelated().length;
      if (wNode.weight !== newWeight) {
        wNode.weight = newWeight;
        changed = true;
      }
    }

    if (changed) {
      var linkPairs = [];
      for (var li2 = 0; li2 < existingLinks.length; li2++) {
        var lnk2 = existingLinks[li2];
        linkPairs.push([lnk2.source.id, lnk2.target.id]);
      }

      var nodePositions = {};
      for (var ai2 = 0; ai2 < addedNodes.length; ai2++) {
        var an = addedNodes[ai2];
        nodePositions[an.id] = [an.x, an.y];
      }

      this.worker.postMessage({
        nodes: nodePositions,
        links: linkPairs,
        alpha: 0.3,
        run: true,
      });
      this.changed();
    } else if (colorChanged) {
      this.changed();
    }
  };

  /* ------ Render Options ------ */

  GraphRenderer.prototype.setRenderOptions = function (options) {
    var nodeSizeMult = options.nodeSizeMultiplier;
    var lineSizeMult = options.lineSizeMultiplier;
    var showArrow = options.showArrow;
    var textFadeMult = options.textFadeMultiplier;

    if (typeof nodeSizeMult === "number") this.fNodeSizeMult = nodeSizeMult;
    if (typeof lineSizeMult === "number") this.fLineSizeMult = lineSizeMult;
    if (typeof textFadeMult === "number") this.fTextShowMult = textFadeMult;
    if (typeof showArrow === "boolean") this.fShowArrow = showArrow;
    this.changed();
  };

  GraphRenderer.prototype.setForces = function (forces) {
    this.worker.postMessage({ forces: forces, alpha: 0.3, run: true });
  };

  GraphRenderer.prototype.getHighlightNode = function () {
    return this.dragNode || this.highlightNode;
  };

  /* ------ Zoom / Pan / Scale ------ */

  GraphRenderer.prototype.updateZoom = function () {
    var scale = this.scale;
    var targetScale = this.targetScale;
    var panX = this.panX;
    var panY = this.panY;

    targetScale = this.targetScale = Math.min(8, Math.max(1 / 128, targetScale));

    var ratio = scale > targetScale ? scale / targetScale : targetScale / scale;
    if (ratio - 1 >= 0.01) {
      var cx = this.zoomCenterX;
      var cy = this.zoomCenterY;
      if (cx === 0 && cy === 0) {
        var dpr = window.devicePixelRatio;
        cx = (this.width / 2) * dpr;
        cy = (this.height / 2) * dpr;
      }

      var worldPoint = { x: (cx - panX) / scale, y: (cy - panY) / scale };
      scale = lerp(scale, targetScale, 0.85);
      panX -= worldPoint.x * scale + panX - cx;
      panY -= worldPoint.y * scale + panY - cy;
      this.changed();
    }

    this.setPan(panX, panY);
    this.setScale(scale);
  };

  GraphRenderer.prototype.setPan = function (x, y) {
    var hanger = this.hanger;
    this.panX = x;
    this.panY = y;
    if (hanger) {
      hanger.x = x;
      hanger.y = y;
    }
  };

  GraphRenderer.prototype.setScale = function (s) {
    var hanger = this.hanger;
    this.scale = s;
    this.nodeScale = Math.sqrt(1 / s);
    var logScale = Math.log(s) / Math.log(2);
    this.textAlpha = Math.min(Math.max(logScale + 1 - this.fTextShowMult, 0), 1);
    if (hanger) {
      hanger.scale.x = hanger.scale.y = s;
    }
  };

  GraphRenderer.prototype.changed = function () {
    this.idleFrames = 0;
    this.queueRender();
  };

  GraphRenderer.prototype.queueRender = function () {
    if (!this.renderTimer && this.renderCallback) {
      this.renderTimer = window.requestAnimationFrame(this.renderCallback);
    }
  };

  /* ------ CSS Color Detection ------ */

  GraphRenderer.prototype.testCSS = function () {
    var readColor = function (cssClass) {
      var div = document.createElement("div");
      div.className = "graph-view " + cssClass;
      document.body.appendChild(div);
      var computed = getComputedStyle(div);
      var colorStr = computed.color;
      var opacityStr = computed.opacity;
      div.remove();

      var parsed = parseColor(colorStr);
      var opacity = parseFloat(opacityStr);
      if (isNaN(opacity)) opacity = 1;

      return parsed
        ? { a: opacity * parsed.a, rgb: (parsed.r << 16) | (parsed.g << 8) | parsed.b }
        : { a: opacity, rgb: 0x888888 };
    };

    for (var key in COLOR_CLASS_MAP) {
      if (COLOR_CLASS_MAP.hasOwnProperty(key)) {
        this.colors[key] = readColor(COLOR_CLASS_MAP[key]);
      }
    }

    for (var i = 0; i < this.nodes.length; i++) {
      this.nodes[i].fontDirty = true;
    }
    this.changed();
  };

  return GraphRenderer;
})();

/* ==========================================================
   Section 6: Standalone Graph View Initialization
   ========================================================== */

var graphRendererInstance = null;

/**
 * Convert index-based graphData to OB's node-map format for GraphRenderer.setData()
 */
function convertGraphData(gd) {
  var nodes = {};
  for (var i = 0; i < gd.nodeCount; i++) {
    var id = String(i);
    nodes[id] = {
      type: "",
      links: {},
      displayText: gd.labels[i] || id,
    };
  }
  for (var li = 0; li < gd.linkCount; li++) {
    var srcId = String(gd.linkSources[li]);
    var tgtId = String(gd.linkTargets[li]);
    if (nodes[srcId]) {
      nodes[srcId].links[tgtId] = true;
    }
  }
  return { nodes: nodes };
}

function initializeGraphView() {
  var containerEl = document.querySelector(".graph-view-container");
  if (!containerEl) return;

  // Remove the old static canvas if present
  var oldCanvas = containerEl.querySelector("#graph-canvas");
  if (oldCanvas) oldCanvas.remove();

  // Create the sim worker
  var workerScript = document.querySelector("script[id='graph-sim-worker']");
  var worker;
  if (workerScript && workerScript.textContent) {
    worker = new Worker(URL.createObjectURL(new Blob([workerScript.textContent], { type: "application/javascript" })));
  } else {
    // Try loading from URL
    var pathToRoot = typeof ObsidianSite !== "undefined" ? ObsidianSite.document.info.pathToRoot : ".";
    worker = new Worker(pathToRoot + "/lib/scripts/graph-sim-worker.js");
  }

  // Create GraphRenderer
  var renderer = graphRendererInstance = new GraphRenderer(containerEl, worker);
  renderer.setScale(0.5);
  renderer.targetScale = 0.5;
  renderer.setRenderOptions({ textFadeMultiplier: -1 });

  // Convert graphData and set
  var data = convertGraphData(graphData);
  renderer.setData(data);

  // Set forces from graphData options
  renderer.setForces({
    centerStrength: graphData.graphOptions.centralForce || 0.1,
    linkStrength: graphData.graphOptions.attractionForce || 1,
    linkDistance: graphData.graphOptions.linkLength || 250,
    repelStrength: graphData.graphOptions.repulsionForce || 1000,
  });

  // Node click navigation
  renderer.onNodeClick = function (event, nodeId, nodeType) {
    var index = parseInt(nodeId);
    if (isNaN(index) || index < 0 || index >= graphData.paths.length) return;
    var url = graphData.paths[index];
    if (window.location.pathname.endsWith(url)) return;
    if (typeof loadDocument === "function") {
      loadDocument(url, true, true);
    } else {
      window.location.href = url;
    }
  };

  // Handle resize
  window.addEventListener("resize", function () {
    if (graphRendererInstance) graphRendererInstance.onResize();
  });

  // Expand/collapse
  var graphExpanded = false;
  function toggleExpandedGraph() {
    var initialWidth = containerEl.clientWidth;
    var initialHeight = containerEl.clientHeight;

    containerEl.classList.add("scale-down");
    var fadeOutAnimation = containerEl.animate({ opacity: 0 }, { duration: 100, easing: "ease-in", fill: "forwards" });
    fadeOutAnimation.addEventListener("finish", function () {
      containerEl.classList.toggle("expanded");
      renderer.onResize();
      var finalWidth = containerEl.clientWidth;
      var finalHeight = containerEl.clientHeight;
      if (graphExpanded) {
        renderer.zoomTo(2 * renderer.scale);
      }
      containerEl.classList.remove("scale-down");
      containerEl.classList.add("scale-up");
      renderer.changed();
      var fadeInAnimation = containerEl.animate({ opacity: 1 }, { duration: 200, easing: "ease-out", fill: "forwards" });
      fadeInAnimation.addEventListener("finish", function () {
        containerEl.classList.remove("scale-up");
      });
    });

    graphExpanded = !graphExpanded;

    if (graphExpanded) document.addEventListener("pointerdown", handleOutsideClick);
    else document.removeEventListener("pointerdown", handleOutsideClick);
  }

  function handleOutsideClick(event) {
    if (event.composedPath().includes(containerEl)) return;
    toggleExpandedGraph();
  }

  var expandBtn = document.querySelector(".graph-expand.graph-icon");
  if (expandBtn) {
    expandBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleExpandedGraph();
    });
  }

  // Theme toggle -> re-read CSS colors
  var themeToggle = document.querySelector(".theme-toggle-input");
  if (themeToggle) {
    themeToggle.addEventListener("change", function () {
      setTimeout(function () { renderer.testCSS(); }, 0);
    });
  }

  // Set active document highlight
  if (typeof setActiveDocument === "function") {
    setActiveDocument(new URL(window.location.href), false, false);
  }
}

window.addEventListener("load", function () {
  waitLoadScripts(["pixi", "graph-data", "graph-sim-worker"], function () {
    initializeGraphView();
  });
});
