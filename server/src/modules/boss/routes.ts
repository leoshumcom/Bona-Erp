import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'boss', message: '老板端 - 待实现' });
});

export default router;
