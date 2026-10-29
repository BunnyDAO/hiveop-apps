/** Confirmation text for Quit, or null when it can quit immediately. */
export function quitPrompt(runningLocalAgents: number): string | null {
  if (runningLocalAgents <= 0) return null;
  const noun = runningLocalAgents === 1 ? 'agent' : 'agents';
  return `Stop ${runningLocalAgents} local ${noun}? They end when HiveOp quits.`;
}
