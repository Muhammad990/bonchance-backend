import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const memberSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      required: [true, 'Member ID is required'],
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
    },
    nickname: {
      type: String,
      required: [true, 'Nickname is required'],
      unique: true,
      trim: true,
      maxlength: [50, 'Nickname cannot exceed 50 characters'],
    },
    creditScore: {
      type: Number,
      required: [true, 'Credit score is required'],
      default: 100,
      min: [0, 'Credit score cannot be negative'],
    },
    loginPassword: {
      type: String,
      required: [true, 'Login password is required'],
      minlength: [6, 'Login password must be at least 6 characters'],
      select: false,
    },
    securityPin: {
      type: String,
      minlength: [4, 'Security pin must be at least 4 characters'],
      select: false,
    },
    referredByCode: {
      type: String,
      default: '',
      trim: true,
    },
    vipLevel: {
      type: String,
      required: [true, 'VIP level is required'],
      trim: true,
    },
    superiorId: {
      type: String,
      required: [true, 'Superior ID is required'],
      default: '5983',
      trim: true,
    },
    todaySalaryPendingPayment: {
      type: Number,
      required: [true, 'Today salary pending payment is required'],
      default: 0,
      min: [0, 'Today salary pending payment cannot be negative'],
    },
    taskStatus: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Task status cannot be negative'],
    },
    taskStatusDate: {
      type: String,
      default: '',
    },
    invitationCode: {
      type: String,
      required: [true, 'Invitation code is required'],
      unique: true,
    },
    registrationTime: {
      type: String,
      required: [true, 'Registration time is required'],
    },
    lastLoginTime: {
      type: String,
      default: '',
    },
    lastLoginIp: {
      type: String,
      default: '',
    },
    availableFunds: {
      type: Number,
      required: true,
      default: 0,
    },
    todayProfit: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Today profit cannot be negative'],
    },
    totalCommissions: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Total commissions cannot be negative'],
    },
    status: {
      type: String,
      enum: ['Enabled', 'Disabled'],
      default: 'Enabled',
    },
    transactions: {
      type: String,
      enum: ['Enabled', 'Disabled'],
      default: 'Enabled',
    },
    userType: {
      type: String,
      enum: ['Regular User', 'Test User', 'Proxy User'],
      default: 'Regular User',
    },
    unseenRejection: {
      type: Boolean,
      default: false,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

memberSchema.pre('save', async function (next) {
  if (!this.isModified('loginPassword') && !this.isModified('securityPin')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  if (this.isModified('loginPassword')) {
    this.loginPassword = await bcrypt.hash(this.loginPassword, salt);
  }
  if (this.isModified('securityPin') && this.securityPin) {
    this.securityPin = await bcrypt.hash(this.securityPin, salt);
  }
  next();
});

memberSchema.methods.matchLoginPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.loginPassword);
};

memberSchema.methods.matchSecurityPin = function (enteredPin) {
  return bcrypt.compare(String(enteredPin || ''), this.securityPin);
};

export default mongoose.model('Member', memberSchema);
