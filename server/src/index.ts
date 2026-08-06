import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
export const prisma = new PrismaClient();

// 中间件
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 路由注册（后续按模块挂载）
// app.use('/api/auth', authRoutes);
// app.use('/api/factory', factoryRoutes);
// app.use('/api/warehouse', warehouseRoutes);
// app.use('/api/operation', operationRoutes);
// app.use('/api/aftersales', aftersalesRoutes);
// app.use('/api/boss', bossRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`博纳ERP服务已启动: http://localhost:${PORT}`);
});

export default app;
