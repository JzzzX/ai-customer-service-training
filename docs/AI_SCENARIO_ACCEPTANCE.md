# AI 情景对话公司环境验收

本清单用于根 Next.js + SQLite 应用在公司内网的真实 AI 验收。它不包含部署动作，也不以 Mock 或本地代码测试替代线上修复结论。

## 发布前记录

在目标服务器、切换服务前记录以下事实，并随本次发布单保存：

```bash
cd /opt/ai-customer-service-training
git rev-parse HEAD
cat .next/BUILD_ID
pgrep -af 'next-server|next start'
systemctl status ai-customer-service-training --no-pager
sudo -u ai-training pnpm db:verify
```

- 记录 Git SHA、`BUILD_ID`、精确 Node 进程 PID/启动参数、systemd 状态和 SQLite 校验结果。
- 只允许一个连接持久 SQLite 的 Node 实例；`SQLITE_PATH` 必须是 `ai-training` 可写的持久路径。
- 不在命令行、工单或日志中记录网关密钥、OAuth token、完整提示词或学员对话。

## 网关和流式预检

先加载服务器环境文件但不要输出其内容，再执行：

```bash
set -a
. /etc/ai-customer-service-training/app.env
set +a
pnpm ai:verify
sudo nginx -t
curl --fail http://127.0.0.1:3001/api/ready
curl --fail http://127.0.0.1:35769/api/ready
```

确认正式配置为 `DEMO_MODE=false` 与 `SCENARIO_AI_MODE=real`。预检失败时按认证、限流、超时、网络、上游、空响应或无效响应处理；不得把失败请求降级为 Mock 成功。

报告接口 `/api/scenario/complete/:sessionId` 的 Nginx 配置必须关闭代理缓冲与缓存、设置 `X-Accel-Buffering: no`，并允许 300 秒读写等待。应用侧对话请求上限为 60 秒、报告请求上限为 180 秒；报告 SSE 首帧立即发出且每 15 秒发送心跳。

## 三轮真实对话验收

使用已获授权的飞书测试账号，连续完成三次独立真实 AI 训练。每次至少完成三轮上下文对话，并主动结束生成报告：

1. 确认对话回复在 60 秒内返回，且没有重复顾客回复。
2. 确认报告页在 180 秒内完成；浏览器网络面板能看到 SSE 首帧和不超过 15 秒间隔的心跳/数据帧。
3. 在一次报告生成中关闭页面或取消请求，确认没有继续写入报告；重新进入后可安全重试。
4. 针对网关受控失败，确认页面仅显示脱敏分类消息，不显示密钥、URL、供应商原文或学员内容。
5. 成功后刷新页面，确认同一会话只有一份报告；重复请求复用已完成报告，不重复写入。

## 日志和结论

验收后读取最小时间窗日志并按内部会话 ID / 请求 ID 检索：

```bash
journalctl -u ai-customer-service-training --since '-30 min' --no-pager
```

日志应只有 route、operation、内部资源 ID、错误类别、状态码/错误码等结构化字段；不得包含秘密或业务对话正文。记录三次训练的时间、会话内部 ID、结果与异常类别。

只有 SHA、BUILD_ID、单实例/SQLite、网关预检、Nginx、日志和连续三次真实 AI 对话均完成后，才能标记为“目标环境已验收”。`pnpm test`、`pnpm check`、Mock E2E 或本地成功仅说明代码层健康，**不等于线上问题已修复**。
