import { DeviceGate } from './employee/DeviceGate';
import { EmployeeApp } from './employee/EmployeeApp';
import { StationApp } from './employee/StationApp';
import { ToastProvider } from './ui/Toast';

export function App({ path = window.location.pathname }: { path?: string }) {
  return (
    <ToastProvider>
      <DeviceGate>{path.startsWith('/estacao') ? <StationApp /> : <EmployeeApp />}</DeviceGate>
    </ToastProvider>
  );
}
