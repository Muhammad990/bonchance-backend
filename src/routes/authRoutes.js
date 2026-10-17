import { Router } from 'express';
import {
  register,
  login,
  adminLogin,
  appRegister,
  appLogin,
  getMe,
  changePassword,
  adminChangePassword,
  markRejectionSeen,
} from '../controllers/authController.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = Router();

router.post(
  '/register',
  validate({
    name: { required: true, maxLength: 50 },
    email: { required: true, isEmail: true },
    password: { required: true, minLength: 6, maxLength: 50 },
  }),
  register
);

router.post('/login', validate({ email: { required: true, isEmail: true }, password: { required: true } }), login);

router.post(
  '/admin-login',
  validate({ username: { required: true, maxLength: 50 }, password: { required: true } }),
  adminLogin
);

router.post('/app-register', appRegister);
router.post('/app-login', appLogin);
router.get('/me', getMe);
router.put('/change-password', changePassword);
router.put('/admin-change-password', adminChangePassword);
router.post('/mark-rejection-seen', markRejectionSeen);

export default router;
