import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTimer, formatElapsed } from "./timer.ts";

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
  it("把毫秒格式化成分秒", () => {
    assert.equal(formatElapsed(0), "0.000");
    assert.equal(formatElapsed(1500), "1.500");
    assert.equal(formatElapsed(65_000), "1:05.000");
    assert.equal(formatElapsed(-20), "0.000");
  });
});
