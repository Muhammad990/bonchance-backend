import { Router } from 'express';
import {
  createWithdrawalOrder,
  getMyWithdrawalOrders,
  getWithdrawalOrders,
  editWithdrawalOrder,
  approveWithdrawalOrder,
  rejectWithdrawalOrder,
} from '../controllers/withdrawalOrderController.js';

const router = Router();

router.post('/', createWithdrawalOrder);
router.get('/my', getMyWithdrawalOrders);
router.get('/', getWithdrawalOrders);
router.put('/:id/edit', editWithdrawalOrder);
router.put('/:id/approve', approveWithdrawalOrder);
router.put('/:id/reject', rejectWithdrawalOrder);

export default router;