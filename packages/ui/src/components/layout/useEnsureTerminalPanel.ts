import { useEffect, useRef } from 'react';
import type { ToolPanel } from '@snowtree/core/types/panels';
import { API } from '../../utils/api';

type SessionRef = { id: string };

export const useEnsureTerminalPanel = (
  session: SessionRef | null,
  terminalPanel: ToolPanel | null,
  setTerminalPanel: (panel: ToolPanel | null) => void
) => {
  const terminalPanelRef = useRef<ToolPanel | null>(terminalPanel);

  useEffect(() => {
    terminalPanelRef.current = terminalPanel;
  }, [terminalPanel]);

  useEffect(() => {
    if (!session) return;
    if (terminalPanelRef.current) return;
    let cancelled = false;

    const ensureTerminalPanel = async () => {
      try {
        const response = await API.sessions.ensureTerminalPanel(session.id);
        if (cancelled) return;
        if (response?.success && response.data) {
          setTerminalPanel(response.data as ToolPanel);
        }
      } catch (error) {
        console.error('Failed to ensure terminal panel:', error);
      }
    };

    void ensureTerminalPanel();

    return () => {
      cancelled = true;
    };
  }, [session, setTerminalPanel]);
};
