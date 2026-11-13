import mongoose from 'mongoose';

const withdrawalOrderSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      required: [true, 'Member ID is required'],
    },
    username: {
      type: String,
      required: [true, 'User name is required'],
    },
    superiorId: {
      type: String,
      default: '',
    },
    method: {
      type: String,
      enum: ['Bank Card', 'USDT', 'Wise', 'Revolut'],
      required: [true, 'Withdrawal method is required'],
    },
    bankInformation: {
      type: String,
      default: '',
    },
    withdrawalAmount: {
      type: Number,
      required: [true, 'Withdrawal amount is required'],
      min: [0, 'Withdrawal amount cannot be negative'],
    },
    handlingFee: {
      type: Number,
      default: 0,
      min: [0, 'Handling fee cannot be negative'],
    },
    fundsDeducted: {
      type: Boolean,
      default: false,
    },
    state: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    reviewInformation: {
      type: String,
      default: '',
    },
    creationTime: {
      type: String,
      required: [true, 'Creation time is required'],
    },
    processingTime: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('WithdrawalOrder', withdrawalOrderSchema);