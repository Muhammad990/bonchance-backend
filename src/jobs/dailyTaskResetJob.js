// Daily task status auto-reset ab nahi hota. Order count / task status sirf
// admin ke manual "Reset Order" action par reset hoga.
export const resetDailyTaskStatus = async () => {
  return { reset: 0, alreadyDone: true, disabled: true };
};
