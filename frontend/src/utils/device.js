// Device-type detection used to tailor the agent download/setup UI:
// desktop users get the native MSI installer flow (AgentSetup), mobile
// users get the browser-based telemetry agent (MobileAgent). Each page
// also shows a small cross-link so a user on the "wrong" page for their
// device can get to the right one.
export function isMobileDevice() {
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    if (/Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent)) {
      return true;
    }
  }
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
    return window.innerWidth < 768;
  }
  return false;
}
