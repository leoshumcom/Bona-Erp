import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'platform', message: '平台对接 - 待实现' });
});

export default router;
