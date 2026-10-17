import { Router } from 'express';
import { getWalletTransactions } from '../controllers/walletTransactionController.js';

const router = Router();

router.get('/', getWalletTransactions);

export default router;