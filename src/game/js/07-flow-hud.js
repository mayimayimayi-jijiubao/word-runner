            // ===== 关卡检查 =====
            function checkLevelState() {
                if (ST.lives <= 0) {
                    endGame(); return;
                }
                // 连击4个错误 → 失败
                if (ST.wrongStreak >= CFG.rules.failWrongStreak) {
                    endGame(); return;
                }
                // 累计9个正确 或 连续4个正确 → 过关
                // v2.8.6: 延迟通关逻辑
                const isWin = ST.correctTotal >= CFG.rules.winCorrectTotal || ST.correctStreak >= CFG.rules.winCorrectStreak;

                if (isWin && !ST.isCompletingLevel) {
                    // 开始通关流程：光环动画 -> 延迟 -> 弹窗
                    ST.isCompletingLevel = true;
                    ST.ringCompleteAnim = 1.0; // 触发外环闪烁动画
                    SFX.levelUp(); // 播放音效

                    // 1.5秒后显示结算界面
                    setTimeout(() => {
                        clearLevel();
                    }, 1500);
                }
            }

            function clearLevel() {
                ST.paused = true;
                ST.totalLevelsCleared++;
                ST.streakLevels++;

                SFX.levelUp();

                // v2.8: 累加已完成的字数
                ST.completedWordCount++;

                // v2.8.2: 修正通关简报显示
                const lcInfo = document.getElementById('lc-info');
                const justPassedLevel = ST.levelIndex + 1;

                // 通关标题
                const phaseLabel = ST.gamePhase === 'wordToSound' ? '字找音' : '音找字';
                document.querySelector('#level-clear h2').textContent = `${phaseLabel} 第${justPassedLevel}关 通过！`;

                // 任务简报
                const taskDisplay = ST.gamePhase === 'wordToSound'
                    ? `${ST.currentCorrectWord} → ${ST.currentPinyin}`
                    : `${ST.currentPinyin} → ${ST.currentCorrectWord}`;
                lcInfo.innerHTML = `任务：${taskDisplay}<br>正确：${ST.correctTotal}个 | 连击：${ST.maxCombo}<br>得分：${ST.score}分<br>等级：${getLevel(ST.score).rank}`;

                document.getElementById('level-clear').style.display = 'flex';
            }

            function nextLevel() {
                document.getElementById('level-clear').style.display = 'none';
                ST.levelIndex++;
                const currentList = ST.gamePhase === 'wordToSound' ? wordList : pinyinList;
                if (ST.levelIndex >= currentList.length) {
                    if (ST.gamePhase === 'soundToWord') {
                        // 音找字完成，显示过渡弹窗
                        ST.paused = true;
                        document.getElementById('phase-transition').style.display = 'flex';
                        return;
                    } else {
                        // 字找音也完成，游戏结束
                        endGame(true); return;
                    }
                }
                startLevel();
            }

            function startLevel() {
                ST.levelTime = 0; ST.correctTotal = 0; ST.correctStreak = 0; ST.wrongStreak = 0; ST.combo = 0; ST.maxCombo = 0;
                ST.comboDisplayTimer = 0;
                ST.isCompletingLevel = false;
                ST.objects = []; ST.particles = [];
                ST.appearedCorrectWords.clear();

                if (ST.gamePhase === 'wordToSound') {
                    // 字找音：任务区显示汉字，跑道出现拼音
                    ST.currentCorrectWord = wordList[ST.levelIndex];
                    const matches = getAllData().filter(d => d.word === ST.currentCorrectWord);
                    ST.currentPinyin = matches.length > 0 ? matches[0].pinyin : '';
                    ST.currentTaskDisplay = ST.currentCorrectWord;
                    ST.currentWord = ST.currentCorrectWord;
                } else {
                    // 音找字：任务区显示拼音，跑道出现汉字
                    ST.currentPinyin = pinyinList[ST.levelIndex];
                    const matches = getAllData().filter(d => d.pinyin === ST.currentPinyin);
                    if (matches.length > 0) {
                        const selectedItem = matches[Math.floor(Math.random() * matches.length)];
                        ST.currentCorrectWord = selectedItem.word;
                        ST.currentWord = selectedItem.word;
                    } else {
                        ST.currentCorrectWord = '';
                        ST.currentWord = ST.currentPinyin;
                    }
                    ST.currentTaskDisplay = ST.currentPinyin;
                }

                ST.paused = false;
                ST.levelTimer = 0;
                updateHUD();
                // 任务提示音
                const playTaskPrompt = () => {
                    if (ST.gamePhase === 'soundToWord') {
                        spellPinyin(ST.currentPinyin);
                    } else {
                        speakWord(ST.currentCorrectWord);
                    }
                };
                if (IS_CHROMIUM) {
                    playTaskPrompt();
                } else {
                    setTimeout(playTaskPrompt, 300);
                }
            }

            function endGame(allClear) {
                ST.gameOver = true; ST.running = false;
                if (!allClear) ST.failedLevelIndex = ST.levelIndex; // v2.8: 记录失败的关卡索引
                stopBGM();
                if (!allClear) SFX.gameOver(); else SFX.levelUp();
                const stats = document.getElementById('go-stats');
                const title = document.querySelector('#game-over h2');
                title.textContent = allClear ? '🎉 全部通关！' : '游戏结束';
                title.style.color = allClear ? '#00ffcc' : '#ff6b6b';
                // v2.8.1: 修复游戏结束统计信息，显示正确的进度
                const currentProgress = `${ST.completedWordCount}/${getAllData().length}`; // 当前已完成的字数
                const currentLevel = `第${ST.levelIndex + 1}关`; // 当前关卡
                stats.innerHTML = `当前进度：${currentProgress}<br>当前小关：${currentLevel}<br>总得分：${ST.score}<br>最高连击：${ST.maxCombo}<br>等级：${getLevel(ST.score).rank}`;
                document.getElementById('game-over').style.display = 'flex';
            }

            function restartGame() {
                document.getElementById('game-over').style.display = 'none';
                ST.lives = CFG.rules.initLives; ST.score = 0; ST.combo = 0; ST.maxCombo = 0;
                // v2.8: 从失败的关卡重新开始，保持进度
                if (ST.failedLevelIndex >= 0) {
                    ST.levelIndex = ST.failedLevelIndex;
                } else {
                    ST.levelIndex = 0;
                    ST.completedWordCount = 0;
                    ST.gamePhase = 'soundToWord'; // 重置为音找字阶段
                }
                ST.totalLevelsCleared = 0; ST.streakLevels = 0;
                ST.objects = []; ST.particles = []; ST.roadLines = [];
                roadLineSpawnAcc = 0;
                ST.appearedCorrectWords.clear();
                ST.lastTime = 0;
                ST.gameOver = false; ST.running = true; ST.paused = false;
                if (ST.failedLevelIndex < 0) {
                    updateDataLists(); // 重置或开始前确保数据列表是最新的
                    shuffleArray(pinyinList);
                    shuffleArray(wordList);
                }
                startLevel();
                startBGM();
            }

            // ===== HUD 更新 =====
            function updateHUD() {
                // 分数 & 生命
                // 生命值 (支持半心)
                let hearts = '';
                const full = Math.floor(ST.lives);
                const half = ST.lives % 1 >= 0.5 ? 1 : 0;
                const empty = Math.max(0, CFG.rules.initLives - full - half);
                for (let i = 0; i < full; i++) hearts += '❤️';
                if (half) hearts += '💔';
                for (let i = 0; i < empty; i++) hearts += '🖤';
                document.getElementById('hud-hearts').textContent = hearts;

                // 时间
                const remaining = Math.max(0, Math.ceil(CFG.rules.levelTime - ST.levelTime));
                document.getElementById('hud-timer').textContent = remaining + 's';
                document.getElementById('hud-timer').style.color = remaining <= 10 ? '#ff3c3c' : '#ff6b6b';

                // 任务
                document.getElementById('hud-task').textContent = `任务：${ST.currentPinyin}`;

                // 分数
                document.getElementById('hud-score').textContent = ST.score + '分';

                // 等级
                const lv = getLevel(ST.score);
                document.getElementById('hud-level').textContent = `Lv.${lv.levelNumber} ${lv.rank}`;

                // v2.8.6: 连击提示优化（带动画）
                const comboEl = document.getElementById('hud-combo');
                if (ST.combo >= 2 && ST.comboDisplayTimer > 0) {
                    comboEl.textContent = `🔥 ${ST.combo}连击！`;
                    comboEl.classList.remove('fade-out');
                    comboEl.style.opacity = '1';
                } else {
                    comboEl.classList.add('fade-out');
                    // opacity由CSS处理
                }
            }

            let hudFrameTimer = 0;
            function updateHUDThrottled(dt, force = false) {
                if (force) {
                    updateHUD();
                    hudFrameTimer = 0;
                    return;
                }
                hudFrameTimer += dt;
                if (hudFrameTimer >= 0.12) {
                    updateHUD();
                    hudFrameTimer = 0;
                }
            }

            // ===== 物体生成计时器 =====
            let spawnTimer = 0;
            function updateSpawner(dt) {
                const diff = getDifficulty();
                spawnTimer += dt * 1000;
                if (spawnTimer >= diff.interval) {
                    spawnObject();
                    spawnTimer = 0;
                }
            }

