            // ===== 游戏状态 =====
            const ST = {
                running: false, paused: false, gameOver: false,
                lives: CFG.rules.initLives, score: 0, combo: 0, maxCombo: 0,
                levelIndex: 0, levelTime: 0, levelTimer: 0,
                correctTotal: 0, correctStreak: 0, wrongStreak: 0,
                currentPinyin: '', currentWord: '', currentCorrectWord: '', // v2.8: 本关唯一正确汉字
                trackIndex: 1, playerJump: 0, vy: 0, isGrounded: true, playerAnim: 0,
                landingScale: 1.0, // 落地挤压缩放
                isRunning: false, runSpeedMultiplier: 1.0, // v2.8: 跑动状态和速度倍率
                runAnimPhase: 0, // v2.8.3: 跑动动画阶段
                objects: [], particles: [], roadLines: [],
                streakLevels: 0, totalLevelsCleared: 0,
                completedWordCount: 0, // v2.8: 已完成的字数（用于显示总进度）
                failedLevelIndex: -1, // v2.8: 失败时的关卡索引
                ringCompleteAnim: 0, // v2.8: 外环完成动画进度
                appearedCorrectWords: new Set(), // v2.5: 跟踪已出现的同音字
                gamePhase: 'soundToWord', // v4.1: 游戏阶段 soundToWord | wordToSound
                currentTaskDisplay: '', // v4.1: 任务区显示内容
                dt: 0, lastTime: 0, frameCount: 0
            };

            // ===== 关卡数据 =====
            // v4.0: 用函数取代const，确保loadConfig后始终读取最新数据
            function getAllData() { return CFG.dataSource.offlineData; }
            let pinyinList = [];
            let wordList = [];

            function updateDataLists() {
                const data = getAllData();
                pinyinList = data.map(d => d.pinyin).filter(Boolean);
                wordList = data.map(d => d.word).filter(Boolean);
                console.log('Data Lists Updated:', pinyinList.length, 'words');
            }
            updateDataLists(); // 初始化一次

            // ===== 数组洗牌 =====
            function shuffleArray(arr) {
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            }

            // ===== 等级计算 =====
            function getLevel(score) {
                // 使用配置中的等级规则
                const grades = (CFG.character && CFG.character.grades) || [
                    { name: "识字新兵", score: 0 }
                ];
                let lvIdx = 0;
                for (let i = 0; i < grades.length; i++) {
                    if (score >= grades[i].score) lvIdx = i;
                }
                const lv = grades[lvIdx];
                return {
                    rank: lv.name || lv.rank || "识字新兵",
                    levelNumber: lvIdx + 1
                };
            }

            // ===== 难度曲线 =====
            function getDifficulty() {
                const t = Math.min(ST.levelTime / CFG.rules.levelTime, 1);
                const d = CFG.difficulty;
                const lerp = (a, b) => a + (b - a) * t;
                return {
                    speed: lerp(d.speedStart, d.speedEnd),
                    interval: lerp(d.intervalStart, d.intervalEnd),
                    pObstacle: lerp(d.obstacleStart, d.obstacleEnd),
                    pWrong: lerp(d.wrongStart, d.wrongEnd),
                    pCorrect: lerp(d.correctStart, d.correctEnd)
                };
            }

            // ===== localStorage 配置管理 =====
            function loadConfig() {
                try {
                    // 优先读取内嵌配置（独立导出包专用，解决 File 协议限制）
                    let config = null;
                    if (window.OFFLINE_CONFIG) {
                        config = window.OFFLINE_CONFIG;
                        console.log('📦 使用内嵌配置 (OFFLINE_CONFIG) 启动');
                    } else if (window.FORCE_OFFLINE_CONFIG) {
                        config = window.FORCE_OFFLINE_CONFIG;
                        console.log('📦 使用内嵌配置 (FORCE_OFFLINE_CONFIG) 启动');
                    } else if (window.EMBEDDED_CONFIG) {
                        config = window.EMBEDDED_CONFIG;
                        console.log('📦 使用内嵌配置 (EMBEDDED_CONFIG) 启动');
                    } else {
                        const saved = localStorage.getItem('WRM_UserConfig');
                        if (!saved) return;
                        config = JSON.parse(saved);
                    }

                    // ── 兼容旧格式（直接有 rules/physics/difficulty/ui 字段）──
                    if (config.rules) Object.assign(CFG.rules, config.rules);
                    if (config.physics) Object.assign(CFG.physics, config.physics);
                    if (config.difficulty) Object.assign(CFG.difficulty, config.difficulty);
                    if (config.ui) Object.assign(CFG.ui, config.ui);

                    // ── 配置中心 v2.0 新格式映射 ──
                    // 物理引擎
                    const pe = config.physical_engine;
                    if (pe) {
                        if (pe.obstacleScale) {
                            if (pe.obstacleScale.near !== undefined) CFG.physics.objScaleEnd = pe.obstacleScale.near;
                            if (pe.obstacleScale.far !== undefined) CFG.physics.objScaleStart = pe.obstacleScale.far;
                        }
                        if (pe.itemScale) {
                            // itemScale 与 objScale 共享（游戏中统一处理）
                            if (pe.itemScale.far !== undefined) CFG.physics.objScaleStart = pe.itemScale.far;
                            if (pe.itemScale.near !== undefined) CFG.physics.objScaleEnd = pe.itemScale.near;
                        }
                        if (pe.physics) {
                            if (pe.physics.jumpForce !== undefined) CFG.physics.jumpForce = pe.physics.jumpForce;
                            if (pe.physics.gravity !== undefined) CFG.physics.gravity = pe.physics.gravity;
                        }
                    }

                    // 小关通关设置
                    const ls = config.level_settings;
                    if (ls) {
                        if (ls.goals) {
                            if (ls.goals.timeLimit !== undefined) CFG.rules.levelTime = ls.goals.timeLimit;
                            if (ls.goals.targetCount !== undefined) CFG.rules.winCorrectTotal = ls.goals.targetCount;
                            if (ls.goals.comboTarget !== undefined) CFG.rules.winCorrectStreak = ls.goals.comboTarget;
                        }
                        if (ls.fail) {
                            if (ls.fail.comboWrong !== undefined) CFG.rules.failWrongStreak = ls.fail.comboWrong;
                            // totalWrong 暂由生命值系统兜底
                        }
                    }

                    // 难度设置
                    const diff = config.difficulty_and_level || config.difficulty;
                    if (config.difficulty && config.difficulty.spawn) {
                        const sp = config.difficulty.spawn;
                        if (sp.targetDensity !== undefined) CFG.difficulty.correctStart = sp.targetDensity;
                        if (sp.distractorDensity !== undefined) CFG.difficulty.wrongStart = sp.distractorDensity;
                        if (sp.obstacleDensity !== undefined) CFG.difficulty.obstacleStart = sp.obstacleDensity;
                    }

                    // 计分系统
                    const sc = config.scoring;
                    if (sc) {
                        if (sc.base) {
                            if (sc.base.hitTarget !== undefined) CFG.scoring.correctBase = sc.base.hitTarget;
                            if (sc.base.hitDistractor !== undefined) CFG.scoring.hitDistractor = sc.base.hitDistractor;
                            if (sc.base.hitObstacle !== undefined) CFG.scoring.hitObstacle = sc.base.hitObstacle;
                        }
                        if (sc.combo) {
                            // 连击最大值取最高定义的连击数
                            CFG.scoring.comboMax = 5;
                            // 存储连击奖励表供游戏使用
                            CFG.scoring.comboRewards = {};
                            if (sc.combo.combo2 !== undefined) CFG.scoring.comboRewards[2] = sc.combo.combo2;
                            if (sc.combo.combo3 !== undefined) CFG.scoring.comboRewards[3] = sc.combo.combo3;
                            if (sc.combo.combo4 !== undefined) CFG.scoring.comboRewards[4] = sc.combo.combo4;
                            if (sc.combo.combo5 !== undefined) CFG.scoring.comboRewards[5] = sc.combo.combo5;
                        }
                        if (sc.lives) {
                            if (sc.lives.initLives !== undefined) CFG.rules.initLives = sc.lives.initLives;
                            if (sc.lives.distractorDamage !== undefined) CFG.rules.wrongDamage = sc.lives.distractorDamage;
                            if (sc.lives.obstacleDamage !== undefined) CFG.rules.obstacleDamage = sc.lives.obstacleDamage;
                        }
                    }

                    // 角色设置
                    const ch = config.character;
                    if (ch) {
                        if (ch.nickname) CFG.metadata.playerName = ch.nickname;
                        if (Array.isArray(ch.grades) && ch.grades.length > 0) {
                            // 同步到核心配置，确保 getLevel 能读取到最新阈值
                            CFG.character.grades = ch.grades;
                        }
                    }

                    // 单元关卡设置（模式/CSV数据）
                    const us = config.unit_settings;
                    if (us) {
                        if (us.unitName) CFG.metadata.unitTitle = us.unitName;
                        if (us.mode === 'soundToWord') {
                            CFG.levelDesign = CFG.levelDesign || {};
                            CFG.levelDesign.levelName = '音找字';
                            CFG.levelDesign.taskSource = 'pinyin';
                            CFG.levelDesign.correctSource = 'word';
                            CFG.levelDesign.wrongSource = 'word_exclude_homophone';
                        } else if (us.mode === 'wordToSound') {
                            CFG.levelDesign = CFG.levelDesign || {};
                            CFG.levelDesign.levelName = '字找音';
                            CFG.levelDesign.taskSource = 'word';
                            CFG.levelDesign.correctSource = 'pinyin';
                            CFG.levelDesign.wrongSource = 'pinyin';
                        }
                        // CSV 数据注入
                        if (Array.isArray(us.csvData) && us.csvData.length > 0) {
                            CFG.dataSource.offlineData = us.csvData.map(row => ({
                                word: row.word || '',
                                pinyin: row.pinyin || '',
                                radical: row.radical || '',
                                words_std: row.words_std || ''
                            }));
                        }
                    }
                    updateDataLists(); // 加载配置后必须同步全局变量

                } catch (e) {
                    console.warn('Failed to load config:', e);
                }
                syncUIText();
            }

            // v4.3: 同步 UI 文字 (标题/首屏)
            function syncUIText() {
                if (CFG.metadata && CFG.metadata.unitTitle) {
                    // 强制锁定浏览器标签页标题和游戏标题为“字跑大师”
                    document.title = '字跑大师';
                    // 保持启动界面标题内容固定，不从 unitTitle 同步
                    console.log('📝 标题已锁定为：字跑大师');
                }
            }
            function saveConfig() {
                try {
                    const config = {
                        ui: { isInvincible: CFG.ui.isInvincible },
                        difficulty: { ...CFG.difficulty },
                        rules: { ...CFG.rules },
                        physics: { ...CFG.physics }
                    };
                    localStorage.setItem('WRM_UserConfig', JSON.stringify(config));
                } catch (e) {
                    console.warn('Failed to save config:', e);
                }
            }

