        // ══════════════════════════════════════════════
        //  Save / Load / Reset
        // ══════════════════════════════════════════════
        function save() {
            uiToCFG();
            localStorage.setItem('WRM_UserConfig', JSON.stringify(CFG));
            showToast('✓ 配置已保存至本地存储');
        }

        function load() {
            try {
                const raw = localStorage.getItem('WRM_UserConfig');
                if (!raw) return;
                const saved = JSON.parse(raw);
                deepMerge(CFG, saved);
                // Restore grades array if present
                if (saved.character && Array.isArray(saved.character.grades)) {
                    CFG.character.grades = saved.character.grades;
                }
            } catch (e) {
                console.warn('加载配置失败:', e);
            }
        }

        function resetToDefaults() {
            const fresh = JSON.parse(JSON.stringify(DEFAULTS));
            Object.keys(fresh).forEach(k => CFG[k] = fresh[k]);
            cfgToUI();
            showToast('✓ 已恢复默认配置');
        }

        function showToast(msg) {
            const t = document.getElementById('toast');
            if (msg) t.textContent = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 2000);
        }

        // ══════════════════════════════════════════════
        //  Download / Share
        // ══════════════════════════════════════════════
        // ══════════════════════════════════════════════
        //  Download / Share (Standalone Game Export) - v3.5.0
        // ══════════════════════════════════════════════
        async function downloadShare() {
            uiToCFG();

            // 1. 核心需求：全量导出数据 (强制将 CSV 解析结果固化到 CFG)
            if (CFG.unit_settings && Array.isArray(CFG.unit_settings.csvData)) {
                CFG.dataSource = CFG.dataSource || {};
                CFG.dataSource.offlineData = CFG.unit_settings.csvData.map(d => ({
                    word: d.word || '',
                    pinyin: d.pinyin || '',
                    radical: d.radical || '',
                    words_std: d.words_std || ''
                }));
                console.log('✅ 已全量固化离线数据:', CFG.dataSource.offlineData.length, '条');
            }

            // 2. 文件名安全过滤 (Sanitize filename)
            const rawName = CFG.unit_settings.unitName || '单元信息';
            const safeName = rawName.replace(/[\\/:\*\?"<>\|]/g, '_').trim(); // 基础过滤
            const fileName = `${safeName}.html`;
            const cfgJson = JSON.stringify(CFG, null, 2);

            try {
                // 获取游戏模板
                let template = '';
                try {
                    const resp = await fetch('index.html');
                    if (resp.ok) {
                        template = await resp.text();
                    } else { throw new Error('Fetch failed'); }
                } catch (e) {
                    alert('❌ 下载失败：无法获取 index.html。请在本地服务器环境运行本页面。');
                    return;
                }

                // 3. 即时自愈逻辑注入 (window.OFFLINE_CONFIG)
                // 在 head 顶部注入，确保比任何引擎逻辑都先运行
                const injection = `
    <!-- Standalone Force Offline Config (v4.6) -->
    <script>
        window.OFFLINE_CONFIG = ${cfgJson};
        // 强制初始化自愈 (解决 File 协议 localStorage 受限问题)
        try {
            localStorage.setItem('WRM_UserConfig', JSON.stringify(window.OFFLINE_CONFIG));
        } catch(e) { console.warn("LocalStorage access denied in File protocol mode."); }
    <\/script>
                `;

                // 注入到 </head> 之前
                let finalHtml = template.replace('</head>', injection + '\n</head>');

                // 4. (已移除双重保障：保留 index.html 原生 WRM_CONFIG，由 loadConfig 进行安全合并)
                // 这修复了导出后因缺少基础字段 (如 rules, physics) 导致 ST 对象初始化崩溃的问题

                // 同步标题
                finalHtml = finalHtml.replace(/<title>.*?<\/title>/, `<title>${safeName} - 字跑大师</title>`);

                // 5. 触发物理下载
                const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = fileName;
                document.body.appendChild(a); a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                showToast(`📥 ${fileName} 导出成功`);
            } catch (err) {
                console.error(err);
                showToast('❌ 导出失败，请检查控制台');
            }
        }

        // ══════════════════════════════════════════════
        //  Events
        // ══════════════════════════════════════════════
        document.getElementById('btn-save').addEventListener('click', save);
        document.getElementById('btn-reset').addEventListener('click', resetToDefaults);
        document.getElementById('btn-download').addEventListener('click', downloadShare);

        // ══════════════════════════════════════════════
        //  Init
        // ══════════════════════════════════════════════
        load();
        cfgToUI();
