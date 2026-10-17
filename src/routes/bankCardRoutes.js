import { Router } from 'express';
import {
  getBankCards,
  getMyBankCard,
  saveMyBankCard,
  updateBankCard,
} from '../controllers/bankCardController.js';

const router = Router();

router.get('/', getBankCards);
router.get('/my', getMyBankCard);
router.post('/my', saveMyBankCard);
router.put('/:id', updateBankCard);

export default router;
