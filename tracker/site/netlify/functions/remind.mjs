import { runReminders } from '../lib/core.mjs';

// ყოველდღე 06:00, 08:00 და 10:00 UTC = 10:00, 12:00, 14:00 თბილისის დროით.
// უკვე გაგზავნილ შეხსენებას ხელახლა არ აგზავნის; მეორე და მესამე გაშვება მხოლოდ წარუმატებლების გასამეორებლადაა.
export default async () => {
  await runReminders();
};
export const config = { schedule: '0 6,8,10 * * *' };
