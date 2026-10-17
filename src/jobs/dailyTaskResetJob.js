import Member from '../models/Member.js';
import SiteSetting from '../models/SiteSetting.js';
import { todayKey } from '../utils/dailyCounterHelper.js';

// Har naye din sabhi members ka task status / today profit 0 kar deta hai,
// taake admin member list bhi reset value dikhaye bina kisi member activity ke.
export const resetDailyTaskStatus = async () => {
  const setting = await SiteSetting.getGeneral();
  const today = todayKey();
  if (setting.taskStatusResetDate === today) {
    return { reset: 0, alreadyDone: true };
  }

  const result = await Member.updateMany(
    { $or: [{ taskStatus: { $ne: 0 } }, { taskStatusDate: { $ne: today } }] },
    { $set: { taskStatus: 0, taskStatusDate: today } }
  );

  setting.taskStatusResetDate = today;
  await setting.save();

  return { reset: result.modifiedCount || 0, alreadyDone: false };
};