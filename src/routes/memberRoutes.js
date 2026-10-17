import { Router } from 'express';
import {
  getMembers,
  createMember,
  deleteMember,
  updateMember,
  adjustBalance,
  updateCommission,
  updateMemberPasswords,
  updateMemberState,
} from '../controllers/memberController.js';
import {
  getMemberOrderSetting,
  saveMemberOrderSetting,
  resetMemberOrderSetting,
} from '../controllers/memberOrderSettingController.js';

const router = Router();

router.get('/', getMembers);
router.post('/', createMember);
router.put('/:id', updateMember);
router.put('/:id/balance', adjustBalance);
router.put('/:id/commission', updateCommission);
router.put('/:id/password', updateMemberPasswords);
router.put('/:id/state', updateMemberState);
router.delete('/:id', deleteMember);
router.get('/:id/order-setting', getMemberOrderSetting);
router.post('/:id/order-setting', saveMemberOrderSetting);
router.post('/:id/order-setting/reset', resetMemberOrderSetting);

export default router;
