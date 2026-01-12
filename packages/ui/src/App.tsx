import { Sidebar } from './components/Sidebar';
import { MainLayout } from './components/layout';
import { useIPCEvents } from './hooks/useIPCEvents';
import { useWorkspaceStageSync } from './hooks/useWorkspaceStageSync';
import { ErrorDialog } from './components/ErrorDialog';
import { useErrorStore } from './stores/errorStore';

export default function App() {
  useIPCEvents();
  useWorkspaceStageSync();
  const { currentError, clearError } = useErrorStore();

  return (
    <div
      className="h-screen w-screen flex overflow-hidden relative"
      style={{
        paddingTop: 'var(--st-titlebar-gap)',
        backgroundColor: 'var(--st-bg)',
        color: 'var(--st-text)'
      }}
    >
      {/* Drag region for macOS hiddenInset titlebar */}
      <div
        className="absolute top-0 left-0 right-0 z-50"
        style={{
          height: 'var(--st-titlebar-gap)',
          // @ts-expect-error - webkit vendor prefix
          WebkitAppRegion: 'drag',
        }}
      />
      <Sidebar />
      <MainLayout />

      {currentError && (
        <ErrorDialog
          isOpen={true}
          onClose={clearError}
          title={currentError.title}
          error={currentError.error}
          details={currentError.details}
          command={currentError.command}
        />
      )}
    </div>
  );
}
