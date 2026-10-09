// ColorOS, on OPPO, OnePlus and realme phones, can hand the lock-screen player to Live Alerts. While its Music
// playback switch is off, no app's player appears on the lock screen, and apps can neither read nor change it.
const LIVE_ALERTS_MAKERS = ['oppo', 'oneplus', 'realme'];

export function hasLiveAlerts(manufacturer: string, brand: string) {
  return [manufacturer, brand].some(name => LIVE_ALERTS_MAKERS.includes(name.toLowerCase()));
}

export const liveAlertsTip = {
  id: 'liveAlerts',
  title: 'Controls on the lock screen',
  text: 'If the lock screen shows no player, open Settings, search for Live Alerts and turn on Music playback.',
};
