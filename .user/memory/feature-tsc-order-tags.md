# TSC order-tag integration

- Branch: feature/tsc-order-tags in webapp-vue; Print Server feature is merged into local main.
- Preview successfully printed a physical 25 x 20 mm label through Cloudflare and the TSC LAN queue.
- The pending update adds a confirmation dialog and editable 1–999 tag count with 999-tag batching.
- Web/API typechecks, build, import check, focused dry tests, and Print Server tests pass.
- Push the updated Webapp branch and browser-verify the dialog on Preview.
- Print Server local main still needs explicit authorization before pushing to its GitHub origin.
- The 35 mm design and barcode persistence remain separate follow-up work.
