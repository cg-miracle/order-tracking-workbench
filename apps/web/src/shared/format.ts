const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'code',
});

const date = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatMoney(amount: string | null) {
  return amount === null ? 'Unavailable' : currency.format(Number(amount));
}

export function formatDate(value: string) {
  return date.format(new Date(value + 'T00:00:00Z'));
}

export function statusLabel(status: string) {
  return status
    .replaceAll('_', ' ')
    .replace(/^./, (first) => first.toUpperCase());
}

export function carrierLabel(carrier: 'auspost-startrack' | 'tnt') {
  return carrier === 'tnt' ? 'TNT' : 'StarTrack / Australia Post';
}

const dateTime = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Australia/Sydney',
  timeZoneName: 'short',
});

export function formatDateTime(value: string) {
  return dateTime.format(new Date(value));
}
