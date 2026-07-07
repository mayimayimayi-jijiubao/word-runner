        // ══════════════════════════════════════════════
        //  Utility functions
        // ══════════════════════════════════════════════
        function getByPath(obj, path) {
            return path.split('.').reduce((o, k) => o && o[k], obj);
        }
        function setByPath(obj, path, val) {
            const keys = path.split('.');
            let cur = obj;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!(keys[i] in cur)) cur[keys[i]] = {};
                cur = cur[keys[i]];
            }
            cur[keys[keys.length - 1]] = val;
        }
        function deepMerge(target, source) {
            for (const key of Object.keys(source)) {
                if (source[key] && typeof source[key] === 'object' &&
                    !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object') {
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }

        // ══════════════════════════════════════════════
        //  Collapsible sections
        // ══════════════════════════════════════════════
        function toggleSection(id) {
            document.getElementById(id).classList.toggle('collapsed');
        }

        // ══════════════════════════════════════════════
        //  Preset select (3-option + text)
        // ══════════════════════════════════════════════
        function setPreset(path, value, btnEl) {
            const input = document.getElementById(path);
            if (input) input.value = value;
            // highlight active btn
            const group = btnEl.parentElement;
            group.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btnEl.classList.add('active');
            // sync to CFG
            setByPath(CFG, path, value);
        }

        // Editable preset number: click to select, edit value in-place
        function selectEditablePreset(el) {
            const path = el.dataset.target;
            const val = parseFloat(el.value);
            if (isNaN(val)) return;

            // 1. highlight active in THIS group
            const group = el.parentElement;
            group.querySelectorAll('.preset-num').forEach(b => b.classList.remove('active'));
            el.classList.add('active');

            // 2. update CFG object
            setByPath(CFG, path, val);

            // 3. (Optional) Sync other inputs if they exist (unlikely now)
            const input = document.getElementById(path);
            if (input) input.value = val;
        }

        // Sync editable preset highlight when value matches
        function syncEditablePresetHighlight(path) {
            const val = getByPath(CFG, path);
            document.querySelectorAll(`.preset-num[data-target="${path}"]`).forEach(num => {
                num.classList.toggle('active', parseFloat(num.value) == val);
            });
        }

        // Bind change events to all editable preset numbers
        document.querySelectorAll('.preset-num').forEach(num => {
            num.addEventListener('change', () => {
                // When user edits the value and presses enter or blurs, just update the value
                // but do NOT auto-select — user needs to click to select
            });
            // Prevent click default from selecting text inside, keep focus for editing
            num.addEventListener('focus', (e) => e.target.select());
        });

        function syncPresetHighlight(inputEl) {
            const group = inputEl.parentElement;
            const val = inputEl.value.trim();
            group.querySelectorAll('.preset-btn').forEach(b => {
                b.classList.toggle('active', b.textContent.trim() === val);
            });
        }

        // ══════════════════════════════════════════════
        //  Mode tabs (音找字 / 字找音)
        // ══════════════════════════════════════════════
        function switchMode(el) {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            const mode = el.dataset.mode;
            CFG.unit_settings.mode = mode;
            document.getElementById('assoc-soundToWord').style.display = mode === 'soundToWord' ? '' : 'none';
            document.getElementById('assoc-wordToSound').style.display = mode === 'wordToSound' ? '' : 'none';
        }

        // ══════════════════════════════════════════════
        //  CSV upload
        // ══════════════════════════════════════════════
        document.getElementById('csv-file-input').addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const area = document.getElementById('csv-upload-area');
            const nameEl = document.getElementById('csv-file-name');
            const unitNameInput = document.getElementById('unit_settings.unitName');

            const reader = new FileReader();
            reader.onload = function (ev) {
                const text = ev.target.result;
                const lines = text.trim().split(/\r?\n/);
                const headers = lines[0].split(',').map(h => h.trim());
                const data = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    const row = {};
                    headers.forEach((h, idx) => row[h] = (cols[idx] || '').trim());
                    data.push(row);
                }
                CFG.unit_settings.csvData = data;

                // Update UI
                const baseName = file.name.replace(/\.csv$/i, '');
                area.classList.add('has-file');
                nameEl.textContent = '✓ ' + file.name + '（' + data.length + ' 条数据）';

                // 自动填入并更新单元名称
                unitNameInput.value = baseName;
                CFG.unit_settings.unitName = baseName;
            };
            reader.readAsText(file);
        });

