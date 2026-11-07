/**
 * 浏览器侧静态导入 gan-web-bluetooth。
 * 不可被 Node 单测直接加载（aes-js CJS 命名导出问题）；
 * 由 App 引入，保证用户手势内立刻 requestDevice，不打断系统选择窗。
 */
import {
  connectGanCube,
  type MacAddressProvider,
  type GanCubeConnection,
} from "gan-web-bluetooth";
import type { SmartCubeBleDevice } from "../brand.ts";

export { connectGanCube };

type BluetoothRequestDeviceFn = (
  ...args: never[]
) => Promise<SmartCubeBleDevice>;

type NavigatorBluetoothShim = {
  requestDevice: BluetoothRequestDeviceFn & {
    bind(thisArg: unknown): BluetoothRequestDeviceFn;
  };
};

/**
 * 复用已选出的设备，避免二次弹出系统选择窗。
 * 通过短暂替换 requestDevice 接入库内 MAC / GATT 流程。
 * （本仓 tsconfig 未启用全局 Web Bluetooth 类型，故用结构类型 + 断言。）
 */
export async function connectGanCubeWithDevice(
  device: SmartCubeBleDevice,
  askMac?: MacAddressProvider,
): Promise<GanCubeConnection> {
  const bluetooth = (
    navigator as Navigator & { bluetooth?: NavigatorBluetoothShim }
  ).bluetooth;
  if (!bluetooth) {
    throw new Error("当前浏览器不支持 Web Bluetooth");
  }
  const original = bluetooth.requestDevice.bind(bluetooth);
  bluetooth.requestDevice = (async () => device) as BluetoothRequestDeviceFn & {
    bind(thisArg: unknown): BluetoothRequestDeviceFn;
  };
  try {
    return await connectGanCube(askMac);
  } finally {
    bluetooth.requestDevice = original;
  }
}
