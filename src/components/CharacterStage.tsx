import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/*  组件：章节人物（帧序列 + GSAP 滚动擦洗）                              */
/*                                                                      */
/*  与之前的 <video> 方案相比：                                           */
/*    - GSAP ScrollTrigger scrub 直接驱动帧序号，滚动同步零延迟；          */
/*    - 帧逐张预加载（10fps webp，整段仅 1~2.4MB），无 seek 卡顿；         */
/*    - 媒体盒用羽化蒙版 + 暗角渐变，人物融化进页面背景，不再像贴片。       */
/*                                                                      */
/*  调度（共享 rAF）：视口中心所在章节的人物出场（crossfade），             */
/*  鼠标视差 + 呼吸浮动让人物保持"活着"。                                 */
/* ------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** 羽化蒙版：中心实、四周渐隐进背景（百分比相对整宽/整高） */
const FEATHER_MASK =
  "radial-gradient(72% 66% at 50% 46%, #000 54%, rgba(0,0,0,0.92) 70%, transparent 88%)";

interface Entry {
  el: HTMLElement; // 所在章节
  box: HTMLDivElement; // 媒体盒（出入场 / 蒙版）
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  bar: HTMLSpanElement;
  frames: string[];
  imgs: (HTMLImageElement | null)[];
  scrollF: number; // GSAP scrub 写入的帧位置（小数）
  lastIdx: number;
  dirty: boolean;
  loaded: boolean; // 是否已开始批量预加载
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

      /* ---- 5. 镜头视差 + 呼吸浮动（用 gsap.ticker 的 time，切后台即停）---- */
      const bob = Math.sin(time * 1.1) * 5;
      const breathe = 1 + Math.sin(time * 0.72) * 0.006;
      e.canvas.style.transform =
        `perspective(1000px) rotateY(${(-snx * 2.6).toFixed(2)}deg) rotateX(${(sny * 1.6).toFixed(2)}deg) ` +
        `translateY(${(sny * -5 + bob).toFixed(1)}px) scale(${breathe.toFixed(4)})`;

      /* ---- 6. 绘制当前帧 ---- */
      const n = e.frames.length;
      const idx = clamp(Math.round(e.scrollF), 0, n - 1);
      if (!e.dirty && idx === e.lastIdx) continue;

      // 就近回退：目标帧未就绪时先用相邻已加载帧兜底
      let j = idx;
      while (j >= 0 && !isReady(e.imgs[j])) j--;
      if (j < 0) { j = idx; while (j < n && !isReady(e.imgs[j])) j++; }
      if (j >= n) continue;
      const img = e.imgs[j]!;
      if (e.canvas.width !== img.naturalWidth) {
        e.canvas.width = img.naturalWidth;
        e.canvas.height = img.naturalHeight;
      }
      e.ctx.drawImage(img, 0, 0);
      e.lastIdx = j;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  /* useGSAP：自动在卸载时回滚动画与 ScrollTrigger，并以 wrapRef 限定作用域 */
  useGSAP(() => {
    const wrap = wrapRef.current;
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const bar = barRef.current;
    if (!wrap || !box || !canvas || !bar || frames.length === 0) return;
    const ctx = canvas.getContext("2d")!;

    const entry: Entry = {
      el: wrap.parentElement as HTMLElement, // 所在章节
      box,
      canvas,
      ctx,
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
      },
      onUpdate: () => {
        entry.scrollF = obj.f;
        entry.dirty = true;
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
            <canvas ref={canvasRef} className="h-full w-full will-change-transform" />
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
