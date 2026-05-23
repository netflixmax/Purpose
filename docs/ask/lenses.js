// 问 AI 前的化简——4 把透镜，专为问题打磨。
// 与读志的不同：去掉「界定 (搜 vs 读)」，加入「揭设 (假设暴露)」
// ——这是 AI 失败的最大原因：它接受用户的错前提"陪演"。

export const LENSES = [
  {
    id: "guiben",
    name: "归本",
    gloss: "删冗，留骨。",
    socratic:
      "如果你必须把这个问题缩到 15 个字以内，留什么？再缩到 8 个字，又留什么？被你删掉的那部分，AI 真的需要看到吗？",
    terminal: false,
  },
  {
    id: "dingxing",
    name: "定型",
    gloss: "你要哪一种答案？",
    socratic:
      "你要 AI 给你的是：事实？方法？观点对比？反例？还是评估？选一个——剩下的别在这一问里塞。一问一型，答案才能落地。",
    terminal: false,
  },
  {
    id: "jieshe",
    name: "揭设",
    gloss: "亮出你偷偷的预设。",
    socratic:
      "你这个问题里有一个被你当作\"理所当然\"的前提。如果这个前提是错的，整个问题就崩了。把它亮出来——明问 AI \"这个前提对吗\"，比让 AI 陪你演戏好十倍。",
    terminal: false,
  },
  {
    id: "anju",
    name: "锚据",
    gloss: "这就是问志吗？",
    socratic:
      "停。看着当前这个问题——不思考、不论证——你能直觉到 AI 答这一问就够你受用吗？如能，立为问志，一键带走。",
    terminal: true,
  },
];

export const LENS_BY_ID = Object.fromEntries(LENSES.map((l) => [l.id, l]));

export function lensName(id) {
  return LENS_BY_ID[id]?.name ?? id;
}
