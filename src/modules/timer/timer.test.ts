import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTimer,
  formatElapsed,
  formatElapsedParts,
  timerDisplayScale,
  TIMER_NARROW_VIEWPORT_PX,
} from "./timer.ts";

function fakeClock(start = 1_000) {
  let now = start;
  return {
    clock: () => now,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe("createTimer", () => {
  it("当前时间一开始是 0", () => {
    const time = fakeClock();
    const timer = createTimer(time.clock);

    assert.equal(timer.current(), 0);
  });

  it("开始后当前时间随时钟增加", () => {
    const time = fakeClock();
    const timer = createTimer(time.clock);

    timer.start();
    time.advance(1500);

    assert.equal(timer.current(), 1500);

    time.advance(250);
    assert.equal(timer.current(), 1750);
  });

  it("停止后当前时间冻结", () => {
    const time = fakeClock();
    const timer = createTimer(time.clock);

    timer.start();
    time.advance(800);
    timer.stop();
    time.advance(5000);

    assert.equal(timer.current(), 800);
  });

  it("未开始时停止，当前时间仍是 0", () => {
    const time = fakeClock();
    const timer = createTimer(time.clock);

    timer.stop();
    time.advance(400);

    assert.equal(timer.current(), 0);
  });

  it("运行中再次开始，不重新计时", () => {
    const time = fakeClock();
    const timer = createTimer(time.clock);

    timer.start();
    time.advance(300);
    timer.start();
    time.advance(200);

    assert.equal(timer.current(), 500);
  });

  it("停止后再次开始，从 0 重新计时", () => {
    const time = fakeClock();
    const timer = createTimer(time.clock);

    timer.start();
    time.advance(900);
    timer.stop();
    timer.start();
    time.advance(100);

    assert.equal(timer.current(), 100);
  });

  it("停止后重置，当前时间回到 0", () => {
    const time = fakeClock();
    const timer = createTimer(time.clock);

    timer.start();
    time.advance(600);
    timer.stop();
    timer.reset();
    time.advance(600);

    assert.equal(timer.current(), 0);
  });

  it("运行中重置后保持 0", () => {
    const time = fakeClock();
    const timer = createTimer(time.clock);

    timer.start();
    time.advance(600);
    timer.reset();
    time.advance(600);

    assert.equal(timer.current(), 0);
  });
});

describe("formatElapsed", () => {
  it("按厘秒两位显示，减轻毫秒位闪烁", () => {
    assert.equal(formatElapsed(0), "0.00");
    assert.equal(formatElapsed(1500), "1.50");
    assert.equal(formatElapsed(1509), "1.50");
    assert.equal(formatElapsed(65_000), "1:05.00");
    assert.equal(formatElapsed(-20), "0.00");
  });
});

describe("formatElapsedParts", () => {
  it("拆出主段与两位厘秒，供大号/小号排版", () => {
    assert.deepEqual(formatElapsedParts(0), { main: "0", fraction: "00" });
    assert.deepEqual(formatElapsedParts(21_040), {
      main: "21",
      fraction: "04",
    });
    assert.deepEqual(formatElapsedParts(103_000), {
      main: "1:43",
      fraction: "00",
    });
  });
});

describe("timerDisplayScale", () => {
  const tenMin = 10 * 60_000;
  const hundredMin = 100 * 60_000;

  it("未满 10 分钟保持 normal，宽窄屏一致", () => {
    assert.equal(timerDisplayScale(0), "normal");
    assert.equal(timerDisplayScale(tenMin - 1), "normal");
    assert.equal(
      timerDisplayScale(tenMin - 1, TIMER_NARROW_VIEWPORT_PX),
      "normal",
    );
  });

  it("满 10 分钟：宽屏 compact，窄屏（手机）tight", () => {
    assert.equal(timerDisplayScale(tenMin, 1280), "compact");
    assert.equal(timerDisplayScale(tenMin, TIMER_NARROW_VIEWPORT_PX), "tight");
    assert.equal(
      timerDisplayScale(tenMin, TIMER_NARROW_VIEWPORT_PX - 1),
      "tight",
    );
  });

  it("满 100 分钟一律 tight，避免三位分钟溢出", () => {
    assert.equal(timerDisplayScale(hundredMin, 1280), "tight");
    assert.equal(
      timerDisplayScale(hundredMin, TIMER_NARROW_VIEWPORT_PX),
      "tight",
    );
  });
});
