import { useEffect, useRef } from 'react';
import './pot-liquid.css';

const TAU = Math.PI * 2;
const MAX_RIPPLES = 26;
const MAX_BUBBLES = 30;

/** A local, pointer-reactive water surface. It never changes the brand/job state. */
export default function PotLiquid({ busy = false, reduced = false }) {
  const surfaceRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const latestRef = useRef({ busy, reduced });
  latestRef.current = { busy, reduced };

  useEffect(() => {
    const surface = surfaceRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!surface || !context) return undefined;

    let width = 1, height = 1, pixelRatio = 1;
    let frame = 0, previousTime = 0, elapsed = 0, spawnClock = 0;
    let disposed = false, clearStillTimer = 0, interactionCount = 0;
    let lastMoveTime = 0, lastPoint = null, capturedPointer = null;
    let state = { ...latestRef.current };
    let ripples = [], bubbles = [];

    function inWater(x, y) {
      return ((x - .5) / .5) ** 2 + ((y - .5) / .5) ** 2 <= 1;
    }

    function bubbleAt(x, y, input = false) {
      if (bubbles.length >= MAX_BUBBLES) return;
      bubbles.push({ x, y, age: 0, life: .65 + Math.random() * .8,
        radius: (input ? .018 : .014) + Math.random() * .019,
        drift: (Math.random() - .5) * .04, seed: Math.random() * TAU });
    }

    function spawnBubble() {
      const angle = Math.random() * TAU;
      const radius = Math.sqrt(Math.random()) * .84;
      bubbleAt(.5 + Math.cos(angle) * radius * .48,
        .5 + Math.sin(angle) * radius * .42);
    }

    function publishCounts() {
      surface.dataset.rippleCount = String(ripples.length);
      surface.dataset.bubbleCount = String(state.reduced && state.busy ? 9 : bubbles.length);
      surface.dataset.interactions = String(interactionCount);
    }

    function drawBase() {
      context.clearRect(0, 0, width, height);
      context.save();
      context.beginPath();
      context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, TAU);
      context.clip();

      const base = context.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, state.busy ? '#b8f3e3' : '#e7eaff');
      base.addColorStop(.42, state.busy ? '#b4d9ff' : '#d1d6fa');
      base.addColorStop(.75, state.busy ? '#e0bcf8' : '#d6c8ef');
      base.addColorStop(1, '#bdc9f0');
      context.fillStyle = base;
      context.fillRect(0, 0, width, height);

      const light = context.createRadialGradient(width * .27, height * .25, 0,
        width * .3, height * .35, width * .55);
      light.addColorStop(0, '#ffffffa8');
      light.addColorStop(.48, '#ffffff00');
      light.addColorStop(1, '#6e70c82b');
      context.fillStyle = light;
      context.fillRect(0, 0, width, height);

      const time = state.reduced ? 0 : elapsed;
      const strength = state.busy ? 1 : .42;
      // Three interleaved spirals make the movement read as stirring, not a spinner.
      ['#faf9ffe6', '#8a8ce8a3', '#c7ffe9d9'].forEach((color, lane) => {
        context.beginPath();
        for (let step = 0; step <= 85; step++) {
          const progress = step / 85;
          const angle = progress * TAU * 1.6 + lane * TAU / 3 + time * (state.busy ? 1.3 : .25);
          const radius = .02 + progress * .46;
          const x = width * (.5 + Math.cos(angle) * radius);
          const y = height * (.5 + Math.sin(angle) * radius * .85);
          if (!step) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.globalAlpha = strength;
        context.strokeStyle = color;
        context.lineWidth = Math.max(1.1, width * .008);
        context.lineCap = 'round';
        context.stroke();
      });
      context.globalAlpha = 1;

      // A clear crescent reflection retains the perspective of the original pot.
      context.beginPath();
      context.ellipse(width * .48, height * .49, width * .42, height * .38, 0, Math.PI * 1.05, Math.PI * 1.73);
      context.strokeStyle = '#ffffffba';
      context.lineWidth = Math.max(1.5, height * .055);
      context.stroke();
    }

    function drawBubble(bubble, frozen = false) {
      const progress = frozen ? .56 : Math.min(1, bubble.age / bubble.life);
      const x = width * (bubble.x + Math.sin(progress * 3 + bubble.seed) * bubble.drift);
      const y = height * (bubble.y - progress * .09);
      const radius = Math.max(1.3, width * bubble.radius * (.45 + Math.sin(progress * Math.PI) * .65));
      const popping = !frozen && progress > .78;
      const pop = popping ? (progress - .78) / .22 : 0;
      context.save();
      context.globalAlpha = popping ? 1 - pop : Math.min(1, progress * 6);
      if (popping) {
        context.beginPath();
        context.ellipse(x, y, radius * (1 + pop * 2.3), radius * (.45 + pop * .5), 0, 0, TAU);
        context.strokeStyle = '#ffffff';
        context.lineWidth = 1.5;
        context.stroke();
        for (let ray = 0; ray < 4; ray++) {
          const angle = ray * TAU / 4 + bubble.seed;
          context.beginPath();
          context.arc(x + Math.cos(angle) * radius * (1.3 + pop),
            y + Math.sin(angle) * radius * (.6 + pop * .5), Math.max(.6, radius * .13), 0, TAU);
          context.fillStyle = '#fffbe9'; context.fill();
        }
      } else {
        const shine = context.createRadialGradient(x - radius * .3, y - radius * .4,
          radius * .1, x, y, radius);
        shine.addColorStop(0, '#ffffffef');
        shine.addColorStop(.32, '#f7ffffb0');
        shine.addColorStop(.64, '#b1b5f74a');
        shine.addColorStop(1, '#666ac488');
        context.beginPath(); context.arc(x, y, radius, 0, TAU);
        context.fillStyle = shine; context.fill();
        context.strokeStyle = '#ffffffed'; context.lineWidth = 1.2; context.stroke();
        context.beginPath(); context.arc(x - radius * .28, y - radius * .34, Math.max(.7, radius * .2), 0, TAU);
        context.fillStyle = '#fff'; context.fill();
      }
      context.restore();
    }

    function drawRipples() {
      for (const ripple of ripples) {
        const progress = state.reduced ? .28 : Math.min(1, ripple.age / ripple.life);
        const radius = width * (.025 + progress * .32) * ripple.force;
        const alpha = state.reduced ? .72 : (1 - progress) * .9;
        context.save(); context.globalAlpha = alpha;
        // A short curved wake joins the previous pointer position to this one.
        if (ripple.from && progress < .65) {
          context.beginPath();
          context.moveTo(ripple.from.x * width, ripple.from.y * height);
          context.quadraticCurveTo((ripple.from.x + ripple.x) * width * .5,
            ripple.y * height - height * .12, ripple.x * width, ripple.y * height);
          context.strokeStyle = '#ffffff'; context.lineWidth = Math.max(1.5, height * .055);
          context.stroke();
        }
        for (let ring = 0; ring < 2; ring++) {
          const size = radius * (1 - ring * .23);
          context.beginPath();
          context.ellipse(ripple.x * width, ripple.y * height, size,
            size * Math.max(.18, height / width * 1.15), 0, 0, TAU);
          context.strokeStyle = ring ? '#fff9de' : '#606bc5';
          context.lineWidth = ring ? 1.8 : 2.5;
          context.stroke();
        }
        context.restore();
      }
    }

    function draw() {
      drawBase();
      if (state.reduced && state.busy) {
        for (let index = 0; index < 9; index++) {
          drawBubble({ x: .17 + (index % 5) * .15, y: .3 + Math.floor(index / 5) * .38,
            life: 1, radius: .019 + (index % 3) * .006, drift: 0, seed: index }, true);
        }
      } else bubbles.forEach(bubble => drawBubble(bubble));
      drawRipples();
      context.restore();
      publishCounts();
    }

    function schedule() {
      if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(tick);
    }

    function tick(timestamp) {
      frame = 0;
      if (disposed || document.hidden) return;
      const delta = previousTime ? Math.min((timestamp - previousTime) / 1000, .045) : .016;
      previousTime = timestamp;
      if (!state.reduced) {
        elapsed += delta;
        if (state.busy) {
          spawnClock += delta;
          while (spawnClock >= .075) { spawnBubble(); spawnClock -= .075; }
        }
        bubbles.forEach(bubble => { bubble.age += delta; });
        ripples.forEach(ripple => { ripple.age += delta; });
        bubbles = bubbles.filter(bubble => bubble.age < bubble.life);
        ripples = ripples.filter(ripple => ripple.age < ripple.life);
      }
      draw();
      if (!state.reduced && (state.busy || bubbles.length || ripples.length)) schedule();
      else previousTime = 0;
    }

    function stir(x, y, force = 1) {
      if (!inWater(x, y)) return;
      interactionCount++;
      ripples.push({ x, y, age: 0, life: .95, force, from: lastPoint });
      ripples = ripples.slice(-MAX_RIPPLES);
      if (!state.reduced) {
        bubbleAt(x, y, true);
        if (force > 1) bubbleAt(Math.min(.95, x + .045), Math.min(.9, y + .035), true);
      } else {
        ripples = ripples.slice(-2);
        clearTimeout(clearStillTimer);
        clearStillTimer = window.setTimeout(() => { ripples = []; schedule(); }, 420);
      }
      lastPoint = { x, y };
      schedule();
    }

    function pointFrom(event) {
      const bounds = surface.getBoundingClientRect();
      return { x: (event.clientX - bounds.left) / bounds.width,
        y: (event.clientY - bounds.top) / bounds.height };
    }

    function pointerDown(event) {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      const point = pointFrom(event);
      if (!inWater(point.x, point.y)) return;
      capturedPointer = event.pointerId;
      surface.setPointerCapture?.(event.pointerId);
      lastPoint = null;
      stir(point.x, point.y, 1.25);
      lastMoveTime = performance.now();
    }

    function pointerMove(event) {
      if (event.pointerType !== 'mouse' && capturedPointer !== event.pointerId) return;
      const point = pointFrom(event);
      if (!inWater(point.x, point.y)) { lastPoint = null; return; }
      const now = performance.now();
      if (now - lastMoveTime < (capturedPointer === null ? 45 : 28)) return;
      if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < .018) return;
      lastMoveTime = now;
      stir(point.x, point.y, capturedPointer === null ? .85 : 1.2);
    }

    function pointerEnd(event) {
      if (capturedPointer === event.pointerId) {
        if (surface.hasPointerCapture?.(event.pointerId)) surface.releasePointerCapture(event.pointerId);
        capturedPointer = null;
      }
      lastPoint = null;
    }

    function pointerLeave() { if (capturedPointer === null) lastPoint = null; }
    function keyboardClick(event) {
      // Native button activation covers Enter, Space and assistive-technology clicks.
      if (event.detail === 0) { lastPoint = null; stir(.5, .5, 1.35); }
    }

    function resize() {
      const bounds = surface.getBoundingClientRect();
      width = Math.max(1, surface.clientWidth || bounds.width);
      height = Math.max(1, surface.clientHeight || bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      schedule();
    }

    function visibilityChanged() {
      if (document.hidden) {
        cancelAnimationFrame(frame); frame = 0; previousTime = 0;
      } else schedule();
    }

    const engine = {
      update(next) {
        const start = next.busy && !state.busy;
        state = { ...next };
        if (!state.busy || state.reduced) bubbles = [];
        if (start && !state.reduced) {
          for (let index = 0; index < 16; index++) spawnBubble();
          bubbles.forEach((bubble, index) => { bubble.age = bubble.life * (index % 7) / 9; });
        }
        if (state.reduced) ripples = [];
        spawnClock = 0; previousTime = 0;
        schedule();
      },
    };
    engineRef.current = engine;
    surface.addEventListener('pointerdown', pointerDown);
    surface.addEventListener('pointermove', pointerMove);
    surface.addEventListener('pointerup', pointerEnd);
    surface.addEventListener('pointercancel', pointerEnd);
    surface.addEventListener('lostpointercapture', pointerEnd);
    surface.addEventListener('pointerleave', pointerLeave);
    surface.addEventListener('click', keyboardClick);
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('resize', resize);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(surface);
    resize();
    if (state.busy && !state.reduced) {
      for (let index = 0; index < 16; index++) spawnBubble();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(clearStillTimer);
      observer?.disconnect();
      surface.removeEventListener('pointerdown', pointerDown);
      surface.removeEventListener('pointermove', pointerMove);
      surface.removeEventListener('pointerup', pointerEnd);
      surface.removeEventListener('pointercancel', pointerEnd);
      surface.removeEventListener('lostpointercapture', pointerEnd);
      surface.removeEventListener('pointerleave', pointerLeave);
      surface.removeEventListener('click', keyboardClick);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('resize', resize);
      engineRef.current = null;
    };
  }, []);

  useEffect(() => { engineRef.current?.update({ busy, reduced }); }, [busy, reduced]);

  return <button
    ref={surfaceRef}
    className="pot-liquid"
    type="button"
    aria-label="คนน้ำในหม้อ"
    aria-description="ลากเมาส์หรือนิ้วบนน้ำ หรือกด Enter หรือ Space เพื่อสร้างคลื่นน้ำ"
    title="ลากเพื่อคนน้ำ · Enter / Space"
    data-busy={busy ? 'true' : 'false'}
    data-reduced-motion={reduced ? 'true' : 'false'}
    data-interactions="0"
    data-ripple-count="0"
    data-bubble-count="0"
  >
    <canvas ref={canvasRef} aria-hidden="true" />
    {busy && reduced && <span className="pot-liquid__still-label" aria-hidden="true">กำลังปรุง</span>}
  </button>;
}
