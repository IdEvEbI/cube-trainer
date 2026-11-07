import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Subject } from "rxjs";
import type { GanCubeConnection, GanCubeEvent } from "gan-web-bluetooth";
import { SOLVED_FACELETS_URFDLB } from "../moyu/facelets.ts";
import { connectGanCubeSession } from "./ble.ts";

describe("connectGanCubeSession", () => {
  it("requestStatus 收到 FACELETS 后给出 setupAlg", async () => {
    const events$ = new Subject<GanCubeEvent>();
    const conn: GanCubeConnection = {
      deviceName: "GAN-Test-AABBCCDDEEFF",
      deviceMAC: "AA:BB:CC:DD:EE:FF",
      events$,
      async sendCubeCommand(command) {
        assert.equal(command.type, "REQUEST_FACELETS");
        setTimeout(() => {
          events$.next({
            type: "FACELETS",
            timestamp: Date.now(),
            serial: 3,
            facelets: SOLVED_FACELETS_URFDLB,
            state: {
              CP: [0, 1, 2, 3, 4, 5, 6, 7],
              CO: [0, 0, 0, 0, 0, 0, 0, 0],
              EP: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
              EO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          });
        }, 5);
      },
      async disconnect() {
        events$.complete();
      },
    };

    const session = await connectGanCubeSession({
      connectImpl: async () => conn,
    });
    const status = await session.requestStatus();
    assert.equal(status.facelets, SOLVED_FACELETS_URFDLB);
    assert.equal(status.setupAlg, "");
    assert.equal(status.moveCounter, 3);
    session.disconnect();
  });

  it("未注入 connectImpl 时拒绝", async () => {
    await assert.rejects(
      () => connectGanCubeSession({}),
      /不支持 Web Bluetooth|缺少 Gan 连接实现/,
    );
  });

  it("支持广播监听时：首次不询问；fallback 才询问，并记住 MAC", async () => {
    const events$ = new Subject<GanCubeEvent>();
    const conn: GanCubeConnection = {
      deviceName: "GANi3XXX",
      deviceMAC: "AA:BB:CC:DD:EE:FF",
      events$,
      async sendCubeCommand() {},
      async disconnect() {
        events$.complete();
      },
    };
    let asked = 0;
    let remembered: string | null = null;
    const watchable = {
      id: "dev-1",
      name: "GANi3XXX",
      watchAdvertisements: async () => undefined,
    };
    await connectGanCubeSession({
      askMacAddress: () => {
        asked += 1;
        return "AA:BB:CC:DD:EE:FF";
      },
      rememberMac: (device, mac) => {
        remembered = `${device.id}:${mac}`;
      },
      connectImpl: async (askMac) => {
        assert.equal(await askMac(watchable, false), null);
        assert.equal(asked, 0);
        assert.equal(await askMac(watchable, true), "AA:BB:CC:DD:EE:FF");
        assert.equal(asked, 1);
        return conn;
      },
    });
    assert.equal(remembered, "dev-1:AA:BB:CC:DD:EE:FF");
  });

  it("MOVE / GYRO 事件转发到 onMoves / onOrientation", async () => {
    const events$ = new Subject<GanCubeEvent>();
    const conn: GanCubeConnection = {
      deviceName: "GAN-Test",
      deviceMAC: "AA:BB:CC:DD:EE:FF",
      events$,
      async sendCubeCommand() {},
      async disconnect() {
        events$.complete();
      },
    };
    const moves: string[] = [];
    const quats: Array<{ w: number }> = [];
    await connectGanCubeSession({
      onMoves: (samples) => {
        for (const sample of samples) {
          moves.push(sample.move);
        }
      },
      onOrientation: (q) => {
        quats.push({ w: q.w });
      },
      connectImpl: async () => conn,
    });
    events$.next({
      type: "MOVE",
      serial: 1,
      face: 1,
      direction: 0,
      move: "R",
      localTimestamp: 1000,
      cubeTimestamp: 10,
    });
    events$.next({
      type: "GYRO",
      timestamp: 1001,
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    });
    assert.deepEqual(moves, ["R"]);
    assert.deepEqual(quats, [{ w: 1 }]);
  });

  it("无 watchAdvertisements 时首次即询问，避免空等", async () => {
    const events$ = new Subject<GanCubeEvent>();
    const conn: GanCubeConnection = {
      deviceName: "GANi3XXX",
      deviceMAC: "11:22:33:44:55:66",
      events$,
      async sendCubeCommand() {},
      async disconnect() {
        events$.complete();
      },
    };
    let asked = 0;
    await connectGanCubeSession({
      askMacAddress: () => {
        asked += 1;
        return "11:22:33:44:55:66";
      },
      connectImpl: async (askMac) => {
        assert.equal(
          await askMac({ id: "dev-2", name: "GANi3XXX" }, false),
          "11:22:33:44:55:66",
        );
        assert.equal(asked, 1);
        return conn;
      },
    });
  });
});
