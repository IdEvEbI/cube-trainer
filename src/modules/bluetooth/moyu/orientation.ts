/** 魔域姿态四元数：相对 home 后交给 Twisty Cube3D.quaternion。 */

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

/**
 * 相对姿态 → Twisty/Three 可用的四元数。
 * 魔域解析已是 (x,y,z,w)；再翻转 y（与 GoCube / cubing.js 智能魔方一致）。
 */
export function toTwistyOrientation(relative: MoyuQuat): MoyuQuat {
  return {
    x: relative.x,
    y: -relative.y,
    z: relative.z,
    w: relative.w,
  };
}

/**
 * 跟踪实体魔方姿态：首次或「对齐朝向」时记下 home。
 * 相对 = current ⊗ home⁻¹，表示相对「对齐时握持」的旋转，直接乘到 Cube3D 上。
 */
export class MoyuOrientationTracker {
  private homeInverse: MoyuQuat | null = null;
  private last: MoyuQuat | null = null;

  /** 把当前实体姿态记为屏幕「正对」基准；返回单位四元数（屏幕魔方回正）。 */
  alignToCurrent(current: MoyuQuat = this.requireLast()): MoyuQuat {
    this.homeInverse = quatInvert(current);
    this.last = current;
    return { ...IDENTITY_QUAT };
  }

  /** 尚未对齐时自动以第一帧为 home。 */
  toOrientation(current: MoyuQuat): MoyuQuat {
    this.last = current;
    if (!this.homeInverse) {
      this.homeInverse = quatInvert(current);
    }
    const relative = quatMultiply(current, this.homeInverse);
    return toTwistyOrientation(relative);
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
