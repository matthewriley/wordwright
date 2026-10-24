; Tauri's fileAssociations config has no icon field (verified against the
; actual tauri-utils FileAssociation struct), so the NSIS installer
; template hardcodes the .md file-association icon to the app's own exe.
; This hook runs after the installer has already created the
; "Markdown Document" class and its DefaultIcon key (APP_ASSOCIATE, in
; FileAssociation.nsh) — overwriting DefaultIcon here gives .md/.markdown
; their own icon instead. wordwright-markdown.ico is bundled via
; tauri.conf.json's bundle.resources, landing directly in $INSTDIR.
; No uninstall-side hook needed: APP_UNASSOCIATE already deletes the whole
; "Markdown Document" class key tree, DefaultIcon included.
!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\Markdown Document\DefaultIcon" "" "$INSTDIR\wordwright-markdown.ico,0"
!macroend
