import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    superiorId: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['Income', 'Expenditure'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    before: {
      type: Number,
      required: true,
    },
    after: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    time: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('WalletTransaction', walletTransactionSchema);