/**
 * 复盘「再练一次」：用相同打乱重开，并撤销进入复盘时已写入的成绩。
 */

export type SolveReviewRetryPlan = {
  scramble: string;
  /** 进入复盘即已保存，再练一次默认撤销最新一条。 */
  discardPersistedScore: true;
};

export function planSolveReviewRetry(review: {
  scramble: string;
}): SolveReviewRetryPlan {
  const scramble = review.scramble.trim();
  if (scramble === "") {
    throw new Error("打乱是空的");
  }
  return {
    scramble,
    discardPersistedScore: true,
  };
}
