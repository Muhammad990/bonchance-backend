import Member from '../models/Member.js';
import MembershipLevel from '../models/MembershipLevel.js';
import SiteSetting from '../models/SiteSetting.js';
import { logWalletTransaction } from '../utils/walletLogger.js';
import { parseLevelNumber } from '../utils/membershipLevelHelper.js';

const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

export const creditGradeSalaries = async () => {
  const setting = await SiteSetting.getGeneral();
  const today = dateKey(new Date());
  if (setting.gradeSalaryLastDate === today) {
    return { credited: 0, alreadyDone: true };
  }

  const levels = await MembershipLevel.find().lean();
  const levelMap = new Map(levels.map((level) => [level.name, level]));

  const members = await Member.find().lean();
  let credited = 0;

  for (const member of members) {
    const level = levelMap.get(member.vipLevel);
    if (!level) continue;

    const salary = parseLevelNumber(level.gradeSalary);
    if (!Number.isFinite(salary) || salary <= 0) continue;

    const before = Math.round((Number(member.availableFunds) || 0) * 100) / 100;
    const after = Math.round(before * 100 + salary * 100) / 100;

    await Member.updateOne({ _id: member._id }, { $set: { availableFunds: after } });

    await logWalletTransaction({
      member,
      before,
      after,
      description: 'Daily grade salary',
    });

    credited += 1;
  }

  setting.gradeSalaryLastDate = today;
  await setting.save();

  return { credited, alreadyDone: false };
};