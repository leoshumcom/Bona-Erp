import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { prisma } from './common/prisma';

dotenv.config();

const app = express();

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

// 路由注册
import authRoutes from './modules/auth';
app.use('/api/auth', authRoutes);
import factoryRoutes from './modules/factory';
app.use('/api/factory', factoryRoutes);
import warehouseRoutes from './modules/warehouse/routes';
app.use('/api/warehouse', warehouseRoutes);
import operationRoutes from './modules/operation';
app.use('/api/operation', operationRoutes);
import aftersalesRoutes from './modules/aftersales';
app.use('/api/aftersales', aftersalesRoutes);
import bossRoutes from './modules/boss';
app.use('/api/boss', bossRoutes);
import adminRoutes from './modules/admin';
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`博纳ERP服务已启动: http://localhost:${PORT}`);
});

export default app;
