            // ===== 启动 =====
            // 页面加载时加载保存的配置
            loadConfig();
            // v2.9.1: 同步 ST.lives（loadConfig 在 ST 初始化之后执行，需手动同步）
            ST.lives = CFG.rules.initLives;
            // v4.0: loadConfig 可能注入了新的 CSV 数据，刷新列表
            // v4.2: 任务总数等于 offlineData 总数（不去重）
            pinyinList = CFG.dataSource.offlineData.map(d => d.pinyin);
            wordList = CFG.dataSource.offlineData.map(d => d.word);

            // ═══════ 任务看板逻辑 ═══════
            function openTaskBoard() {
                const board = document.getElementById('task-board');
                const grid = document.getElementById('tb-grid');
                const data = CFG.dataSource.offlineData;

                // 标题
                document.getElementById('tb-title').textContent = CFG.metadata.unitTitle || '单元信息';

                // 摘要统计
                const wordCount = data.length;
                const allWords = data.map(d => d.words_std || '').filter(Boolean);
                const wordPhrases = new Set();
                allWords.forEach(w => w.split(/[、，,]/).forEach(p => { if (p.trim()) wordPhrases.add(p.trim()); }));
                document.getElementById('tb-summary').innerHTML =
                    `本单元生字共 <em>${wordCount}</em> 个汉字，<em>${wordPhrases.size}</em> 个词语`;

                // 生成卡片
                grid.innerHTML = '';
                data.forEach((item, idx) => {
                    const card = document.createElement('div');
                    card.className = 'fc-container';
                    card.dataset.idx = idx;

                    // 背面词语：高亮生字
                    const wordsRaw = (item.words_std || '').split(/[、，,]/);
                    const wordsHtml = wordsRaw.map(w => {
                        if (!w.trim()) return '';
                        return w.split('').map(ch =>
                            ch === item.word ? `<span class="hl">${ch}</span>` : ch
                        ).join('');
                    }).filter(Boolean).join('<br>');

                    card.innerHTML = `
                        <div class="fc-inner">
                            <div class="fc-front">
                                <div class="fc-word">${item.word}</div>
                                <div class="fc-pinyin">${item.pinyin}</div>
                            </div>
                            <div class="fc-back">
                                <div class="fc-word-back">${item.word}</div>
                                <div class="fc-radical">部首 <span>${item.radical || '—'}</span></div>
                                <div class="fc-words-list">${wordsHtml || '—'}</div>
                            </div>
                        </div>
                    `;
                    grid.appendChild(card);
                });

                board.classList.add('show');
                initCardInteraction();
            }

            // ─── Web Speech 工具 (Task Board) 已由统一引擎接管 ───

            // ─── 卡片交互（修复版：UI与音频完全解耦）───
            function initCardInteraction() {
                const cards = document.querySelectorAll('#tb-grid .fc-container');
                const data = CFG.dataSource.offlineData;
                let lastTouchTime = 0;

                cards.forEach(card => {
                    const idx = parseInt(card.dataset.idx);
                    const item = data[idx];
                    if (!item) return;

                    // ─── PC：鼠标交互 ───
                    let hoverActive = false;
                    let speechQueueTimer = null; // 用于管理连续音频播放的定时器
                    const startCardSpeech = () => {
                        if (!IS_CHROMIUM) stopSpeech(); // Chromium 下避免 cancel 与 speak 同帧冲突
                        clearTimeout(speechQueueTimer);
                        if (IS_CHROMIUM) {
                            VoiceEngine.speak(item.word, 0.9);
                            speechQueueTimer = setTimeout(() => {
                                if (!hoverActive) return;
                                spellPinyin(item.pinyin);
                                speechQueueTimer = setTimeout(() => {
                                    if (hoverActive) speakWords(item.words_std);
                                }, 1100);
                            }, 480);
                            return;
                        }
                        VoiceEngine.speak(item.word, 0.85);
                        speechQueueTimer = setTimeout(() => {
                            if (!hoverActive) return;
                            spellPinyin(item.pinyin); // 拼读
                            speechQueueTimer = setTimeout(() => {
                                if (hoverActive) speakWords(item.words_std);
                            }, 1500);
                        }, 600);
                    };

                    card.addEventListener('mouseenter', () => {
                        if (Date.now() - lastTouchTime < 500) return;
                        hoverActive = true;

                        // 【关键修复 1】：立即翻转，不等待音频！
                        // 只有当卡片不在翻转状态时，才执行翻转
                        if (!card.classList.contains('flipped')) {
                            card.classList.add('flipped');
                        }

                        // Chromium 需要用户激活事件，改为 pointerdown 触发朗读。
                        if (!IS_CHROMIUM) startCardSpeech();
                    });

                    card.addEventListener('pointerdown', () => {
                        if (Date.now() - lastTouchTime < 500) return;
                        hoverActive = true;
                        if (!card.classList.contains('flipped')) {
                            card.classList.add('flipped');
                        }
                        startCardSpeech();
                    });

                    card.addEventListener('mouseleave', () => {
                        if (Date.now() - lastTouchTime < 500) return;
                        hoverActive = false;

                        // 立即翻回正面
                        card.classList.remove('flipped');

                        // 立即停止声音并清除后续播放队列
                        stopSpeech();
                        clearTimeout(speechQueueTimer);
                    });

                    // ─── Mobile：触摸交互 ───
                    let tapCount = 0;
                    let tapTimer = null;

                    card.addEventListener('touchstart', (e) => {
                        lastTouchTime = Date.now();
                    }, { passive: true });

                    card.addEventListener('touchend', (e) => {
                        lastTouchTime = Date.now();
                        e.preventDefault();
                        tapCount++;

                        if (tapCount === 1) {
                            tapTimer = setTimeout(() => {
                                tapCount = 0;
                                stopSpeech();

                                // 手机端逻辑：点击翻转/折叠
                                // 如果卡片已经是翻转状态，则翻回来
                                if (card.classList.contains('flipped')) {
                                    card.classList.remove('flipped');
                                } else {
                                    // 修正逻辑：单击只读不翻，双击翻转（保持您原代码意图），或者单击就翻
                                    // 为了流畅性，建议：单击 = 读字 + 拼读
                                    VoiceEngine.speak(item.word, 0.85);
                                    setTimeout(() => spellPinyin(item.pinyin), 600);
                                }
                            }, 250);
                        } else if (tapCount >= 2) {
                            clearTimeout(tapTimer);
                            tapCount = 0;
                            stopSpeech();

                            // 双击：立即翻转 + 读组词
                            card.classList.toggle('flipped');
                            if (card.classList.contains('flipped')) {
                                speakWords(item.words_std);
                            }
                        }
                    });
                });
            }

            // ─── 启动游戏（从看板进入）───
            function launchGameFromBoard(phase) {
                const board = document.getElementById('task-board');
                board.classList.remove('show');
                stopSpeech();

                warmUpTTS();
                ensureAudio();
                updateDataLists(); // 进入游戏前最后一次对齐数据
                startBGM();

                // 设置游戏阶段
                if (phase === 'wordToSound') {
                    ST.gamePhase = 'wordToSound';
                    CFG.levelDesign = CFG.levelDesign || {};
                    CFG.levelDesign.levelName = '字找音';
                    CFG.levelDesign.taskSource = 'word';
                    CFG.levelDesign.correctSource = 'pinyin';
                    CFG.levelDesign.wrongSource = 'pinyin';
                } else {
                    ST.gamePhase = 'soundToWord';
                    CFG.levelDesign = CFG.levelDesign || {};
                    CFG.levelDesign.levelName = '音找字';
                    CFG.levelDesign.taskSource = 'pinyin';
                    CFG.levelDesign.correctSource = 'word';
                    CFG.levelDesign.wrongSource = 'word_exclude_homophone';
                }

                // 初始化游戏状态
                ST.levelIndex = 0;
                ST.score = 0;
                ST.lives = CFG.rules.initLives || 3;
                ST.gameOver = false;
                const wasRunning = ST.running;
                ST.running = true;

                updateHUD();
                startLevel();

                if (!wasRunning) {
                    ST.lastTime = performance.now();
                    requestAnimationFrame(gameLoop);
                }
            }

            document.getElementById('tb-btn-s2w').onclick = () => launchGameFromBoard('soundToWord');
            document.getElementById('tb-btn-w2s').onclick = () => launchGameFromBoard('wordToSound');

            // ─── 关键修复：Chrome 语音预热与手势解锁 ───
            function warmUpTTS() {
                if (ttsUnlocked) {
                    if ('speechSynthesis' in window) {
                        try { window.speechSynthesis.resume(); } catch (e) { }
                    }
                    return;
                }
                if (ttsUnlocking) return;
                ttsUnlocking = true;
                // 1. 恢复 AudioContext (Chrome 策略)
                ensureAudio();
                if (IS_CHROMIUM) {
                    // Chromium 下不再发预热 utterance，避免 warmup 自身被拦截后污染引擎状态。
                    ttsLastEvent = 'warmup-gesture';
                    ttsLastError = '';
                    ttsUnlocking = false;
                    setTTSUnlocked();
                    updateTTSDebug();
                    return;
                }
                // 2. 触发一个空的语音合成，以此获得浏览器播放权限
                // 必须在用户点击事件堆栈中同步执行
                if ('speechSynthesis' in window) {
                    cachedVoices = window.speechSynthesis.getVoices();
                    // Chromium 对纯空白和纯静音更容易忽略，使用极低音量的短词作为稳态预热。
                    let u = new SpeechSynthesisUtterance('开始');
                    u.lang = 'zh-CN';
                    u.volume = 0.2;
                    u.rate = 1;
                    u.onstart = setTTSUnlocked;
                    u.onend = setTTSUnlocked;
                    u.onerror = (e) => {
                        ttsReady = false;
                        ttsUnlocking = false;
                        ttsLastEvent = 'warmup-onerror';
                        ttsLastError = e && e.error ? e.error : 'unknown';
                        updateTTSDebug();
                    };
                    try { window.speechSynthesis.resume(); } catch (e) { }
                    window.speechSynthesis.speak(u);
                    ttsLastEvent = 'warmup-speak';
                    updateTTSDebug();
                    // Chromium 有时不触发 onstart/onend，但已接受 speak；给一次保底解锁。
                    setTimeout(() => {
                        if (!ttsUnlocked && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
                            setTTSUnlocked();
                        }
                    }, 120);
                } else {
                    ttsUnlocking = false;
                }
            }
            window.addEventListener('pointerdown', warmUpTTS, { once: true });
            window.addEventListener('keydown', warmUpTTS, { once: true });
            window.addEventListener('touchend', warmUpTTS, { once: true });

            document.getElementById('start-btn').onclick = () => {
                warmUpTTS(); // <--- 关键调用：用户亲手点击按钮，激活全部 Audio 授权
                const ss = document.getElementById('start-screen');
                ss.style.opacity = '0';
                setTimeout(() => ss.remove(), 600);
                // 打开任务看板而非直接启动游戏
                openTaskBoard();
            };
            initTTSDebugPanel();

            document.getElementById('go-restart').onclick = restartGame;
            document.getElementById('lc-next').onclick = nextLevel;

            // v4.1: 音找字→字找音 阶段切换
            document.getElementById('phase-next-btn').onclick = () => {
                document.getElementById('phase-transition').style.display = 'none';
                ST.gamePhase = 'wordToSound';
                ST.levelIndex = 0;
                ST.completedWordCount = 0;
                ST.failedLevelIndex = -1;
                shuffleArray(wordList);
                ST.paused = false;
                startLevel();
            };

        })();
