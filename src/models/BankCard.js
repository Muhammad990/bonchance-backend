import mongoose from 'mongoose';

const bankCardSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
    },
    superiorId: {
      type: String,
      default: '',
    },
    phoneNumber: {
      type: String,
      default: '',
    },
    bankName: {
      type: String,
      default: '',
      trim: true,
    },
    accountNumber: {
      type: String,
      default: '',
      trim: true,
    },
    accountHolderName: {
      type: String,
      default: '',
      trim: true,
    },
    branch: {
      type: String,
      default: '',
      trim: true,
    },
    usdtAddress: {
      type: String,
      default: '',
      trim: true,
    },
    usdtProtocol: {
      type: String,
      default: 'ERC20',
      trim: true,
    },
    usdtFullName: {
      type: String,
      default: '',
      trim: true,
    },
    wiseEmail: {
      type: String,
      default: '',
      trim: true,
    },
    wiseFullName: {
      type: String,
      default: '',
      trim: true,
    },
    revolutWallet: {
      type: String,
      default: '',
      trim: true,
    },
    revolutFullName: {
      type: String,
      default: '',
      trim: true,
    },
    time: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('BankCard', bankCardSchema);