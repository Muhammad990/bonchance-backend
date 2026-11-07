import Order from '../models/Order.js';

const pad = (n) => String(n).padStart(2, '0');

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Task status / today profit daily reset — agar naye din mein abhi tak reset
// nahi hua to counters ko 0 kar do. Caller save tab kare jab isModified ho.
export const syncDailyCounters = (member) => {
  const today = todayKey();
  if (member.taskStatusDate !== today) {
    member.taskStatus = 0;
    member.todayProfit = 0;
    member.taskStatusDate = today;
  }
};

// Async version of daily counter reconciliation helper that counts today's completed orders for accurate task status.
export const syncDailyCountersAsync = async (member) => {
  const today = todayKey();
  if (member.taskStatusDate !== today) {
    member.taskStatus = 0;
    member.todayProfit = 0;
    member.taskStatusDate = today;
  }

  const completedOrders = await Order.find({
    memberId: member.memberId,
    transactionStatus: 'Complete payment',
    settlementTime: { $regex: `^${today}` },
  }).lean();

  const completedCount = completedOrders.length;
  if ((member.taskStatus || 0) !== completedCount) {
    member.taskStatus = completedCount;
  }
};