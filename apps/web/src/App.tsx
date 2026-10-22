import { AdminApp } from './admin/AdminApp';
import { isPhone } from './device';
import { DeviceGate } from './employee/DeviceGate';
import { EmployeeApp } from './employee/EmployeeApp';
import { StationApp } from './employee/StationApp';
import { ToastProvider } from './ui/Toast';

export function App({ path = window.location.pathname, phone = isPhone() }: { path?: string; phone?: boolean }) {
  const station = path.startsWith('/estacao') || !phone;
  return (
    <ToastProvider>
      {path.startsWith('/gestor') ? (
        <AdminApp />
      ) : (
        <DeviceGate>{station ? <StationApp /> : <EmployeeApp />}</DeviceGate>
      )}
    </ToastProvider>
  );
}
