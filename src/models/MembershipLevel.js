import mongoose from 'mongoose';

const membershipLevelSchema = new mongoose.Schema(
  {
    grade: {
      type: Number,
      required: [true, 'Grade is required'],
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    picture: {
      type: String,
      default: '',
    },
    dailyOrderVolume: { type: String, default: '' },
    taskWheel: { type: String, default: '' },
    limitAmount: { type: String, default: '' },
    lowestPriceOfGoods: { type: String, default: '' },
    highestPriceOfGoods: { type: String, default: '' },
    upgradeRewards: { type: String, default: '' },
    price: { type: String, default: '' },
    minWithdrawalAmount: { type: String, default: '' },
    maxWithdrawalAmount: { type: String, default: '' },
    withdrawalFeeRate: { type: String, default: '' },
    withdrawalLimitCount: { type: String, default: '' },
    orderCommissionRate: { type: String, default: '' },
    gradeSalary: { type: String, default: '' },
    creationTime: {
      type: String,
      required: [true, 'Creation time is required'],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('MembershipLevel', membershipLevelSchema);