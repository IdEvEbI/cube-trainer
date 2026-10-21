export type AppMode = "打乱计时" | "公式练习";

export type ModeSwitch = {
  mode: AppMode;
  keepCube: true;
};

export function switchMode(mode: AppMode): ModeSwitch {
  return {
    mode: mode === "打乱计时" ? "公式练习" : "打乱计时",
    keepCube: true,
  };
}
