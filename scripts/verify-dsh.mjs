import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { syncEditor } from "../src/lib/agent-bridge.ts";
import { seedProject } from "../src/lib/project.ts";
import * as plugin from "../plugins/dsh/dist/index.mjs";
const runtime = process.argv[2];
if (!runtime)
  throw new Error(
    "Usage: node --import tsx scripts/verify-dsh.mjs /path/to/dsh-installation",
  );
const requireRuntime = createRequire(resolve(runtime, "package.json"));
const load = async (name) =>
  import(pathToFileURL(requireRuntime.resolve(name)).href);
const { Context } = await load("@deepseek-ai/cordis");
const { default: SystemPrompt } = await load("@deepseek-ai/dsh-system-prompt");
const { default: Tools } = await load("@deepseek-ai/dsh-tools");
const directory = await mkdtemp(join(tmpdir(), "taleweft-dsh-runtime-"));
const ctx = new Context();
try {
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(Tools);
  await ctx.plugin(plugin, { bridgeDirectory: directory });
  const schemas = ctx.tools.schemas();
  assert.equal(schemas.filter((t) => t.name.startsWith("taleweft_")).length, 4);
  const call = async (name, args, signal = new AbortController().signal) =>
    ctx.tools.execute({
      callId: crypto.randomUUID(),
      name,
      arguments: args,
      signal,
    });
  const token = "b".repeat(48);
  const document = {
    project: seedProject,
    revision: 1,
    selection: { chapterId: "chapter-1", segmentId: "s2", text: "" },
    connected: true,
  };
  const { workspaceId } = await syncEditor(directory, token, document);
  const list = await call("taleweft_list_workspaces", {});
  assert.equal(list.isError, false);
  assert.equal(list.value.workspaces[0].workspaceId, workspaceId);
  const context = await call("taleweft_get_context", { workspaceId });
  assert.equal(context.isError, false);
  assert.equal(context.value.revision, 1);
  const proposal = await call("taleweft_propose_edit", {
    workspaceId,
    projectId: seedProject.id,
    baseRevision: 1,
    title: "Runtime verification",
    edits: [
      {
        kind: "segment",
        id: "s2",
        changes: { text: "请把那封信交给我。", pause: 0.8 },
      },
    ],
  });
  assert.equal(proposal.isError, false, JSON.stringify(proposal));
  assert.equal(proposal.value.status, "pending");
  const status = await call("taleweft_proposal_status", {
    workspaceId,
    proposalId: proposal.value.id,
  });
  assert.equal(status.value.status, "pending");
  const invalid = await call("taleweft_propose_edit", {
    workspaceId,
    projectId: seedProject.id,
    baseRevision: 1,
    title: "Invalid",
    edits: [
      {
        kind: "segment",
        id: "s2",
        changes: { original: { text: "overwrite" } },
      },
    ],
  });
  assert.equal(invalid.isError, true);
  const controller = new AbortController();
  controller.abort();
  const cancelled = await call(
    "taleweft_get_context",
    { workspaceId },
    controller.signal,
  );
  assert.equal(cancelled.isError, true);
  console.log(
    "PASS: real DSH registry loaded all four tools; read/propose/status, validation and cancellation verified. No LLM request was made.",
  );
} finally {
  await ctx.fiber.dispose();
  await rm(directory, { recursive: true, force: true });
}
