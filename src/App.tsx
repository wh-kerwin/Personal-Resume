import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import GazeBanner from "./components/GazeBanner";
import CharacterStage from "./components/CharacterStage";

/* 章节人物帧序列（由 ffmpeg 按 10fps 抽取，GSAP scrub 驱动） */
const frameModules = import.meta.glob("./assets/frames/*/*.webp", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const framesOf = (name: string) =>
  Object.keys(frameModules)
    .filter((p) => p.includes(`/${name}/`))
    .sort()
    .map((p) => frameModules[p]);

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

type SectionKey = "hero" | "about" | "skills" | "timeline" | "projects" | "contact";

const KEYS: SectionKey[] = ["hero", "about", "skills", "timeline", "projects", "contact"];

const NAV = [
  { key: "about", label: "关于" },
  { key: "skills", label: "技能" },
  { key: "timeline", label: "经历" },
  { key: "projects", label: "项目" },
  { key: "contact", label: "联系" },
] as const;

/* ------------------------------------------------------------------ */
/*  小部件                                                              */
/* ------------------------------------------------------------------ */
function SectionHead({ num, title, en, align = "left" }: { num: string; title: string; en: string; align?: "left" | "right" }) {
  return (
    <div className={`mb-10 flex items-end gap-5 ${align === "right" ? "flex-row-reverse text-right" : ""}`} data-reveal>
      <span className="ghost-num text-[5.5rem] leading-[0.8] font-bold select-none md:text-[7rem]">{num}</span>
      <div>
        <p className="font-mono text-[11px] tracking-[0.35em] text-azure uppercase">{en}</p>
        <h2 className="font-disp text-4xl text-snow md:text-5xl">{title}</h2>
        <div className={`mt-3 h-[3px] w-16 bg-coral ${align === "right" ? "ml-auto" : ""}`} />
      </div>
    </div>
  );
}

function Chip({ children, tone = "azure" }: { children: React.ReactNode; tone?: "azure" | "amber" | "coral" }) {
  const map = {
    azure: "border-azure/40 text-azure",
    amber: "border-amber/40 text-amber",
    coral: "border-coral/40 text-coral",
  } as const;
  return (
    <span className={`notch-sm inline-block border ${map[tone]} bg-panel px-3 py-1 font-mono text-xs tracking-wide transition-colors duration-300 hover:bg-panel2`}>
      {children}
    </span>
  );
}

function SkillBar({ name, value, tone, delay }: { name: string; value: number; tone: string; delay: number }) {
  return (
    <div data-reveal style={{ transitionDelay: `${delay}ms` }}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-snow">{name}</span>
        <span className="font-mono text-xs text-mist">{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden bg-abyss/80 notch-sm">
        <div data-bar={value} className="h-full origin-left" style={{ background: tone, transform: `scaleX(${value / 100})` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  项目缩略图（纯 SVG，按真实项目主题绘制）                                */
/* ------------------------------------------------------------------ */
type ThumbKind = "rcm" | "rpa" | "course" | "shield" | "net" | "bars" | "pie";

function Thumb({ kind }: { kind: ThumbKind }) {
  const T = "#4d8bf2", A = "#ffc65c", R = "#ff7a59", S = "#eaf1fc";
  switch (kind) {
    case "rcm":
      return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <rect x="52" y="22" width="96" height="64" rx="6" fill="none" stroke={T} strokeWidth="3" />
          <path d="M60 14 Q100 -2 140 14" fill="none" stroke={A} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M70 8 Q100 -4 130 8" fill="none" stroke={A} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <line x1="64" y1="42" x2="112" y2="42" stroke={S} strokeWidth="3" opacity="0.5" />
          <circle cx="120" cy="42" r="5" fill={T} />
          <line x1="64" y1="62" x2="100" y2="62" stroke={S} strokeWidth="3" opacity="0.5" />
          <circle cx="108" cy="62" r="5" fill={R} />
          <rect x="90" y="86" width="20" height="10" fill={T} opacity="0.7" />
        </svg>
      );
    case "rpa":
      return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <rect x="66" y="34" width="52" height="44" rx="8" fill="none" stroke={T} strokeWidth="3" />
          <circle cx="82" cy="54" r="5" fill={A} />
          <circle cx="102" cy="54" r="5" fill={A} />
          <line x1="80" y1="68" x2="104" y2="68" stroke={R} strokeWidth="3" strokeLinecap="round" />
          <line x1="92" y1="34" x2="92" y2="22" stroke={T} strokeWidth="2.5" />
          <circle cx="92" cy="18" r="4" fill={R} />
          <circle cx="142" cy="72" r="16" fill="none" stroke={A} strokeWidth="3" />
          <circle cx="142" cy="72" r="5" fill={A} />
          <path d="M142 52v-6M142 98v-6M122 72h-6M168 72h-6M128 58l-4-4M160 90l-4-4" stroke={A} strokeWidth="3" strokeLinecap="round" />
          <rect x="42" y="88" width="26" height="6" fill={T} opacity="0.5" />
        </svg>
      );
    case "course":
      return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <path d="M100 30 Q78 20 56 28 V92 Q78 84 100 94 Q122 84 144 92 V28 Q122 20 100 30Z" fill="none" stroke={T} strokeWidth="3" strokeLinejoin="round" />
          <line x1="100" y1="30" x2="100" y2="94" stroke={T} strokeWidth="2.5" />
          <path d="M66 44h22M66 56h22M66 68h16" stroke={S} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          <path d="M112 48 l14 8 -14 8 z" fill={R} />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <path d="M100 16 L136 30 V58 Q136 86 100 102 Q64 86 64 58 V30 Z" fill="none" stroke={T} strokeWidth="3" strokeLinejoin="round" />
          <path d="M84 58 l12 12 22 -24" fill="none" stroke={A} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="152" cy="34" r="4" fill={R} />
          <circle cx="48" cy="78" r="3" fill={A} />
        </svg>
      );
    case "net":
      return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <g stroke="#2b4a9c" strokeWidth="1.6">
            <path d="M52 82 L88 40 L126 68 L158 30" fill="none" />
            <path d="M88 40 L104 92 L126 68" fill="none" />
            <path d="M52 82 L104 92" fill="none" />
          </g>
          {([[52, 82, 6, T], [88, 40, 8, A], [126, 68, 6, R], [158, 30, 9, T], [104, 92, 5, S]] as const).map(([x, y, r, c], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={c} />
          ))}
        </svg>
      );
    case "bars":
      return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <line x1="40" y1="98" x2="168" y2="98" stroke={S} strokeWidth="2" opacity="0.4" />
          <rect x="52" y="56" width="18" height="42" fill={T} />
          <rect x="82" y="34" width="18" height="64" fill={A} />
          <rect x="112" y="66" width="18" height="32" fill={R} />
          <rect x="142" y="24" width="18" height="74" fill={T} opacity="0.8" />
          <circle cx="61" cy="46" r="3" fill={S} />
          <circle cx="121" cy="56" r="3" fill={S} />
        </svg>
      );
    case "pie":
      return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <circle cx="88" cy="60" r="34" fill="none" stroke={T} strokeWidth="14" strokeDasharray="118 214" transform="rotate(-90 88 60)" />
          <circle cx="88" cy="60" r="34" fill="none" stroke={A} strokeWidth="14" strokeDasharray="60 214" strokeDashoffset="-118" transform="rotate(-90 88 60)" />
          <circle cx="88" cy="60" r="34" fill="none" stroke={R} strokeWidth="14" strokeDasharray="36 214" strokeDashoffset="-178" transform="rotate(-90 88 60)" />
          <path d="M138 52 l18 8 -18 8 v-6 h-12 v-4 h12 z" fill={S} opacity="0.85" />
        </svg>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  主组件                                                              */
/* ------------------------------------------------------------------ */
export default function App() {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    (_self, contextSafe) => {
      /* 所有动效只在"不要求减少动效"时启用；减少动效时仅保留静态排版 */
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        /* ---- 滚动到哪一节，右侧圆点就点亮哪一节 ---- */
        KEYS.forEach((k) => {
          ScrollTrigger.create({
            trigger: `#sec-${k}`,
            start: "top 58%",
            end: "bottom 42%",
            onToggle: (s) => {
              document.querySelector(`[data-dot="${k}"]`)?.classList.toggle("is-active", s.isActive);
            },
          });
        });

        /* ---- 文字入场：按屏批量 stagger，比逐元素触发更整齐 ---- */
        gsap.set("[data-reveal]", { y: 48, autoAlpha: 0 });
        ScrollTrigger.batch("[data-reveal]", {
          interval: 0.12,
          batchMax: 6,
          start: "top 88%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              autoAlpha: 1,
              duration: 0.9,
              ease: "power3.out",
              stagger: 0.08,
              overwrite: true,
            }),
        });

        /* ---- 技能条 ---- */
        gsap.utils.toArray<HTMLElement>("[data-bar]").forEach((el) => {
          gsap.fromTo(el, { scaleX: 0.02 }, {
            scaleX: Number(el.dataset.bar) / 100,
            duration: 1.3,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });
        });

        /* ---- 经历时间轴划线 ---- */
        gsap.fromTo("#tl-line", { scaleY: 0 }, {
          scaleY: 1,
          ease: "none",
          scrollTrigger: { trigger: "#tl-list", start: "top 78%", end: "bottom 62%", scrub: 0.8 },
        });

        /* ---- 顶部阅读进度 ---- */
        gsap.to("#progress", {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
        });

        /* ---- 章节编号：随滚动轻微上浮，制造纵深 ---- */
        gsap.utils.toArray<HTMLElement>(".ghost-num").forEach((el) => {
          gsap.fromTo(el, { yPercent: 14 }, {
            yPercent: -14,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.8 },
          });
        });

        /* ---- 渐进式文字揭示：逐词随滚动点亮（scrubbing text reveal）---- */
        gsap.utils.toArray<HTMLElement>("[data-scrub-text]").forEach((el) => {
          const split = SplitText.create(el, { type: "words", autoSplit: true });
          gsap.from(split.words, {
            opacity: 0.18,
            ease: "none",
            stagger: 0.4,
            scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 52%", scrub: 0.6 },
          });
          return () => split.revert();
        });
      });

      /* 减少动效：只做一次淡入，不做位移/擦洗 */
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-reveal]", { autoAlpha: 1, y: 0 });
        gsap.utils.toArray<HTMLElement>("[data-bar]").forEach((el) => {
          gsap.set(el, { scaleX: Number(el.dataset.bar) / 100 });
        });
      });

      /* ---- 首屏入场主时间线：用 label 编排，避免 delay 链式堆叠 ---- */
      const tl = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.15 });
      const titleSplit = SplitText.create(".hero-title", { type: "lines", autoSplit: true, linesClass: "hero-line" });
      tl.addLabel("stage", 0)
        .from(".hero-banner", { autoAlpha: 0, scale: 1.12, filter: "blur(16px)", duration: 1.5, ease: "power2.out" }, "stage")
        .from(".hero-line", { yPercent: 105, autoAlpha: 0, duration: 1, stagger: 0.12 }, "stage+=0.2")
        .from(
          ".hero-anim:not(.hero-banner):not(.hero-title)",
          { y: 34, autoAlpha: 0, duration: 0.85, stagger: 0.09 },
          "stage+=0.45"
        )
        .from(".hero-deco", { autoAlpha: 0, scale: 0.6, duration: 0.8, stagger: 0.12, ease: "back.out(2)" }, "stage+=0.7");

      /* ---- 首屏漂浮装饰的鼠标视差（contextSafe 包裹，卸载后自动失效）---- */
      const decos = gsap.utils.toArray<HTMLElement>("[data-parallax]").map((el) => ({
        x: gsap.quickTo(el, "x", { duration: 0.8, ease: "power3" }),
        y: gsap.quickTo(el, "y", { duration: 0.8, ease: "power3" }),
        s: Number(el.dataset.parallax) || 18,
      }));
      const parallax = (e: PointerEvent) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        decos.forEach((d) => { d.x(nx * d.s); d.y(ny * d.s); });
      };
      const onMove = (contextSafe?.(parallax) ?? parallax) as EventListener;
      window.addEventListener("pointermove", onMove);

      return () => {
        window.removeEventListener("pointermove", onMove);
        titleSplit.revert();
        mm.revert();
      };
    },
    { scope: rootRef }
  );

  const jump = (k: SectionKey) => {
    document.getElementById(`sec-${k}`)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div ref={rootRef} className="relative min-h-screen">
      <div className="atmos" aria-hidden />

      {/* 阅读进度条 */}
      <div id="progress" className="fixed top-0 left-0 z-50 h-[3px] w-full origin-left bg-amber" style={{ transform: "scaleX(0)" }} />

      {/* ---------------- 导航 ---------------- */}
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-10">
          <a href="#sec-hero" onClick={(e) => { e.preventDefault(); jump("hero"); }} className="group flex items-center gap-3">
            <span className="notch-sm flex h-10 w-10 items-center justify-center bg-coral font-disp text-xl text-abyss transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">吴</span>
            <span className="font-mono text-xs tracking-[0.25em] text-mist">
              WU·HAN <span className="text-azure">/ 3D简历</span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <a
                key={n.key}
                href={`#sec-${n.key}`}
                onClick={(e) => { e.preventDefault(); jump(n.key); }}
                className="group relative text-sm text-mist transition-colors duration-300 hover:text-snow"
              >
                {n.label}
                <span className="absolute -bottom-1.5 left-0 h-[2px] w-0 bg-azure transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
            <span className="flex items-center gap-2 border border-line bg-panel/80 px-3 py-1.5 font-mono text-[11px] text-azure">
              <i className="dot-live inline-block h-2 w-2 rounded-full bg-azure" />
              求职中 · 合肥
            </span>
          </nav>
        </div>
      </header>

      {/* ---------------- 右侧圆点导航 ---------------- */}
      <div className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-4 md:flex">
        {KEYS.map((k) => (
          <button
            key={k}
            data-dot={k}
            onClick={() => jump(k)}
            aria-label={k}
            className="group flex items-center gap-2.5"
          >
            <span className="pointer-events-none translate-x-2 font-mono text-[10px] tracking-widest text-mist uppercase opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
              {k}
            </span>
            <span className="dot block h-2.5 w-2.5 rotate-45 border border-mist/60 transition-all duration-300 group-hover:border-azure" />
          </button>
        ))}
      </div>

      <main className="relative z-10">
        {/* ================= HERO ================= */}
        <section id="sec-hero" className="relative flex min-h-screen flex-col justify-center overflow-hidden px-5 pt-24 pb-16 md:px-10">
          {/* 全屏视频 Banner：人物视线跟随鼠标 */}
          <GazeBanner className="hero-anim hero-banner" />

          {/* 漂浮装饰 */}
          <svg data-parallax="26" className="hero-deco drift absolute top-[16%] left-[6%] hidden h-10 w-10 text-azure/70 lg:block" style={{ "--rot": "12deg" } as React.CSSProperties} viewBox="0 0 40 40" fill="none">
            <path d="M20 4v32M4 20h32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <svg data-parallax="-20" className="hero-deco drift absolute top-[24%] right-[64%] hidden h-8 w-8 text-amber/70 lg:block" style={{ "--rot": "-8deg", animationDelay: "0.8s" } as React.CSSProperties} viewBox="0 0 40 40" fill="none">
            <rect x="8" y="8" width="24" height="24" stroke="currentColor" strokeWidth="3" transform="rotate(12 20 20)" />
          </svg>
          <svg data-parallax="34" className="hero-deco drift absolute bottom-[28%] left-[28%] hidden h-9 w-9 text-coral/70 lg:block" style={{ animationDelay: "1.6s" } as React.CSSProperties} viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="3" />
            <circle cx="20" cy="20" r="4" fill="currentColor" />
          </svg>

          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <div className="max-w-2xl">
              <p className="hero-anim mb-5 flex items-center gap-3 font-mono text-xs tracking-[0.35em] text-azure">
                <span className="inline-block h-[2px] w-10 bg-azure" />
                FRONTEND · 9 YEARS · HEFEI
              </p>
              <h1 className="hero-anim hero-title font-disp text-[clamp(3.2rem,9vw,7rem)] leading-[1.02] text-snow">
                你好，我是<br />
                <span className="brush text-coral">吴寒</span>
                <span className="ml-3 align-middle font-mono text-base tracking-widest text-mist md:text-lg">// 前端开发工程师</span>
              </h1>
              <p className="hero-anim mt-6 max-w-lg text-lg leading-relaxed text-mist">
                <strong className="font-bold text-snow">9 年</strong>前端老兵，从百度地图 API 写到 echarts 大屏，
                从 <span className="text-azure">Vue2</span> 一路写到 <span className="text-azure">Vue3 + Pinia</span>。
                这份会动的简历本身，就是我用 <span className="text-amber">交互视频 × GSAP</span> 写的小作品。
              </p>
              <div className="hero-anim mt-9 flex flex-wrap items-center gap-4">
                <a
                  href="#sec-about"
                  onClick={(e) => { e.preventDefault(); jump("about"); }}
                  className="notch-sm group inline-flex items-center gap-2.5 bg-amber px-7 py-3.5 font-bold text-abyss transition-all duration-300 hover:-translate-y-0.5 hover:bg-coral hover:text-snow"
                >
                  开始阅读简历
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-1" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v11M3.5 8.5L8 13l4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a
                  href="mailto:1301644971@qq.com"
                  className="notch-sm inline-flex items-center gap-2.5 border border-azure/50 px-7 py-3.5 font-bold text-azure transition-all duration-300 hover:-translate-y-0.5 hover:border-azure hover:bg-azure/10"
                >
                  <svg className="h-4 w-4" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="3.5" width="15" height="11" rx="1" stroke="currentColor" strokeWidth="1.8" /><path d="M2 4.5l7 5.5 7-5.5" stroke="currentColor" strokeWidth="1.8" /></svg>
                  1301644971@qq.com
                </a>
              </div>
              <div className="hero-anim mt-12 flex flex-wrap gap-x-10 gap-y-5">
                {[["9", "年前端开发经验"], ["30+", "项目 / 系统交付"], ["7+", "可视化大屏落地"]].map(([n, t]) => (
                  <div key={t} className="flex items-baseline gap-3">
                    <span className="font-mono text-4xl font-bold text-snow">{n}</span>
                    <span className="max-w-[9rem] text-xs leading-tight text-mist">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 滚动提示 */}
          <div className="hero-anim absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2.5">
            <span className="font-mono text-[10px] tracking-[0.3em] text-mist">SCROLL · 阿寒会配合翻页</span>
            <span className="flex h-9 w-[22px] justify-center rounded-full border-2 border-mist/50 pt-1.5">
              <span className="wheel-dot h-1.5 w-1.5 rounded-full bg-azure" />
            </span>
          </div>
        </section>

        {/* ================= 跑马灯 ================= */}
        <div className="marquee relative z-10 overflow-hidden border-y border-line bg-abyss/70 py-3.5">
          <div className="marquee-track flex w-max items-center gap-8">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center gap-8" aria-hidden={dup === 1}>
                {["VUE3", "UNI-APP", "ELEMENT", "ECHARTS", "THREE.JS", "D3.JS", "SWIPER", "PINIA", "WEBPACK", "NODE.JS", "LINUX", "JENKINS", "AI 编程"].map((w, i) => (
                  <span key={w} className="flex items-center gap-8">
                    <span className={`font-mono text-sm tracking-[0.3em] ${i % 3 === 0 ? "text-coral" : i % 3 === 1 ? "text-azure" : "text-amber"}`}>{w}</span>
                    <svg className="h-3 w-3 text-mist/50" viewBox="0 0 12 12"><path d="M6 0l1.6 4.4L12 6 7.6 7.6 6 12 4.4 7.6 0 6l4.4-1.6z" fill="currentColor" /></svg>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ================= 关于 ================= */}
        <section id="sec-about" className="relative px-5 py-28 md:px-10">
          <CharacterStage
            frames={framesOf("about")}
            side="left"
            widthClass="md:w-[38%]"
            frameClass="aspect-[9/16] w-32 sm:w-36 md:w-auto md:h-[72vh]"
            label="CAM 02 · 自我介绍"
          />
          <div className="mx-auto max-w-7xl md:pl-[42%]">
            <SectionHead num="01" title="关于我" en="ABOUT ME" />
            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-5 text-[15px] leading-loose text-mist">
                <p data-scrub-text>
                  我是吴寒，男，32 岁，淮北师范大学计算机专业毕业，目前在<strong className="text-snow">合肥</strong>看新机会。
                  从 2017 年入行到今天，<strong className="text-snow">9 年</strong>只做了一件事——把业务需求稳稳地翻译成页面：
                  烟草研判平台、海关联合指挥系统、RPA 机器人管理后台、课程资源中心……
                </p>
                <p data-reveal>
                  我的关键词是<strong className="text-snow">「可靠」与「可视化」</strong>：
                  用 <span className="text-azure">Vue 全家桶</span> 搭过带 RBAC 权限的复杂后台，
                  用 <span className="text-amber">echarts / vis.js / D3</span> 画过层层下钻的数据大屏，
                  也封装过拖拽式 ETL 清洗工具。最近还在用
                  <span className="text-coral"> Cursor、Trae </span>等 AI 工具给开发提速。
                  左边这位穿着连帽衫、抬手就能调出全息影像的「阿寒」，就是我的精神形象——
                  继续往下滚，他会跟着你的滚动一路演下去。
                </p>
                <div className="flex flex-wrap gap-2 pt-2" data-reveal>
                  {["Vue", "Uni-app", "Element", "ECharts", "Three.js", "D3.js", "Node.js", "Linux"].map((t, i) => (
                    <Chip key={t} tone={(["azure", "amber", "coral"] as const)[i % 3]}>{t}</Chip>
                  ))}
                </div>
              </div>
              <aside className="notch self-start border border-line bg-panel p-6" data-reveal>
                <p className="mb-4 font-mono text-[11px] tracking-[0.3em] text-azure">PILOT CARD · 档案</p>
                <ul className="space-y-3 text-sm">
                  {[
                    ["姓名", "吴寒 / 男 · 32岁"],
                    ["坐标", "合肥（期望城市）"],
                    ["工龄", "9 年 · 前端开发"],
                    ["求职意向", "前端开发工程师"],
                    ["学历", "淮北师范大学 · 本科"],
                    ["证书", "大学英语四级 CET-4"],
                  ].map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-4 border-b border-line/60 pb-2.5">
                      <span className="shrink-0 text-mist">{k}</span>
                      <span className="text-right font-medium text-snow">{v}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-center gap-2.5 font-mono text-xs text-amber">
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.8 4.4L14.5 6l-4.7 3.6L11 14.5 8 11.9l-3 2.6 1.2-4.9L1.5 6l4.7-.6z" fill="currentColor" /></svg>
                  本档案由阿寒本仔实时出演
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* ================= 技能 ================= */}
        <section id="sec-skills" className="relative px-5 py-28 md:px-10">
          <CharacterStage
            frames={framesOf("skills")}
            side="right"
            widthClass="md:w-[35%]"
            frameClass="aspect-[3/4] w-32 sm:w-36 md:w-auto md:h-[66vh]"
            label="CAM 03 · 技能面板"
          />
          <div className="mx-auto max-w-7xl md:pr-[40%]">
            <SectionHead num="02" title="个人优势" en="SKILL SET" />
            <p className="mb-10 max-w-md text-[15px] leading-loose text-mist" data-reveal>
              阿寒调出了它的全息技能面板——每一条进度条，都是九年项目里磨出来的手感。
            </p>
            <div className="max-w-xl space-y-6">
              <SkillBar name="Vue / Uni-app / Element / AntD / Vant" value={95} tone="linear-gradient(90deg,#2b4a9c,#4d8bf2)" delay={0} />
              <SkillBar name="HTML / CSS / JavaScript" value={93} tone="linear-gradient(90deg,#b9822e,#ffc65c)" delay={70} />
              <SkillBar name="数据可视化 · ECharts / Three.js / D3" value={90} tone="linear-gradient(90deg,#2b4a9c,#4d8bf2)" delay={140} />
              <SkillBar name="工具库 · jQuery / Swiper / 百度地图 API" value={88} tone="linear-gradient(90deg,#a34a30,#ff7a59)" delay={210} />
              <SkillBar name="工程化 · Git / Webpack / CI-CD" value={85} tone="linear-gradient(90deg,#b9822e,#ffc65c)" delay={280} />
              <SkillBar name="后端与运维 · Node.js / Linux Shell" value={72} tone="linear-gradient(90deg,#a34a30,#ff7a59)" delay={350} />
            </div>
            <div className="mt-10 max-w-xl space-y-4" data-reveal>
              {[
                ["AI 编程辅助", ["Cursor", "Trae", "Augment"], "coral" as const],
                ["前端框架", ["Vue", "Uni-app", "Element", "AntDesign", "Vant", "Bootstrap", "Layui"], "azure" as const],
                ["开发工具 / 构建", ["Git", "Svn", "Webpack", "Rainbow", "Vite"], "amber" as const],
                ["后端 / CI / 运维", ["Node.js", "Express", "Jenkins", "Gitlab", "Nginx", "Linux Shell"], "azure" as const],
              ].map(([label, list, tone]) => (
                <div key={label as string} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-32 shrink-0 font-mono text-xs tracking-wider text-mist">{label as string}</span>
                  <div className="flex flex-wrap gap-2">
                    {(list as string[]).map((t) => <Chip key={t} tone={tone as "azure" | "amber" | "coral"}>{t}</Chip>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= 工作经历 ================= */}
        <section id="sec-timeline" className="relative px-5 py-28 md:px-10">
          <CharacterStage
            frames={framesOf("timeline")}
            side="left"
            widthClass="md:w-[38%]"
            frameClass="aspect-[4/5] w-32 sm:w-36 md:w-auto md:h-[68vh]"
            label="CAM 04 · 成长路径"
          />
          <div className="mx-auto max-w-7xl md:pl-[42%]">
            <SectionHead num="03" title="工作经历" en="CAREER PATH" />
            <div id="tl-list" className="relative max-w-2xl">
              <span className="absolute top-1 bottom-1 left-[7px] w-[2px] bg-line" />
              <span id="tl-line" className="absolute top-1 bottom-1 left-[7px] w-[2px] origin-top bg-azure" style={{ transform: "scaleY(0)" }} />
              <div className="space-y-12">
                {[
                  {
                    year: "2024.03 — 至今", co: "北京珂阳科技有限公司", role: "前端开发工程师", tone: "text-coral", border: "border-coral",
                    desc: [
                      "RCM 远程控制客户端研发：优化重构功能模块，封装通用业务组件",
                      "RPA 管理后台研发：配置驱动 CRUD、Pinia + RBAC 权限路由、SignalR 实时通信",
                    ],
                    tags: ["Vue3", "Pinia", "SignalR"],
                  },
                  {
                    year: "2021.12 — 2023.11", co: "北京创联教育投资有限公司", role: "前端开发工程师", tone: "text-amber", border: "border-amber",
                    desc: [
                      "负责平台 Web 前端开发，带领同事高质高效完成开发任务",
                      "参与公司 H5 页面开发，解决各类技术问题，并 review 成员代码",
                    ],
                    tags: ["Web", "H5", "Code Review"],
                  },
                  {
                    year: "2019.01 — 2021.10", co: "公安部第三研究所", role: "前端开发工程师", tone: "text-azure", border: "border-azure",
                    desc: [
                      "独立承担四川、上海、武汉等地烟草研判项目",
                      "开发拖拽自动化 ETL 数据清洗工具",
                      "使用 echarts 等组件库实现可视化大屏，linux 命令负责部分运维",
                    ],
                    tags: ["ECharts", "ETL", "Linux"],
                  },
                  {
                    year: "2017.08 — 2018.11", co: "上海锐英科技股份有限公司", role: "前端开发工程师", tone: "text-coral", border: "border-coral",
                    desc: [
                      "完成项目前端页面开发，与后台进行数据交互",
                      "使用百度地图 API 开发地图功能，熟悉 linux 命令行",
                    ],
                    tags: ["百度地图", "PS", "Linux"],
                  },
                ].map((job) => (
                  <article key={job.co} className="relative pl-10" data-reveal>
                    <span className={`absolute top-1 left-0 h-4 w-4 rotate-45 border-2 bg-panel ${job.border}`} />
                    <p className="font-mono text-xs tracking-[0.25em] text-mist">{job.year}</p>
                    <h3 className="mt-1.5 font-disp text-2xl text-snow">
                      {job.co} <span className={`ml-2 text-base ${job.tone}`}>{job.role}</span>
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-mist">
                      {job.desc.map((d) => (
                        <li key={d} className="flex gap-2.5">
                          <span className={`mt-[9px] h-1 w-1 shrink-0 rotate-45 ${job.border.replace("border-", "bg-")}`} />
                          {d}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3.5 flex gap-2">
                      {job.tags.map((t) => <Chip key={t}>{t}</Chip>)}
                    </div>
                  </article>
                ))}

                {/* 教育经历 */}
                <article className="relative pl-10" data-reveal>
                  <span className="absolute top-1 left-0 h-4 w-4 rotate-45 border-2 border-amber bg-panel" />
                  <p className="font-mono text-xs tracking-[0.25em] text-mist">2013 — 2017 · 教育经历</p>
                  <h3 className="mt-1.5 font-disp text-2xl text-snow">
                    淮北师范大学 <span className="ml-2 text-base text-amber">本科 · 计算机科学与技术</span>
                  </h3>
                  <div className="mt-3.5 flex gap-2">
                    <Chip tone="amber">CET-4 大学英语四级</Chip>
                    <Chip tone="amber">计算机专业</Chip>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 项目经历 ================= */}
        <section id="sec-projects" className="relative px-5 py-28 md:px-10">
          <CharacterStage
            frames={framesOf("projects")}
            side="right"
            widthClass="md:w-[33%]"
            frameClass="aspect-[9/16] w-32 sm:w-36 md:w-auto md:h-[72vh]"
            label="CAM 05 · 项目操控台"
          />
          <div className="mx-auto max-w-7xl md:pr-[38%]">
            <SectionHead num="04" title="项目经历" en="SELECTED PROJECTS" />
            <p className="mb-10 max-w-md text-[15px] leading-loose text-mist" data-reveal>
              阿寒拨动着全息方块——这七个，是最有代表性的。
            </p>
            <div className="grid max-w-2xl gap-6 sm:grid-cols-2">
              {[
                { kind: "rcm" as const, name: "RCM 客户端", date: "2024.04 — 至今", desc: "RCM 远程控制客户端。优化重构前端功能模块，封装通用业务组件，设计模块化配置方案实现功能解耦与动态化管理。", tags: ["Vue3", "组件封装"], metric: "复用性 ↑", tone: "border-coral/50 hover:border-coral", bg: "bg-[#2a1512]" },
                { kind: "rpa" as const, name: "RPA 数据管理平台", date: "2025.04 — 2025.08", desc: "管理 RPA 机器人、剧本流程、任务调度与日志监控。配置驱动 CRUD、RBAC 权限、SignalR + ECharts 实时可视化。", tags: ["Pinia", "SignalR", "ECharts"], metric: "开发效率 ↑", tone: "border-azure/50 hover:border-azure", bg: "bg-[#0e2419]" },
                { kind: "course" as const, name: "资源管理中心", date: "2023.01 — 2023.11", desc: "集团内部课程资源管理系统：钉钉扫码登录、课程 / 专题中心、数据大屏。vue3 开发 + echarts 大屏。", tags: ["Vue3", "钉钉", "ECharts"], metric: "简化选课流程", tone: "border-amber/50 hover:border-amber", bg: "bg-[#26200f]" },
                { kind: "shield" as const, name: "工伤预防教育平台", date: "2022.01 — 2022.12", desc: "在线教育系统后台：登录注册、订单 / 试题 / 课程 / 权限管理。CDN + 懒加载 + 代码拆分优化性能。", tags: ["Vue", "Element", "Vuex"], metric: "按钮级权限", tone: "border-coral/50 hover:border-coral", bg: "bg-[#2a1512]" },
                { kind: "net" as const, name: "上海海关智慧缉私平台", date: "2020.03 — 2021.01", desc: "上海海关 × 上海烟草联合指挥平台：多子系统 SSO 登录、vis.js 关系图谱、数据清洗，打通双方数据联系。", tags: ["SSO", "vis.js", "Element-UI"], metric: "联合办案 ↑", tone: "border-azure/50 hover:border-azure", bg: "bg-[#0e2419]" },
                { kind: "bars" as const, name: "涉烟研判平台", date: "2019.01 — 2020.12", desc: "上海 / 四川 / 武汉各地研判平台：echarts、antV、vis.js 大屏与图谱，组件封装，拖拽 ETL 清洗工具。", tags: ["ECharts", "AntV", "ETL"], metric: "多地汇报落地", tone: "border-amber/50 hover:border-amber", bg: "bg-[#26200f]" },
                { kind: "pie" as const, name: "上海烟草指挥平台", date: "2020.02 — 2020.05", desc: "可视化大屏页面，分级下钻查看年月日数据。echarts 二次封装，ajax 对接数据，参与布局配色建议。", tags: ["ECharts", "下钻"], metric: "指标一图总览", tone: "border-azure/50 hover:border-azure", bg: "bg-[#0e2419]" },
              ].map((p, i) => (
                <article
                  key={p.name}
                  data-reveal
                  className={`notch group border ${p.tone} bg-panel transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)]`}
                  style={{ transitionDelay: `${(i % 2) * 80}ms` }}
                >
                  <div className={`relative h-28 overflow-hidden border-b border-line ${p.bg}`}>
                    <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-2">
                      <Thumb kind={p.kind} />
                    </div>
                    <span className="absolute top-2.5 right-3 font-mono text-[10px] tracking-[0.25em] text-mist/70">0{i + 1}</span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-disp text-xl text-snow transition-colors duration-300 group-hover:text-amber">{p.name}</h3>
                      <span className="shrink-0 font-mono text-[10px] text-mist">{p.date}</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-mist">{p.desc}</p>
                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex gap-1.5">
                        {p.tags.map((t) => (
                          <span key={t} className="border border-line px-2 py-0.5 font-mono text-[10px] text-mist">{t}</span>
                        ))}
                      </div>
                      <span className="font-mono text-[11px] text-azure">{p.metric}</span>
                    </div>
                  </div>
                </article>
              ))}

              {/* 收尾 CTA 卡 */}
              <a
                href="mailto:1301644971@qq.com"
                data-reveal
                className="notch group flex min-h-[13rem] flex-col items-start justify-between border border-dashed border-line bg-transparent p-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-amber"
              >
                <span className="font-mono text-xs tracking-[0.3em] text-mist">MORE · 更多项目</span>
                <span className="font-disp text-2xl leading-snug text-snow transition-colors duration-300 group-hover:text-amber">
                  还有更多大屏与后台，<br />邮件里聊给你听 →
                </span>
                <span className="flex items-center gap-2 font-mono text-xs text-amber">
                  <svg className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  1301644971@qq.com
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* ================= 联系 ================= */}
        <section id="sec-contact" className="relative px-5 pt-28 pb-16 md:px-10">
          <CharacterStage
            frames={framesOf("contact")}
            side="right"
            widthClass="md:w-[38%]"
            frameClass="aspect-[9/10] w-32 sm:w-36 md:w-auto md:h-[62vh]"
            label="CAM 06 · 下一段旅程"
          />
          <div className="mx-auto max-w-7xl md:pr-[42%]">
            <SectionHead num="05" title="保持联系" en="GET IN TOUCH" />
            <div className="max-w-xl">
              <h3 className="font-disp text-[clamp(2.2rem,5vw,3.6rem)] leading-tight text-snow" data-reveal>
                一起把需求<br /><span className="brush text-amber">稳稳落地</span>？
              </h3>
              <p className="mt-5 text-[15px] leading-loose text-mist" data-reveal>
                无论是 Vue 全家桶业务系统、echarts 数据大屏，还是老项目的重构与性能优化，
                都欢迎来聊。阿寒背上行囊，正走向下一段旅程——期望城市：合肥，等你同行。
              </p>
              <div className="mt-8 flex flex-wrap gap-4" data-reveal>
                <a
                  href="mailto:1301644971@qq.com"
                  className="notch-sm group inline-flex items-center gap-3 bg-coral px-7 py-3.5 font-bold text-abyss transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber"
                >
                  <svg className="h-4 w-4" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="3.5" width="15" height="11" rx="1" stroke="currentColor" strokeWidth="1.8" /><path d="M2 4.5l7 5.5 7-5.5" stroke="currentColor" strokeWidth="1.8" /></svg>
                  1301644971@qq.com
                </a>
                <a
                  href="tel:18756179875"
                  className="notch-sm inline-flex items-center gap-3 border border-line px-7 py-3.5 font-bold text-snow transition-all duration-300 hover:-translate-y-0.5 hover:border-azure hover:text-azure"
                >
                  <svg className="h-4 w-4" viewBox="0 0 18 18" fill="none"><path d="M3 2.5h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a1.5 1.5 0 01-1.6 1.5C7.4 16.6 1.4 10.6 1 3.6A1.5 1.5 0 012.5 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                  187 5617 9875
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3" data-reveal>
                {[["GitHub", "https://github.com"], ["Gitee", "https://gitee.com"], ["掘金", "https://juejin.cn"]].map(([name, url]) => (
                  <a key={name} href={url} target="_blank" rel="noreferrer" className="group flex items-center gap-1.5 font-mono text-sm text-mist transition-colors hover:text-azure">
                    {name}
                    <svg className="h-3 w-3 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" viewBox="0 0 12 12" fill="none"><path d="M3 9l6-6M4 3h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================= 页脚 ================= */}
        <footer className="relative z-10 border-t border-line bg-abyss/70 px-5 py-8 md:px-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
            <p className="font-mono text-xs tracking-wider text-mist">
              © 2026 吴寒 · 用 <span className="text-azure">交互视频</span> × <span className="text-amber">GSAP</span> 手工打造 · 合肥
            </p>
            <div className="flex items-center gap-6">
              <p className="font-mono text-xs text-mist/70">移动鼠标试试——阿寒一直在看你</p>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="notch-sm group flex h-10 w-10 items-center justify-center border border-line text-mist transition-all duration-300 hover:-translate-y-1 hover:border-coral hover:text-coral"
                aria-label="回到顶部"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none"><path d="M8 14V3M3.5 7.5L8 3l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        </footer>
      </main>

      {/* 圆点导航激活样式 */}
      <style>{`
        [data-dot] .dot { background: transparent; }
        [data-dot].is-active .dot {
          background: #4d8bf2; border-color: #4d8bf2;
          transform: rotate(45deg) scale(1.35);
          box-shadow: 0 0 12px rgba(77,139,242,.7);
        }
      `}</style>
    </div>
  );
}
