// 问志产婆：结构化版。LLM 版（v0.3）日后接入，接口保持一致。
import { LENS_BY_ID } from "./lenses.js";

export function structuralPropose(ask, lensId) {
  const lens = LENS_BY_ID[lensId];
  if (!lens) {
    return { socratic: "（未知透镜。）", note: "" };
  }
  if (lens.terminal) {
    return {
      socratic: lens.socratic,
      note: "如果你能凭直觉判断当前问题就是要送出去的那一问，写下它，立为问志。",
    };
  }
  return {
    socratic: lens.socratic,
    note: "写下化简后的问题——要比当前更短、更准、更不绕。",
  };
}
