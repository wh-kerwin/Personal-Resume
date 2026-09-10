import { useEffect, useRef } from "react";
import gsap from "gsap";
import bannerUrl from "../../video/banner.mp4?url";

/* ------------------------------------------------------------------ */
/*  视线映射表                                                          */
/*  通过对 video/banner.mp4 逐帧计算人物头部亮部质心得到（归一化 0~1）：   */
/*    t=0.0s~2.4s  faceX≈0.561  正视镜头                                */
/*    t≈2.9s       faceX≈0.533  头部偏向画面左侧（观众视角的左边）        */
/*    t≈4.2s       faceX≈0.553  正视镜头                                */
/*    t≈5.5s       faceX≈0.595  头部偏向画面右侧（观众视角的右边）        */
/*  纵向：t≈3.8s 时 faceY≈0.402（抬头），t≈5.0s 时 faceY≈0.431（低头）    */
/*  因此鼠标横向位置线性映射到 [T_LEFT, T_RIGHT] 时间轴（单调连续），      */
/*  纵向位置在时间轴上叠加小幅偏移 + 镜头俯仰变换，共同实现看向上/下方。   */
/* ------------------------------------------------------------------ */
const T_LEFT = 2.9;
const T_RIGHT = 5.5;
const T_SPAN = T_RIGHT - T_LEFT;
const T_CENTER = (T_LEFT + T_RIGHT) / 2;

/** 鼠标纵向对时间轴的偏移（秒）：鼠标在下 → 靠近低头帧，鼠标在上 → 靠近抬头帧 */
const Y_INFLUENCE = 0.42;
/** 鼠标静止多久之后，把镜头交还给视频自己播放（毫秒） */
const IDLE_MS = 2200;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function gazeName(x: number, y: number) {
  const h = x < -0.3 ? "左" : x > 0.3 ? "右" : "";
  const v = y < -0.3 ? "上" : y > 0.3 ? "下" : "";
  if (!h && !v) return "正视镜头";
  if (!v) return `看向${h}侧`;
  if (!h) return `看向正${v}方`;
  return `看向${h}${v}`;
}

/* ------------------------------------------------------------------ */
/*  组件：全屏视频 Banner，人物视线跟随鼠标                               */
/* ------------------------------------------------------------------ */
export default function GazeBanner({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const meterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    const reticle = reticleRef.current;
    const label = labelRef.current;
    const meter = meterRef.current;
    if (!wrap || !video) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let rect = wrap.getBoundingClientRect();
    let lg = window.innerWidth >= 1024;
    let tnx = 0; // 鼠标目标位置（归一化）
    let tny = 0;
    let nx = 0; // 平滑后的位置
    let ny = 0;
    let tm = T_CENTER; // 当前影片时间
    let auto = true; // true = 交给视频自然播放，false = 跟随鼠标擦洗
    let lastMove = 0;
    let visible = true;
    let text = "";

    const updateRect = () => {
      rect = wrap.getBoundingClientRect();
      lg = window.innerWidth >= 1024;
    };

    const onMove = (e: PointerEvent) => {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // 以首屏中心为原点归一化
      tnx = clamp((e.clientX - cx) / (rect.width * 0.62), -1, 1);
      tny = clamp((e.clientY - cy) / (rect.height * 0.62), -1, 1);
      lastMove = gsap.ticker.time * 1000; // 与 tick 同一时间基准

      if (!reduce && auto) {
        auto = false;
        video.pause();
        tm = video.currentTime || T_CENTER;
      }
      if (reticle) {
        reticle.style.left = `${clamp((e.clientX - rect.left) / rect.width, 0.05, 0.95) * 100}%`;
        reticle.style.top = `${clamp((e.clientY - rect.top) / rect.height, 0.12, 0.88) * 100}%`;
      }
    };

    /* 统一挂到 gsap.ticker：与页面其它 GSAP 动效共用一条时钟，切后台自动暂停 */
    const tick = (time: number, deltaMs: number) => {
      const now = time * 1000; // gsap.ticker 的 time 为启动以来的秒数
      const dt = Math.min(0.05, deltaMs / 1000);
      if (!visible) return;

      const k = 1 - Math.exp(-dt * 7);
      nx += (tnx - nx) * k;
      ny += (tny - ny) * k;

      if (!reduce) {
        // 全屏镜头的“模拟视线”：
        //  - 鼠标在下(ny>0)：rotateX 正角让镜头后仰 + 画面上移 → 人物呈现低头看向下方
        //  - 鼠标在上(ny<0)：镜头前倾 + 画面下移 → 抬头看向上方
        //  - 水平方向轻微反向平移 + 转头，放大时间轴擦洗带来的转头效果
        const baseTx = lg ? 12 : 0; // 桌面端把人物推到画面右侧，给文案让位
        const scale = lg ? 1.16 : 1.12;
        video.style.transform =
          `perspective(1200px) ` +
          `translate3d(${(baseTx - nx * 1.2).toFixed(2)}%, ${(-ny * 3).toFixed(2)}%, 0) ` +
          `rotateY(${(-nx * 2.2).toFixed(2)}deg) rotateX(${(ny * 4.2).toFixed(2)}deg) ` +
          `scale(${scale})`;
      }

      if (!reduce) {
        if (auto) {
          tm = video.currentTime;
        } else {
          const want = clamp(T_LEFT + ((nx + 1) / 2) * T_SPAN + ny * Y_INFLUENCE, 0.2, 7.05);
          tm += (want - tm) * (1 - Math.exp(-dt * 5.5));
          if (video.readyState >= 2 && Math.abs(video.currentTime - tm) > 1 / 50) {
            video.currentTime = tm;
          }
          // 鼠标停下来一会儿，就让他继续自然地呼吸、眨眼
          if (now - lastMove > IDLE_MS) {
            auto = true;
            void video.play().catch(() => {});
          }
        }
      }

      if (reticle) reticle.style.opacity = auto ? "0.3" : "1";
      if (meter) meter.style.left = `${(50 + nx * 50).toFixed(2)}%`;

      const next = auto ? "自由状态" : gazeName(nx, ny);
      if (label && next !== text) {
        text = next;
        label.textContent = next;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        updateRect();
        if (visible) {
          if (auto) void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.05 }
    );
    io.observe(wrap);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", updateRect, { passive: true });
    window.addEventListener("resize", updateRect);
    gsap.ticker.add(tick);
    void video.play().catch(() => {});

    return () => {
      gsap.ticker.remove(tick);
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", updateRect);
      window.removeEventListener("resize", updateRect);
      video.pause();
    };
  }, []);

  return (
    <div ref={wrapRef} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={bannerUrl}
        className="absolute inset-0 h-full w-full object-cover will-change-transform"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          if (!e.currentTarget.currentTime) e.currentTarget.currentTime = T_CENTER;
        }}
      />

      {/* 文字可读性渐变：移动端上下压暗，桌面端左侧压暗 */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,12,26,0.82)_0%,rgba(6,12,26,0.3)_24%,transparent_44%,rgba(6,12,26,0.24)_68%,rgba(6,12,26,0.9)_100%)]" />
      <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(6,12,26,0.94)_0%,rgba(6,12,26,0.68)_28%,rgba(6,12,26,0.14)_54%,transparent_72%)] lg:block" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_95%_at_62%_38%,transparent_48%,rgba(6,12,26,0.5)_100%)]" />

      {/* 网格 */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(93,146,242,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(93,146,242,0.08) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* 四角 HUD 框 */}
      {[
        "top-4 left-4 border-t-2 border-l-2",
        "top-4 right-4 border-t-2 border-r-2",
        "bottom-4 left-4 border-b-2 border-l-2",
        "bottom-4 right-4 border-b-2 border-r-2",
      ].map((c) => (
        <span key={c} className={`absolute h-5 w-5 border-azure/60 ${c}`} />
      ))}

      {/* 顶部右侧 LIVE 标识（避开导航） */}
      <div className="absolute right-5 top-[5.5rem] hidden items-center gap-2 font-mono text-[10px] tracking-[0.28em] text-azure md:right-10 md:flex">
        <i className="dot-live inline-block h-1.5 w-1.5 rounded-full bg-azure" />
        LIVE · 阿寒 CAM 01 · GAZE TRACKING
      </div>

      {/* 视线准星：跟着鼠标走 */}
      <div
        ref={reticleRef}
        className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-500"
      >
        <svg viewBox="0 0 56 56" className="h-full w-full text-amber">
          <circle cx="28" cy="28" r="15" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.85" />
          <circle cx="28" cy="28" r="2" fill="currentColor" />
          <path d="M28 2v10M28 44v10M2 28h10M44 28h10" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
          <path d="M13 13l-5-5M43 13l5-5M13 43l-5 5M43 43l5 5" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
        </svg>
      </div>

      {/* 右下角视线信息 */}
      <div className="absolute bottom-16 right-5 w-48 md:bottom-8 md:right-10 md:w-52">
        <p className="font-mono text-[10px] tracking-[0.28em] text-mist/70">视线方向</p>
        <p className="mt-1 font-disp text-lg leading-none text-snow">
          <span ref={labelRef} className="text-amber">正视镜头</span>
        </p>
        {/* 横向视线刻度 */}
        <div className="relative mt-3 h-[3px] w-full bg-line/70">
          <span className="absolute left-1/2 top-1/2 h-3 w-[1px] -translate-x-1/2 -translate-y-1/2 bg-mist/40" />
          <span
            ref={meterRef}
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-amber"
            style={{ left: "50%" }}
          />
        </div>
        <p className="mt-2 text-right font-mono text-[10px] tracking-[0.22em] text-mist/60">
          移动鼠标 · 他会看向你
        </p>
      </div>
    </div>
  );
}
