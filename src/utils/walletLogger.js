import WalletTransaction from '../models/WalletTransaction.js';

const pad = (n) => String(n).padStart(2, '0');

const formatDateTime = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export const logWalletTransaction = async ({ member, before, after, description = '' }) => {
  const type = after >= before ? 'Income' : 'Expenditure';
  const amount = Math.round(Math.abs(after - before) * 100) / 100;

  await WalletTransaction.create({
    memberId: member.memberId,
    username: member.nickname,
    superiorId: member.superiorId || '',
    type,
    amount,
    before: Math.round(before * 100) / 100,
    after: Math.round(after * 100) / 100,
    description,
    time: formatDateTime(new Date()),
  });
};