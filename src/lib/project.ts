export type Format = "有声剧" | "广播剧" | "有声小说";
export type Character = {
  id: string;
  name: string;
  description: string;
  voice: string;
  tone: string;
  speed: number;
  color: string;
};
export type Segment = {
  id: string;
  text: string;
  readonly original?: Readonly<{ text: string; kind: "import" | "sample" }>;
  characterId: string;
  emotion: string;
  speed: number;
  pause: number;
  duration: number;
  model: string;
  status: "draft" | "stale";
};
export type Cue = {
  id: string;
  name: string;
  kind: "sfx" | "music" | "ambience";
  anchorId: string | null;
  endAnchorId?: string;
  start: number;
  duration: number;
  gain: number;
};
export type Chapter = {
  id: string;
  title: string;
  segments: Segment[];
  cues: Cue[];
};
export type Project = {
  id: string;
  title: string;
  format: Format;
  readonly sourceText?: string;
  characters: Character[];
  chapters: Chapter[];
};
export type Patch = {
  segmentId: string;
  changes: Partial<
    Pick<
      Segment,
      "text" | "characterId" | "emotion" | "speed" | "pause" | "model"
    >
  >;
};
export type Proposal = {
  revision: number;
  title: string;
  summary: string;
  patches: Patch[];
};
export const estimateDuration = (text: string) =>
  Math.max(
    1.5,
    Math.round((Array.from(text.replace(/\s/g, "")).length / 4.2) * 10) / 10,
  );
export const uid = (prefix: string) =>
  `${prefix}-${typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
export const segment = (
  id: string,
  text: string,
  characterId = "narrator",
  emotion = "自然",
  duration = estimateDuration(text),
  originalKind: "import" | "sample" = "sample",
): Segment => ({
  id,
  text,
  original: { text, kind: originalKind },
  characterId,
  emotion,
  duration,
  speed: 1,
  pause: 0.4,
  model: "场景音频模型",
  status: "draft",
});
export const seedProject: Project = {
  id: "rain-letter",
  title: "雨夜来信",
  format: "广播剧",
  characters: [
    {
      id: "narrator",
      name: "旁白",
      description: "叙事者 · 克制而有画面感",
      voice: "温暖、低沉的中性声线",
      tone: "平静",
      speed: 1,
      color: "sage",
    },
    {
      id: "lin",
      name: "林夏",
      description: "女主角 · 年轻的调查记者",
      voice: "清澈女声，呼吸感自然",
      tone: "警觉",
      speed: 1,
      color: "blue",
    },
    {
      id: "gu",
      name: "顾言",
      description: "书店主人 · 沉静、神秘",
      voice: "成熟男声，低音略带沙哑",
      tone: "沉稳",
      speed: 0.95,
      color: "amber",
    },
  ],
  chapters: [
    {
      id: "chapter-1",
      title: "第一章 · 雨夜的书店",
      segments: [
        segment(
          "s1",
          "雨落在旧城区的屋檐上。午夜十一点四十七分，林夏推开了那家早已打烊的书店。",
          "narrator",
          "平静",
          9.8,
        ),
        segment("s2", "有人吗？……我来取一封信。", "lin", "低声", 4.6),
        segment(
          "s3",
          "门铃在身后轻响。柜台上的台灯，忽然亮了。",
          "narrator",
          "悬疑",
          6.1,
        ),
        segment("s4", "你比我想象中，来得更晚。", "gu", "沉稳", 4.5),
        segment("s5", "你认识我？", "lin", "疑惑", 2.3),
        segment(
          "s6",
          "不。但我等这封信的主人，已经十年了。",
          "gu",
          "低声",
          6.2,
        ),
        segment(
          "s7",
          "他把泛黄的信封推到灯下。上面只有两个字：林夏。",
          "narrator",
          "悬疑",
          6.4,
        ),
      ],
      cues: [
        {
          id: "rain",
          name: "雨落屋檐",
          kind: "ambience",
          anchorId: null,
          start: 0,
          duration: 48,
          gain: -22,
        },
        {
          id: "bell",
          name: "书店门铃",
          kind: "sfx",
          anchorId: "s3",
          start: 0,
          duration: 2.4,
          gain: -8,
        },
        {
          id: "piano",
          name: "悬疑氛围 · 钢琴",
          kind: "music",
          anchorId: "s4",
          endAnchorId: "s7",
          start: 0,
          duration: 23,
          gain: -18,
        },
      ],
    },
    {
      id: "chapter-2",
      title: "第二章 · 没有寄出的信",
      segments: [
        segment("s8", "信封没有邮戳。林夏沿着折痕，将信纸缓缓展开。"),
        segment("s9", "如果你读到了这里，请不要相信钟声。", "lin", "疑惑"),
        segment("s10", "窗外，钟楼正好响起了第十二声。"),
      ],
      cues: [],
    },
    {
      id: "chapter-3",
      title: "第三章 · 第十二声钟响",
      segments: [
        segment("s11", "街道上的雨停了。所有时钟，却同时停在了午夜。"),
        segment("s12", "我们必须在天亮前离开。", "gu", "急促"),
      ],
      cues: [],
    },
  ],
};
export function segmentTimings(chapter: Chapter) {
  let cursor = 0;
  return chapter.segments.map((s) => {
    const start = cursor;
    const end = start + s.duration / s.speed;
    cursor = end + s.pause;
    return { id: s.id, start, end, next: cursor };
  });
}
export function cueStart(chapter: Chapter, cue: Cue) {
  return (
    (cue.anchorId
      ? (segmentTimings(chapter).find((t) => t.id === cue.anchorId)?.start ?? 0)
      : 0) + cue.start
  );
}
export function cueDuration(chapter: Chapter, cue: Cue) {
  const end = cue.endAnchorId
    ? segmentTimings(chapter).find((t) => t.id === cue.endAnchorId)
    : undefined;
  return cue.anchorId && end
    ? Math.max(0.5, end.next - cueStart(chapter, cue))
    : cue.duration;
}
export function chapterDuration(chapter: Chapter) {
  return Math.max(
    segmentTimings(chapter).at(-1)?.next ?? 0,
    ...chapter.cues.map((c) => cueStart(chapter, c) + cueDuration(chapter, c)),
    1,
  );
}
export function timeLabel(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export function applyPatches(project: Project, patches: Patch[]): Project {
  const copy = structuredClone(project);
  for (const patch of patches) {
    const target = copy.chapters
      .flatMap((c) => c.segments)
      .find((s) => s.id === patch.segmentId);
    if (!target) throw new Error("目标片段已不存在，请重新生成修改建议。");
    if (
      patch.changes.characterId &&
      !copy.characters.some((c) => c.id === patch.changes.characterId)
    )
      throw new Error("角色不存在。");
    Object.assign(target, patch.changes, {
      original: target.original,
      status: "stale",
    });
    if (patch.changes.text !== undefined)
      target.duration = estimateDuration(patch.changes.text);
  }
  return copy;
}

/** Prototype-only, deterministic import planner. All original nonblank text is retained. */
export function planImport(
  text: string,
  title: string,
  format: Format,
): Project {
  if (!text.trim()) throw new Error("请先输入或上传文本。");
  if (text.length > 100_000)
    throw new Error("交互原型单次支持 10 万字符，请分批导入。");
  const chapters: Chapter[] = [];
  const characters: Character[] = [structuredClone(seedProject.characters[0])];
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let current: Chapter | undefined;
  for (const line of lines) {
    if (
      /^(第[零〇一二三四五六七八九十百千万\d]+[章回集幕]|chapter\s+\d+|#{1,3}\s)/i.test(
        line,
      )
    ) {
      current = {
        id: uid("chapter"),
        title: line.replace(/^#{1,3}\s*/, ""),
        segments: [],
        cues: [],
      };
      chapters.push(current);
      continue;
    }
    if (!current) {
      current = {
        id: uid("chapter"),
        title: "第一章 · 正文",
        segments: [],
        cues: [],
      };
      chapters.push(current);
    }
    const match = line.match(/^([\p{L}][\p{L}\d· ]{0,11})[：:]\s*(.+)$/u);
    let charId = "narrator";
    let content = line;
    if (match) {
      let role = characters.find((c) => c.name === match[1]);
      if (!role) {
        role = {
          id: uid("character"),
          name: match[1],
          description: "根据“角色：台词”标记识别，待确认",
          voice: "待选音色",
          tone: "自然",
          speed: 1,
          color: characters.length % 2 ? "blue" : "amber",
        };
        characters.push(role);
      }
      charId = role.id;
      content = match[2];
    }
    // Sentence boundaries preserve punctuation; a long sentence is never silently cut.
    const sentences = Array.from(
      new Intl.Segmenter("zh", { granularity: "sentence" }).segment(content),
      (s) => s.segment,
    );
    let chunk = "";
    const flush = () => {
      if (chunk.trim())
        current!.segments.push(
          segment(
            uid("segment"),
            chunk.trim(),
            charId,
            "自然",
            estimateDuration(chunk.trim()),
            "import",
          ),
        );
      chunk = "";
    };
    for (const sentence of sentences) {
      if (chunk.length + sentence.length > 120) flush();
      chunk += sentence;
    }
    flush();
  }
  if (!chapters.some((c) => c.segments.length))
    throw new Error("只有章节标题，没有正文，请添加正文后重试。");
  return {
    id: uid("project"),
    sourceText: text,
    title: title.trim() || "未命名作品",
    format,
    characters,
    chapters: chapters.filter((c) => c.segments.length),
  };
}

export function proposeEdit(
  project: Project,
  chapterId: string,
  segmentId: string,
  scope: "selection" | "chapter",
  instruction: string,
  revision: number,
): Proposal {
  const chapter = project.chapters.find((c) => c.id === chapterId)!;
  const targets =
    scope === "chapter"
      ? chapter.segments
      : chapter.segments.filter((s) => s.id === segmentId);
  const changes: Patch["changes"] = {};
  const tone = ["紧张", "低声", "平静", "温柔", "警觉", "急促", "自然"].find(
    (t) => instruction.includes(t),
  );
  if (tone) changes.emotion = tone;
  const pause = instruction.match(/停顿\s*([0-9.]+)\s*秒/);
  if (pause) changes.pause = Math.min(3, Math.max(0, Number(pause[1])));
  const speed = instruction.match(/([0-9.]+)\s*倍/);
  if (speed) changes.speed = Math.min(1.5, Math.max(0.5, Number(speed[1])));
  if (instruction.includes("放慢")) changes.speed = 0.85;
  if (instruction.includes("加快")) changes.speed = 1.15;
  if (!Object.keys(changes).length)
    throw new Error(
      "本地演示支持情绪、语速和停顿指令，例如“改为低声，停顿 0.6 秒”。自由改写将在接入 Agent 后启用。",
    );
  return {
    revision,
    title: "表演设置调整",
    summary: `将修改 ${targets.length} 个片段。正文内容保持不变。`,
    patches: targets.map((s) => ({ segmentId: s.id, changes })),
  };
}

/** Recover only known sample originals; legacy imports have no recoverable source. */
export function migrateOriginals(project: Project): Project {
  const copy = structuredClone(project);
  if (copy.id !== seedProject.id) return copy;
  const originals = new Map(
    seedProject.chapters
      .flatMap((c) => c.segments)
      .map((s) => [s.id, s.original]),
  );
  for (const block of copy.chapters.flatMap((c) => c.segments)) {
    if (!block.original && originals.has(block.id))
      Object.assign(block, { original: originals.get(block.id) });
  }
  return copy;
}

export function restoreOriginal(project: Project, id: string): Project {
  const block = project.chapters
    .flatMap((c) => c.segments)
    .find((s) => s.id === id);
  if (!block?.original) throw new Error("此片段没有保存原文，无法恢复。");
  return applyPatches(project, [
    { segmentId: id, changes: { text: block.original.text } },
  ]);
}
