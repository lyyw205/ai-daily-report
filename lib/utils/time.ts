export const nowIso = () => new Date().toISOString();

export const formatDateKST = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

export const formatDisplayDate = (date: string) => {
  const [year, month, day] = date.split('-');
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
};
