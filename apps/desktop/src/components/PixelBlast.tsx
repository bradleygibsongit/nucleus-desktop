// PixelBlast background effect component
// Adapted from ReactBits (https://reactbits.dev/backgrounds/pixel-blast)
// Original inspiration: github.com/zavalit/bayer-dithering-webgl-demo

import { useEffect, useRef } from "react"
import * as THREE from "three"

const SHAPE_MAP: Record<string, number> = {
  square: 0,
  circle: 1,
  triangle: 2,
  diamond: 3,
}

const VERTEX_SRC = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`

const FRAGMENT_SRC = `
precision highp float;

uniform vec3  uColor;
uniform vec2  uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uPixelJitter;
uniform int   uEnableRipples;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform float uEdgeFade;

uniform int   uShapeType;
const int SHAPE_SQUARE   = 0;
const int SHAPE_CIRCLE   = 1;
const int SHAPE_TRIANGLE = 2;
const int SHAPE_DIAMOND  = 3;

const int   MAX_CLICKS = 10;

uniform vec2  uClickPos  [MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];

out vec4 fragColor;

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2. + a.y * a.y * .75);
}
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

#define FBM_OCTAVES     5
#define FBM_LACUNARITY  1.25
#define FBM_GAIN        1.0

float hash11(float n){ return fract(sin(n)*43758.5453); }

float vnoise(vec3 p){
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0  = mix(x00, x10, w.y);
  float y1  = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t){
  vec3 p = vec3(uv * uScale, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < FBM_OCTAVES; ++i){
    sum  += amp * vnoise(p * freq);
    freq *= FBM_LACUNARITY;
    amp  *= FBM_GAIN;
  }
  return sum * 0.5 + 0.5;
}

float maskCircle(vec2 p, float cov){
  float r = sqrt(cov) * .25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

float maskTriangle(vec2 p, vec2 id, float cov){
  bool flip = mod(id.x + id.y, 2.0) > 0.5;
  if (flip) p.x = 1.0 - p.x;
  float r = sqrt(cov);
  float d  = p.y - r*(1.0 - p.x);
  float aa = fwidth(d);
  return cov * clamp(0.5 - d/aa, 0.0, 1.0);
}

float maskDiamond(vec2 p, float cov){
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
  float pixelSize = uPixelSize;
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float aspectRatio = uResolution.x / uResolution.y;

  vec2 pixelId = floor(fragCoord / pixelSize);
  vec2 pixelUV = fract(fragCoord / pixelSize);

  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

  float base = fbm2(uv, uTime * 0.05);
  base = base * 0.5 - 0.65;

  float feed = base + (uDensity - 0.5) * 0.3;

  float speed     = uRippleSpeed;
  float thickness = uRippleThickness;
  const float dampT     = 1.0;
  const float dampR     = 10.0;

  if (uEnableRipples == 1) {
    for (int i = 0; i < MAX_CLICKS; ++i){
      vec2 pos = uClickPos[i];
      if (pos.x < 0.0) continue;
      float cellPixelSize = 8.0 * pixelSize;
      vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
      float t = max(uTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);
      float waveR = speed * t;
      float ring  = exp(-pow((r - waveR) / thickness, 2.0));
      float atten = exp(-dampT * t) * exp(-dampR * r);
      feed = max(feed, ring * atten * uRippleIntensity);
    }
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
  float coverage = bw * jitterScale;
  float M;
  if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);
  else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
  else                                   M = coverage;

  if (uEdgeFade > 0.0) {
    vec2 norm = gl_FragCoord.xy / uResolution;
    float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
    float fade = smoothstep(0.0, uEdgeFade, edge);
    M *= fade;
  }

  vec3 color = uColor;

  vec3 srgbColor = mix(
    color * 12.92,
    1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, color)
  );

  fragColor = vec4(srgbColor, M);
}
`

const MAX_CLICKS = 10

interface PixelBlastProps {
  variant?: "square" | "circle" | "triangle" | "diamond"
  pixelSize?: number
  color?: string
  className?: string
  style?: React.CSSProperties
  antialias?: boolean
  patternScale?: number
  patternDensity?: number
  pixelSizeJitter?: number
  enableRipples?: boolean
  rippleIntensityScale?: number
  rippleThickness?: number
  rippleSpeed?: number
  autoPauseOffscreen?: boolean
  speed?: number
  transparent?: boolean
  edgeFade?: number
}

export function PixelBlast({
  variant = "square",
  pixelSize = 3,
  color = "#7C3AED",
  className,
  style,
  antialias = true,
  patternScale = 2,
  patternDensity = 1,
  pixelSizeJitter = 0,
  enableRipples = true,
  rippleIntensityScale = 1,
  rippleThickness = 0.1,
  rippleSpeed = 0.3,
  autoPauseOffscreen = true,
  speed = 0.5,
  transparent = true,
  edgeFade = 0.5,
}: PixelBlastProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const visibilityRef = useRef({ visible: true })
  const speedRef = useRef(speed)

  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.OrthographicCamera
    material: THREE.ShaderMaterial
    clock: THREE.Clock
    clickIx: number
    uniforms: Record<string, THREE.IUniform>
    resizeObserver: ResizeObserver | null
    raf: number
    quad: THREE.Mesh | null
    timeOffset: number
  } | null>(null)

  const prevConfigRef = useRef<{ antialias: boolean } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    speedRef.current = speed

    const cfg = { antialias }
    let mustReinit = false
    if (!threeRef.current) mustReinit = true
    else if (prevConfigRef.current && prevConfigRef.current.antialias !== cfg.antialias) {
      mustReinit = true
    }

    if (mustReinit) {
      if (threeRef.current) {
        const t = threeRef.current
        t.resizeObserver?.disconnect()
        cancelAnimationFrame(t.raf)
        t.quad?.geometry.dispose()
        t.material.dispose()
        t.renderer.dispose()
        t.renderer.forceContextLoss()
        if (t.renderer.domElement.parentElement === container) container.removeChild(t.renderer.domElement)
        threeRef.current = null
      }

      const canvas = document.createElement("canvas")
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias,
        alpha: true,
        powerPreference: "high-performance",
      })
      renderer.domElement.style.width = "100%"
      renderer.domElement.style.height = "100%"
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      container.appendChild(renderer.domElement)

      if (transparent) renderer.setClearAlpha(0)
      else renderer.setClearColor(0x000000, 1)

      const uniforms: Record<string, THREE.IUniform> = {
        uResolution: { value: new THREE.Vector2(0, 0) },
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uClickPos: {
          value: Array.from({ length: MAX_CLICKS }, () => new THREE.Vector2(-1, -1)),
        },
        uClickTimes: { value: new Float32Array(MAX_CLICKS) },
        uShapeType: { value: SHAPE_MAP[variant] ?? 0 },
        uPixelSize: { value: pixelSize * renderer.getPixelRatio() },
        uScale: { value: patternScale },
        uDensity: { value: patternDensity },
        uPixelJitter: { value: pixelSizeJitter },
        uEnableRipples: { value: enableRipples ? 1 : 0 },
        uRippleSpeed: { value: rippleSpeed },
        uRippleThickness: { value: rippleThickness },
        uRippleIntensity: { value: rippleIntensityScale },
        uEdgeFade: { value: edgeFade },
      }

      const scene = new THREE.Scene()
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SRC,
        fragmentShader: FRAGMENT_SRC,
        uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        glslVersion: THREE.GLSL3,
      })
      const quadGeom = new THREE.PlaneGeometry(2, 2)
      const quad = new THREE.Mesh(quadGeom, material)
      scene.add(quad)

      const clock = new THREE.Clock()

      const setSize = () => {
        const w = container.clientWidth || 1
        const h = container.clientHeight || 1
        renderer.setSize(w, h, false)
        uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height)
        uniforms.uPixelSize.value = pixelSize * renderer.getPixelRatio()
      }
      setSize()

      const ro = new ResizeObserver(setSize)
      ro.observe(container)

      const randomFloat = () => {
        if (window.crypto?.getRandomValues) {
          const u32 = new Uint32Array(1)
          window.crypto.getRandomValues(u32)
          return u32[0] / 0xffffffff
        }
        return Math.random()
      }
      const timeOffset = randomFloat() * 1000

      const mapToPixels = (e: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect()
        const scaleX = renderer.domElement.width / rect.width
        const scaleY = renderer.domElement.height / rect.height
        const fx = (e.clientX - rect.left) * scaleX
        const fy = (rect.height - (e.clientY - rect.top)) * scaleY
        return { fx, fy, w: renderer.domElement.width, h: renderer.domElement.height }
      }

      const onPointerDown = (e: PointerEvent) => {
        const { fx, fy } = mapToPixels(e)
        const ix = threeRef.current?.clickIx ?? 0
        uniforms.uClickPos.value[ix].set(fx, fy)
        uniforms.uClickTimes.value[ix] = uniforms.uTime.value
        if (threeRef.current) threeRef.current.clickIx = (ix + 1) % MAX_CLICKS
      }

      renderer.domElement.addEventListener("pointerdown", onPointerDown, { passive: true })

      let raf = 0
      const animate = () => {
        if (autoPauseOffscreen && !visibilityRef.current.visible) {
          raf = requestAnimationFrame(animate)
          return
        }
        uniforms.uTime.value = timeOffset + clock.getElapsedTime() * speedRef.current
        renderer.render(scene, camera)
        raf = requestAnimationFrame(animate)
      }
      raf = requestAnimationFrame(animate)

      threeRef.current = {
        renderer,
        scene,
        camera,
        material,
        clock,
        clickIx: 0,
        uniforms,
        resizeObserver: ro,
        raf,
        quad,
        timeOffset,
      }
    } else if (threeRef.current) {
      const t = threeRef.current
      t.uniforms.uShapeType.value = SHAPE_MAP[variant] ?? 0
      t.uniforms.uPixelSize.value = pixelSize * t.renderer.getPixelRatio()
      t.uniforms.uColor.value.set(color)
      t.uniforms.uScale.value = patternScale
      t.uniforms.uDensity.value = patternDensity
      t.uniforms.uPixelJitter.value = pixelSizeJitter
      t.uniforms.uEnableRipples.value = enableRipples ? 1 : 0
      t.uniforms.uRippleIntensity.value = rippleIntensityScale
      t.uniforms.uRippleThickness.value = rippleThickness
      t.uniforms.uRippleSpeed.value = rippleSpeed
      t.uniforms.uEdgeFade.value = edgeFade
      if (transparent) t.renderer.setClearAlpha(0)
      else t.renderer.setClearColor(0x000000, 1)
    }

    prevConfigRef.current = cfg

    return () => {
      if (threeRef.current && mustReinit) return
      if (!threeRef.current) return
      const t = threeRef.current
      t.resizeObserver?.disconnect()
      cancelAnimationFrame(t.raf)
      t.quad?.geometry.dispose()
      t.material.dispose()
      t.renderer.dispose()
      t.renderer.forceContextLoss()
      if (t.renderer.domElement.parentElement === container) container.removeChild(t.renderer.domElement)
      threeRef.current = null
    }
  }, [
    antialias,
    pixelSize,
    patternScale,
    patternDensity,
    enableRipples,
    rippleIntensityScale,
    rippleThickness,
    rippleSpeed,
    pixelSizeJitter,
    edgeFade,
    transparent,
    autoPauseOffscreen,
    variant,
    color,
    speed,
  ])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", ...style }}
      aria-hidden="true"
    />
  )
}
