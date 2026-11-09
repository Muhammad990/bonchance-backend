import mongoose from 'mongoose';

const productItemSchema = new mongoose.Schema(
  {
    orderNumber: { type: Number, min: 1 },
    productId: { type: String, default: '' },
    displayId: { type: String, default: '' },
    name: { type: String, default: '', trim: true },
    picture: { type: String, default: '' },
    price: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    multiplier: { type: Number, default: 1 },
    returnAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const memberOrderSettingSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      required: [true, 'Member ID is required'],
      unique: true,
      index: true,
    },
    products: {
      type: [productItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('MemberOrderSetting', memberOrderSettingSchema);