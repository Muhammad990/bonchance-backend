import mongoose from 'mongoose';

const DEFAULT_DISABLED_MESSAGE =
  'Deposits and withdrawals are temporarily disabled. Please try again later.';

const siteSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'general',
    },
    transactionsDisabled: {
      type: Boolean,
      default: false,
    },
    disabledMessage: {
      type: String,
      default: DEFAULT_DISABLED_MESSAGE,
      trim: true,
    },
    gradeSalaryLastDate: {
      type: String,
      default: '',
    },
    taskStatusResetDate: {
      type: String,
      default: '',
    },
    defaultLanguage: {
      type: String,
      default: 'ru',
      trim: true,
    },
    systemTimeZone: {
      type: String,
      default: 'Asia/Bishkek',
      trim: true,
    },
    openingTime: {
      type: String,
      default: '09:00:00',
      trim: true,
    },
    closingTime: {
      type: String,
      default: '23:58:59',
      trim: true,
    },
    withdrawalStartTime: {
      type: String,
      default: '01:00:00',
      trim: true,
    },
    withdrawalEndTime: {
      type: String,
      default: '17:00:00',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

siteSettingSchema.statics.DEFAULT_DISABLED_MESSAGE = DEFAULT_DISABLED_MESSAGE;

// Single "general" document — agar na ho to bana lo
siteSettingSchema.statics.getGeneral = async function () {
  const doc = await this.findOne({ key: 'general' });
  if (doc) return doc;
  return await this.create({ key: 'general' });
};

export default mongoose.model('SiteSetting', siteSettingSchema);
