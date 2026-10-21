import { DeviceGate } from './employee/DeviceGate';
import { EmployeeApp } from './employee/EmployeeApp';
import { ToastProvider } from './ui/Toast';

export function App() {
  return (
    <ToastProvider>
      <DeviceGate>
        <EmployeeApp />
      </DeviceGate>
    </ToastProvider>
  );
}
