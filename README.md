# 博纳ERP (Bona ERP)

开源外贸ERP系统，五端架构覆盖**工厂、仓库、运营、售后、老板**全业务链路。基于赛狐ERP底座定制优化，专为跨境电商外贸企业打造。

## 系统架构

```
博纳ERP 五端架构

┌─────────────────────────────────────────────────────┐
│                    👤 老板端 (Boss)                   │
│         经营看板 · KPI · 利润分析 · 预警              │
└─────────────────────────────────────────────────────┘
                            ↑
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  🏭 工厂端    │ │  📦 仓库端    │ │  📊 运营端    │
│  模具·BOM    │ │  FIFO批次    │ │  订单·广告    │
│  生产工单    │ │  不可变账本   │ │  利润核算    │
│  成本归集    │ │  入库·出库   │ │  多店铺      │
└──────────────┘ └──────────────┘ └──────────────┘
                            ↑
┌─────────────────────────────────────────────────────┐
│                    🔧 售后端 (Aftersales)             │
│              售后工单 · 物流管理 · 退货处理            │
└─────────────────────────────────────────────────────┘
```

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + Vite + Ant Design 5 + ECharts + Zustand |
| **后端** | Express (本地) / Hono + Cloudflare Workers (生产) |
| **数据库** | SQLite (本地) / Cloudflare D1 (生产) |
| **ORM** | Prisma 5 + `@prisma/adapter-d1` |
| **认证** | JWT + bcryptjs |
| **校验** | Zod |
| **部署** | Cloudflare Workers + Pages + D1 |

## 快速开始

### 前置要求

- Node.js 18+
- npm 9+

### 1. 克隆仓库

```bash
git clone https://github.com/leoshumcom/Bona-Erp.git
cd Bona-Erp
```

### 2. 启动后端

```bash
cd server

# 安装依赖
npm install

# 复制环境变量模板（默认SQLite，无需额外配置）
cp .env.example .env

# 初始化数据库
npx prisma db push
npm run db:seed

# 启动开发服务器
npm run dev
```

后端运行在 `http://localhost:3000`

### 3. 启动前端（可选）

```bash
cd client
npm install
npm run dev
```

前端运行在 `http://localhost:5173`

### 4. 默认账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | `admin` | `admin123` |
| 老板 | `boss` | `test123` |
| 工厂经理 | `factory` | `test123` |
| 仓库经理 | `warehouse` | `test123` |
| 运营主管 | `operator` | `test123` |
| 售后专员 | `aftersales` | `test123` |
| 查看者 | `viewer` | `test123` |

## 模块与API

### Auth 认证
`/api/auth`
- `POST /login` - 登录
- `POST /register` - 注册
- `GET /profile` - 用户信息

### Admin 管理
`/api/admin`
- 用户管理 CRUD · 产品管理 CRUD · 公司管理 CRUD
- 店铺管理 CRUD · 供应商管理 CRUD · 仓库/库位管理
- 审计日志查询 · CSV数据导出

### Factory 工厂端
`/api/factory`
- 模具管理（CRUD + 费用记录 + 折旧摊销）
- BOM管理（版本化物料清单 + 激活/复制）
- 生产工单（DRAFT → RELEASED → IN_PROGRESS → COMPLETED 状态流转）
- 成本核算（工单成本归集 + 产品分解 + 固定费用）

### Warehouse 仓库端
`/api/warehouse`
- 入库（生产入库 / 采购入库 / 售后退货 / 期初导入）
- 出库（生产领料 / 销售出库 / 退料入库）
- 盘点（计划创建 + 差异调整）
- 查询（FIFO批次库存余额 / 不可变库存流水 / 批次追踪）
- 仓储费用（租金 / 耗材 / 薪资 / 管理费 录入与汇总）

### Operation 运营端
`/api/operation`
- 订单管理（多店铺订单 + 批量导入 + 费用记录）
- 广告管理（活动CRUD + 花费汇总 + ROAS分析）
- 利润核算（单品利润 / 汇总 / 按店铺 / 按产品）

### Aftersales 售后端
`/api/aftersales`
- 售后工单（退款 / 退货退款 / 换货 / 投诉 / 维修 / 补发）
- 物流管理（头程→国际→尾程 五段运费 + 运单追踪）

### Boss 老板端
`/api/boss`
- 每日经营快照 · 收入趋势 · 店铺业绩排名
- 产品盈利能力 · 成本结构分析 · KPI指标 · 业务预警

## 全链路利润公式

```
单SKU订单利润 = 销售收入
  - 生产成本（BOM物料 + 模具折旧 + 人工/水电/管理）
  - 仓储成本（租金/耗材/薪资 × SKU库存占比分摊）
  - 平台佣金（平台费率 × 销售额）
  - 广告费（广告花费 ÷ 同期订单数）
  - 物流费（头程 + 国际 + 尾程）
  - 售后损耗（退款 + 赔偿 + 货损）
```

## 核心特性

- **FIFO批次成本核算** — 库存出库严格按先进先出，22个单元测试覆盖
- **不可变库存账本** — 每笔库存变动永久记录，Balance由聚合计算
- **BOM版本化** — 物料清单支持多版本并存，切换版本不丢失历史
- **7角色权限体系** — ADMIN / BOSS / FACTORY_MANAGER / WAREHOUSE_MANAGER / OPERATOR / AFTERSALES / VIEWER

## 部署到Cloudflare

### 前置条件

1. Cloudflare 账号
2. API Token（D1 Edit + Workers Scripts Edit 权限）

### 部署步骤

```bash
cd server

# 1. 配置环境变量
export CLOUDFLARE_API_TOKEN="你的API Token"

# 2. 创建D1数据库
npx wrangler d1 create bona-erp-db

# 3. 更新 wrangler.toml 中的 database_id（从上一步输出获取）

# 4. 生成SQL迁移并初始化D1
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/d1-migration.sql
npx wrangler d1 execute bona-erp-db --file=prisma/d1-migration.sql

# 5. 设置生产环境密钥
npx wrangler secret put JWT_SECRET

# 6. 部署Worker
npx wrangler deploy

# 7. (可选) 部署前端到Cloudflare Pages
cd ../client
npm run build
npx wrangler pages deploy dist --project-name=bona-erp
```

### 绑定自定义域名

在 Cloudflare Dashboard → Workers & Pages → Triggers → Custom Domains 添加域名（如 `Erp.Bona6.com`）

## 项目结构

```
Bona-Erp/
├── client/                     # React 前端
│   ├── src/
│   │   ├── pages/              # 页面（工厂/仓库/运营/售后/老板）
│   │   ├── services/api.ts    # API 封装
│   │   └── stores/            # Zustand 状态管理
│   └── vite.config.ts
├── server/                     # 后端服务
│   ├── prisma/
│   │   ├── schema.prisma       # 54个数据模型
│   │   └── seed.ts             # 种子数据
│   ├── src/
│   │   ├── common/             # 公共（Prisma/JWT/中间件）
│   │   ├── modules/            # 业务模块
│   │   │   ├── auth/           # 认证
│   │   │   ├── admin/          # 管理
│   │   │   ├── factory/        # 工厂
│   │   │   ├── warehouse/      # 仓库
│   │   │   ├── operation/      # 运营
│   │   │   ├── aftersales/     # 售后
│   │   │   └── boss/           # 老板
│   │   ├── index.ts            # Express入口
│   │   └── worker.ts           # Cloudflare Workers入口
│   ├── wrangler.toml           # Workers配置
│   └── vitest.config.ts
└── .gitignore
```

## 运行测试

```bash
cd server
npm test                # 运行全部测试
npm run test:watch      # 监听模式
npm run test:coverage   # 覆盖率报告
```

## License

MIT
