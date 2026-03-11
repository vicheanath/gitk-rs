import {
  FolderGit2,
  Settings2,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";

interface LandingPageProps {
  connections: Array<{ id: string; display_name: string; provider: string; host: string }>;
  onOpenRepository: () => void;
  onOpenSettings: () => void;
}

export default function LandingPage({
  connections,
  onOpenRepository,
  onOpenSettings,
}: LandingPageProps) {
  const { repoPath } = useAppContext();

  return (
    <div className="min-h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center px-4 py-12 sm:py-20">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]">
          <FolderGit2 size={32} />
        </div>

        <h1 className="mb-2 text-center text-4xl font-bold tracking-tight sm:text-5xl">
          GitK-RS
        </h1>
        <p className="mb-8 text-center text-lg text-[var(--text-secondary)]">
          A modern Git visualization tool for exploring repositories with ease
        </p>

        {/* Primary CTA */}
        <button
          onClick={onOpenRepository}
          className="mb-8 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-8 py-3 text-base font-semibold text-[#0b1117] shadow-lg transition hover:shadow-xl hover:brightness-110"
        >
          <FolderGit2 size={20} />
          Open Repository
        </button>

        {/* Quick Stats / Info */}
        {repoPath && (
          <div className="mb-8 rounded-lg border border-[color-mix(in_srgb,var(--accent)_30%,var(--border-color))] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-4 py-2 text-sm text-[var(--text-secondary)]">
            Last opened: <span className="font-medium text-[var(--text-primary)]">{repoPath.split("/").pop()}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-auto max-w-4xl border-t border-[color-mix(in_srgb,var(--border-color)_50%,transparent)]" />

      {/* Connected Providers Section */}
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div>
          <h3 className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            <div className="h-1 w-1 rounded-full bg-[var(--accent)]" />
            Connected Providers
          </h3>
          {connections.length === 0 ? (
            <div className="rounded-lg border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-secondary)_70%,transparent)] p-6">
              <p className="text-sm text-[var(--text-secondary)]">
                No providers connected yet.
              </p>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Connect accounts to manage repositories from GitHub, GitLab, Bitbucket, and Azure DevOps.
              </p>
              <button
                onClick={onOpenSettings}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--accent)_40%,var(--border-color))] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
              >
                <Settings2 size={16} />
                Connect Providers
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="rounded-lg border border-[color-mix(in_srgb,var(--accent)_30%,var(--border-color))] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-4 py-3"
                >
                  <p className="font-medium text-[var(--accent)]">{connection.display_name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {connection.provider} • {connection.host}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Info */}
      <div className="border-t border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] px-4 py-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs text-[var(--text-secondary)]">
            GitK-RS • A modern Git visualization tool built with Rust and React
          </p>
        </div>
      </div>
    </div>
  );
}
