export interface WorkflowDispatchInput {
  owner: string;
  repo: string;
  /** Nama file workflow, mis. backup-release.yml */
  workflowId: string;
  ref: string;
  /** Nilai input Actions selalu string */
  inputs: Record<string, string>;
  token: string;
}

export interface GithubActionsDispatchPort {
  workflowDispatch(input: WorkflowDispatchInput): Promise<void>;
}
