export type GitProvider = "github" | "gitlab" | "bitbucket" | "azure-devops";

export interface AuthConnection {
  id: string;
  provider: GitProvider;
  host: string;
  username?: string | null;
  display_name: string;
  scopes: string[];
  connected_at: number;
  has_token: boolean;
}

export interface AuthConnectionInput {
  provider: GitProvider;
  host?: string;
  username?: string;
  display_name: string;
  token: string;
  scopes?: string[];
}

export const PROVIDER_PRESETS: Array<{
  provider: GitProvider;
  label: string;
  defaultHost: string;
  tokenLabel: string;
  docsUrl: string;
}> = [
  {
    provider: "github",
    label: "GitHub",
    defaultHost: "github.com",
    tokenLabel: "Personal access token",
    docsUrl: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
  },
  {
    provider: "gitlab",
    label: "GitLab",
    defaultHost: "gitlab.com",
    tokenLabel: "Personal access token",
    docsUrl: "https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html",
  },
  {
    provider: "bitbucket",
    label: "Bitbucket",
    defaultHost: "bitbucket.org",
    tokenLabel: "App password",
    docsUrl: "https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/",
  },
  {
    provider: "azure-devops",
    label: "Azure DevOps",
    defaultHost: "dev.azure.com",
    tokenLabel: "Personal access token",
    docsUrl: "https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate",
  },
];
