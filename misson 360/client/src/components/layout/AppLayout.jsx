import { Sidebar } from './Sidebar';
import { ProjectsProvider } from '../../context/ProjectsContext';

export function AppLayout({ children, selectedEnv, environments, onSelectEnv, onEnvsChanged }) {
  return (
    <ProjectsProvider selectedEnv={selectedEnv}>
      <div className="h-svh flex overflow-hidden bg-[var(--paper)] print:block print:overflow-visible print:h-auto" dir="rtl">
        <Sidebar
          selectedEnv={selectedEnv}
          environments={environments || []}
          onSelectEnv={onSelectEnv}
          onEnvsChanged={onEnvsChanged}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,100rem)] flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-6 sm:py-10">
            {children}
          </div>
        </main>
      </div>
    </ProjectsProvider>
  );
}
