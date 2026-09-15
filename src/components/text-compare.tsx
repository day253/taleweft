"use client";
import { useMemo, useState } from "react";
import { FileDiff, RotateCcw } from "lucide-react";
import { compareText } from "@/lib/text-diff";
import { type Segment } from "@/lib/project";
import { useStudio } from "@/lib/store";

export function TextCompare({ block }: { block: Segment }) {
  const restore = useStudio((s) => s.restoreOriginalText);
  const sourceText = useStudio((s) => s.project.sourceText);
  const [showSource, setShowSource] = useState(false);
  const diff = useMemo(
    () => compareText(block.original?.text ?? block.text, block.text),
    [block.original?.text, block.text],
  );
  if (!block.original)
    return (
      <div className="text-compare compare-unavailable">
        <FileDiff size={18} />
        <p>
          这个旧项目没有保存导入原文，无法追溯修改前的内容。新导入的文本会自动保留原文。
        </p>
      </div>
    );
  const changed = block.text !== block.original.text;
  return (
    <div className="text-compare">
      <div className="compare-heading">
        <strong>原文对照</strong>
        <span>
          {changed ? (
            <>
              <b className="diff-added">+{diff.added} 新增</b>
              <b className="diff-removed">−{diff.removed} 删除</b>
            </>
          ) : (
            "与原文一致"
          )}
        </span>
      </div>
      <div className="compare-columns">
        <section aria-label="原文版本">
          <h4>
            {block.original.kind === "import" ? "导入时的原文" : "示例原文"}
            <span>只读</span>
          </h4>
          <div className="compare-copy">
            {diff.changes
              .filter((c) => !c.added)
              .map((c, i) =>
                c.removed ? (
                  <del key={i}>{c.value}</del>
                ) : (
                  <span key={i}>{c.value}</span>
                ),
              )}
            {!block.original.text && <em>空文本</em>}
          </div>
        </section>
        <section aria-label="当前文本版本">
          <h4>
            当前文本<span>在上方正文直接编辑</span>
          </h4>
          <div className="compare-copy">
            {diff.changes
              .filter((c) => !c.removed)
              .map((c, i) =>
                c.added ? (
                  <ins key={i}>{c.value}</ins>
                ) : (
                  <span key={i}>{c.value}</span>
                ),
              )}
            {!block.text && <em>正文已清空</em>}
          </div>
        </section>
      </div>
      {diff.coarse && (
        <p className="compare-note">
          本段变化较大，按整段标示差异，保留两侧完整内容。
        </p>
      )}
      <footer>
        <span>原文固定保留 · 恢复只改文字，可撤销</span>
        <button
          className="secondary small"
          disabled={!changed}
          onClick={() => restore(block.id)}
        >
          <RotateCcw size={12} />
          恢复本段原文
        </button>
      </footer>
      {sourceText !== undefined && (
        <div className="import-source">
          <button
            className="quiet"
            aria-expanded={showSource}
            onClick={() => setShowSource(!showSource)}
          >
            {showSource ? "收起" : "查看"}完整导入原文
          </button>
          {showSource && <pre aria-label="完整导入原文">{sourceText}</pre>}
        </div>
      )}
    </div>
  );
}
