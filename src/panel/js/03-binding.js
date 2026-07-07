        // ══════════════════════════════════════════════
        //  Grade table rendering
        // ══════════════════════════════════════════════
        function renderGradeTable() {
            const tbody = document.getElementById('grade-tbody');
            const grades = CFG.character.grades;
            tbody.innerHTML = '';
            grades.forEach((g, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="grade-level">${g.level}</td>
                    <td><input type="text" data-grade-idx="${i}" data-grade-field="name" value="${g.name}" style="width:80px"></td>
                    <td><input type="number" data-grade-idx="${i}" data-grade-field="score" value="${g.score}" style="width:80px"></td>
                `;
                tbody.appendChild(tr);
            });
            // Bind events
            tbody.querySelectorAll('input').forEach(inp => {
                inp.addEventListener('input', () => {
                    const idx = parseInt(inp.dataset.gradeIdx);
                    const field = inp.dataset.gradeField;
                    if (field === 'score') {
                        CFG.character.grades[idx].score = parseFloat(inp.value) || 0;
                    } else {
                        CFG.character.grades[idx].name = inp.value;
                    }
                });
            });
        }

        // ══════════════════════════════════════════════
        //  Two-way binding
        // ══════════════════════════════════════════════
        // Collect bindable inputs (exclude grade-table and csv)
        function getBindableInputs() {
            return document.querySelectorAll(
                'input[id]:not([type=file]):not([data-grade-idx]), select[id]'
            );
        }

        function cfgToUI() {
            getBindableInputs().forEach(el => {
                const path = el.id;
                const val = getByPath(CFG, path);
                if (val === undefined) return;
                if (el.type === 'checkbox') {
                    el.checked = !!val;
                } else if (el.type === 'range') {
                    el.value = val;
                    const span = document.querySelector(`.val[data-for="${path}"]`);
                    if (span) span.textContent = val;
                } else {
                    el.value = val;
                }
            });

            // sync editable preset nums
            const presetPaths = [
                'physical_engine.physics.jumpForce', 'physical_engine.physics.gravity',
                'level_settings.goals.timeLimit', 'level_settings.goals.targetCount', 'level_settings.goals.comboTarget',
                'level_settings.fail.totalWrong', 'level_settings.fail.comboWrong'
            ];
            presetPaths.forEach(syncEditablePresetHighlight);

            // mode tabs
            document.querySelectorAll('.mode-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.mode === CFG.unit_settings.mode);
            });
            document.getElementById('assoc-soundToWord').style.display =
                CFG.unit_settings.mode === 'soundToWord' ? '' : 'none';
            document.getElementById('assoc-wordToSound').style.display =
                CFG.unit_settings.mode === 'wordToSound' ? '' : 'none';

            renderGradeTable();
        }

        function uiToCFG() {
            // 1. Handle standard inputs (with IDs)
            getBindableInputs().forEach(el => {
                const path = el.id;
                let val;
                if (el.type === 'checkbox') {
                    val = el.checked;
                } else if (el.type === 'range' || el.type === 'number') {
                    val = parseFloat(el.value);
                } else if (el.tagName === 'SELECT') {
                    val = isNaN(el.value) ? el.value : parseFloat(el.value);
                } else {
                    val = el.value;
                }
                setByPath(CFG, path, val);
            });

            // 2. Handle group presets (Winning conditions, Kinematics etc)
            document.querySelectorAll('.preset-group').forEach(group => {
                const activeNum = group.querySelector('.preset-num.active');
                if (activeNum) {
                    const path = activeNum.dataset.target;
                    const val = parseFloat(activeNum.value);
                    if (!isNaN(val)) setByPath(CFG, path, val);
                }
            });
        }

        // ══════════════════════════════════════════════
        //  Live binding events
        // ══════════════════════════════════════════════
        document.querySelectorAll('input[type=range]').forEach(slider => {
            slider.addEventListener('input', () => {
                const span = document.querySelector(`.val[data-for="${slider.id}"]`);
                if (span) span.textContent = slider.value;
                setByPath(CFG, slider.id, parseFloat(slider.value));
            });
        });
        document.querySelectorAll('input[type=number]').forEach(inp => {
            if (inp.dataset.gradeIdx !== undefined) return;
            inp.addEventListener('input', () => {
                if (inp.id) setByPath(CFG, inp.id, parseFloat(inp.value));
            });
        });
        document.querySelectorAll('.preset-input').forEach(inp => {
            inp.addEventListener('input', () => {
                syncPresetHighlight(inp);
                const num = parseFloat(inp.value);
                setByPath(CFG, inp.id, isNaN(num) ? inp.value : num);
            });
        });
        document.querySelectorAll('input[type=text]').forEach(inp => {
            if (inp.classList.contains('preset-input')) return;
            if (inp.dataset.gradeIdx !== undefined) return;
            inp.addEventListener('input', () => {
                if (inp.id) setByPath(CFG, inp.id, inp.value);
            });
        });

