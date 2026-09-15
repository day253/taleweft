import { test } from "node:test";
import assert from "node:assert/strict";
import { compareText } from "../src/lib/text-diff";
import {
  planImport,
  applyPatches,
  restoreOriginal,
  migrateOriginals,
  seedProject,
} from "../src/lib/project";

test("import preserves the untouched file and segment sources through edits and restoration", () => {
  const input = "第一章 雨夜\r\n\n林夏：一封信。\n  雨还在下。  ";
  const original = planImport(input, "原文测试", "有声剧");
  const id = original.chapters[0].segments[0].id;
  const edited = applyPatches(original, [
    {
      segmentId: id,
      changes: { text: "两封旧信。", emotion: "紧张", speed: 0.85 },
    },
  ]);
  assert.equal(edited.sourceText, input);
  assert.deepEqual(edited.chapters[0].segments[0].original, {
    text: "一封信。",
    kind: "import",
  });
  const restored = restoreOriginal(edited, id);
  assert.equal(restored.chapters[0].segments[0].text, "一封信。");
  assert.equal(restored.chapters[0].segments[0].emotion, "紧张");
  assert.equal(restored.chapters[0].segments[0].speed, 0.85);
  assert.deepEqual(restored.chapters[0].cues, edited.chapters[0].cues);
  assert.equal(edited.chapters[0].segments[0].text, "两封旧信。");
  assert.equal(original.chapters[0].segments[0].text, "一封信。");
});

test("migration recovers sample originals without inventing a source for old imports", () => {
  const legacy = JSON.parse(JSON.stringify(seedProject));
  legacy.chapters[0].segments[0].text = "已修改";
  for (const chapter of legacy.chapters)
    for (const block of chapter.segments) delete block.original;
  const upgraded = migrateOriginals(legacy);
  assert.equal(upgraded.chapters[0].segments[0].text, "已修改");
  assert.equal(
    upgraded.chapters[0].segments[0].original?.text,
    seedProject.chapters[0].segments[0].text,
  );
  assert.equal(legacy.chapters[0].segments[0].original, undefined);
  legacy.id = "legacy-import";
  const unknown = migrateOriginals(legacy);
  assert.equal(unknown.chapters[0].segments[0].original, undefined);
  assert.throws(() => restoreOriginal(unknown, "s1"), /没有保存原文/);
});

test("diff reconstructs both texts for replacements, empty paragraphs, whitespace and Unicode", () => {
  for (const [before, after] of [
    ["一封信。", "一封旧信。"],
    ["甲乙丙", "甲丁丙"],
    ["", "新增"],
    ["全部删除", ""],
    ["雨🌧️\n a", "雪🌨️\n  a"],
    ["一致", "一致"],
  ]) {
    const diff = compareText(before, after);
    assert.equal(
      diff.changes
        .filter((c) => !c.added)
        .map((c) => c.value)
        .join(""),
      before,
    );
    assert.equal(
      diff.changes
        .filter((c) => !c.removed)
        .map((c) => c.value)
        .join(""),
      after,
    );
  }
  assert.equal(compareText("一封信。", "一封旧信。").added, 1);
  assert.equal(compareText("甲乙丙", "甲丁丙").removed, 1);
});

test("large rewrites fall back without losing either version", () => {
  const diff = compareText("甲".repeat(5000), "乙".repeat(5000));
  assert.equal(diff.coarse, true);
  assert.equal(diff.removed, 5000);
  assert.equal(diff.added, 5000);
});
