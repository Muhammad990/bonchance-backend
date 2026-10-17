import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      trim: true,
    },
    memberId: {
      type: String,
      required: [true, 'Member ID is required'],
      index: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
    },
    userNickname: {
      type: String,
      default: '',
      trim: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    superiorId: {
      type: String,
      default: '',
      trim: true,
    },
    productId: {
      type: String,
      default: '',
    },
    productName: {
      type: String,
      default: '',
      trim: true,
    },
    productPicture: {
      type: String,
      default: '',
    },
    productRating: {
      type: Number,
      default: 0,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    transactionVolume: {
      type: Number,
      default: 0,
    },
    transactionAmount: {
      type: Number,
      default: 0,
    },
    commission: {
      type: Number,
      default: 0,
    },
    transactionStatus: {
      type: String,
      enum: ['Waiting for Payment', 'Complete payment'],
      default: 'Waiting for Payment',
    },
    orderTime: {
      type: String,
      default: '',
    },
    settlementTime: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Order', orderSchema);