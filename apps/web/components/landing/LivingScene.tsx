"use client";

/**
 * The hero's painting, alive: the clouds drift, wind rolls through the grass
 * and trees, and now and then a few birds cross the sky.
 *
 * Everything sits on top of the static background, which stays the first
 * paint, the fallback without WebGL, and the whole view for reduced motion.
 * A WebGL pass re-samples the same image each frame:
 *  - sky: pixels that read as sky or cloud (bluish or white, above the
 *    horizon) slide sideways on a slow swing, more up high than near the
 *    horizon. Anything that isn't sky (the big rock) hides the clouds behind
 *    it, using a cloud-free sky colour estimated from the painting itself.
 *  - meadow: a soft mask of the greens leans with a travelling gust and
 *    catches a faint sheen, more in the foreground than on the far hills.
 * Birds are plain SVG flapping with SMIL, a small flock every 10–20s, kept in
 * the band above the headline.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uImage;
uniform sampler2D uSky;
uniform sampler2D uMeadow;
uniform vec2 uScale;
uniform vec2 uOffset;
uniform vec2 uTexel;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// sky or cloud: blue sky, or anything bright and pale; never the greens or the brown rock
float skyish(vec3 c) {
  float blue = smoothstep(0.04, 0.10, c.b - c.r) * smoothstep(0.02, -0.03, c.g - c.b);
  float cloud = smoothstep(0.76, 0.84, min(c.r, min(c.g, c.b)));
  return max(blue, cloud);
}
// reflect past the image's edges, so clouds at the border never smear
float mirror(float x) { return 1.0 - abs(1.0 - abs(x)); }

void main() {
  vec2 uv = vUv * uScale + uOffset;
  vec3 base = texture2D(uImage, uv).rgb;
  vec3 col = base;

  float sd = skyish(base) * (1.0 - smoothstep(0.40, 0.50, uv.y));
  if (sd > 0.0) {
    float reach = 52.0 * mix(1.0, 0.4, smoothstep(0.12, 0.48, uv.y));
    float dx = reach * sin(uTime * 0.09) + 3.0 * (noise(vec2(uv.y * 14.0, uTime * 0.08)) - 0.5);
    vec2 src = vec2(mirror(uv.x - dx * sd * uTexel.x), uv.y);
    vec3 cs = texture2D(uImage, src).rgb;
    vec3 s0 = texture2D(uSky, uv).rgb;
    vec3 s1 = texture2D(uSky, src).rgb;
    // how much cloud is in the source pixel; carry the cloud, re-tint the sky around it
    float a = clamp((cs.r - s1.r) / max(0.05, 0.98 - s1.r), 0.0, 1.0);
    vec3 moved = cs + (1.0 - a) * (s0 - s1);
    col = mix(base, mix(s0, moved, skyish(cs)), smoothstep(0.0, 0.08, sd));
  }

  float m = texture2D(uMeadow, uv).g;
  if (m > 0.0) {
    float near = smoothstep(0.55, 1.0, uv.y);
    float gust = noise(vec2(uv.x * 3.5 - uTime * 0.4, uv.y * 6.0 + uTime * 0.05));
    float flutter = sin(uTime * 2.3 + uv.x * 70.0 + uv.y * 40.0);
    float lean = (gust - 0.35) * mix(1.5, 6.0, near) + flutter * mix(0.2, 0.9, near);
    vec2 src = uv - vec2(lean * uTexel.x, abs(lean) * 0.3 * uTexel.y) * m;
    vec3 c = texture2D(uImage, src).rgb;
    col = mix(col, c * (1.0 + (gust - 0.5) * 0.12 * m), m);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

type Raster = { w: number; h: number; data: Uint8Array };

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function boxBlur(v: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(v.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) (s += v[y * w + xx]), n++;
      }
      tmp[y * w + x] = s / n;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) (s += tmp[yy * w + x]), n++;
      }
      v[y * w + x] = s / n;
    }
}

/** Reads a small copy of the painting: the clear sky's colour on a coarse grid, and where the greens are. */
function readPainting(img: HTMLImageElement): { sky: Raster; meadow: Raster } {
  const W = 260;
  const H = Math.round((img.naturalHeight / img.naturalWidth) * W);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;

  // clear-sky colour per cell; cells hidden by cloud or land borrow from their neighbours
  const GX = 26;
  const GY = 17;
  const acc = new Float32Array(GX * GY * 3);
  const count = new Float32Array(GX * GY);
  const meadow = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = px[i] / 255;
      const g = px[i + 1] / 255;
      const b = px[i + 2] / 255;
      if (b - r > 0.12 && b > g && b > 0.55) {
        const cell = Math.floor((y / H) * GY) * GX + Math.floor((x / W) * GX);
        acc[cell * 3] += r;
        acc[cell * 3 + 1] += g;
        acc[cell * 3 + 2] += b;
        count[cell]++;
      }
      meadow[y * W + x] = Math.min(1, Math.max(0, (g - Math.max(r, b) - 0.03) * 10)) * sstep(0.5, 0.6, y / H);
    }
  const sky = new Float32Array(GX * GY * 3);
  const known = new Uint8Array(GX * GY);
  for (let k = 0; k < GX * GY; k++)
    if (count[k] >= 4) {
      known[k] = 1;
      for (let c = 0; c < 3; c++) sky[k * 3 + c] = acc[k * 3 + c] / count[k];
    }
  for (let pass = 0; pass < GX + GY; pass++) {
    const next = known.slice();
    for (let y = 0; y < GY; y++)
      for (let x = 0; x < GX; x++) {
        const k = y * GX + x;
        if (known[k]) continue;
        let n = 0;
        const s = [0, 0, 0];
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GX || ny >= GY || !known[ny * GX + nx]) continue;
          for (let c = 0; c < 3; c++) s[c] += sky[(ny * GX + nx) * 3 + c];
          n++;
        }
        if (!n) continue;
        next[k] = 1;
        for (let c = 0; c < 3; c++) sky[k * 3 + c] = s[c] / n;
      }
    known.set(next);
  }
  const skyData = new Uint8Array(GX * GY * 4);
  for (let k = 0; k < GX * GY; k++) {
    for (let c = 0; c < 3; c++) skyData[k * 4 + c] = Math.round(sky[k * 3 + c] * 255);
    skyData[k * 4 + 3] = 255;
  }

  // soften the greens so flowers and blades move together
  boxBlur(meadow, W, H, 2);
  boxBlur(meadow, W, H, 2);
  const meadowData = new Uint8Array(W * H * 4);
  for (let k = 0; k < W * H; k++) {
    meadowData[k * 4 + 1] = Math.round(meadow[k] * 255);
    meadowData[k * 4 + 3] = 255;
  }
  return { sky: { w: GX, h: GY, data: skyData }, meadow: { w: W, h: H, data: meadowData } };
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader failed");
  return shader;
}

function texture(gl: WebGLRenderingContext, unit: number, source: HTMLImageElement | Raster) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (source instanceof HTMLImageElement) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.w, source.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
}

function Painting({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let alive = true;
    let raf = 0;
    let teardown = () => {};
    const img = new Image();
    img.src = src;
    img
      .decode()
      .then(() => {
        if (!alive) return;
        const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
        if (!gl) return;
        const program = gl.createProgram()!;
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
        gl.useProgram(program);

        // one triangle that covers the screen
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, "aPos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const { sky, meadow } = readPainting(img);
        texture(gl, 0, img);
        texture(gl, 1, sky);
        texture(gl, 2, meadow);
        const u = (name: string) => gl.getUniformLocation(program, name);
        gl.uniform1i(u("uImage"), 0);
        gl.uniform1i(u("uSky"), 1);
        gl.uniform1i(u("uMeadow"), 2);
        gl.uniform2f(u("uTexel"), 1 / img.naturalWidth, 1 / img.naturalHeight);
        const uTime = u("uTime");
        const uScale = u("uScale");
        const uOffset = u("uOffset");

        const start = performance.now();
        let last = 0;
        let visible = true;
        const draw = (now: number) => {
          last = now;
          gl.uniform1f(uTime, (now - start) / 1000);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        // match the CSS underneath: background-size cover, centred
        const resize = () => {
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          if (!w || !h) return;
          const dpr = Math.min(window.devicePixelRatio || 1, w < 768 ? 1 : 1.5);
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          gl.viewport(0, 0, canvas.width, canvas.height);
          const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
          const sx = w / (img.naturalWidth * s);
          const sy = h / (img.naturalHeight * s);
          gl.uniform2f(uScale, sx, sy);
          gl.uniform2f(uOffset, (1 - sx) / 2, (1 - sy) / 2);
          draw(performance.now()); // a resized canvas is blank until drawn
        };
        const tick = (now: number) => {
          raf = 0;
          if (!visible) return;
          raf = requestAnimationFrame(tick);
          if (now - last >= 33) draw(now); // ~30fps is plenty for drifting clouds
        };
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);
        const io = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !raf) raf = requestAnimationFrame(tick);
        });
        io.observe(canvas);
        const onLost = (e: Event) => {
          e.preventDefault();
          visible = false;
          setReady(false); // the static image underneath takes over
        };
        canvas.addEventListener("webglcontextlost", onLost);

        resize();
        raf = requestAnimationFrame(tick);
        setReady(true);
        teardown = () => {
          ro.disconnect();
          io.disconnect();
          canvas.removeEventListener("webglcontextlost", onLost);
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        };
      })
      .catch(() => {
        /* no image or no WebGL: the static background stays */
      });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      teardown();
    };
  }, [src]);

  return <canvas ref={ref} aria-hidden className={cn("absolute inset-0 h-full w-full transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")} />;
}

// a gull's wings, up and down
const WINGS = { up: "M0 3 Q6 1 12 7 Q18 1 24 3", down: "M0 10 Q6 4 12 7 Q18 4 24 10" };

type Flock = {
  id: number;
  ltr: boolean;
  top: number;
  duration: number;
  birds: { dx: number; dy: number; size: number; flap: number; phase: number }[];
};

function launch(id: number): Flock {
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const ltr = Math.random() < 0.65;
  return {
    id,
    ltr,
    top: rand(16, 24),
    duration: rand(20, 28),
    birds: Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, i) => ({
      dx: (ltr ? -1 : 1) * i * rand(20, 30), // followers trail the leader
      dy: (i % 2 ? -1 : 1) * Math.ceil(i / 2) * rand(7, 12),
      size: rand(13, 19),
      flap: rand(0.42, 0.6),
      phase: rand(0, 0.6),
    })),
  };
}

function Birds() {
  const [flocks, setFlocks] = useState<Flock[]>([]);

  useEffect(() => {
    let id = 0;
    let timer = 0;
    const next = () => {
      // phones have little sky above the headline, so the birds stay home there
      if (!document.hidden && window.matchMedia("(min-width: 768px)").matches) setFlocks((all) => [...all, launch(++id)]);
      timer = window.setTimeout(next, 10_000 + Math.random() * 10_000);
    };
    timer = window.setTimeout(next, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
      {flocks.map((f) => (
        <motion.div
          key={f.id}
          className="absolute left-0 text-[#2b3a4a]/70"
          style={{ top: `${f.top}%` }}
          initial={{ x: f.ltr ? "-12vw" : "112vw", y: 0 }}
          animate={{ x: f.ltr ? "112vw" : "-12vw", y: [0, -26, -6, -34] }}
          transition={{ duration: f.duration, ease: "linear" }}
          onAnimationComplete={() => setFlocks((all) => all.filter((x) => x.id !== f.id))}
        >
          {f.birds.map((b, i) => (
            <svg key={i} className="absolute overflow-visible" style={{ transform: `translate(${b.dx}px, ${b.dy}px)` }} width={b.size} height={b.size / 2} viewBox="0 0 24 12" fill="none">
              <path d={WINGS.up} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <animate
                  attributeName="d"
                  values={`${WINGS.up};${WINGS.down};${WINGS.up}`}
                  keyTimes="0;0.5;1"
                  calcMode="spline"
                  keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
                  dur={`${b.flap}s`}
                  begin={`-${b.phase}s`}
                  repeatCount="indefinite"
                />
              </path>
            </svg>
          ))}
        </motion.div>
      ))}
    </div>
  );
}

/** Sits inside the hero's background box, over the static image of the same `src`. */
export function LivingScene({ src }: { src: string }) {
  const still = useReducedMotion();
  // the server can't know about reduced motion, so render only once mounted
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration-safe bootstrap
  useEffect(() => setMounted(true), []);
  if (!mounted || still) return null;
  return (
    <>
      <Painting src={src} />
      <Birds />
    </>
  );
}
