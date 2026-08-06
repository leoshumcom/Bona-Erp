import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'aftersales', message: '售后端 - 待实现' });
});

export default router;
