import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";

export type MoveHintTone = "guide" | "error";

export type MoveHintOptions = {
  tone?: MoveHintTone;
  /** 当前是双步（R2）且尚未转完。 */
  double?: boolean;
  /** 双步已完成一半，箭头只提示剩余四分之一。 */
  half?: boolean;
};

type Face = "U" | "D" | "L" | "R" | "F" | "B";

/**
 * 面外法向 = 转动轴。
 * U/D：水平环绕；F/B/L/R：垂直环绕。
 */
const FACE_FRAME: Record<
  Face,
  { normal: [number, number, number]; up: [number, number, number] }
> = {
  U: { normal: [0, 1, 0], up: [0, 0, -1] },
  D: { normal: [0, -1, 0], up: [0, 0, 1] },
  R: { normal: [1, 0, 0], up: [0, 1, 0] },
  L: { normal: [-1, 0, 0], up: [0, 1, 0] },
  F: { normal: [0, 0, 1], up: [0, 1, 0] },
  B: { normal: [0, 0, -1], up: [0, 1, 0] },
};

const FACE_TURN = /^([UDLRFB])(')?$/;

const FILL_COLORS: Record<MoveHintTone, number> = {
  guide: 0xffffff,
  error: 0xff5a3d,
};

const SEAM_COLOR = 0x2a303c;
const SHADOW_COLOR = 0x000000;
/** 浅灰描边，衬出白底箭头。 */
const BORDER_COLOR = 0xeeeeee;
/** 描边相对填充外扩（本地单位）。 */
const BORDER_EXTRA = 0.022;

export const MOVE_HINT_CUBE_EDGE = 3;
export const MOVE_HINT_CUBE_RADIUS = 1.5;
export const MOVE_HINT_RADIUS_SCALE = 1.45;
export const MOVE_HINT_RING_RADIUS =
  MOVE_HINT_CUBE_RADIUS * MOVE_HINT_RADIUS_SCALE;
export const MOVE_HINT_LAYER_OFFSET = MOVE_HINT_CUBE_RADIUS + 0.18;
/** 半宽 ≈ 24–32px。 */
export const MOVE_HINT_TUBE_RADIUS = 0.2;
export const MOVE_HINT_TUBE_RADIUS_DOUBLE = 0.22;
/** 径向半厚；全厚约 6px（本地 1 ≈ 边长/3 屏像素）。 */
export const MOVE_HINT_HALF_THICK = 0.045;
const SHADOW_EXTRA = 0.038;
const SHADOW_OPACITY = 0.14;
/** 单步与双步同弧长（约 150°），单步更易辨认；双步另有中段小三角。 */
const ARC_SINGLE = Math.PI * 1.45;
const ARC_DOUBLE = Math.PI * 1.45;
/** 等边三角：底 = 带宽，高 = √3/2·底；略放大底边更醒目。 */
const HEAD_BASE_SCALE = 1.15;
const FLOW_PERIOD_MS = 3200;
const FLOW_CHEVRON_COUNT = 4;
const ARC_SEGMENTS = 72;

type HintHost = {
  add(object: Group): void;
  remove(object: Group): void;
  scheduleRenderCallback?: () => void;
};

type HintGroup = Group & {
  userData: {
    stopAnim?: () => void;
  };
};

function solidMaterial(
  color: number,
  opacity: number,
  depthTest: boolean,
  vertexColors = false,
): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    depthTest,
    depthWrite: false,
    transparent: true,
    opacity,
    side: DoubleSide,
    vertexColors,
  });
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 头部半宽相对尾部的倍率（头比尾宽约 1/3）。 */
const BAND_HEAD_WIDTH_SCALE = 4 / 3;
/** 纯白（含侧面）；厚度靠几何本身。 */
const FACE_RGB: [number, number, number] = [1, 1, 1];
const SIDE_RGB: [number, number, number] = [1, 1, 1];

/**
 * 长方截面环带：顶底用亮色、内外侧用暗色顶点色。
 * Twisty 场景无灯光，MeshBasic 必须靠顶点色才能看出厚度。
 */
function createBandGeometry(
  ringRadius: number,
  halfWidth: number,
  halfThick: number,
  tailAngle: number,
  arcLength: number,
  travelSign: number,
  segments: number,
): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];

  function pushVert(
    x: number,
    y: number,
    z: number,
    rgb: [number, number, number],
  ): void {
    positions.push(x, y, z);
    colors.push(rgb[0], rgb[1], rgb[2]);
  }

  function pushTri(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    rgb: [number, number, number],
  ): void {
    pushVert(ax, ay, az, rgb);
    pushVert(bx, by, bz, rgb);
    pushVert(cx, cy, cz, rgb);
  }

  function ringCorners(
    angle: number,
    widthScale: number,
  ): Array<[number, number, number]> {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const cx = ringRadius * cos;
    const cy = ringRadius * sin;
    const hw = halfWidth * widthScale;
    const ht = halfThick;
    // 外+/内- 径向，上+/下- 法向
    return [
      [cx + cos * ht, cy + sin * ht, hw], // 0 外上
      [cx - cos * ht, cy - sin * ht, hw], // 1 内上
      [cx - cos * ht, cy - sin * ht, -hw], // 2 内下
      [cx + cos * ht, cy + sin * ht, -hw], // 3 外下
    ];
  }

  for (let i = 0; i < segments; i++) {
    const u0 = i / segments;
    const u1 = (i + 1) / segments;
    const a0 = tailAngle + travelSign * u0 * arcLength;
    const a1 = tailAngle + travelSign * u1 * arcLength;
    const s0 = 1 + (BAND_HEAD_WIDTH_SCALE - 1) * u0;
    const s1 = 1 + (BAND_HEAD_WIDTH_SCALE - 1) * u1;
    const c0 = ringCorners(a0, s0);
    const c1 = ringCorners(a1, s1);

    // 顶面 (z+)
    pushTri(
      c0[0]![0],
      c0[0]![1],
      c0[0]![2],
      c0[1]![0],
      c0[1]![1],
      c0[1]![2],
      c1[1]![0],
      c1[1]![1],
      c1[1]![2],
      FACE_RGB,
    );
    pushTri(
      c0[0]![0],
      c0[0]![1],
      c0[0]![2],
      c1[1]![0],
      c1[1]![1],
      c1[1]![2],
      c1[0]![0],
      c1[0]![1],
      c1[0]![2],
      FACE_RGB,
    );
    // 底面 (z-)
    pushTri(
      c0[3]![0],
      c0[3]![1],
      c0[3]![2],
      c1[2]![0],
      c1[2]![1],
      c1[2]![2],
      c0[2]![0],
      c0[2]![1],
      c0[2]![2],
      FACE_RGB,
    );
    pushTri(
      c0[3]![0],
      c0[3]![1],
      c0[3]![2],
      c1[3]![0],
      c1[3]![1],
      c1[3]![2],
      c1[2]![0],
      c1[2]![1],
      c1[2]![2],
      FACE_RGB,
    );
    // 外侧壁（径向外）
    pushTri(
      c0[0]![0],
      c0[0]![1],
      c0[0]![2],
      c1[0]![0],
      c1[0]![1],
      c1[0]![2],
      c1[3]![0],
      c1[3]![1],
      c1[3]![2],
      SIDE_RGB,
    );
    pushTri(
      c0[0]![0],
      c0[0]![1],
      c0[0]![2],
      c1[3]![0],
      c1[3]![1],
      c1[3]![2],
      c0[3]![0],
      c0[3]![1],
      c0[3]![2],
      SIDE_RGB,
    );
    // 内侧壁（径向内）
    pushTri(
      c0[1]![0],
      c0[1]![1],
      c0[1]![2],
      c0[2]![0],
      c0[2]![1],
      c0[2]![2],
      c1[2]![0],
      c1[2]![1],
      c1[2]![2],
      SIDE_RGB,
    );
    pushTri(
      c0[1]![0],
      c0[1]![1],
      c0[1]![2],
      c1[2]![0],
      c1[2]![1],
      c1[2]![2],
      c1[1]![0],
      c1[1]![1],
      c1[1]![2],
      SIDE_RGB,
    );
  }

  // 尾端封闭
  {
    const c = ringCorners(tailAngle, 1);
    pushTri(
      c[0]![0],
      c[0]![1],
      c[0]![2],
      c[3]![0],
      c[3]![1],
      c[3]![2],
      c[2]![0],
      c[2]![1],
      c[2]![2],
      SIDE_RGB,
    );
    pushTri(
      c[0]![0],
      c[0]![1],
      c[0]![2],
      c[2]![0],
      c[2]![1],
      c[2]![2],
      c[1]![0],
      c[1]![1],
      c[1]![2],
      SIDE_RGB,
    );
  }
  // 头端封闭（贴 seam）
  {
    const c = ringCorners(
      tailAngle + travelSign * arcLength,
      BAND_HEAD_WIDTH_SCALE,
    );
    pushTri(
      c[0]![0],
      c[0]![1],
      c[0]![2],
      c[1]![0],
      c[1]![1],
      c[1]![2],
      c[2]![0],
      c[2]![1],
      c[2]![2],
      SIDE_RGB,
    );
    pushTri(
      c[0]![0],
      c[0]![1],
      c[0]![2],
      c[2]![0],
      c[2]![1],
      c[2]![2],
      c[3]![0],
      c[3]![1],
      c[3]![2],
      SIDE_RGB,
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(colors), 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 头带分界线：横跨带宽的薄片（截图 2 红线位置）。
 */
function createSeamGeometry(
  ringRadius: number,
  halfWidth: number,
  halfThick: number,
  seamAngle: number,
  travelSign: number,
): BufferGeometry {
  const cos = Math.cos(seamAngle);
  const sin = Math.sin(seamAngle);
  const tx = -sin * travelSign;
  const ty = cos * travelSign;
  const cx = ringRadius * cos;
  const cy = ringRadius * sin;
  const hw = halfWidth * 1.02;
  const ht = halfThick * 1.15;
  const halfSeam = 0.018;

  // 局部：radial / normal / tangent
  const corners: Array<[number, number, number]> = [
    [ht, hw, -halfSeam],
    [-ht, hw, -halfSeam],
    [-ht, -hw, -halfSeam],
    [ht, -hw, -halfSeam],
    [ht, hw, halfSeam],
    [-ht, hw, halfSeam],
    [-ht, -hw, halfSeam],
    [ht, -hw, halfSeam],
  ];

  const positions: number[] = [];
  for (const [dr, dn, dt] of corners) {
    positions.push(cx + cos * dr + tx * dt, cy + sin * dr + ty * dt, dn);
  }

  const indices = [
    0,
    1,
    2,
    0,
    2,
    3, // back
    4,
    6,
    5,
    4,
    7,
    6, // front
    0,
    4,
    5,
    0,
    5,
    1,
    1,
    5,
    6,
    1,
    6,
    2,
    2,
    6,
    7,
    2,
    7,
    3,
    3,
    7,
    4,
    3,
    4,
    0,
  ];

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 等边三角箭头头：底 ≈ 带宽，高 = √3/2·底。
 * 顶底亮、侧壁暗，与环带同一套顶点色。
 */
function createTriangleHeadGeometry(
  ringRadius: number,
  halfWidth: number,
  halfThick: number,
  seamAngle: number,
  travelSign: number,
): BufferGeometry {
  const base = halfWidth * 2 * HEAD_BASE_SCALE;
  const height = base * (Math.sqrt(3) / 2);
  const cos = Math.cos(seamAngle);
  const sin = Math.sin(seamAngle);
  const tx = -sin * travelSign;
  const ty = cos * travelSign;
  const cx = ringRadius * cos;
  const cy = ringRadius * sin;
  const ht = halfThick * 1.05;
  const baseLeft = -base / 2;
  const baseRight = base / 2;
  const tipAlong = height;

  function vert(along: number, across: number, radial: number): number[] {
    return [
      cx + tx * along + cos * radial,
      cy + ty * along + sin * radial,
      across,
    ];
  }

  const positions: number[] = [];
  const colors: number[] = [];

  function pushTri(
    a: number[],
    b: number[],
    c: number[],
    rgb: [number, number, number],
  ): void {
    for (const p of [a, b, c]) {
      positions.push(p[0]!, p[1]!, p[2]!);
      colors.push(rgb[0], rgb[1], rgb[2]);
    }
  }

  const bln = vert(0, baseLeft, -ht);
  const brn = vert(0, baseRight, -ht);
  const tpn = vert(tipAlong, 0, -ht);
  const blp = vert(0, baseLeft, ht);
  const brp = vert(0, baseRight, ht);
  const tpp = vert(tipAlong, 0, ht);

  // 径向 - / + 视为顶底（亮）；其余侧壁暗
  pushTri(bln, tpn, brn, FACE_RGB);
  pushTri(blp, brp, tpp, FACE_RGB);
  pushTri(bln, brn, brp, SIDE_RGB);
  pushTri(bln, brp, blp, SIDE_RGB);
  pushTri(brn, tpn, tpp, SIDE_RGB);
  pushTri(brn, tpp, brp, SIDE_RGB);
  pushTri(tpn, bln, blp, SIDE_RGB);
  pushTri(tpn, blp, tpp, SIDE_RGB);

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(colors), 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** 流动短划（小三角），沿环带指向箭头，方向更直观。 */
function createChevronGeometry(
  halfWidth: number,
  halfThick: number,
): BufferGeometry {
  const len = halfWidth * 1.1;
  const halfBase = halfWidth * 0.55;
  const ht = halfThick * 0.85;
  // 局部：沿 +Y 为行进，X 为 across，Z 为厚；再由调用方旋转到弧上
  const positions = new Float32Array([
    0,
    0,
    -ht,
    halfBase,
    0,
    -ht,
    0,
    len,
    -ht,
    -halfBase,
    0,
    -ht,
    0,
    0,
    ht,
    halfBase,
    0,
    ht,
    0,
    len,
    ht,
    -halfBase,
    0,
    ht,
  ]);
  // 简化为两个面片 + 侧面
  const indices = [
    0,
    1,
    2,
    0,
    2,
    3, // -ht
    4,
    6,
    5,
    4,
    7,
    6, // +ht
    0,
    4,
    5,
    0,
    5,
    1,
    1,
    5,
    6,
    1,
    6,
    2,
    2,
    6,
    7,
    2,
    7,
    3,
    3,
    7,
    4,
    3,
    4,
    0,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function applyMoveHint(
  puzzle: HintHost,
  existing: Group | null,
  move: string | null,
  options: MoveHintOptions = {},
): Group | null {
  if (existing) {
    puzzle.remove(existing);
    disposeHintGroup(existing);
  }
  if (!move) {
    puzzle.scheduleRenderCallback?.();
    return null;
  }
  const group = buildHintGroup(move, options, () => {
    puzzle.scheduleRenderCallback?.();
  });
  if (!group) {
    puzzle.scheduleRenderCallback?.();
    return null;
  }
  puzzle.add(group);
  puzzle.scheduleRenderCallback?.();
  return group;
}

function disposeHintGroup(group: Group) {
  const hint = group as HintGroup;
  hint.userData.stopAnim?.();
  hint.userData.stopAnim = undefined;
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material as MeshBasicMaterial | undefined;
    material?.dispose?.();
  });
}

function buildHintGroup(
  move: string,
  options: MoveHintOptions,
  onFrame: () => void,
): HintGroup | null {
  const match = FACE_TURN.exec(move);
  if (!match) {
    return null;
  }
  const face = match[1] as Face;
  const prime = Boolean(match[2]);
  const frame = FACE_FRAME[face];
  const tone = options.tone ?? "guide";
  const fillColor = FILL_COLORS[tone];
  const double = Boolean(options.double) && !options.half;
  const arcLength = double ? ARC_DOUBLE : ARC_SINGLE;

  const normal = new Vector3(...frame.normal).normalize();
  const up = new Vector3(...frame.up).normalize();
  const right = new Vector3().crossVectors(up, normal).normalize();
  const trueUp = new Vector3().crossVectors(normal, right).normalize();

  const ringRadius = MOVE_HINT_RING_RADIUS;
  const layerOffset = MOVE_HINT_LAYER_OFFSET;

  const group = new Group() as HintGroup;
  group.name = "cube-move-hint";
  group.userData.face = face;
  group.position.copy(normal.clone().multiplyScalar(layerOffset));
  group.quaternion.setFromRotationMatrix(
    new Matrix4().makeBasis(right, trueUp, normal),
  );
  group.renderOrder = 20;

  const halfWidth = double
    ? MOVE_HINT_TUBE_RADIUS_DOUBLE
    : MOVE_HINT_TUBE_RADIUS;
  const halfThick = MOVE_HINT_HALF_THICK;
  const travelSign = prime ? 1 : -1;

  const mid = Math.PI / 2;
  const half = arcLength / 2;
  const tailAngle = mid - travelSign * half;
  const tipAngle = mid + travelSign * half;
  // 环带止于 seam；三角头接在 seam 之后（底边对齐加宽后的环带头）
  const headHalfWidth = halfWidth * BAND_HEAD_WIDTH_SCALE;
  const headHeight = headHalfWidth * 2 * HEAD_BASE_SCALE * (Math.sqrt(3) / 2);
  const headAngle = headHeight / ringRadius;
  const seamAngle = tipAngle - travelSign * headAngle;
  const bandLength = Math.abs(seamAngle - tailAngle);

  const depthTest = false;
  const shadowMat = solidMaterial(SHADOW_COLOR, SHADOW_OPACITY, depthTest);
  const borderMat = solidMaterial(BORDER_COLOR, 0.98, depthTest);
  // 纯白填充 + 浅灰描边
  const fillMat = solidMaterial(fillColor, 0.96, depthTest, true);
  const seamMat = solidMaterial(SEAM_COLOR, 0.9, depthTest);

  function addBand(
    hw: number,
    ht: number,
    material: MeshBasicMaterial,
    renderOrder: number,
  ): Mesh {
    const mesh = new Mesh(
      createBandGeometry(
        ringRadius,
        hw,
        ht,
        tailAngle,
        bandLength,
        travelSign,
        ARC_SEGMENTS,
      ),
      material,
    );
    mesh.renderOrder = renderOrder;
    group.add(mesh);
    return mesh;
  }

  const shadow = addBand(
    halfWidth + SHADOW_EXTRA,
    halfThick + SHADOW_EXTRA,
    shadowMat,
    18,
  );
  shadow.position.z = -0.028;

  addBand(
    halfWidth + BORDER_EXTRA,
    halfThick + BORDER_EXTRA * 0.5,
    borderMat,
    19,
  );
  addBand(halfWidth, halfThick, fillMat, 20);

  // 头带分界线（保留，便于辨认箭头方向）
  const seam = new Mesh(
    createSeamGeometry(
      ringRadius,
      headHalfWidth,
      halfThick,
      seamAngle,
      travelSign,
    ),
    seamMat,
  );
  seam.renderOrder = 24;
  group.add(seam);

  const headBorder = new Mesh(
    createTriangleHeadGeometry(
      ringRadius,
      headHalfWidth + BORDER_EXTRA,
      halfThick + BORDER_EXTRA * 0.5,
      seamAngle,
      travelSign,
    ),
    borderMat,
  );
  headBorder.renderOrder = 25;
  group.add(headBorder);

  const head = new Mesh(
    createTriangleHeadGeometry(
      ringRadius,
      headHalfWidth,
      halfThick,
      seamAngle,
      travelSign,
    ),
    fillMat,
  );
  head.renderOrder = 26;
  head.name = "cube-move-hint-head";
  group.add(head);

  const tipAnchor = new Object3D();
  tipAnchor.name = "cube-move-hint-tip";
  tipAnchor.position.set(
    ringRadius * Math.cos(tipAngle),
    ringRadius * Math.sin(tipAngle),
    0,
  );
  group.add(tipAnchor);

  group.userData.tipAngle = tipAngle;
  group.userData.tailAngle = tailAngle;
  group.userData.seamAngle = seamAngle;
  group.userData.ringRadius = ringRadius;
  group.userData.layerOffset = layerOffset;
  group.userData.depthTest = depthTest;
  group.userData.double = double;
  group.userData.fillColor = fillColor;
  group.userData.horizontal = face === "U" || face === "D";

  // 双步：中段再加一个小三角头，强调 180°
  if (double) {
    const midSeam = mid;
    const midHead = new Mesh(
      createTriangleHeadGeometry(
        ringRadius,
        halfWidth * 0.75,
        halfThick,
        midSeam,
        travelSign,
      ),
      fillMat,
    );
    midHead.renderOrder = 23;
    group.add(midHead);
  }

  // 流动短划（类似常见 App 的方向点/箭头串），沿环带滑向三角头
  const chevronGeom = createChevronGeometry(halfWidth, halfThick);
  const chevrons: Array<{ mesh: Mesh; mat: MeshBasicMaterial }> = [];
  for (let i = 0; i < FLOW_CHEVRON_COUNT; i++) {
    const mat = solidMaterial(fillColor, 0.85, depthTest);
    const mesh = new Mesh(chevronGeom, mat);
    mesh.renderOrder = 22;
    group.add(mesh);
    chevrons.push({ mesh, mat });
  }

  const startedAt = performance.now();
  let raf = 0;
  const hasRaf = typeof requestAnimationFrame === "function";
  const tick = (now: number) => {
    const elapsed = now - startedAt;
    const base = (elapsed / FLOW_PERIOD_MS) % 1;
    for (let i = 0; i < chevrons.length; i++) {
      const raw = (base + i / FLOW_CHEVRON_COUNT) % 1;
      const phase = easeInOut(raw);
      const angle = tailAngle + travelSign * bandLength * phase;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const tx = -sin * travelSign;
      const ty = cos * travelSign;
      const { mesh, mat } = chevrons[i]!;
      mesh.position.set(ringRadius * cos, ringRadius * sin, 0);
      // 局部 +Y → 切线
      mesh.quaternion.setFromUnitVectors(
        new Vector3(0, 1, 0),
        new Vector3(tx, ty, 0),
      );
      // 靠近箭头更实，形成明确流向
      mat.opacity = 0.35 + 0.6 * phase;
    }
    onFrame();
    if (hasRaf) {
      raf = requestAnimationFrame(tick);
    }
  };
  if (hasRaf) {
    raf = requestAnimationFrame(tick);
    group.userData.stopAnim = () => {
      cancelAnimationFrame(raf);
    };
  } else {
    tick(startedAt);
  }

  return group;
}
