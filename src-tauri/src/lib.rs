use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    Emitter, Manager, Runtime,
};

mod app_core;
mod auth;
mod commands;
mod git_engine;

fn build_native_menu<R: Runtime, M: Manager<R>>(manager: &M) -> tauri::Result<tauri::menu::Menu<R>> {
    let about = MenuItemBuilder::with_id("open_about", "About GitK-RS")
        .build(manager)?;
    let open_repository = MenuItemBuilder::with_id("open_repository", "Open Repository...")
        .accelerator("CmdOrCtrl+O")
        .build(manager)?;
    let close_repository = MenuItemBuilder::with_id("close_repository", "Close Repository")
        .accelerator("CmdOrCtrl+Shift+W")
        .build(manager)?;
    let reload_graph = MenuItemBuilder::with_id("reload_graph", "Reload Graph")
        .accelerator("CmdOrCtrl+R")
        .build(manager)?;
    let focus_search = MenuItemBuilder::with_id("focus_search", "Focus Search")
        .accelerator("CmdOrCtrl+F")
        .build(manager)?;
    let toggle_sidebar = MenuItemBuilder::with_id("toggle_sidebar", "Toggle Sidebar")
        .accelerator("CmdOrCtrl+B")
        .build(manager)?;
    let open_settings = MenuItemBuilder::with_id("open_settings", "Settings")
        .accelerator("CmdOrCtrl+,")
        .build(manager)?;
    let keyboard_shortcuts = MenuItemBuilder::with_id("show_shortcuts", "Keyboard Shortcuts")
        .accelerator("CmdOrCtrl+/")
        .build(manager)?;
    let quit = PredefinedMenuItem::quit(manager, Some("Quit GitK-RS"))?;

    let app_menu = SubmenuBuilder::new(manager, "GitK-RS")
        .item(&about)
        .separator()
        .item(&open_settings)
        .separator()
        .item(&quit)
        .build()?;

    let file_menu = SubmenuBuilder::new(manager, "File")
        .item(&open_repository)
        .item(&close_repository)
        .separator()
        .item(&reload_graph)
        .build()?;

    let edit_menu = SubmenuBuilder::new(manager, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .separator()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(manager, "View")
        .item(&focus_search)
        .item(&toggle_sidebar)
        .build()?;

    let help_menu = SubmenuBuilder::new(manager, "Help")
        .item(&keyboard_shortcuts)
        .build()?;

    MenuBuilder::new(manager)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&help_menu)
        .build()
}

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
            commands::get_working_tree_status,
            commands::stage_all,
            commands::unstage_all,
            commands::stage_paths,
            commands::unstage_paths,
            commands::discard_paths,
            commands::discard_all,
            commands::commit_staged,
            commands::get_working_tree_diff,
            commands::search_commits,
            commands::list_git_auth_connections,
            commands::upsert_git_auth_connection,
            commands::remove_git_auth_connection,
            commands::open_url,
        ])
        .setup(|app| {
            let menu = build_native_menu(app)?;
            app.set_menu(menu)?;

            app.on_menu_event(|app, event| {
                let action = match event.id().as_ref() {
                    "open_about" => Some("open_about"),
                    "open_repository" => Some("open_repository"),
                    "close_repository" => Some("close_repository"),
                    "reload_graph" => Some("reload_graph"),
                    "focus_search" => Some("focus_search"),
                    "toggle_sidebar" => Some("toggle_sidebar"),
                    "open_settings" => Some("open_settings"),
                    "show_shortcuts" => Some("show_shortcuts"),
                    _ => None,
                };

                if let Some(action) = action {
                    let _ = app.emit("native-menu-action", action);
                }
            });

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

