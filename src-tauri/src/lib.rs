use tauri::Manager;

mod app_core;
mod commands;
mod git_engine;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_repository,
            commands::get_commit_graph,
            commands::get_branches,
            commands::get_tags,
            commands::get_commit_details,
            commands::get_commit_branches,
            commands::get_diff,
            commands::get_file_content,
            commands::get_commit_tree,
            commands::checkout_branch,
            commands::create_branch,
            commands::delete_branch,
            commands::search_commits,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

