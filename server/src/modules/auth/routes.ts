import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../common/middleware';
import { success, error } from '../../common/response';
import * as s from './schemas';
import * as authService from './services/authService';

const router = Router();

/** 提取 Zod 校验错误信息 */
function getValidationErrors(result: { success: false; error: any }) {
  return result.error.issues?.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

// POST /login - 登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = s.loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }

    const result = await authService.login(parsed.data.username, parsed.data.password);
    res.json(success(result, '登录成功'));
  } catch (err: any) {
    if (err.message === '用户名或密码错误') {
      return res.status(401).json(error(err.message, 401));
    }
    if (err.message === '账号已被禁用，请联系管理员') {
      return res.status(403).json(error(err.message, 403));
    }
    res.status(500).json(error(err.message || '登录失败', 500));
  }
});

// POST /register - 注册（公开接口）
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = s.registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }

    const result = await authService.register(parsed.data);
    res.status(201).json(success(result, '注册成功'));
  } catch (err: any) {
    if (err.message === '用户名已存在') {
      return res.status(409).json(error(err.message, 409));
    }
    if (err.message?.includes('请先创建公司')) {
      return res.status(400).json(error(err.message, 400));
    }
    res.status(500).json(error(err.message || '注册失败', 500));
  }
});

// GET /profile - 获取当前用户信息（需认证）
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await authService.getProfile(req.userId!);
    res.json(success(user, '查询成功'));
  } catch (err: any) {
    if (err.message === '用户不存在') {
      return res.status(404).json(error(err.message, 404));
    }
    res.status(500).json(error(err.message || '获取用户信息失败', 500));
  }
});

export default router;
