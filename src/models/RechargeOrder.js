import mongoose from 'mongoose';

const rechargeOrderSchema = new mongoose.Schema(
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
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
    },
    cardNumber: {
      type: String,
      required: [true, 'Card number is required'],
      trim: true,
    },
    accountHolderName: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
    },
    rechargeAmount: {
      type: Number,
      required: [true, 'Recharge amount is required'],
      min: [0, 'Recharge amount cannot be negative'],
    },
    paymentVoucher: {
      type: String,
      default: 'none',
    },
    state: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
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

export default mongoose.model('RechargeOrder', rechargeOrderSchema);