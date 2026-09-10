import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/*  组件：章节人物（帧序列 + 分层视差）                                   */
/*                                                                      */
/*  视差分层（无需抠像）：                                                */
/*    · 环境层：同一帧的高斯模糊副本，放在 translateZ(-70px) 的远平面，     */
/*      与清晰的人物层形成真实 3D 纵深，转头/滚动时两层位移不同步          */
/*    · 滚动漂移：人物随章节穿越视口上下漂移 ±70px，与文字形成速度差       */
/*    · 速度惯性：由 ScrollTrigger.getVelocity() 驱动挤压/倾斜，滚动越快   */
/*      人物"迎风"形变越明显，停止后自然回弹                              */
/*    · 鼠标视差 + 呼吸浮动，让人物始终"活着"                             */
/* ------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** 羽化蒙版：中心实、四周渐隐进背景（百分比相对整宽/整高） */
const FEATHER_MASK =
  "radial-gradient(72% 66% at 50% 46%, #000 54%, rgba(0,0,0,0.92) 70%, transparent 88%)";

interface Entry {
  el: HTMLElement; // 所在章节
  box: HTMLDivElement; // 出入场容器
  tilt: HTMLDivElement; // 3D 变换层
  canvas: HTMLCanvasElement; // 人物层
  ctx: CanvasRenderingContext2D;
  bgCanvas: HTMLCanvasElement; // 环境层（模糊）
  bgCtx: CanvasRenderingContext2D;
  bar: HTMLSpanElement;
  frames: string[];
  imgs: (HTMLImageElement | null)[];
  scrollF: number; // GSAP scrub 写入的帧位置（小数）
  lastIdx: number;
  dirty: boolean;
  vel: number; // 滚动速度（归一化，带衰减）
  loaded: boolean;
  active: boolean;
  load: () => void;
}

const registry = new Set<Entry>();
let tnx = 0, tny = 0, snx = 0, sny = 0; // 鼠标目标 / 平滑值
let loopId = 0;
let bound = false;

const isReady = (img: HTMLImageElement | null) => !!img && img.complete && img.naturalWidth > 0;

function bindGlobal() {
  if (bound) return;
  bound = true;
  window.addEventListener("pointermove", (e) => {
    tnx = (e.clientX / window.innerWidth) * 2 - 1;
    tny = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
}

/** 把目标帧画到指定画布，未就绪时用相邻已加载帧兜底 */
function paint(e: Entry, cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const n = e.frames.length;
  const idx = clamp(Math.round(e.scrollF), 0, n - 1);
  let j = idx;
  while (j >= 0 && !isReady(e.imgs[j])) j--;
  if (j < 0) { j = idx; while (j < n && !isReady(e.imgs[j])) j++; }
  if (j >= n) return -1;
  const img = e.imgs[j]!;
  if (cv.width !== img.naturalWidth) {
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
  }
  ctx.drawImage(img, 0, 0);
  return j;
}

function ensureLoop() {
  if (loopId || registry.size === 0) return;

  const tick = (time: number, deltaMs: number) => {
    if (registry.size === 0) { loopId = 0; gsap.ticker.remove(tick); return; }
    const dt = Math.min(0.05, deltaMs / 1000);
    const vh = window.innerHeight;
    const mid = vh * 0.5;

    /* ---- 1. 选角：视口中心落在哪个章节，哪位人物出场 ---- */
    let star: Entry | null = null;
    let bestDist = Infinity;
    for (const e of registry) {
      const r = e.el.getBoundingClientRect();
      const d = r.top <= mid && r.bottom >= mid ? -1 : r.top > mid ? r.top - mid : mid - r.bottom;
      if (d < 0) { star = e; break; }
      if (d < bestDist) { bestDist = d; star = e; }
    }

    const k = 1 - Math.exp(-dt * 6);
    snx += (tnx - snx) * k;
    sny += (tny - sny) * k;

    for (const e of registry) {
      const r = e.el.getBoundingClientRect();

      /* ---- 2. 懒加载：临近视口 1.6 屏才开始批量预加载 ---- */
      if (!e.loaded && r.top < vh * 1.6 && r.bottom > -vh * 0.6) e.load();

      /* ---- 3. 出入场（章节需实际覆盖视口，避免在首屏提前现身）---- */
      const isActive = e === star && r.top < vh * 0.85 && r.bottom > vh * 0.15;
      if (e.active !== isActive) {
        e.active = isActive;
        e.box.classList.toggle("char-on", isActive);
        if (isActive) e.dirty = true;
      }

      /* ---- 4. 滚动进度条：章节完整穿越视口 = 0 → 1 ---- */
      const p = clamp((vh - r.top) / Math.max(1, vh + r.height), 0, 1);
      e.bar.style.transform = `scaleX(${p.toFixed(3)})`;

      if (!e.active) continue;

      /* ---- 5. 分层视差 + 速度惯性 + 呼吸浮动 ---- */
      e.vel *= Math.exp(-dt * 4); // 停止滚动后自然回弹
      const drift = (0.5 - p) * 70; // 与文字形成速度差的纵向漂移
      const bob = Math.sin(time * 1.1) * 5;
      const breathe = 1 + Math.sin(time * 0.72) * 0.006;
      e.tilt.style.transform =
        `rotateY(${(-snx * 3.4).toFixed(2)}deg) rotateX(${(sny * 2.2).toFixed(2)}deg) ` +
        `translateY(${(sny * -6 + bob + drift).toFixed(1)}px) ` +
        `skewY(${(-e.vel * 1.5).toFixed(2)}deg) ` +
        `scaleY(${(breathe + Math.abs(e.vel) * 0.035).toFixed(4)}) scaleX(${(1 - Math.abs(e.vel) * 0.012).toFixed(4)})`;

      /* ---- 6. 绘制当前帧（人物层 + 环境层）---- */
      const drawn = paint(e, e.canvas, e.ctx);
      if (!e.dirty && drawn === e.lastIdx) continue;
      if (drawn >= 0) {
        paint(e, e.bgCanvas, e.bgCtx);
        e.lastIdx = drawn;
      }
      e.dirty = false;
    }
  };
  loopId = 1; // 已挂载到 gsap.ticker（1 = 运行中，0 = 空闲）
  gsap.ticker.add(tick);
}

/* ------------------------------------------------------------------ */
interface Props {
  /** 帧序列 URL（已按顺序排列） */
  frames: string[];
  /** 桌面端人物站位的半边（与各章节文案预留位对应） */
  side?: "left" | "right";
  /** 桌面端占位栏宽 */
  widthClass?: string;
  /** 帧形状（含移动端画中画尺寸） */
  frameClass?: string;
  /** HUD 标签 */
  label: string;
}

export default function CharacterStage({
  frames,
  side = "left",
  widthClass = "md:w-[38%]",
  frameClass = "aspect-[3/4] w-36 sm:w-44 md:w-auto md:h-[66vh]",
  label,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  /* useGSAP：自动在卸载时回滚动画与 ScrollTrigger，并以 wrapRef 限定作用域 */
  useGSAP(() => {
    const wrap = wrapRef.current;
    const box = boxRef.current;
    const tilt = tiltRef.current;
    const canvas = canvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    const bar = barRef.current;
    if (!wrap || !box || !tilt || !canvas || !bgCanvas || !bar || frames.length === 0) return;

    const entry: Entry = {
      el: wrap.parentElement as HTMLElement, // 所在章节
      box,
      tilt,
      canvas,
      ctx: canvas.getContext("2d")!,
      bgCanvas,
      bgCtx: bgCanvas.getContext("2d")!,
      bar,
      frames,
      imgs: frames.map((src, i) => {
        // 首帧立即加载，其余等临近视口再批量加载
        if (i > 0) return null;
        const img = new Image();
        img.src = src;
        return img;
      }),
      scrollF: 0,
      lastIdx: -1,
      dirty: true,
      vel: 0,
      loaded: false,
      active: false,
      load() {
        if (entry.loaded) return;
        entry.loaded = true;
        for (let i = 0; i < frames.length; i++) {
          if (entry.imgs[i]) continue;
          const img = new Image();
          img.decoding = "async";
          img.onload = () => (entry.dirty = true);
          img.src = frames[i];
          entry.imgs[i] = img;
        }
      },
    };
    registry.add(entry);
    bindGlobal();
    ensureLoop();

    /* ---- GSAP 滚动擦洗：章节穿越视口 = 0 → 末帧（scrub 越大越顺滑）---- */
    const obj = { f: 0 };
    gsap.to(obj, {
      f: frames.length - 1,
      ease: "none",
      scrollTrigger: {
        trigger: entry.el,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
        onUpdate: (self) => {
          entry.scrollF = obj.f;
          entry.dirty = true;
          // 滚动速度 → 惯性形变（归一化到 ±1）
          entry.vel = gsap.utils.clamp(-1, 1, self.getVelocity() / 2400);
        },
      },
    });

    return () => {
      registry.delete(entry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { scope: wrapRef });

  return (
    <div
      ref={wrapRef}
      className={`pointer-events-none fixed bottom-24 right-3 z-20 w-36 sm:w-44 md:bottom-0 md:top-0 md:z-auto md:flex md:w-[38%] md:items-center md:justify-center ${
        side === "left" ? "md:left-0 md:right-auto" : "md:right-0 md:left-auto"
      } ${widthClass}`}
    >
      <div ref={boxRef} className="char-frame relative flex w-full flex-col items-center">
        <div className="relative">
          {/* 背景光晕 */}
          <div className="absolute -inset-12 hidden md:block">
            <div className="h-full w-full bg-[radial-gradient(52%_52%_at_50%_50%,rgba(77,139,242,0.18),transparent_70%)]" />
          </div>

          {/* 媒体盒：羽化蒙版让人物融入背景 */}
          <div
            className={`relative overflow-hidden ${frameClass}`}
            style={{ WebkitMaskImage: FEATHER_MASK, maskImage: FEATHER_MASK }}
          >
            {/* 3D 舞台：环境层（远）+ 人物层（近），转头时产生真实视差 */}
            <div className="absolute inset-0 [perspective:900px]">
              <div ref={tiltRef} className="absolute inset-0 [transform-style:preserve-3d] will-change-transform">
                <canvas
                  ref={bgCanvasRef}
                  className="absolute inset-0 h-full w-full scale-[1.18] opacity-45 blur-[10px]"
                  style={{ transform: "translateZ(-70px)" }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 h-full w-full"
                  style={{ transform: "translateZ(0px)" }}
                />
              </div>
            </div>
            {/* 暗角渐变：边缘压向页面底色 */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,17,34,0.3)_0%,transparent_20%,transparent_58%,rgba(10,17,34,0.45)_84%,rgba(10,17,34,0.78)_100%)]" />
          </div>
        </div>

        {/* 字幕条（随人物一起出入场，不压画面） */}
        <div className="mt-2.5 flex w-[88%] items-center gap-3">
          <span className="shrink-0 font-mono text-[9px] tracking-[0.24em] text-azure/90">{label}</span>
          <div className="h-[2px] flex-1 bg-line/60">
            <span ref={barRef} className="block h-full w-full origin-left bg-azure/90" style={{ transform: "scaleX(0)" }} />
          </div>
          <span className="shrink-0 font-mono text-[9px] tracking-[0.2em] text-mist/50">SCROLL</span>
        </div>
      </div>
    </div>
  );
}
