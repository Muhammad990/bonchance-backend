import SiteSetting from '../models/SiteSetting.js';

export const DEFAULT_BASIC_SETTINGS = {
  defaultLanguage: 'ru',
  systemTimeZone: 'Asia/Bishkek',
  openingTime: '09:00:00',
  closingTime: '23:58:59',
  withdrawalStartTime: '01:00:00',
  withdrawalEndTime: '17:00:00',
};

export const timeToSeconds = (time) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(String(time || '').trim());
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
};

export const secondsInTimeZone = (timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const values = {};
  parts.forEach((part) => { if (part.type !== 'literal') values[part.type] = Number(part.value); });
  return (values.hour || 0) * 3600 + (values.minute || 0) * 60 + (values.second || 0);
};

export const isSecondsInWindow = (seconds, start, end) => {
  const startSeconds = timeToSeconds(start);
  const endSeconds = timeToSeconds(end);
  if (startSeconds === null || endSeconds === null) return false;
  if (startSeconds <= endSeconds) return seconds >= startSeconds && seconds <= endSeconds;
  return seconds >= startSeconds || seconds <= endSeconds;
};

export const getBasicTimeSettings = async () => {
  const setting = await SiteSetting.getGeneral();
  return {
    systemTimeZone: setting.systemTimeZone || DEFAULT_BASIC_SETTINGS.systemTimeZone,
    openingTime: setting.openingTime || DEFAULT_BASIC_SETTINGS.openingTime,
    closingTime: setting.closingTime || DEFAULT_BASIC_SETTINGS.closingTime,
    withdrawalStartTime: setting.withdrawalStartTime || DEFAULT_BASIC_SETTINGS.withdrawalStartTime,
    withdrawalEndTime: setting.withdrawalEndTime || DEFAULT_BASIC_SETTINGS.withdrawalEndTime,
    defaultLanguage: setting.defaultLanguage || DEFAULT_BASIC_SETTINGS.defaultLanguage,
  };
};
