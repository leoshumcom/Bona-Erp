import { Router, Request, Response } from 'express';

const router = Router();

// 登录
router.post('/login', (_req: Request, res: Response) => {
  res.json({ message: '登录接口 - 待实现' });
});

// 获取当前用户信息
router.get('/me', (_req: Request, res: Response) => {
  res.json({ message: '当前用户信息 - 待实现' });
});

// 退出登录
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: '退出登录 - 待实现' });
});

export default router;
