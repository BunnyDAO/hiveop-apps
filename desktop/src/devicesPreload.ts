// ryc — preload for the two local device windows (resources/approve-device.html, devices.html).
// Channel names mirror devicesUi.ts. Only local file pages load here; main checks every sender.
// The bridge's control token and the Mac-side pairing code never cross into this world.
import { contextBridge, ipcRenderer } from 'electron';

const on = (channel: string, cb: (v: unknown) => void): (() => void) => {
  const listener = (_e: unknown, v: unknown): void => cb(v);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
};

if (window.location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('hiveopDevices', {
    state: () => ipcRenderer.invoke('hiveop-devices:approval-state'),
    onState: (cb: (v: unknown) => void) => on('hiveop-devices:approval-changed', cb),
    approve: (code: string) => ipcRenderer.invoke('hiveop-devices:approve', String(code)),
    deny: () => ipcRenderer.invoke('hiveop-devices:deny'),
    close: () => ipcRenderer.invoke('hiveop-devices:close'),
    list: () => ipcRenderer.invoke('hiveop-devices:list'),
    onList: (cb: (v: unknown) => void) => on('hiveop-devices:list-changed', cb),
    remove: (keyId: string) => ipcRenderer.invoke('hiveop-devices:remove', String(keyId)),
  });
}
