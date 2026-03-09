export const formatPoints = (value: number): string => `${value} point${value > 1 ? 's' : ''}`;

export const formatEventPayload = (payload?: Record<string, unknown> | null): string => {
  if (!payload) return '';
  const json = JSON.stringify(payload);
  if (!json) return '';
  return json.length > 120 ? `${json.slice(0, 117)}...` : json;
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};
