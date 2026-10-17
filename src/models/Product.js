import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    pId: {
      type: Number,
      required: [true, 'Product ID is required'],
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    picture: {
      type: String,
      default: '',
    },
    price: {
      type: String,
      required: [true, 'Price is required'],
      trim: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
    },
    creationTime: {
      type: String,
      required: [true, 'Creation time is required'],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Product', productSchema);