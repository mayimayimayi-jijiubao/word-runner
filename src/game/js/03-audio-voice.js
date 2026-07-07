            // ===== 音频引擎 =====
            let audioCtx = null;
            function ensureAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); }
            function synth(freq, type, decay, vol) {
                ensureAudio();
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = type; o.frequency.setValueAtTime(freq, audioCtx.currentTime);
                o.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.01, 1), audioCtx.currentTime + decay);
                g.gain.setValueAtTime(vol, audioCtx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + decay);
                o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + decay);
            }
            // ─── 语音系统 ───
            // 声母→中文注音映射，避免 TTS 把拉丁字母按英文读出
            const INITIAL_PHONETIC = {
                'b': '波', 'p': '坡', 'm': '摸', 'f': '佛',
                'd': '得', 't': '特', 'n': '呢', 'l': '勒',
                'g': '哥', 'k': '科', 'h': '喝',
                'j': '基', 'q': '七', 'x': '西',
                'zh': '知', 'ch': '吃', 'sh': '诗', 'r': '日',
                'z': '资', 'c': '次', 's': '思',
                'y': '衣', 'w': '乌'
            };

            function decomposePinyin(pinyin) {
                const whole = ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si', 'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying'];
                const base = pinyin.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
                if (whole.includes(base)) return { isWhole: true, full: pinyin };
                const initialMatch = pinyin.match(/^(zh|ch|sh|b|p|m|f|d|t|n|l|g|k|h|j|q|x|r|z|c|s|y|w)/i);
                if (initialMatch) {
                    const initial = initialMatch[0].toLowerCase();
                    const final = pinyin.substring(initial.length);
                    if (final) {
                        // 用中文注音代替拉丁字母声母
                        const initialPhonetic = INITIAL_PHONETIC[initial] || initial;
                        return { isWhole: false, initial, initialPhonetic, final, full: pinyin };
                    }
                }
                return { isWhole: true, full: pinyin };
            }

            // 全局缓存语音列表，解决 Chrome 首次加载时 getVoices() 为空的 Bug
            let cachedVoices = [];
            if ('speechSynthesis' in window) {
                cachedVoices = window.speechSynthesis.getVoices();
                window.speechSynthesis.addEventListener('voiceschanged', () => {
                    cachedVoices = window.speechSynthesis.getVoices();
                });
            }

            let ttsUnlocked = false;
            let ttsReady = false;
            let ttsUnlocking = false;
            let ttsLastCancelAt = 0;
            let pendingSpeechTasks = [];
            let pendingSpeechUnlockBound = false;
            let ttsLastError = '';
            let ttsLastEvent = '';
            let ttsDebugEl = null;
            let ttsLastSpeakAt = 0;
            let ttsLastOnstartAt = 0;

            function clearPendingSpeechUnlockListeners() {
                if (!pendingSpeechUnlockBound) return;
                window.removeEventListener('pointerdown', flushPendingSpeechOnGesture, true);
                window.removeEventListener('keydown', flushPendingSpeechOnGesture, true);
                window.removeEventListener('touchend', flushPendingSpeechOnGesture, true);
                pendingSpeechUnlockBound = false;
            }

            function updateTTSDebug(extra = '') {
                if (!ttsDebugEl || !('speechSynthesis' in window)) return;
                const s = window.speechSynthesis;
                ttsDebugEl.textContent =
                    `TTS unlocked=${ttsUnlocked} unlocking=${ttsUnlocking} ready=${ttsReady}\n` +
                    `speaking=${s.speaking} pending=${s.pending} paused=${s.paused}\n` +
                    `voices=${cachedVoices.length} lastEvent=${ttsLastEvent || '-'} lastError=${ttsLastError || '-'}\n` +
                    `${extra || ''}`;
            }

            function initTTSDebugPanel() {
                if (!IS_CHROMIUM || !('speechSynthesis' in window)) return;
                const wrap = document.createElement('div');
                wrap.style.cssText = [
                    'position:fixed',
                    'right:8px',
                    'bottom:8px',
                    'z-index:99999',
                    'max-width:360px',
                    'background:rgba(0,0,0,.75)',
                    'color:#b7ffb7',
                    'font:12px/1.4 monospace',
                    'padding:8px',
                    'border-radius:8px'
                ].join(';');
                const pre = document.createElement('pre');
                pre.style.cssText = 'margin:0 0 6px 0;white-space:pre-wrap;word-break:break-word;';
                const btn = document.createElement('button');
                btn.textContent = 'Test TTS';
                btn.style.cssText = 'font:12px monospace;padding:4px 8px;cursor:pointer;';
                btn.addEventListener('click', () => {
                    ttsLastEvent = 'debug-test-click';
                    ttsLastError = '';
                    updateTTSDebug('trying: 语音测试');
                    VoiceEngine.speak('语音测试', 0.9);
                });
                wrap.appendChild(pre);
                wrap.appendChild(btn);
                document.body.appendChild(wrap);
                ttsDebugEl = pre;
                updateTTSDebug('debug panel ready');
            }

            function bindPendingSpeechUnlockListeners() {
                if (pendingSpeechUnlockBound) return;
                pendingSpeechUnlockBound = true;
                window.addEventListener('pointerdown', flushPendingSpeechOnGesture, { once: true, capture: true });
                window.addEventListener('keydown', flushPendingSpeechOnGesture, { once: true, capture: true });
                window.addEventListener('touchend', flushPendingSpeechOnGesture, { once: true, capture: true });
            }

            function runPendingSpeechTasks() {
                if (!pendingSpeechTasks.length) return;
                const tasks = pendingSpeechTasks.slice();
                pendingSpeechTasks = [];
                clearPendingSpeechUnlockListeners();
                tasks.forEach((task) => {
                    try { task(); } catch (e) { }
                });
            }

            function flushPendingSpeechOnGesture() {
                // { once: true } 触发后，监听器已自动移除；这里同步重置状态，便于失败后重绑。
                pendingSpeechUnlockBound = false;
                if (!ttsUnlocked) {
                    warmUpTTS();
                    if (!ttsUnlocked && pendingSpeechTasks.length) bindPendingSpeechUnlockListeners();
                    return;
                }
                runPendingSpeechTasks();
            }

            function scheduleSpeechOnNextGesture(task) {
                pendingSpeechTasks.push(task);
                bindPendingSpeechUnlockListeners();
            }

            function setTTSUnlocked() {
                if (ttsUnlocked) return;
                ttsUnlocked = true;
                ttsReady = true;
                ttsUnlocking = false;
                ttsLastEvent = 'set-unlocked';
                updateTTSDebug();
                runPendingSpeechTasks();
            }

            function pickPreferredVoice(voices) {
                if (!voices || !voices.length) return null;
                const zhLocal = voices.find(v => /^zh/i.test(v.lang || '') && v.localService);
                const zhAny = voices.find(v => /^zh/i.test(v.lang || ''));
                const def = voices.find(v => v.default);
                return zhLocal || zhAny || def || voices[0] || null;
            }

            // ─── AI 专家优化的统一 Web Speech 引擎 ───
            const VoiceEngine = {
                _uid: 0,
                speak: (text, rate = 0.85, onEnd = null, options = null) => {
                    if (!('speechSynthesis' in window) || !text) {
                        if (onEnd) onEnd();
                        return;
                    }
                    ttsLastSpeakAt = performance.now();
                    const voiceMode = options && typeof options.voiceMode === 'number' ? options.voiceMode : 0;
                    const retry = options && typeof options.retry === 'number' ? options.retry : 0;
                    ttsLastEvent = `speak:${text.slice(0, 16)}`;
                    ttsLastError = '';
                    updateTTSDebug();
                    if (IS_CHROMIUM && (performance.now() - ttsLastCancelAt) < 120) {
                        setTimeout(() => VoiceEngine.speak(text, rate, onEnd, options), 130);
                        return;
                    }

                    if (!ttsUnlocked && !ttsUnlocking) {
                        warmUpTTS();
                    }

                    // Chromium 专用保守路径：不主动 cancel，不做激进重试，避免引擎进入 canceled/stall 循环。
                    if (IS_CHROMIUM) {
                        VoiceEngine._uid++;
                        const currentUid = VoiceEngine._uid;
                        const s = window.speechSynthesis;
                        const cleanText = String(text).replace(/，{2,}/g, '，');
                        const utterance = new SpeechSynthesisUtterance(cleanText);
                        window._activeUtterance = utterance; // 防止 Chromium 在异步阶段回收对象
                        utterance.lang = 'zh-CN';
                        utterance.rate = Math.max(0.7, Math.min(1.0, rate));
                        utterance.pitch = 1;
                        utterance.volume = 1;

                        let ended = false;
                        let endTimer = null;
                        const done = () => {
                            if (ended || currentUid !== VoiceEngine._uid) return;
                            ended = true;
                            clearTimeout(endTimer);
                            if (onEnd) onEnd();
                        };
                        utterance.onstart = () => {
                            ttsLastOnstartAt = performance.now();
                            ttsReady = true;
                            if (!ttsUnlocked) setTTSUnlocked();
                            ttsLastEvent = 'chromium-onstart';
                            ttsLastError = '';
                            updateTTSDebug();
                        };
                        utterance.onend = () => {
                            ttsLastEvent = 'chromium-onend';
                            updateTTSDebug();
                            done();
                        };
                        utterance.onerror = (e) => {
                            ttsLastEvent = 'chromium-onerror';
                            ttsLastError = e && e.error ? e.error : 'unknown';
                            updateTTSDebug();
                            if (e && (e.error === 'not-allowed' || e.error === 'interrupted')) {
                                scheduleSpeechOnNextGesture(() => VoiceEngine.speak(text, rate, onEnd, { retry: 0 }));
                                setTimeout(done, 20);
                                return;
                            }
                            setTimeout(done, 20);
                        };

                        const fire = () => {
                            try { s.resume(); } catch (e) { }
                            try { s.speak(utterance); } catch (e) { }
                            ttsLastEvent = `chromium-speak:${text.slice(0, 14)}`;
                            updateTTSDebug();
                            const estimateMs = Math.max(1300, cleanText.length * 360 / utterance.rate);
                            endTimer = setTimeout(done, estimateMs);
                        };
                        if (s.speaking || s.pending) {
                            const now = performance.now();
                            const noRealStartYet = ttsLastOnstartAt === 0;
                            const staleByNoStart = noRealStartYet && (now - ttsLastSpeakAt > 900);
                            const staleByHang = !noRealStartYet && (now - ttsLastOnstartAt > 3500);
                            if (staleByNoStart || staleByHang) {
                                ttsLastEvent = 'chromium-stale-reset';
                                updateTTSDebug();
                                try { s.cancel(); } catch (e) { }
                                setTimeout(() => VoiceEngine.speak(text, rate, onEnd, options), 220);
                                return;
                            }
                            setTimeout(() => VoiceEngine.speak(text, rate, onEnd, options), 140);
                            return;
                        }
                        fire();
                        return;
                    }

                    VoiceEngine._uid++;
                    const currentUid = VoiceEngine._uid;

                    // Safari 强力防回收
                    const utterance = new SpeechSynthesisUtterance(text);
                    window._activeUtterance = utterance;

                    utterance.lang = 'zh-CN';
                    utterance.rate = rate;
                    utterance.pitch = 1;
                    utterance.volume = 1;

                    const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
                    const preferredVoice = pickPreferredVoice(voices);
                    const defaultVoice = voices.find(v => v.default) || null;
                    const firstVoice = voices[0] || null;
                    // voiceMode:
                    // 0: 首选中文 voice
                    // 1: 不指定 voice，仅设 lang
                    // 2: 浏览器 default voice
                    // 3: voices[0]
                    if (voiceMode === 0 && preferredVoice) {
                        utterance.voice = preferredVoice;
                        utterance.lang = preferredVoice.lang || 'zh-CN';
                    } else if (voiceMode === 2 && defaultVoice) {
                        utterance.voice = defaultVoice;
                        utterance.lang = defaultVoice.lang || 'zh-CN';
                    } else if (voiceMode === 3 && firstVoice) {
                        utterance.voice = firstVoice;
                        utterance.lang = firstVoice.lang || 'zh-CN';
                    }
                    ttsLastEvent = `speak(mode=${voiceMode}):${text.slice(0, 10)}`;
                    updateTTSDebug();

                    let handled = false;
                    let fallbackTimer = null;
                    let kickTimer = null;
                    let watchdogTimer = null;
                    let started = false;

                    const handleEnd = () => {
                        if (!handled && currentUid === VoiceEngine._uid) {
                            handled = true;
                            clearTimeout(fallbackTimer);
                            clearTimeout(kickTimer);
                            clearTimeout(watchdogTimer);
                            if (onEnd) onEnd();
                        }
                    };
                    const abortCurrentWithoutEnd = () => {
                        if (handled || currentUid !== VoiceEngine._uid) return;
                        handled = true;
                        clearTimeout(fallbackTimer);
                        clearTimeout(kickTimer);
                        clearTimeout(watchdogTimer);
                    };

                    utterance.onstart = () => {
                        started = true;
                        ttsReady = true;
                        if (!ttsUnlocked) setTTSUnlocked();
                        ttsLastEvent = 'utterance-onstart';
                        updateTTSDebug();
                    };
                    utterance.onend = () => {
                        ttsLastEvent = 'utterance-onend';
                        updateTTSDebug();
                        handleEnd();
                    };
                    utterance.onerror = (e) => {
                        ttsLastEvent = 'utterance-onerror';
                        ttsLastError = e && e.error ? e.error : 'unknown';
                        // 即使浏览器立刻抛出 canceled 错误，也不会阻断后续逻辑(如翻页/下一阶段播放)
                        if (e && (e.error === 'not-allowed' || e.error === 'interrupted')) {
                            ttsReady = false;
                            scheduleSpeechOnNextGesture(() => VoiceEngine.speak(text, rate, null));
                        }
                        updateTTSDebug();
                        setTimeout(handleEnd, 20);
                    };

                    // 【致命修复】：对于 Chrome 必须直接、同步执行调用，绝不能被包裹在 setTimeout 里！
                    // 不然新一代 Chromium 会发现它丢失了 User-Gesture 来源而直接将音频 cancel()！
                    // 并且只要不处于 pending，我们就尽量不轻易掉用 .cancel()，以防队列永远堵死
                    try {
                        window.speechSynthesis.resume();
                        window.speechSynthesis.speak(utterance);
                        updateTTSDebug();
                    } catch (e) { }

                    kickTimer = setTimeout(() => {
                        if (handled || started || currentUid !== VoiceEngine._uid) return;
                        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return;
                        try {
                            const u2 = new SpeechSynthesisUtterance(text);
                            u2.lang = 'zh-CN';
                            u2.rate = rate;
                            u2.pitch = 1;
                            u2.volume = 1;
                            u2.onstart = () => { started = true; ttsReady = true; };
                            u2.onend = handleEnd;
                            u2.onerror = handleEnd;
                            window.speechSynthesis.speak(u2);
                        } catch (e) { }
                    }, 180);

                    if (IS_CHROMIUM) {
                        watchdogTimer = setTimeout(() => {
                            if (handled || started || currentUid !== VoiceEngine._uid) return;
                            if (voiceMode >= 3) {
                                ttsLastEvent = 'watchdog-give-up';
                                ttsLastError = 'no-onstart';
                                updateTTSDebug();
                                handleEnd();
                                return;
                            }
                            const nextMode = voiceMode + 1;
                            ttsLastEvent = `watchdog-retry-mode-${nextMode}`;
                            updateTTSDebug();
                            try {
                                ttsLastCancelAt = performance.now();
                                window.speechSynthesis.cancel();
                            } catch (e) { }
                            abortCurrentWithoutEnd();
                            setTimeout(() => VoiceEngine.speak(text, rate, onEnd, { voiceMode: nextMode }), 140);
                        }, 900);
                    }

                    const estimateMs = Math.max(1500, text.length * 400 / rate);
                    fallbackTimer = setTimeout(handleEnd, estimateMs);
                },
                cancel: () => {
                    if ('speechSynthesis' in window) {
                        // 避免在解锁窗口内把 warm-up 语音自己 cancel 掉（Chromium 会因此一直解锁失败）。
                        if (!ttsUnlocked && ttsUnlocking) return;
                        VoiceEngine._uid++; // 强行废止回调链，阻止之前排队的音频触发接下来的状态
                        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                            ttsLastCancelAt = performance.now();
                            try { window.speechSynthesis.cancel(); } catch (e) { }
                            ttsLastEvent = 'cancel';
                            updateTTSDebug();
                        }
                    }
                }
            };

            // 保持原有接口兼容，并恢复极其重要的“拼读”逻辑（声母+韵母->全音）
            function buildPinyinSpeechText(pinyin) {
                if (!pinyin) return '';
                const info = decomposePinyin(pinyin);
                if (info.isWhole) return info.full;
                return `${info.initialPhonetic}，，${info.final}，，${info.full}`;
            }

            function spellPinyin(pinyin, onFullSyllableStart, onEnd, checkAbort) {
                if (!pinyin) { if (onEnd) onEnd(); return; }
                if (checkAbort && !checkAbort()) return;
                const combinedText = buildPinyinSpeechText(pinyin);
                if (onFullSyllableStart) setTimeout(onFullSyllableStart, 800);
                VoiceEngine.speak(combinedText, 0.75, onEnd);
            }

            function speakWord(text) {
                if (!text) return;
                VoiceEngine.speak(text, 0.85);
            }

            function speakWords(text) {
                if (!text) return;
                // 将词组连接在一起，添加停顿
                const phrases = text.split(/[、，,]/).filter(Boolean).join('，');
                VoiceEngine.speak(phrases, 0.85);
            }

            function stopSpeech() {
                VoiceEngine.cancel();
            }
            let bgmNodes = [];
            function startBGM() {
                // Background music disabled as per user request
            }
            function stopBGM() { bgmNodes.forEach(o => { try { o.stop(); } catch (e) { } }); bgmNodes = []; }
            const SFX = {
                correct(data) {
                    synth(880, 'sine', 0.15, 0.25); synth(1100, 'sine', 0.2, 0.15);
                    if (data.type === 'spell') {
                        // 等音效播完后再拼读，给足延迟
                        setTimeout(() => spellPinyin(data.pinyin), 250);
                    } else if (data.word) {
                        // 等音效播完后再朗读
                        setTimeout(() => speakWord(data.word), 250);
                    }
                },
                wrong() { synth(150, 'sawtooth', 0.3, 0.2); synth(120, 'square', 0.2, 0.15); },
                hit() { synth(80, 'square', 0.15, 0.3); },
                jump() { synth(400, 'sine', 0.1, 0.1); synth(600, 'sine', 0.08, 0.08); },
                levelUp() { synth(523, 'sine', 0.2, 0.2); setTimeout(() => synth(659, 'sine', 0.2, 0.2), 150); setTimeout(() => synth(784, 'sine', 0.3, 0.2), 300); },
                gameOver() { synth(300, 'sawtooth', 0.5, 0.2); synth(200, 'sawtooth', 0.6, 0.15); }
            };

