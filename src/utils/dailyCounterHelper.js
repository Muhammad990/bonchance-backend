const pad = (n) => String(n).padStart(2, '0');

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Today profit daily reset hota hai, lekin task status / order count reset
// nahi hota. Order count sirf admin ke manual reset par 0 hoga.
export const syncDailyCounters = (member) => {
  const today = todayKey();
  if (member.taskStatusDate !== today) {
    member.todayProfit = 0;
    member.taskStatusDate = today;
  }
};

export const syncDailyCountersAsync = async (member) => {
  syncDailyCounters(member);
};
