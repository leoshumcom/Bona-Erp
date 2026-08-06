import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'warehouse', message: '仓库端 - 待实现' });
});

export default router;
