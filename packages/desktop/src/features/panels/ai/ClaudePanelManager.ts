import { AbstractAIPanelManager, PanelMapping } from '../base/AbstractAIPanelManager';
import { ClaudeExecutor } from '../../../executors/claude';
import type { ExecutorSpawnOptions } from '../../../executors/types';
import type { Logger } from '../../../infrastructure/logging/logger';
import type { ConfigManager } from '../../../infrastructure/config/configManager';
import type { ConversationMessage } from '../../../infrastructure/database/models';
import { AIPanelConfig, StartPanelConfig, ContinuePanelConfig } from '@snowtree/core/types/aiPanelConfig';
import { ClaudePanelState } from '@snowtree/core/types/panels';

/**
 * Manager for Claude Code panels
 * Uses the new ClaudeExecutor
 */
export class ClaudePanelManager extends AbstractAIPanelManager {

  constructor(
    executor: ClaudeExecutor,
    sessionManager: import('../../session').SessionManager,
    logger?: Logger,
    configManager?: ConfigManager
  ) {
    super(executor, sessionManager, logger, configManager);
  }

  /**
   * Get the agent name for logging and identification
   */
  protected getAgentName(): string {
    return 'Claude';
  }

  /**
   * Extract Claude-specific spawn options
   */
  protected extractSpawnOptions(config: AIPanelConfig, _mapping: PanelMapping): Partial<ExecutorSpawnOptions> {
    const permissionMode = config.permissionMode === 'ignore'
      ? 'bypassPermissions'
      : config.permissionMode === 'approve'
        ? 'default'
        : undefined;

    return {
      permissionMode,
      model: config.model,
      planMode: config.planMode,
    };
  }

  /**
   * Claude-specific panel start method for backward compatibility
   */
  async startPanel(panelId: string, worktreePath: string, prompt: string, permissionMode?: 'approve' | 'ignore', model?: string): Promise<void>;
  async startPanel(config: StartPanelConfig): Promise<void>;
  async startPanel(
    panelIdOrConfig: string | StartPanelConfig,
    worktreePath?: string,
    prompt?: string,
    permissionMode?: 'approve' | 'ignore',
    model?: string
  ): Promise<void> {
    if (typeof panelIdOrConfig === 'string') {
      const config: StartPanelConfig = {
        panelId: panelIdOrConfig,
        worktreePath: worktreePath!,
        prompt: prompt!,
        permissionMode,
        model
      };
      return super.startPanel(config);
    } else {
      return super.startPanel(panelIdOrConfig);
    }
  }

  /**
   * Claude-specific panel continue method for backward compatibility
   */
  async continuePanel(panelId: string, worktreePath: string, prompt: string, conversationHistory: ConversationMessage[], model?: string): Promise<void>;
  async continuePanel(config: ContinuePanelConfig): Promise<void>;
  async continuePanel(
    panelIdOrConfig: string | ContinuePanelConfig,
    worktreePath?: string,
    prompt?: string,
    conversationHistory?: ConversationMessage[],
    model?: string
  ): Promise<void> {
    if (typeof panelIdOrConfig === 'string') {
      const config: ContinuePanelConfig = {
        panelId: panelIdOrConfig,
        worktreePath: worktreePath!,
        prompt: prompt!,
        conversationHistory: conversationHistory!,
        model
      };
      return super.continuePanel(config);
    } else {
      return super.continuePanel(panelIdOrConfig);
    }
  }

  /**
   * Get Claude-specific panel state
   */
  getPanelState(panelId: string): ClaudePanelState | undefined {
    const baseState = super.getPanelState(panelId);
    if (!baseState) {
      return undefined;
    }

    return {
      isInitialized: baseState.isInitialized,
      claudeResumeId: baseState.resumeId,
      lastActivityTime: baseState.lastActivityTime
    };
  }

  /**
   * Register panel with Claude-specific state handling
   */
  registerPanel(panelId: string, sessionId: string, initialState?: ClaudePanelState, isUserInitiated = true): void {
    const baseInitialState = initialState ? {
      ...initialState,
      resumeId: initialState.claudeResumeId
    } : undefined;

    super.registerPanel(panelId, sessionId, baseInitialState, isUserInitiated);
  }

  /**
   * Get panel ID from Claude resume ID
   */
  getPanelIdFromClaudeResumeId(claudeResumeId: string): string | undefined {
    return this.getPanelIdFromResumeId(claudeResumeId);
  }
}
