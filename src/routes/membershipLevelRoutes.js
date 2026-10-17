import { Router } from 'express';
import {
  getMembershipLevels,
  createMembershipLevel,
  updateMembershipLevel,
  deleteMembershipLevel,
} from '../controllers/membershipLevelController.js';

const router = Router();

router.get('/', getMembershipLevels);
router.post('/', createMembershipLevel);
router.put('/:id', updateMembershipLevel);
router.delete('/:id', deleteMembershipLevel);

export default router;