import MembershipLevel from '../models/MembershipLevel.js';

export const parseLevelNumber = (value) => {
  const cleaned = String(value == null ? '' : value).replace(/[$,\s]/g, '').trim();
  if (!cleaned) return NaN;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
};

export const getLevelLimits = async (vipLevel) => {
  const level = await MembershipLevel.findOne({ name: vipLevel }).lean();
  if (!level) return null;
  return {
    depositMin: parseLevelNumber(level.lowestPriceOfGoods),
    depositMax: parseLevelNumber(level.highestPriceOfGoods),
    minWithdrawal: parseLevelNumber(level.minWithdrawalAmount),
    maxWithdrawal: parseLevelNumber(level.maxWithdrawalAmount),
    withdrawalFeeRate: parseLevelNumber(level.withdrawalFeeRate),
    withdrawalLimitCount: parseLevelNumber(level.withdrawalLimitCount),
    gradeSalary: parseLevelNumber(level.gradeSalary),
    orderCommissionRate: parseLevelNumber(level.orderCommissionRate),
  };
};