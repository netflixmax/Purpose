// 结构化产婆：给出苏格拉底式追问 + 模式化的提示语。
// LLM 产婆（v0.3）会替换这个函数，但接口保持一致：
//   propose(reading, lens) → { socratic, note }

import { LENS_BY_ID } from "./lenses.js";

export function structuralPropose(reading, lensId) {
  const lens = LENS_BY_ID[lensId];
  if (!lens) {
    return {
      socratic: "（未知透镜。）",
      note: "",
    };
  }
  if (lens.terminal) {
    return {
      socratic: lens.socratic,
      note: "如果你能凭直觉判断当前陈述就是这本书要回答的问题，写下它，立为读志。",
    };
  }
  return {
    socratic: lens.socratic,
    note: "写下化简后的一句陈述——要比当前更短、更接近本质。",
  };
}
