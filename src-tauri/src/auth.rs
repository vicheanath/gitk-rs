use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const KEYRING_SERVICE: &str = "gitk-rs";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitProvider {
    Github,
    Gitlab,
    Bitbucket,
    AzureDevops,
}

impl GitProvider {
    pub fn default_host(&self) -> &'static str {
        match self {
            Self::Github => "github.com",
            Self::Gitlab => "gitlab.com",
            Self::Bitbucket => "bitbucket.org",
            Self::AzureDevops => "dev.azure.com",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConnectionInput {
    pub provider: GitProvider,
    pub host: Option<String>,
    pub username: Option<String>,
    pub display_name: String,
    pub token: String,
    pub scopes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConnection {
    pub id: String,
    pub provider: GitProvider,
    pub host: String,
    pub username: Option<String>,
    pub display_name: String,
    pub scopes: Vec<String>,
    pub connected_at: i64,
    pub has_token: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AuthStore {
    connections: Vec<AuthConnection>,
}

impl Default for AuthStore {
    fn default() -> Self {
        Self {
            connections: Vec::new(),
        }
    }
}

fn now_epoch_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn auth_store_path() -> anyhow::Result<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("Could not resolve home directory"))?;
    let dir = home.join(".gitk-rs");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir.join("auth-connections.json"))
}

fn load_store() -> anyhow::Result<AuthStore> {
    let path = auth_store_path()?;
    if !path.exists() {
        return Ok(AuthStore::default());
    }

    let raw = fs::read_to_string(path)?;
    let parsed = serde_json::from_str::<AuthStore>(&raw).unwrap_or_default();
    Ok(parsed)
}

fn save_store(store: &AuthStore) -> anyhow::Result<()> {
    let path = auth_store_path()?;
    let payload = serde_json::to_string_pretty(store)?;
    fs::write(path, payload)?;
    Ok(())
}

fn normalize_host(provider: &GitProvider, host: Option<String>) -> String {
    let value = host.unwrap_or_else(|| provider.default_host().to_string());
    value.trim().to_lowercase()
}

fn normalize_identifier(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' { ch } else { '-' })
        .collect()
}

fn connection_id(provider: &GitProvider, host: &str, username: Option<&str>, display_name: &str) -> String {
    let provider_part = match provider {
        GitProvider::Github => "github",
        GitProvider::Gitlab => "gitlab",
        GitProvider::Bitbucket => "bitbucket",
        GitProvider::AzureDevops => "azure-devops",
    };
    let principal = username.unwrap_or(display_name);
    format!(
        "{}:{}:{}",
        provider_part,
        normalize_identifier(host),
        normalize_identifier(principal)
    )
}

pub fn list_connections() -> anyhow::Result<Vec<AuthConnection>> {
    let mut store = load_store()?;
    for connection in &mut store.connections {
        let entry = keyring::Entry::new(KEYRING_SERVICE, &connection.id)?;
        connection.has_token = entry.get_password().is_ok();
    }
    Ok(store.connections)
}

pub fn upsert_connection(input: AuthConnectionInput) -> anyhow::Result<AuthConnection> {
    let host = normalize_host(&input.provider, input.host.clone());
    let username = input
        .username
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let display_name = input.display_name.trim().to_string();
    if display_name.is_empty() {
        anyhow::bail!("Display name is required");
    }

    if input.token.trim().is_empty() {
        anyhow::bail!("Token is required");
    }

    let id = connection_id(&input.provider, &host, username.as_deref(), &display_name);
    let mut store = load_store()?;

    let mut connection = AuthConnection {
        id: id.clone(),
        provider: input.provider,
        host,
        username,
        display_name,
        scopes: input.scopes.unwrap_or_default(),
        connected_at: now_epoch_seconds(),
        has_token: true,
    };

    let keyring_entry = keyring::Entry::new(KEYRING_SERVICE, &id)?;
    keyring_entry.set_password(input.token.trim())?;

    if let Some(existing) = store.connections.iter_mut().find(|current| current.id == id) {
        existing.provider = connection.provider.clone();
        existing.host = connection.host.clone();
        existing.username = connection.username.clone();
        existing.display_name = connection.display_name.clone();
        existing.scopes = connection.scopes.clone();
        existing.connected_at = connection.connected_at;
        existing.has_token = true;
        connection = existing.clone();
    } else {
        store.connections.push(connection.clone());
    }

    save_store(&store)?;
    Ok(connection)
}

pub fn remove_connection(connection_id: &str) -> anyhow::Result<()> {
    let id = connection_id.trim();
    if id.is_empty() {
        anyhow::bail!("Connection id is required");
    }

    let mut store = load_store()?;
    store.connections.retain(|connection| connection.id != id);
    save_store(&store)?;

    let entry = keyring::Entry::new(KEYRING_SERVICE, id)?;
    let _ = entry.delete_password();

    Ok(())
}
