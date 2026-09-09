import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import gsap from "gsap";

export type SectionKey =
  | "hero"
  | "about"
  | "skills"
  | "timeline"
  | "projects"
  | "contact";

export interface StageHandle {
  goTo(key: SectionKey, immediate?: boolean): void;
  /** 显示 / 隐藏 3D 人物（首屏由视频 Banner 出演时让位） */
  setAvatarVisible(v: boolean, immediate?: boolean): void;
  destroy(): void;
}

/* ------------------------------------------------------------------ */
/*  调色板 —— 参考图：蓬发 + 黑框眼镜 + 灰色连帽衫的程序员              */
/* ------------------------------------------------------------------ */
const C = {
  skin: 0xf3c39c,
  skinDark: 0xe3ab80,
  hair: 0x2a1d16,
  hoodie: 0x4d5461,
  hoodieLight: 0x5b6270,
  pants: 0x2b303a,
  shoe: 0x191c22,
  frame: 0x14161a,
  white: 0xf7f8f9,
  pupil: 0x2a1c14,
  chair: 0x171a1f,
  chairSoft: 0x22262d,
  coral: 0xff7a59,
  amber: 0xffc65c,
  azure: 0x4d8bf2, // 主题蓝（取自 banner.mp4 轮廓光）
  ink: 0x0a1122,
};

type V3 = [number, number, number];

interface PoseDef {
  shL: V3; elL: V3; shR: V3; elR: V3;
  tilt: number; lean: number;
  mode: "idle" | "wave" | "think" | "type" | "cheer" | "bow";
  holo: boolean; kb: boolean; happy: boolean;
}

const RELAX: V3[] = [
  [0.08, 0, 0.18],
  [-0.2, 0, 0],
];

const POSES: Record<SectionKey, PoseDef> = {
  hero: {
    shL: RELAX[0], elL: RELAX[1],
    shR: [0.08, 0, -0.18], elR: [-0.2, 0, 0],
    tilt: 0, lean: 0, mode: "idle", holo: false, kb: false, happy: false,
  },
  about: {
    shL: RELAX[0], elL: RELAX[1],
    shR: [-0.25, 0, -2.35], elR: [0, 0, 0.4],
    tilt: -0.08, lean: 0, mode: "wave", holo: false, kb: false, happy: true,
  },
  skills: {
    shL: [-1.35, 0, 0.5], elL: [-1.55, 0, 0],
    shR: [-0.95, -0.15, -0.35], elR: [-0.7, 0, 0],
    tilt: 0.13, lean: 0.04, mode: "think", holo: true, kb: false, happy: false,
  },
  timeline: {
    shL: [-0.78, 0, 0.26], elL: [-0.62, 0, 0],
    shR: [-0.78, 0, -0.26], elR: [-0.62, 0, 0],
    tilt: 0, lean: 0.12, mode: "type", holo: false, kb: true, happy: false,
  },
  projects: {
    shL: [-0.15, 0, 2.5], elL: [0.25, 0, 0],
    shR: [-0.15, 0, -2.5], elR: [0.25, 0, 0],
    tilt: 0, lean: -0.04, mode: "cheer", holo: false, kb: false, happy: true,
  },
  contact: {
    shL: [0.1, 0, 0.3], elL: [-0.3, 0, 0],
    shR: [-0.3, 0, -1.9], elR: [0, 0, 0.3],
    tilt: 0, lean: 0, mode: "bow", holo: false, kb: false, happy: true,
  },
};

/* ------------------------------------------------------------------ */
/*  小工具                                                             */
/* ------------------------------------------------------------------ */
function softSprite(hex: number): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const c = new THREE.Color(hex);
  grad.addColorStop(0, `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},1)`);
  grad.addColorStop(0.4, `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.5)`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

function keyboardTexture(): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 96;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#1c2026";
  g.fillRect(0, 0, 256, 96);
  for (let r = 0; r < 4; r++) {
    for (let cI = 0; cI < 12; cI++) {
      g.fillStyle = (r + cI) % 7 === 0 ? "#41b883" : "#31363f";
      g.fillRect(8 + cI * 20, 8 + r * 22, 16, 17);
    }
  }
  g.fillStyle = "#31363f";
  g.fillRect(78, 82, 100, 10);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

function std(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.06, ...opts });
}

/* ------------------------------------------------------------------ */
/*  主函数                                                             */
/* ------------------------------------------------------------------ */
export function createStage(canvas: HTMLCanvasElement): StageHandle {
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  /* ---------- 渲染器 / 场景 / 相机 ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C.ink, 0.03);

  const FOV = 40;
  const CAM_DIST = 7.3;
  const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(0, 1.78, CAM_DIST);

  /* ---------- 灯光 ---------- */
  scene.add(new THREE.HemisphereLight(0x9ec2e8, 0x16202e, 1.0));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.35);
  key.position.set(4.5, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -2;
  key.shadow.camera.far = 24;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const rim = new THREE.PointLight(C.azure, 14, 26);
  rim.position.set(-4.5, 3.2, -2.5);
  scene.add(rim);
  const warm = new THREE.PointLight(C.amber, 8, 22);
  warm.position.set(3.5, 1.4, 3.2);
  scene.add(warm);

  /* ---------- 地面阴影 ---------- */
  const ground = new THREE.Mesh(
    track(new THREE.PlaneGeometry(50, 50)),
    track(new THREE.ShadowMaterial({ opacity: 0.3 }))
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.001;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---------- 漂浮粒子 ---------- */
  const P_COUNT = 150;
  const pGeo = track(new THREE.BufferGeometry());
  const pPos = new Float32Array(P_COUNT * 3);
  const pCol = new Float32Array(P_COUNT * 3);
  const pSpeed = new Float32Array(P_COUNT);
  const pPhase = new Float32Array(P_COUNT);
  const palette = [new THREE.Color(C.azure), new THREE.Color(C.amber), new THREE.Color(C.coral), new THREE.Color(0xd8e6ff)];
  for (let i = 0; i < P_COUNT; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 15;
    pPos[i * 3 + 1] = Math.random() * 7.5;
    pPos[i * 3 + 2] = -4 + Math.random() * 6;
    const c = palette[(Math.random() * palette.length) | 0];
    pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    pSpeed[i] = 0.12 + Math.random() * 0.35;
    pPhase[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const pMat = track(
    new THREE.PointsMaterial({
      size: 0.075,
      map: track(softSprite(0xffffff)),
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  /* ================================================================ */
  /*  角色：阿寒（程序员分身）                                           */
  /* ================================================================ */
  const rig = new THREE.Group();
  const avatar = new THREE.Group(); // 人物整体（含光晕），可整体隐藏让位给视频 Banner
  const entranceG = new THREE.Group();
  const inner = new THREE.Group();
  rig.add(avatar);
  avatar.add(entranceG);
  entranceG.add(inner);
  scene.add(rig);

  const matSkin = track(std(C.skin, { roughness: 0.62 }));
  const matSkinD = track(std(C.skinDark, { roughness: 0.7 }));
  const matHair = track(std(C.hair, { roughness: 0.85 }));
  const matHoodie = track(std(C.hoodie, { roughness: 0.8 }));
  const matHoodieL = track(std(C.hoodieLight, { roughness: 0.8 }));
  const matPants = track(std(C.pants, { roughness: 0.85 }));
  const matShoe = track(std(C.shoe, { roughness: 0.6 }));
  const matFrame = track(std(C.frame, { roughness: 0.35, metalness: 0.3 }));
  const matChair = track(std(C.chair, { roughness: 0.7, metalness: 0.2 }));
  const matChairSoft = track(std(C.chairSoft, { roughness: 0.9 }));

  function mesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    parent: THREE.Object3D,
    x = 0, y = 0, z = 0
  ) {
    const m = new THREE.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /* ---------- 悬浮光晕 ---------- */
  const glow = new THREE.Sprite(
    track(new THREE.SpriteMaterial({
      map: track(softSprite(C.azure)),
      transparent: true, opacity: 0.38, depthWrite: false,
    }))
  );
  glow.scale.set(6.5, 6.5, 1);
  glow.position.set(0, 1.5, -1.6);
  avatar.add(glow);
  const underGlow = new THREE.Sprite(
    track(new THREE.SpriteMaterial({
      map: track(softSprite(C.azure)),
      transparent: true, opacity: 0.3, depthWrite: false,
    }))
  );
  underGlow.scale.set(2.6, 1.1, 1);
  underGlow.position.set(0, 0.12, 0);
  avatar.add(underGlow);

  /* ---------- 人体工学椅（悬浮） ---------- */
  const chair = new THREE.Group();
  inner.add(chair);
  mesh(new RoundedBoxGeometry(0.66, 0.1, 0.62, 3, 0.04), matChairSoft, chair, 0, 0.9, 0.02); // 坐垫
  const back = mesh(new RoundedBoxGeometry(0.6, 0.82, 0.09, 3, 0.04), matChairSoft, chair, 0, 1.36, -0.34);
  back.rotation.x = -0.14;
  mesh(new RoundedBoxGeometry(0.5, 0.2, 0.07, 2, 0.03), matChair, chair, 0, 1.82, -0.4); // 头枕
  mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 12), matChair, chair, 0, 0.58, -0.05); // 气压杆
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = mesh(new THREE.BoxGeometry(0.09, 0.05, 0.5), matChair, chair, Math.sin(a) * 0.26, 0.14, Math.cos(a) * 0.26 - 0.05);
    arm.rotation.y = a;
    mesh(new THREE.SphereGeometry(0.06, 10, 8), matChair, chair, Math.sin(a) * 0.5, 0.07, Math.cos(a) * 0.5 - 0.05);
  }
  // 扶手
  for (const side of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 8), matChair, chair, 0.4 * side, 1.06, -0.08);
    mesh(new RoundedBoxGeometry(0.08, 0.04, 0.3, 2, 0.02), matChair, chair, 0.4 * side, 1.2, -0.02);
  }

  /* ---------- 腿（坐姿） ---------- */
  for (const side of [-1, 1]) {
    const hipX = 0.17 * side;
    const thigh = mesh(new THREE.CapsuleGeometry(0.13, 0.3, 6, 12), matPants, inner, hipX, 0.97, 0.2);
    thigh.rotation.x = Math.PI / 2;
    mesh(new THREE.CapsuleGeometry(0.11, 0.34, 6, 12), matPants, inner, hipX, 0.74, 0.38); // 小腿
    const foot = mesh(new RoundedBoxGeometry(0.22, 0.13, 0.36, 3, 0.05), matShoe, inner, hipX, 0.5, 0.46);
    foot.rotation.x = 0.06;
  }

  /* ---------- 身体（连帽衫） ---------- */
  const torso = new THREE.Group();
  torso.position.y = 1.38;
  inner.add(torso);
  mesh(new RoundedBoxGeometry(0.86, 0.82, 0.56, 4, 0.22), matHoodie, torso, 0, 0, 0);
  // 帽子（垂在背后）
  const hood = mesh(new THREE.SphereGeometry(0.3, 18, 14, 0, Math.PI * 2, 0, Math.PI / 1.7), matHoodieL, torso, 0, 0.3, -0.26);
  hood.rotation.x = -0.9;
  hood.scale.set(1.15, 1, 0.9);
  // 前口袋
  mesh(new RoundedBoxGeometry(0.44, 0.24, 0.06, 3, 0.06), matHoodieL, torso, 0, -0.22, 0.27);
  // 抽绳
  for (const side of [-1, 1]) {
    const s = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6),
      track(std(0xe8e4da, { roughness: 0.6 })), torso, 0.09 * side, 0.24, 0.3);
    s.rotation.z = 0.08 * side;
  }

  /* ---------- 手臂（帽衫袖 + 手） ---------- */
  function buildArm(side: 1 | -1) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.48 * side, 1.66, 0);
    inner.add(shoulder);
    mesh(new THREE.SphereGeometry(0.14, 16, 12), matHoodie, shoulder, 0, 0, 0);
    mesh(new THREE.CapsuleGeometry(0.11, 0.3, 6, 12), matHoodie, shoulder, 0, -0.26, 0);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.48, 0);
    shoulder.add(elbow);
    mesh(new THREE.CapsuleGeometry(0.1, 0.22, 6, 12), matHoodie, elbow, 0, -0.18, 0);
    // 袖口
    mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.07, 12), matHoodieL, elbow, 0, -0.33, 0);
    // 手
    mesh(new THREE.SphereGeometry(0.12, 16, 12), matSkin, elbow, 0, -0.42, 0);
    return { shoulder, elbow };
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  /* ---------- 脖子 & 头 ---------- */
  mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.14, 14), matSkinD, inner, 0, 1.82, 0);

  const headG = new THREE.Group();
  headG.position.y = 1.94;
  inner.add(headG);

  const skull = mesh(new THREE.SphereGeometry(0.46, 28, 22), matSkin, headG, 0, 0.04, 0);
  skull.scale.set(1, 1.06, 0.98);
  // 耳朵
  for (const side of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.08, 12, 10), matSkinD, headG, 0.44 * side, 0, 0);
  }
  // 鼻子
  mesh(new THREE.SphereGeometry(0.05, 12, 10), matSkinD, headG, 0, -0.06, 0.44);

  /* --- 头发：底盖 + 乱翘发束 --- */
  const hairBase = mesh(new THREE.SphereGeometry(0.48, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.6), matHair, headG, 0, 0.08, -0.03);
  hairBase.scale.set(1.04, 1.05, 1.06);
  const hairTuft = new THREE.Group();
  headG.add(hairTuft);
  const tufts: [number, number, number, number, number, number][] = [
    // x, y, z, rotX, rotZ, scale
    [0, 0.5, 0.12, -0.5, 0.1, 1.15],
    [-0.18, 0.48, 0.18, -0.55, 0.5, 0.9],
    [0.2, 0.5, 0.1, -0.4, -0.45, 1.0],
    [-0.3, 0.42, -0.02, -0.1, 0.9, 0.85],
    [0.32, 0.42, -0.05, -0.1, -0.85, 0.9],
    [0.05, 0.52, -0.15, 0.4, -0.15, 1.05],
    [-0.12, 0.5, -0.2, 0.5, 0.35, 0.9],
    [0.15, 0.46, 0.28, -0.8, -0.2, 0.8], // 前刘海
    [-0.16, 0.44, 0.3, -0.85, 0.25, 0.75],
    [0, 0.42, 0.34, -0.95, 0, 0.7],
  ];
  tufts.forEach(([x, y, z, rx, rz, s]) => {
    const cone = mesh(new THREE.ConeGeometry(0.12 * s, 0.34 * s, 7), matHair, hairTuft, x, y, z);
    cone.rotation.x = rx;
    cone.rotation.z = rz;
  });
  // 两侧鬓角
  for (const side of [-1, 1]) {
    const side_h = mesh(new THREE.SphereGeometry(0.14, 10, 8), matHair, headG, 0.4 * side, 0.14, 0.14);
    side_h.scale.set(0.5, 1.1, 0.8);
  }

  /* --- 眉毛 --- */
  for (const side of [-1, 1]) {
    const brow = mesh(new THREE.BoxGeometry(0.16, 0.035, 0.04), matHair, headG, 0.2 * side, 0.22, 0.42);
    brow.rotation.z = -0.12 * side;
    brow.castShadow = false;
  }

  /* --- 眼睛（眼白 + 瞳孔，可追踪） --- */
  function buildEye(x: number) {
    const g = new THREE.Group();
    g.position.set(x, 0.08, 0.4);
    headG.add(g);
    const white = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.088, 18, 14)),
      track(new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.25 }))
    );
    white.scale.set(1, 1.12, 0.6);
    white.castShadow = false;
    g.add(white);
    const pupil = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.042, 14, 10)),
      track(new THREE.MeshBasicMaterial({ color: C.pupil, toneMapped: false }))
    );
    pupil.position.set(0, 0, 0.055);
    pupil.castShadow = false;
    g.add(pupil);
    const glint = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.014, 8, 6)),
      track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }))
    );
    glint.position.set(0.018, 0.02, 0.088);
    glint.castShadow = false;
    g.add(glint);
    return g;
  }
  const eyeL = buildEye(-0.2);
  const eyeR = buildEye(0.2);

  /* --- 黑框圆眼镜 --- */
  for (const side of [-1, 1]) {
    const ring = mesh(new THREE.TorusGeometry(0.135, 0.02, 10, 28), matFrame, headG, 0.2 * side, 0.08, 0.42);
    ring.castShadow = false;
    // 镜腿
    const temple = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), matFrame, headG, 0.34 * side, 0.1, 0.2);
    temple.rotation.x = Math.PI / 2;
    temple.castShadow = false;
  }
  const bridge = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6), matFrame, headG, 0, 0.1, 0.44);
  bridge.rotation.z = Math.PI / 2;
  bridge.castShadow = false;

  /* --- 嘴巴：平静 / 微笑 --- */
  const mouthLine = mesh(
    new RoundedBoxGeometry(0.16, 0.03, 0.03, 2, 0.012),
    track(new THREE.MeshBasicMaterial({ color: 0x8a5a44, toneMapped: false })),
    headG, 0, -0.2, 0.42);
  mouthLine.castShadow = false;
  const mouthHappy = mesh(
    new THREE.TorusGeometry(0.1, 0.026, 10, 22, Math.PI),
    track(new THREE.MeshBasicMaterial({ color: 0x8a5a44, toneMapped: false })),
    headG, 0, -0.16, 0.42);
  mouthHappy.rotation.z = Math.PI;
  mouthHappy.visible = false;
  mouthHappy.castShadow = false;

  // 腮红
  for (const side of [-1, 1]) {
    const blush = mesh(
      new THREE.CircleGeometry(0.06, 18),
      track(new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: 0.4, toneMapped: false })),
      headG, 0.33 * side, -0.1, 0.38);
    blush.rotation.y = 0.5 * side;
    blush.castShadow = false;
  }

  /* ---------- 全息屏（技能区道具） ---------- */
  const holo = new THREE.Group();
  holo.position.set(-1.42, 1.78, 0.42);
  holo.rotation.y = 0.42;
  holo.scale.setScalar(0.001);
  inner.add(holo);
  let holoBars: THREE.Mesh[] = [];
  {
    const frame = track(new THREE.MeshBasicMaterial({ color: C.azure, transparent: true, opacity: 0.9, toneMapped: false }));
    const panel = track(new THREE.MeshBasicMaterial({ color: C.azure, transparent: true, opacity: 0.07, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    const W = 1.24, H = 0.88, T = 0.022;
    const pm = new THREE.Mesh(track(new THREE.PlaneGeometry(W, H)), panel);
    holo.add(pm);
    const mk = (w: number, h: number, x: number, y: number, m: THREE.Material) => {
      const b = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), m);
      b.position.set(x, y, 0.005);
      holo.add(b);
      return b;
    };
    mk(W, T, 0, H / 2, frame); mk(W, T, 0, -H / 2, frame);
    mk(T, H, -W / 2, 0, frame); mk(T, H, W / 2, 0, frame);
    mk(W - 0.14, 0.07, 0, H / 2 - 0.11, frame);
    const barMat = track(new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0.9, toneMapped: false }));
    const barMat2 = track(new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: 0.9, toneMapped: false }));
    for (let i = 0; i < 3; i++) {
      const b = mk(0.64, 0.085, -0.24, 0.16 - i * 0.21, i === 1 ? barMat2 : barMat);
      b.geometry.translate(0.32, 0, 0);
      holoBars.push(b);
    }
  }

  /* ---------- 悬浮机械键盘（经历区道具） ---------- */
  const kb = new THREE.Group();
  kb.position.set(0, 1.02, 0.72);
  kb.rotation.x = -0.18;
  kb.scale.setScalar(0.001);
  inner.add(kb);
  const kbLight = new THREE.PointLight(C.azure, 0, 3);
  kbLight.position.set(0, 0.2, 0.2);
  kb.add(kbLight);
  {
    const base = mesh(new RoundedBoxGeometry(0.96, 0.06, 0.4, 3, 0.02), matChair, kb, 0, 0, 0);
    base.castShadow = false;
    const top = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.9, 0.34)),
      track(new THREE.MeshBasicMaterial({ map: track(keyboardTexture()), toneMapped: false }))
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.035;
    kb.add(top);
  }

  /* ================================================================ */
  /*  布局 & 姿态状态                                                   */
  /* ================================================================ */
  let currentKey: SectionKey = "hero";
  let mobile = false;
  const timers: number[] = [];

  function metrics() {
    const hh = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAM_DIST;
    const hw = hh * camera.aspect;
    return { hh, hw };
  }

  function layoutFor(k: SectionKey) {
    const { hw } = metrics();
    const m = mobile;
    const s = m ? 0.66 : 1;
    const table: Record<SectionKey, { x: number; ry: number; s: number }> = {
      hero:     { x: m ? hw * 0.34 : hw * 0.5,   ry: m ? -0.1 : -0.4,  s: m ? 0.66 : 1 },
      about:    { x: m ? -hw * 0.4 : -hw * 0.5,  ry: m ? 0.15 : 0.45,  s },
      skills:   { x: m ? hw * 0.4 : hw * 0.52,   ry: m ? -0.1 : -0.32, s },
      timeline: { x: m ? -hw * 0.4 : -hw * 0.5,  ry: m ? 0.1 : 0.32,   s },
      projects: { x: m ? hw * 0.38 : hw * 0.5,   ry: m ? -0.12 : -0.45, s: m ? 0.7 : 1.03 },
      contact:  { x: m ? 0 : hw * 0.34,          ry: m ? 0 : -0.18,    s: m ? 0.62 : 1.05 },
    };
    const t = table[k];
    return { x: t.x, ry: t.ry, s: t.s };
  }

  const pose = POSES.hero;
  const cur = {
    shL: [...pose.shL] as V3, elL: [...pose.elL] as V3,
    shR: [...pose.shR] as V3, elR: [...pose.elR] as V3,
    tilt: 0, lean: 0,
  };
  let mode: PoseDef["mode"] = "idle";
  let poseAmp = 1;
  let greeting = false;
  let holoOn = false;
  let kbOn = false;

  function setPose(def: PoseDef) {
    mode = def.mode;
    poseAmp = 0;
    const targets = { shL: def.shL, elL: def.elL, shR: def.shR, elR: def.elR };
    (Object.keys(targets) as (keyof typeof targets)[]).forEach((k) => {
      gsap.to(cur[k], { 0: targets[k][0], 1: targets[k][1], 2: targets[k][2], duration: 0.9, ease: "power3.out" });
    });
    gsap.to(cur, { tilt: def.tilt, lean: def.lean, duration: 0.9, ease: "power3.out" });

    if (def.holo !== holoOn) {
      holoOn = def.holo;
      gsap.to(holo.scale, {
        x: holoOn ? 1 : 0.001, y: holoOn ? 1 : 0.001, z: holoOn ? 1 : 0.001,
        duration: 0.55, ease: holoOn ? "back.out(1.8)" : "power2.in",
      });
    }
    if (def.kb !== kbOn) {
      kbOn = def.kb;
      gsap.to(kb.scale, {
        x: kbOn ? 1 : 0.001, y: kbOn ? 1 : 0.001, z: kbOn ? 1 : 0.001,
        duration: 0.5, ease: kbOn ? "back.out(1.6)" : "power2.in",
      });
      gsap.to(kbLight, { intensity: kbOn ? 4 : 0, duration: 0.6 });
    }
    mouthHappy.visible = def.happy;
    mouthLine.visible = !def.happy;
  }

  function goTo(k: SectionKey, immediate = false) {
    currentKey = k;
    const L = layoutFor(k);
    if (immediate) {
      rig.position.set(L.x, 0, 0);
      rig.rotation.y = L.ry;
      rig.scale.setScalar(L.s);
    } else {
      gsap.to(rig.position, { x: L.x, y: 0, z: 0, duration: 1.15, ease: "power3.inOut" });
      gsap.to(rig.rotation, { y: L.ry, duration: 1.15, ease: "power3.inOut" });
      gsap.to(rig.scale, { x: L.s, y: L.s, z: L.s, duration: 1.15, ease: "power3.inOut" });
    }
    setPose(POSES[k]);
  }

  /* ---------- 人物让位给视频 Banner ---------- */
  let avatarVisible = true;
  function setAvatarVisible(v: boolean, immediate = false) {
    if (avatarVisible === v) return;
    avatarVisible = v;
    gsap.killTweensOf(avatar.scale);
    if (immediate) {
      avatar.visible = v;
      avatar.scale.setScalar(v ? 1 : 0.001);
      return;
    }
    if (v) {
      avatar.visible = true;
      gsap.to(avatar.scale, { x: 1, y: 1, z: 1, duration: 0.55, ease: "back.out(1.6)" });
    } else {
      gsap.to(avatar.scale, {
        x: 0.001, y: 0.001, z: 0.001, duration: 0.35, ease: "power2.in",
        onComplete: () => { avatar.visible = false; },
      });
    }
  }

  /* ---------- 入场 ---------- */
  {
    mobile = window.innerWidth < 860;
    const L = layoutFor("hero");
    rig.position.set(L.x, 0, 0);
    rig.rotation.y = L.ry;
    rig.scale.setScalar(L.s);
    gsap.fromTo(entranceG.position, { y: 3.4 }, { y: 0, duration: 1.15, ease: "bounce.out", delay: 0.25 });
    gsap.fromTo(entranceG.scale, { x: 0.7, y: 0.35, z: 0.7 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: "back.out(2)", delay: 0.25 });
    const gt = window.setTimeout(() => {
      greeting = true;
      window.setTimeout(() => (greeting = false), 1700);
    }, 1500);
    timers.push(gt);
  }

  /* ================================================================ */
  /*  交互：鼠标视线追踪                                                 */
  /* ================================================================ */
  let mouseNX = 0, mouseNY = 0;
  let trackYaw = 0, trackPitch = 0;
  const onPointer = (e: PointerEvent) => {
    mouseNX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNY = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointer);

  /* ---------- 自适应 ---------- */
  const onResize = () => {
    const wasMobile = mobile;
    mobile = window.innerWidth < 860;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (wasMobile !== mobile) goTo(currentKey, true);
  };
  window.addEventListener("resize", onResize);

  /* ================================================================ */
  /*  动画循环                                                          */
  /* ================================================================ */
  const clock = new THREE.Clock();
  let blinkNext = 2.2;
  let blinkT = -1;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    poseAmp = THREE.MathUtils.lerp(poseAmp, 1, 1 - Math.exp(-dt * 3));
    const amp = poseAmp;

    /* --- 视线追踪 --- */
    trackYaw = THREE.MathUtils.lerp(trackYaw, THREE.MathUtils.clamp(mouseNX * 0.62, -0.62, 0.62), 1 - Math.exp(-dt * 6));
    trackPitch = THREE.MathUtils.lerp(trackPitch, THREE.MathUtils.clamp(-mouseNY * 0.34, -0.34, 0.34), 1 - Math.exp(-dt * 6));
    headG.rotation.y = trackYaw;
    headG.rotation.x = trackPitch + Math.sin(t * 1.4) * 0.02;
    headG.rotation.z = cur.tilt * amp + Math.sin(t * 1.1) * 0.015;

    const ex = THREE.MathUtils.clamp(mouseNX * 0.03, -0.03, 0.03);
    const ey = THREE.MathUtils.clamp(-mouseNY * 0.022, -0.022, 0.022);
    eyeL.position.x = -0.2 + ex; eyeL.position.y = 0.08 + ey;
    eyeR.position.x = 0.2 + ex; eyeR.position.y = 0.08 + ey;

    /* --- 眨眼 --- */
    if (blinkT < 0 && t > blinkNext) blinkT = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const s = blinkT < 0.07 ? 1 - blinkT / 0.07 : Math.min(1, (blinkT - 0.07) / 0.09);
      eyeL.scale.y = Math.max(0.08, s);
      eyeR.scale.y = Math.max(0.08, s);
      if (blinkT > 0.16) { blinkT = -1; blinkNext = t + 2 + Math.random() * 2.4; }
    }

    /* --- 姿态振荡器 --- */
    const osc = {
      shL: [0, 0, 0] as V3, elL: [0, 0, 0] as V3,
      shR: [0, 0, 0] as V3, elR: [0, 0, 0] as V3,
    };
    let bounce = 0;
    let bowAmt = 0;
    const waving = mode === "wave" || greeting;
    if (waving) {
      osc.shR[0] = -0.2;
      osc.shR[2] = Math.sin(t * 9) * 0.32 * amp;
      osc.elR[2] = 0.4 + Math.sin(t * 9 + 0.9) * 0.45 * amp;
    }
    if (mode === "idle") {
      osc.shL[2] = Math.sin(t * 2) * 0.06 * amp;
      osc.shR[2] = -Math.sin(t * 2 + 0.6) * 0.06 * amp;
    }
    if (mode === "think") {
      osc.elL[0] = Math.sin(t * 2.4) * 0.05 * amp;
      headG.rotation.x += Math.sin(t * 2) * 0.035 * amp;
    }
    if (mode === "type") {
      osc.elL[0] = Math.sin(t * 11) * 0.17 * amp;
      osc.elR[0] = Math.sin(t * 11 + Math.PI) * 0.17 * amp;
    }
    if (mode === "cheer") {
      osc.shL[2] = Math.sin(t * 6) * 0.22 * amp;
      osc.shR[2] = -Math.sin(t * 6 + 0.4) * 0.22 * amp;
      bounce = Math.abs(Math.sin(t * 5.2)) * 0.16 * amp;
    }
    if (mode === "bow") {
      const p = (t % 3.6) / 3.6;
      bowAmt = Math.pow(Math.max(0, Math.sin(p * Math.PI * 2)), 1.6) * 0.5 * amp;
      osc.shR[2] = Math.sin(t * 8) * 0.3 * amp;
      osc.elR[2] = 0.35 + Math.sin(t * 8 + 0.8) * 0.4 * amp;
    }

    armL.shoulder.rotation.set(cur.shL[0] + osc.shL[0], cur.shL[1] + osc.shL[1], cur.shL[2] + osc.shL[2]);
    armL.elbow.rotation.set(cur.elL[0] + osc.elL[0], cur.elL[1] + osc.elL[1], cur.elL[2] + osc.elL[2]);
    armR.shoulder.rotation.set(cur.shR[0] + osc.shR[0], cur.shR[1] + osc.shR[1], cur.shR[2] + osc.shR[2]);
    armR.elbow.rotation.set(cur.elR[0] + osc.elR[0], cur.elR[1] + osc.elR[1], cur.elR[2] + osc.elR[2]);

    torso.rotation.x = cur.lean * amp + bowAmt;
    if (mode === "bow") headG.rotation.x += bowAmt * 0.5;

    /* --- 悬浮呼吸 & 细节 --- */
    inner.position.y = Math.sin(t * 1.8) * 0.05 + bounce;
    hairTuft.rotation.z = Math.sin(t * 2.1) * 0.03;
    hairTuft.rotation.x = Math.sin(t * 1.6) * 0.02;
    underGlow.material.opacity = 0.24 + Math.sin(t * 2.6) * 0.08;

    /* --- 道具 --- */
    if (holoOn) {
      holo.position.y = 1.78 + Math.sin(t * 2) * 0.05;
      holo.rotation.y = 0.42 + Math.sin(t * 1.2) * 0.05;
      holoBars.forEach((b, i) => {
        b.scale.x = 0.55 + 0.45 * Math.sin(t * (1.6 + i * 0.5) + i * 1.7);
      });
    }
    if (kbOn) {
      kb.position.y = 1.02 + Math.sin(t * 2.2) * 0.025;
      kbLight.intensity = 3.4 + Math.sin(t * 9) * 0.9;
    }

    /* --- 粒子 --- */
    const pos = pGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < P_COUNT; i++) {
      let y = pos.getY(i) + pSpeed[i] * dt;
      if (y > 7.5) y = 0;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.6 + pPhase[i]) * 0.0018);
    }
    pos.needsUpdate = true;

    /* --- 相机视差 --- */
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const sp = window.scrollY / max;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, mouseNX * 0.38, 1 - Math.exp(-dt * 4));
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.86 - mouseNY * 0.16 - sp * 0.35, 1 - Math.exp(-dt * 4));
    camera.lookAt(0, 1.42, 0);

    renderer.render(scene, camera);
  });

  /* ================================================================ */
  /*  销毁                                                             */
  /* ================================================================ */
  function destroy() {
    renderer.setAnimationLoop(null);
    timers.forEach((id) => window.clearTimeout(id));
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("resize", onResize);
    gsap.killTweensOf([
      rig.position, rig.rotation, rig.scale,
      entranceG.position, entranceG.scale,
      avatar.scale,
      holo.scale, kb.scale, kbLight,
      cur, cur.shL, cur.elL, cur.shR, cur.elR,
    ]);
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
  }

  return { goTo, setAvatarVisible, destroy };
}
