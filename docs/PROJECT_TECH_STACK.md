# 项目技术栈模板

> 基于岗位价值提升系统（FastAPI + Vue 3）整理，新建项目时可直接复用。

---

## 一、后端技术栈

| 技术/库 | 版本 | 说明 |
|---------|------|------|
| Python | 3.12+ | 运行环境 |
| FastAPI | 0.115.12 | Web 框架 |
| Uvicorn | 0.34.2 | ASGI 服务器 |
| SQLAlchemy | 2.0.27 | ORM |
| Pydantic | 2.10.6 | 数据校验 |
| Pydantic-Settings | 2.1.0 | 配置管理 |
| python-dotenv | 1.0.1 | 环境变量加载 |
| python-multipart | 0.0.7 | 文件上传支持 |
| python-jose[cryptography] | >=3.3.0 | JWT 认证 |
| requests | 2.31.0 | HTTP 请求 |
| pandas | 2.2.0 | 数据处理 |
| APScheduler | 3.10.4 | 定时任务 |
| PyMySQL | 1.1.0 | MySQL 驱动（生产可选） |
| lark-oapi | 1.4.5 | 飞书开放平台 SDK |

### 后端常用脚本

```bash
# 安装依赖
cd backend
pip install -r requirements.txt

# 启动开发服务器
python main.py

# 或使用 uvicorn 直接启动
uvicorn main:app --reload --port 8005
```

### 后端目录结构参考

```
backend/
├── main.py                  # 应用入口
├── config/settings.py       # 环境变量配置
├── requirements.txt         # Python 依赖
├── .env                     # 环境变量（不提交到仓库）
└── app/
    ├── api/                 # 路由接口
    ├── core/                # 核心模块（数据库、依赖注入）
    ├── models/              # SQLAlchemy ORM 模型
    ├── schemas/             # Pydantic 请求/响应模型
    ├── services/            # 业务服务层
    ├── utils/               # 工具客户端（LLM、飞书等）
    └── prompts/             # LLM 提示词模板
```

### 后端环境变量参考

```env
# 飞书应用
FEISHU_APP_CLIENT_ID=
FEISHU_APP_CLIENT_SECRET=

# 飞书项目
FEISHU_PROJECT_CLIENT_ID=
FEISHU_PROJECT_CLIENT_SECRET=
FEISHU_PROJECT_KEY=
FEISHU_PROJECT_USER_KEY=

# 大模型 API
ARK_API_KEY=               # 豆包 Ark
COZE_API_KEY=              # 扣子
SHIYUN_API_KEY=            # 诗云 DeepSeek

# 其他
FEISHU_MINUTE_TRANSCRIPT_TOKEN=
```

---

## 二、前端技术栈

| 技术/库 | 版本 | 说明 |
|---------|------|------|
| Vue | ^3.4.0 | 前端框架 |
| Vite | ^5.4.0 | 构建工具 |
| Vue Router | ^4.3.0 | 路由管理 |
| Pinia | ^3.0.4 | 状态管理 |
| Axios | ^1.7.0 | HTTP 请求 |
| @vitejs/plugin-vue | ^5.0.0 | Vite Vue 插件 |

### 前端常用脚本

```bash
# 安装依赖
cd frontend
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

### 前端目录结构参考

```
frontend/
├── package.json
├── vite.config.js
└── src/
    ├── main.js              # 应用入口
    ├── App.vue              # 根组件
    ├── router/index.js      # 路由配置
    ├── stores/              # Pinia 状态管理
    ├── api/                 # API 请求封装
    ├── views/               # 页面组件
    └── components/          # 公共组件
```

### Vite 配置参考

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 8006,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8005',
        changeOrigin: true,
      },
    },
  },
})
```

### Vue 入口参考

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

---

## 三、默认端口

| 服务 | 端口 |
|------|------|
| 后端 API | 8005 |
| 前端开发服务器 | 8006（Vite）/ 8004（文档示例） |

---

## 四、核心功能模块参考

### 后端路由组织方式

```python
# main.py 中注册路由示例
app.include_router(auth_router)
app.include_router(feishu_router, prefix="/api/feishu", tags=["飞书"])
app.include_router(chat_router, prefix="/api/chat", tags=["AI对话"])
app.include_router(department_router, prefix="/api/departments")
```

### 前端路由组织方式

```js
// router/index.js 示例
const routes = [
  { path: '/login', component: Login, meta: { guest: true } },
  { path: '/', redirect: '/home' },
  { path: '/home', component: Home, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to, from) => {
  const token = localStorage.getItem('access_token')
  if (to.meta.requiresAuth && !token) {
    return { name: 'Login' }
  }
})
```

### Pinia Store 参考

```js
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('access_token') || '',
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
    },
  },
})
```

---

## 五、外部集成服务

| 服务 | SDK/库 | 用途 |
|------|--------|------|
| 飞书开放平台 | lark-oapi | 云文档、多维表格、妙记、项目 |
| 豆包大模型 | requests（OpenAI 兼容） | 报告生成、AI 对话 |
| DeepSeek V4 | requests（OpenAI 兼容） | AI 对话 |
| 扣子 Coze | requests | 工作流触发 |

---

## 六、快速启动模板

### 1. 克隆/新建项目后

```bash
# 后端
cd backend
pip install -r requirements.txt
# 复制 .env.example 为 .env 并填写配置
python main.py

# 前端
cd frontend
npm install
npm run dev
```

### 2. 访问地址

- 前端页面: `http://localhost:8006`
- Swagger UI: `http://localhost:8005/docs`
- ReDoc: `http://localhost:8005/redoc`

---

## 七、项目脚本生成清单

> 新建项目后，向大模型发送「生成项目脚本」即可自动生成以下脚本。

### 1. `start.sh`（Linux/Mac 一键启动前后端）

放置于项目根目录。

```bash
#!/bin/bash
# 一键启动前后端开发服务

cd backend
python main.py &
BACKEND_PID=$!

cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Ctrl+C 同时关闭前后端
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
```

### 2. `start.bat`（Windows 一键启动前后端）

放置于项目根目录。

```bat
@echo off
chcp 65001 >nul
echo 正在启动后端...
start "backend" cmd /k "cd backend && python main.py"
echo 正在启动前端...
start "frontend" cmd /k "cd frontend && npm run dev"
echo 启动完成，关闭对应窗口即可停止服务
```

### 3. `stop.bat`（Windows 停止服务）

放置于项目根目录。

```bat
@echo off
taskkill /fi "windowtitle eq backend*" /f
taskkill /fi "windowtitle eq frontend*" /f
echo 服务已停止
pause
```

### 4. `.env.example`（后端环境变量模板）

放置于 `backend/` 目录，新建项目后复制为 `.env` 并填写实际值。

```env
# 飞书应用
FEISHU_APP_CLIENT_ID=
FEISHU_APP_CLIENT_SECRET=

# 飞书项目
FEISHU_PROJECT_CLIENT_ID=
FEISHU_PROJECT_CLIENT_SECRET=
FEISHU_PROJECT_KEY=
FEISHU_PROJECT_USER_KEY=

# 大模型 API
ARK_API_KEY=
COZE_API_KEY=
SHIYUN_API_KEY=

# 其他
FEISHU_MINUTE_TRANSCRIPT_TOKEN=
```

### 5. `install.sh`（Linux/Mac 依赖安装）

放置于项目根目录，创建 Python 虚拟环境并安装后端依赖。

```bash
#!/bin/bash

echo "=========================================="
echo "  项目依赖安装脚本"
echo "=========================================="
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查 Python 版本（按需调整，如 3.11/3.12）
PYTHON_BIN=python3.11
if ! command -v $PYTHON_BIN &> /dev/null; then
    echo "❌ 错误: 未找到 $PYTHON_BIN，请先安装"
    exit 1
fi

echo "✅ Python版本: $($PYTHON_BIN --version)"
echo ""

# 创建虚拟环境
echo "🔧 创建Python虚拟环境..."
if [ ! -d "venv" ]; then
    $PYTHON_BIN -m venv venv
    echo "✅ 虚拟环境创建完成"
else
    echo "ℹ️  虚拟环境已存在"
fi

# 激活虚拟环境并安装后端依赖
echo "🔧 安装后端依赖..."
source venv/bin/activate
cd backend
pip install --upgrade pip
pip install -r requirements.txt
echo "✅ 后端依赖安装完成"
cd ..

echo ""
echo "=========================================="
echo "  ✅ 依赖安装完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 检查 backend/.env 配置文件"
echo "2. 运行 ./start.sh 启动服务"
echo ""
```

### 6. `update.sh`（Linux/Mac 代码更新）

放置于项目根目录，停止服务后拉取最新代码。

```bash
#!/bin/bash

echo "=========================================="
echo "  项目代码更新脚本"
echo "=========================================="
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 获取当前分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📌 当前分支: $CURRENT_BRANCH"

# 停止服务（需配合 stop.sh 使用）
echo "🔴 停止服务..."
./stop.sh

# 拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin
git reset --hard origin/$CURRENT_BRANCH

echo ""
echo "=========================================="
echo "  ✅ 代码更新完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 如果需要重新安装依赖: ./install.sh"
echo "2. 启动服务: ./start.sh"
echo ""
```

### 7. `build.sh`（Linux/Mac 前端构建部署）

放置于项目根目录，构建前端并部署静态文件到目标目录。

```bash
#!/bin/bash

echo "=========================================="
echo "  前端构建部署脚本"
echo "=========================================="
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BUILD_OUTPUT_DIR="$FRONTEND_DIR/dist"
# 部署目标目录，按实际服务器路径修改
DEPLOY_DIR="/home/zhoubaolihui/frontend/dist"

echo "📂 前端源码目录: $FRONTEND_DIR"
echo "📂 构建输出目录: $BUILD_OUTPUT_DIR"
echo "📂 部署目标目录: $DEPLOY_DIR"
echo ""

if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ 错误: 前端源码目录不存在: $FRONTEND_DIR"
    exit 1
fi

cd "$FRONTEND_DIR" || exit 1

if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo ""

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install || exit 1
    echo "✅ 依赖安装完成"
else
    echo "ℹ️  node_modules 已存在，跳过安装"
fi

# 构建
echo "🔨 开始构建..."
npm run build
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
    echo "❌ 构建失败！退出码: $BUILD_EXIT"
    exit 1
fi

# 部署
echo "📁 部署静态文件到 $DEPLOY_DIR ..."
mkdir -p "$DEPLOY_DIR"
rm -rf "$DEPLOY_DIR"/*
cp -r "$BUILD_OUTPUT_DIR"/* "$DEPLOY_DIR/"

echo ""
echo "=========================================="
echo "  ✅ 前端构建并部署完成！"
echo "=========================================="
echo "静态文件目录: $DEPLOY_DIR"
echo ""
```

### 生成说明

- 脚本默认端口：后端 `8005`，前端 `8006`，与本文档一致
- `start.sh` / `start.bat` 同时拉起前后端，互不阻塞
- `.env.example` 为占位模板，需复制为 `.env` 后填写真实密钥
- `install.sh`：创建虚拟环境 + 安装后端依赖，Python 版本按实际调整
- `update.sh`：调用 `stop.sh` 停服后 `git reset --hard` 拉取最新代码
- `build.sh`：前端构建并复制到 `DEPLOY_DIR`，部署路径按服务器实际修改
- 脚本生成后需赋予执行权限：`chmod +x *.sh`（仅 Linux/Mac）
