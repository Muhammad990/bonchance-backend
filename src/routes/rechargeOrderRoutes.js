import { Router } from 'express';
import {
  createRechargeOrder,
  getMyRechargeOrders,
  getRechargeOrders,
  approveRechargeOrder,
} from '../controllers/rechargeOrderController.js';

const router = Router();

router.post('/', createRechargeOrder);
router.get('/my', getMyRechargeOrders);
router.get('/', getRechargeOrders);
router.put('/:id/approve', approveRechargeOrder);

export default router;