# TaleWeft for DeepSeek Harness

让 dsh Agent 读取当前章节、选中文字、角色和音轨，并向 TaleWeft 编辑器提出可预览、可拒绝、可撤销的局部修改。

适配 `@deepseek-ai/dsh 0.1.5-rc.2`，需要 Node.js 22.18+。模型在 dsh 中配置；此插件不包含模型密钥或音频生成服务。

## 安装与运行

在 TaleWeft 仓库根目录构建插件并打包：

```sh
npm ci
npm run build:dsh
cd plugins/dsh
npm pack
dsh plugin --profile web add ./day253-dsh-taleweft-0.1.0.tgz
```

启动编辑器和 dsh 时，让二者使用同一个绝对路径：

```sh
export TALEWEFT_BRIDGE_DIR=/absolute/path/to/taleweft/.taleweft/bridge
# TaleWeft 仓库根目录
npm run build
npm run start:lan
# 另一个终端，设置相同的 TALEWEFT_BRIDGE_DIR
dsh web --no-open --port 3080
```

也可在 dsh 插件配置中设置 `bridgeDirectory`。dsh 与 Next.js 服务须运行在同一台机器并共享该目录；浏览器可以通过局域网连接编辑器。

## 交互

1. 在编辑器选中片段，点击顶部 **dsh → 连接 dsh**。
2. 复制面板中的上下文指令到 dsh，补上要求，例如“只把选中这句改得更紧张，停顿改成 0.8 秒”。
3. dsh 调用工具读取当前版本，提出修改建议。编辑器中显示修改前后文本和参数。
4. 点击 **应用修改** 或 **拒绝**。应用后可用编辑器顶部撤销恢复。
5. 可让 dsh 查询建议状态；继续手动编辑会使旧建议失效，Agent 需重新读取上下文。

工具包括 `taleweft_list_workspaces`、`taleweft_get_context`、`taleweft_propose_edit` 和 `taleweft_proposal_status`。支持修改片段文本、角色分配、语气、语速、停顿、角色设定以及已有声音素材的锚点、位置、长度、音量；尚不支持创建章节、创建素材或生成真实音频。

原始导入文本和生成来源快照不可通过修改工具覆盖。`applied` 表示建议曾被应用；用户之后可能撤销，需重新读取当前上下文判断最终内容。

## 数据与验证

连接后，当前作品会缓存到本机 bridge 目录；Agent 调用读取工具时，相应章节与角色信息会进入 dsh 配置的模型上下文。关闭网页后连接会过期，缓存文件仍保留在本机。停止服务后可删除 bridge 目录清理缓存。密钥使用 dsh 自己的凭据存储，不进入插件或前端。

桥接文件使用原子替换和进程锁；每次建议检查作品 ID 与版本，浏览器应用时再次检查。每个建议作为一次撤销操作。关闭连接和心跳按顺序写入，避免旧心跳覆盖断开状态。

```sh
npm test
npm run typecheck
npm run build:dsh
node --import tsx scripts/verify-dsh.mjs /path/to/dsh-installation
```

最后一个检查使用真实 dsh 工具注册器验证四个工具、输入校验和取消，不会调用模型。
