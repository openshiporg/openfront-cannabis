export type WorkspaceClosedState =
  | { state: 'signed_out' }
  | { state: 'forbidden' }
  | { state: 'setup_required' }
  | { state: 'operating_closed'; reason: string }
  | { state: 'unavailable' };

export type CannabisWorkspaceResult<T = Record<string, unknown>> = { state: 'ok'; data: T } | WorkspaceClosedState;

export const WORKSPACE_STATE_COPY: Record<WorkspaceClosedState['state'], { title: string; detail: string }> = {
  signed_out: { title: 'Signed out', detail: 'Sign in again to continue.' },
  forbidden: { title: 'Not in your role', detail: 'Your role doesn’t include this workspace. The owner can change it in Authority.' },
  setup_required: { title: 'Set up your dispensary', detail: 'License, premises, your credential and sales rules' },
  operating_closed: { title: 'Operating authority is not current', detail: 'Renew or correct the license or staff credential in Authority to continue.' },
  unavailable: { title: 'Unavailable', detail: 'This page could not be loaded. Try again.' },
};
