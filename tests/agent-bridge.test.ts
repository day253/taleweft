import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedProject } from "../src/lib/project";
import { applyAgentEdits } from "../src/lib/agent-commands";
import {
  syncEditor,
  listWorkspaces,
  readContext,
  proposeEdits,
  proposalStatus,
} from "../src/lib/agent-bridge";
const token = "a".repeat(48);
const payload = (revision = 1) => ({
  project: structuredClone(seedProject),
  revision,
  selection: { chapterId: "chapter-1", segmentId: "s2", text: "一封信" },
  connected: true,
  decisions: [],
});

test("Agent proposals preserve originals and audio anchors; invalid commands are atomic", () => {
  const next = applyAgentEdits(seedProject, [
    { kind: "segment", id: "s2", changes: { text: "把信给我。", pause: 0.8 } },
    { kind: "cue", id: "bell", changes: { anchorId: "s4", gain: -12 } },
  ]);
  assert.equal(
    next.chapters[0].segments[1].original?.text,
    "有人吗？……我来取一封信。",
  );
  assert.equal(
    seedProject.chapters[0].segments[1].text,
    "有人吗？……我来取一封信。",
  );
  assert.equal(
    next.chapters[0].cues.find((c) => c.id === "bell")?.anchorId,
    "s4",
  );
  assert.throws(() =>
    applyAgentEdits(seedProject, [
      {
        kind: "segment",
        id: "s2",
        changes: { original: { text: "overwrite" } },
      },
    ]),
  );
  assert.throws(
    () =>
      applyAgentEdits(seedProject, [
        { kind: "cue", id: "bell", changes: { anchorId: "s12" } },
      ]),
    /同一章节/,
  );
  assert.throws(() =>
    applyAgentEdits(seedProject, [
      { kind: "segment", id: "s2", changes: { speed: 99 } },
    ]),
  );
});

test("bridge shares selection, stages proposals without editing, then records application", async () => {
  const directory = await mkdtemp(join(tmpdir(), "taleweft-bridge-"));
  try {
    const initial = payload();
    const connection = await syncEditor(directory, token, initial);
    assert.equal((await listWorkspaces(directory)).length, 1);
    const context = await readContext(directory, connection.workspaceId);
    assert.equal(context.selection.text, "一封信");
    const p = await proposeEdits(directory, connection.workspaceId, {
      projectId: initial.project.id,
      baseRevision: 1,
      title: "更紧张",
      edits: [{ kind: "segment", id: "s2", changes: { text: "把信给我。" } }],
    });
    assert.equal(
      (await readContext(directory, connection.workspaceId)).chapter.segments[1]
        .text,
      seedProject.chapters[0].segments[1].text,
    );
    const next = applyAgentEdits(initial.project, p.edits);
    assert.equal(p.before?.[0].text, initial.project.chapters[0].segments[1].text);
    await syncEditor(directory, token, {
      ...initial,
      project: next,
      revision: 2,
      decisions: [{ id: p.id, status: "applied" }],
    });
    assert.equal(
      (await proposalStatus(directory, connection.workspaceId, p.id)).status,
      "applied",
    );
    assert.equal(
      (await readContext(directory, connection.workspaceId)).chapter.segments[1]
        .text,
      "把信给我。",
    );
    await assert.rejects(
      proposeEdits(directory, connection.workspaceId, {
        projectId: initial.project.id,
        baseRevision: 1,
        title: "旧建议",
        edits: p.edits,
      }),
      /作品已变化/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("manual edits invalidate pending proposals and disconnected editors are not writable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "taleweft-bridge-"));
  try {
    const initial = payload();
    const { workspaceId } = await syncEditor(directory, token, initial);
    const p = await proposeEdits(directory, workspaceId, {
      projectId: initial.project.id,
      baseRevision: 1,
      title: "停顿",
      edits: [{ kind: "segment", id: "s2", changes: { pause: 0.8 } }],
    });
    await syncEditor(directory, token, payload(2));
    assert.equal(
      (await proposalStatus(directory, workspaceId, p.id)).status,
      "conflict",
    );
    await syncEditor(directory, token, { ...payload(2), connected: false });
    assert.equal((await listWorkspaces(directory)).length, 0);
    await assert.rejects(readContext(directory, workspaceId), /离线/);
    await assert.rejects(syncEditor(directory, "../secret", initial), /无效/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("concurrent proposal writes survive editor heartbeats", async () => {
  const directory = await mkdtemp(join(tmpdir(), "taleweft-bridge-"));
  try {
    const initial = payload();
    const { workspaceId } = await syncEditor(directory, token, initial);
    await Promise.all([
      syncEditor(directory, token, initial),
      ...Array.from({ length: 3 }, (_, i) =>
        proposeEdits(directory, workspaceId, {
          projectId: initial.project.id,
          baseRevision: 1,
          title: `建议${i}`,
          edits: [{ kind: "segment", id: "s2", changes: { pause: i / 10 } }],
        }),
      ),
    ]);
    assert.equal((await readContext(directory, workspaceId)).pending.length, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
