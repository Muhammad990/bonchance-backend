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