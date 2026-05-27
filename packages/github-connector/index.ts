/**
 * GitHub App connector for draft PR execution.
 * Uses installation access tokens (scoped, auto-refreshing).
 */

import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

export interface GitHubConnectorConfig {
  appId: string;
  privateKey: string;
  installationId: number;
  repoOwner: string;
  repoName: string;
}

export interface DraftPRInput {
  title: string;
  body: string;
  branchName: string;
  baseBranch: string;
  files: { path: string; content: string }[];
}

export class GitHubConnector {
  private octokit: Octokit;
  private config: GitHubConnectorConfig;

  constructor(config: GitHubConnectorConfig) {
    this.config = config;

    const auth = createAppAuth({
      appId: config.appId,
      privateKey: config.privateKey,
      installationId: config.installationId,
    });

    this.octokit = new Octokit({ authStrategy: createAppAuth, auth: {
      appId: config.appId,
      privateKey: config.privateKey,
      installationId: config.installationId,
    }});
  }

  async getInstallationToken(): Promise<string> {
    const { data } = await this.octokit.rest.apps.createInstallationAccessToken({
      installation_id: this.config.installationId,
    });
    return data.token;
  }

  async getDefaultBranch(): Promise<string> {
    const { data } = await this.octokit.rest.repos.get({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
    });
    return data.default_branch;
  }

  async createBranch(branchName: string, baseSha?: string): Promise<void> {
    const base = baseSha ?? await this.getBaseCommitSha();

    await this.octokit.rest.git.createRef({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      ref: `refs/heads/${branchName}`,
      sha: base,
    });
  }

  async updateFile(branch: string, path: string, content: string, message: string): Promise<void> {
    // Get current file SHA if exists
    let sha: string | undefined;
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.repoOwner,
        repo: this.config.repoName,
        path,
        ref: branch,
      });
      if ('sha' in data) sha = data.sha;
    } catch {
      // File doesn't exist — will create
    }

    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha,
    });
  }

  async createDraftPR(input: DraftPRInput): Promise<{ prNumber: number; htmlUrl: string }> {
    // 1. Create branch
    await this.createBranch(input.branchName);

    // 2. Commit files
    for (const file of input.files) {
      await this.updateFile(input.branchName, file.path, file.content, `fix: ${input.title} — ${file.path}`);
    }

    // 3. Create draft PR
    const { data: pr } = await this.octokit.rest.pulls.create({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      title: input.title,
      body: input.body,
      head: input.branchName,
      base: input.baseBranch,
      draft: true,
    });

    return { prNumber: pr.number, htmlUrl: pr.html_url };
  }

  async getPRStatus(prNumber: number): Promise<{ state: string; merged: boolean }> {
    const { data } = await this.octokit.rest.pulls.get({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      pull_number: prNumber,
    });
    return { state: data.state, merged: data.merged ?? false };
  }

  private async getBaseCommitSha(): Promise<string> {
    const { data } = await this.octokit.rest.git.getRef({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      ref: `heads/${await this.getDefaultBranch()}`,
    });
    return data.object.sha;
  }
}
