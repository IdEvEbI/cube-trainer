/**
 * 魔域姿态四元数 → Twisty Cube3D.quaternion。
 *
 * 协议按 Weilong 从 (w,x,-z,y) 还原为标准 (x,y,z,w) 后：
 * - X ↔ R/L，Y ↔ U/D，Z ↔ F/B，与 Twisty 一致，不再套 GAN 的 (x,z,-y)
 *   （真机：套 (x,z,-y) 时 R/L 仍对，但 U/D 与 F/B 对调）
 * - 校准：basis = conjugate(对齐帧)；每帧 orientation = basis ⊗ q（左乘）
 */

export type MoyuQuat = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export const IDENTITY_QUAT: MoyuQuat = { x: 0, y: 0, z: 0, w: 1 };

/** 与 CubeView 默认相机一致；对齐朝向时复位相机，避免拖动残留。 */
export type OrbitDegrees = {
  latitude: number;
  longitude: number;
};

export const MOYU_REST_ORBIT: OrbitDegrees = {
  latitude: 35,
  longitude: 28,
};

export function quatMultiply(a: MoyuQuat, b: MoyuQuat): MoyuQuat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/** 单位四元数共轭即逆。 */
export function quatInvert(q: MoyuQuat): MoyuQuat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function quatNormalize(q: MoyuQuat): MoyuQuat {
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  if (len < 1e-12) {
    return { ...IDENTITY_QUAT };
  }
  return {
    x: q.x / len,
    y: q.y / len,
    z: q.z / len,
    w: q.w / len,
  };
}

/**
 * 传感器四元数 → Twisty 显示空间。
 * Weilong 还原后已与 Twisty 轴一致，只做归一化。
 */
export function toTwistyOrientation(sensor: MoyuQuat): MoyuQuat {
  return quatNormalize(sensor);
}

/**
 * 跟踪实体魔方姿态。
 * 校准与相对旋转均在 Twisty 显示空间中计算（先 map 再 basis⊗mapped）。
 */
export class MoyuOrientationTracker {
  /** 已映射空间中的 basis = conjugate(对齐时的 mapped)。 */
  private homeInverse: MoyuQuat | null = null;
  private last: MoyuQuat | null = null;

  /** 把当前实体姿态记为屏幕「正对」基准；返回单位四元数。 */
  alignToCurrent(current: MoyuQuat = this.requireLast()): MoyuQuat {
    const mapped = toTwistyOrientation(current);
    this.homeInverse = quatInvert(mapped);
    this.last = current;
    return { ...IDENTITY_QUAT };
  }

  /** 尚未对齐时自动以第一帧为 home。 */
  toOrientation(current: MoyuQuat): MoyuQuat {
    this.last = current;
    const mapped = toTwistyOrientation(current);
    if (!this.homeInverse) {
      this.homeInverse = quatInvert(mapped);
    }
    // gan-cube-sample: quat.premultiply(basis) → basis * quat
    return quatNormalize(quatMultiply(this.homeInverse, mapped));
  }

  lastQuat(): MoyuQuat | null {
    return this.last;
  }

  reset(): void {
    this.homeInverse = null;
    this.last = null;
  }

  private requireLast(): MoyuQuat {
    if (!this.last) {
      throw new Error("尚无陀螺仪数据，请稍候再对齐");
    }
    return this.last;
  }
}
