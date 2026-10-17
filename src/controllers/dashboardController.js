import Member from '../models/Member.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import RechargeOrder from '../models/RechargeOrder.js';
import WithdrawalOrder from '../models/WithdrawalOrder.js';
import WalletTransaction from '../models/WalletTransaction.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const pad = (n) => String(n).padStart(2, '0');

const todayPrefix = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const sum = (arr, key) => arr.reduce((s, item) => s + Number(item[key] || 0), 0);

const dayOf = (dt) => String(dt || '').slice(0, 10);

// Single date ("date") ya range ("start" + "end") — dono support.
// Selection window inclusive hai: start 00:00:00 se end 23:59:59 tak.
// Date strings YYYY-MM-DD ke format ki wajah se lexicographic compare valid hai.
const buildWindow = (query) => {
  const single =
    query.date && String(query.date).trim() ? String(query.date).trim() : '';
  const rawStart = (query.start && String(query.start).trim()) || single;
  const rawEnd = (query.end && String(query.end).trim()) || single;
  let start = rawStart || todayPrefix();
  let end = rawEnd || start;
  if (end < start) [start, end] = [end, start];
  return {
    start,
    end,
    timeRange: { $gte: `${start} 00:00:00`, $lte: `${end} 23:59:59` },
  };
};

export const getDashboardStats = asyncHandler(async (req, res) => {
  // Selected window (default = today)
  const { start, end, timeRange } = buildWindow(req.query);

  // Official user = Regular User (Test/Proxy excluded)
  const officialMembers = await Member.find({ userType: 'Regular User' }).select(
    'memberId registrationTime'
  );
  const officialIds = officialMembers.map((m) => m.memberId);

  // 1. Total users (other than test user)
  const totalUsers = await Member.countDocuments({ userType: { $ne: 'Test User' } });

  // 2. Total number of products
  const totalProducts = await Product.countDocuments();

  // 3. Total orders placed by official users
  const totalOfficialOrders = await Order.countDocuments({ memberId: { $in: officialIds } });

  // 4. Total completed order amount (official users)
  const completedOrders = await Order.find({
    memberId: { $in: officialIds },
    transactionStatus: 'Complete payment',
  }).select('transactionAmount');
  const completedOrderAmount = sum(completedOrders, 'transactionAmount');

  // 5. Window's total number of test users (registered in range)
  const todayTestUsers = await Member.countDocuments({
    userType: 'Test User',
    registrationTime: timeRange,
  });

  // 7. Window's official users registered
  const registeredInRange = officialMembers.filter(
    (m) => dayOf(m.registrationTime) >= start && dayOf(m.registrationTime) <= end
  );
  const registeredInRangeIds = new Set(
    registeredInRange.map((m) => m.memberId)
  );
  const todayOfficialRegistered = registeredInRange.length;

  // Window's approved recharges / withdrawals (official only)
  const dayRecharges = await RechargeOrder.find({
    memberId: { $in: officialIds },
    creationTime: timeRange,
    state: 'Approved',
  });
  const dayWithdrawals = await WithdrawalOrder.find({
    memberId: { $in: officialIds },
    creationTime: timeRange,
    state: 'Approved',
  });

  // 8. Window's official recharge amount
  const todayOfficialRechargeAmount = sum(dayRecharges, 'rechargeAmount');

  // 9. Window's official withdrawal amount
  const todayWithdrawAmount = sum(dayWithdrawals, 'withdrawalAmount');

  // 6. Users who REGISTERED in window AND DEPOSITED in the same window.
  // Deposit = recharge order (koi bhi state, user panel) OR admin balance add.
  const dayAllRecharges = await RechargeOrder.find({
    memberId: { $in: officialIds },
    creationTime: timeRange,
  }).select('memberId rechargeAmount');

  const dayBalanceAdds = await WalletTransaction.find({
    memberId: { $in: officialIds },
    type: 'Income',
    description: 'Balance adjustment (add)',
    time: timeRange,
  }).select('memberId amount');

  const depositByMember = new Map();
  for (const r of dayAllRecharges) {
    depositByMember.set(
      r.memberId,
      (depositByMember.get(r.memberId) || 0) + Number(r.rechargeAmount || 0)
    );
  }
  for (const t of dayBalanceAdds) {
    depositByMember.set(
      t.memberId,
      (depositByMember.get(t.memberId) || 0) + Number(t.amount || 0)
    );
  }

  let firstTimeRechargeCount = 0;
  let firstTimeRechargeAmount = 0;
  for (const [memberId, amount] of depositByMember.entries()) {
    if (registeredInRangeIds.has(memberId)) {
      firstTimeRechargeCount += 1;
      firstTimeRechargeAmount += amount;
    }
  }

  // 10. Window's deposit - withdrawal difference
  const depositWithdrawDiff = todayOfficialRechargeAmount - todayWithdrawAmount;

  res.status(200).json(
    new ApiResponse(200, 'Dashboard statistics fetched successfully', {
      date: start === end ? start : `${start} - ${end}`,
      start,
      end,
      totalUsers,
      totalProducts,
      totalOfficialOrders,
      completedOrderAmount,
      todayTestUsers,
      firstTimeRechargeCount,
      firstTimeRechargeAmount,
      todayOfficialRegistered,
      todayOfficialRechargeAmount,
      todayWithdrawAmount,
      depositWithdrawDiff,
    })
  );
});

export default { getDashboardStats };