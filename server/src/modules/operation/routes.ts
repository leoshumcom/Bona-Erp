import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'operation', message: '运营端 - 待实现' });
});

export default router;
