export type WorkspaceClosedState =
  | { state: 'signed_out' }
  | { state: 'forbidden' }
  | { state: 'operating_closed'; reason: string }
  | { state: 'unavailable' };

export type CannabisWorkspaceResult<T = Record<string, unknown>> = { state: 'ok'; data: T } | WorkspaceClosedState;

export const WORKSPACE_STATE_COPY: Record<WorkspaceClosedState['state'], { title: string; detail: string }> = {
  signed_out: { title: 'Signed out', detail: 'Sign in again to continue.' },
  forbidden: { title: 'No access', detail: 'Your role does not include this area, or you are not assigned to a premises.' },
  operating_closed: { title: 'Operating authority is not current', detail: 'Renew or correct the license or staff credential in Authority to continue.' },
  unavailable: { title: 'Unavailable', detail: 'This page could not be loaded. Try again.' },
};
