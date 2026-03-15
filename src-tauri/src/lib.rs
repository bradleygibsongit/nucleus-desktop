use serde::Serialize;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, State};

struct CodexServer {
    process: Mutex<Option<Child>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillSummary {
    id: String,
    name: String,
    description: String,
    directory_path: String,
    entry_path: String,
    body: String,
    has_frontmatter: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillsSyncResponse {
    managed_root_path: String,
    skills: Vec<SkillSummary>,
}

struct ParsedSkillDocument {
    name: Option<String>,
    description: Option<String>,
    body: String,
    has_frontmatter: bool,
}

#[tauri::command]
async fn start_codex_server(state: State<'_, CodexServer>) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = *process_guard {
        match child.try_wait() {
            Ok(Some(_)) => {
                *process_guard = None;
            }
            Ok(None) => {
                return Ok("Codex App Server already running".to_string());
            }
            Err(e) => {
                log::warn!("Error checking Codex App Server status: {}", e);
                *process_guard = None;
            }
        }
    }

    let child = Command::new("codex")
        .args(["app-server", "--listen", "ws://127.0.0.1:4500"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start Codex App Server: {}", e))?;

    *process_guard = Some(child);
    Ok("Codex App Server started".to_string())
}

#[tauri::command]
async fn stop_codex_server(state: State<'_, CodexServer>) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = process_guard.take() {
        child
            .kill()
            .map_err(|e| format!("Failed to stop Codex App Server: {}", e))?;
        child
            .wait()
            .map_err(|e| format!("Failed waiting for Codex App Server shutdown: {}", e))?;
        Ok("Codex App Server stopped".to_string())
    } else {
        Ok("Codex App Server was not running".to_string())
    }
}

#[tauri::command]
async fn list_skills() -> Result<SkillsSyncResponse, String> {
    let managed_root = resolve_managed_skills_root()?;
    let managed_root_string = managed_root.display().to_string();

    if !managed_root.exists() {
        return Ok(SkillsSyncResponse {
            managed_root_path: managed_root_string,
            skills: Vec::new(),
        });
    }

    let entries = fs::read_dir(&managed_root)
        .map_err(|e| format!("Failed to read managed skills directory: {}", e))?;
    let mut skills = Vec::new();

    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(error) => {
                log::warn!("Failed to read a skill directory entry: {}", error);
                continue;
            }
        };

        let directory_path = entry.path();
        if !directory_path.is_dir() {
            continue;
        }

        let entry_path = directory_path.join("SKILL.md");
        if !entry_path.exists() {
            continue;
        }

        let content = match fs::read_to_string(&entry_path) {
            Ok(content) => content,
            Err(error) => {
                log::warn!(
                    "Failed to read skill file {}: {}",
                    entry_path.display(),
                    error
                );
                continue;
            }
        };

        let parsed = parse_skill_document(&content);
        let skill_id = entry.file_name().to_string_lossy().to_string();
        let skill_name = parsed
            .name
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| fallback_skill_name(&skill_id, &parsed.body));
        let skill_description = parsed
            .description
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| fallback_skill_description(&parsed.body));

        skills.push(SkillSummary {
            id: skill_id,
            name: skill_name,
            description: skill_description,
            directory_path: directory_path.display().to_string(),
            entry_path: entry_path.display().to_string(),
            body: parsed.body,
            has_frontmatter: parsed.has_frontmatter,
        });
    }

    skills.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    Ok(SkillsSyncResponse {
        managed_root_path: managed_root_string,
        skills,
    })
}

fn resolve_managed_skills_root() -> Result<PathBuf, String> {
    resolve_home_directory()
        .map(|home| home.join(".agents").join("skills"))
        .ok_or_else(|| "Unable to resolve the user's home directory for managed skills.".to_string())
}

fn resolve_home_directory() -> Option<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(PathBuf::from))
        .or_else(|| {
            match (env::var_os("HOMEDRIVE"), env::var_os("HOMEPATH")) {
                (Some(drive), Some(path)) => {
                    let mut combined = PathBuf::from(drive);
                    combined.push(path);
                    Some(combined)
                }
                _ => None,
            }
        })
}

fn parse_skill_document(content: &str) -> ParsedSkillDocument {
    let normalized = content.replace("\r\n", "\n");
    if !normalized.starts_with("---\n") && normalized.trim() != "---" {
        return ParsedSkillDocument {
            name: None,
            description: None,
            body: normalized.trim().to_string(),
            has_frontmatter: false,
        };
    }

    let rest = &normalized[4..];
    if let Some(frontmatter_end) = rest.find("\n---\n") {
        let frontmatter = &rest[..frontmatter_end];
        let body = rest[(frontmatter_end + 5)..].trim().to_string();
        let mut name = None;
        let mut description = None;

        for line in frontmatter.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            let Some((raw_key, raw_value)) = trimmed.split_once(':') else {
                continue;
            };

            let key = raw_key.trim();
            let value = raw_value
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string();

            match key {
                "name" if !value.is_empty() => name = Some(value),
                "description" if !value.is_empty() => description = Some(value),
                _ => {}
            }
        }

        return ParsedSkillDocument {
            name,
            description,
            body,
            has_frontmatter: true,
        };
    }

    ParsedSkillDocument {
        name: None,
        description: None,
        body: normalized.trim().to_string(),
        has_frontmatter: false,
    }
}

fn fallback_skill_name(skill_id: &str, body: &str) -> String {
    first_markdown_heading(body).unwrap_or_else(|| skill_id.replace('-', " "))
}

fn fallback_skill_description(body: &str) -> String {
    first_content_paragraph(body).unwrap_or_else(|| "No description found in SKILL.md".to_string())
}

fn first_markdown_heading(body: &str) -> Option<String> {
    body.lines()
        .map(str::trim)
        .find(|line| line.starts_with("# "))
        .map(|line| line.trim_start_matches("# ").trim().to_string())
}

fn first_content_paragraph(body: &str) -> Option<String> {
    let mut in_code_block = false;
    let mut paragraph_lines: Vec<String> = Vec::new();

    for raw_line in body.lines() {
        let line = raw_line.trim();

        if line.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }

        if in_code_block {
            continue;
        }

        if line.is_empty() {
            if !paragraph_lines.is_empty() {
                break;
            }
            continue;
        }

        if line.starts_with('#') || line.starts_with('-') || line.starts_with('*') {
            if paragraph_lines.is_empty() {
                continue;
            }
            break;
        }

        paragraph_lines.push(line.to_string());
    }

    if paragraph_lines.is_empty() {
        None
    } else {
        Some(paragraph_lines.join(" "))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .manage(CodexServer {
            process: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            start_codex_server,
            stop_codex_server,
            list_skills,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state: State<CodexServer> = window.state();
                let mut process_guard = match state.process.lock() {
                    Ok(guard) => guard,
                    Err(_) => return,
                };

                if let Some(mut child) = process_guard.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
