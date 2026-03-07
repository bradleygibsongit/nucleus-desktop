use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, State};

struct CodexServer {
    process: Mutex<Option<Child>>,
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
