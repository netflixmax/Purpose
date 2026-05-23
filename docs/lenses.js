// 化简透镜 — 读书意图专用 4 把。
// 比 CLI 的 5 把少了「反观」（读书场景对反面思考不甚相关），
// 多了「界定」（塔勒布式：读 vs 不读的边际收益）。

export const LENSES = [
  {
    id: "guiben",
    name: "归本",
    gloss: "为学日益，为道日损。把不本质的剥掉。",
    socratic:
      "如果你必须删掉这个意图里的一半字，只留最不可省的那一半，剩下的是什么？再删一半呢？",
    terminal: false,
  },
  {
    id: "dingxing",
    name: "定型",
    gloss: "你要书给你的是哪一种东西？",
    socratic:
      "你要这本书给你：事实？方法？视角？还是范式？把它认作那一族的一个例子——那一族的核心问题是什么？",
    terminal: false,
  },
  {
    id: "jieding",
    name: "界定",
    gloss: "读 vs 不读的边际收益。",
    socratic:
      "你要的答案是几句话就能说完，还是必须一整本书？如果是前者——搜索或问 AI 就够了，这本书你其实不需要读。如果是后者，是什么让搜索答不了？",
    terminal: false,
  },
  {
    id: "anju",
    name: "锚据",
    gloss: "到底了吗？这就是读志吗？",
    socratic:
      "停。看着当前这个陈述，不思考、不论证——你能直觉地一眼判断这就是这本书必须为你回答的那一个具体问题吗？如能，写下它，立为读志。",
    terminal: true,
  },
];

export const LENS_BY_ID = Object.fromEntries(LENSES.map((l) => [l.id, l]));

export function lensName(id) {
  return LENS_BY_ID[id]?.name ?? id;
}
