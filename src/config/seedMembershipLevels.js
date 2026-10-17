import MembershipLevel from '../models/MembershipLevel.js';

const DEFAULT_LEVELS = [
  {
    grade: 1,
    name: 'VIP1',
    picture: 'https://img.icons8.com/color/96/vip.png',
    dailyOrderVolume: '30',
    taskWheel: '',
    limitAmount: '10.00',
    lowestPriceOfGoods: '20.00',
    highestPriceOfGoods: '1,000,00.00',
    upgradeRewards: '0.00',
    price: '100000.00',
    minWithdrawalAmount: '1000.00',
    maxWithdrawalAmount: '10000000.00',
    withdrawalLimitCount: '10',
    withdrawalFeeRate: '0',
    orderCommissionRate: '0.01',
    gradeSalary: '$10.00',
    creationTime: '2023-01-20 15:37:37',
  },
  {
    grade: 2,
    name: 'VIP2',
    picture: 'https://img.icons8.com/color/96/vip.png',
    dailyOrderVolume: '35',
    taskWheel: '',
    limitAmount: '20000.00',
    lowestPriceOfGoods: '100000.00',
    highestPriceOfGoods: '1000000.00',
    upgradeRewards: '0.00',
    price: '200000.00',
    minWithdrawalAmount: '20000.00',
    maxWithdrawalAmount: '3000000.00',
    withdrawalLimitCount: '50',
    withdrawalFeeRate: '0',
    orderCommissionRate: '0.02',
    gradeSalary: '$0.00',
    creationTime: '2023-01-27 03:27:40',
  },
  {
    grade: 3,
    name: 'VIP3',
    picture: 'https://img.icons8.com/color/96/vip.png',
    dailyOrderVolume: '40',
    taskWheel: '',
    limitAmount: '30000.00',
    lowestPriceOfGoods: '500.00',
    highestPriceOfGoods: '1,000,000.00',
    upgradeRewards: '0.00',
    price: '300000.00',
    minWithdrawalAmount: '30,000.00',
    maxWithdrawalAmount: '60,000,000.00',
    withdrawalLimitCount: '0',
    withdrawalFeeRate: '0',
    orderCommissionRate: '0.04',
    gradeSalary: '$0.00',
    creationTime: '2023-02-07 16:53:06',
  },
];

export async function seedMembershipLevels() {
  const count = await MembershipLevel.countDocuments();
  if (count > 0) return;
  await MembershipLevel.insertMany(DEFAULT_LEVELS);
  console.log(`Seeded ${DEFAULT_LEVELS.length} default membership levels`);
}