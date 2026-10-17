import { Router } from 'express';
import {
  startOrder,
  completeOrder,
  getMyPendingOrder,
  getMyOrders,
  getOrders,
} from '../controllers/orderController.js';

const router = Router();

router.get('/', getOrders);
router.get('/my', getMyOrders);
router.get('/my-pending', getMyPendingOrder);
router.post('/start', startOrder);
router.post('/:id/complete', completeOrder);

export default router;