import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedProject, cueStart, segmentTimings, planImport, applyPatches, proposeEdit } from '../src/lib/project';

test('anchored sound follows its text when paragraphs are reordered', () => {
  const c = structuredClone(seedProject.chapters[0]);
  const bell = c.cues.find(c => c.id === 'bell')!;
  assert.equal(cueStart(c, bell), segmentTimings(c).find(s => s.id === 's3')!.start);
  const target = c.segments.splice(2, 1)[0]; c.segments.unshift(target);
  assert.equal(cueStart(c, bell), 0);
});
test('plain text import preserves sentences and extracts explicit speaker labels', () => {
  const p = planImport('第一章 雨夜\n林夏：你听见了吗？\n雨一直在下。\n第二章 清晨\n顾言：天亮了。', '测试', '有声剧');
  assert.equal(p.chapters.length, 2);
  assert.deepEqual(p.chapters.flatMap(c => c.segments.map(s => s.text)), ['你听见了吗？', '雨一直在下。', '天亮了。']);
  assert.deepEqual(p.characters.map(c => c.name), ['旁白', '林夏', '顾言']);
  assert.throws(() => planImport('第一章 雨夜', '', '广播剧'), /没有正文/);
});
test('local proposal changes only its selected segment and leaves original project immutable', () => {
  const proposal = proposeEdit(seedProject, 'chapter-1', 's2', 'selection', '改为低声，停顿 0.6 秒', 5);
  const edited = applyPatches(seedProject, proposal.patches);
  assert.equal(edited.chapters[0].segments[1].pause, 0.6);
  assert.equal(seedProject.chapters[0].segments[1].pause, 0.4);
  assert.equal(edited.chapters[0].segments[0].status, 'draft');
  assert.throws(() => applyPatches(seedProject, [{ segmentId: 's2', changes: { characterId: 'missing' } }]), /角色不存在/);
});
