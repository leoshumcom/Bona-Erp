import { Router } from 'express';

const router = Router();

// 模具管理
// router.use('/mold', moldRoutes);
// 材料管理
// router.use('/material', materialRoutes);
// 生产成本
// router.use('/cost', costRoutes);

router.get('/', (_req, res) => {
  res.json({ module: 'factory', message: '工厂端 - 待实现' });
});

export default router;
