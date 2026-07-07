            // ===== 物体系统 =====
            function spawnObject() {
                if (ST.paused || ST.gameOver || !ST.running) return;
                const diff = getDifficulty();
                let r = Math.random();
                let type, word = '', pinyin = '';

                // v2.6: 正确项生成保障 — 确保关卡内能出现足够的正确项
                const remaining = CFG.rules.levelTime - ST.levelTime;
                const needed = CFG.rules.winCorrectTotal - ST.correctTotal;
                if (needed > 0 && remaining > 0) {
                    const avgInterval = (CFG.difficulty.intervalStart + CFG.difficulty.intervalEnd) / 2;
                    const estimatedSpawns = remaining * 1000 / avgInterval;
                    const pCorrect = diff.pCorrect || (1 - diff.pObstacle - diff.pWrong);
                    if (estimatedSpawns * pCorrect < needed * 1.8) {
                        r = 1.0; // 强制落入 correct 区间
                    }
                }

                // 确定物体类型
                const pObs = diff.pObstacle;
                const pWrong = diff.pWrong;
                // pCorrect is the rest

                if (r < pObs) {
                    type = 'obstacle';
                } else if (r < pObs + pWrong) {
                    type = 'wrong';
                    if (ST.gamePhase === 'wordToSound') {
                        // 字找音：干扰项是错误拼音
                        const correctPinyins = getAllData().filter(d => d.word === ST.currentCorrectWord).map(d => d.pinyin);
                        const pool = getAllData().filter(d => !correctPinyins.includes(d.pinyin));
                        if (pool.length > 0) { const item = pool[Math.floor(Math.random() * pool.length)]; word = item.pinyin; pinyin = item.pinyin; }
                        else { type = 'obstacle'; }
                    } else {
                        // 音找字：干扰项是错误汉字
                        const correctWords = getAllData().filter(d => d.pinyin === ST.currentPinyin).map(d => d.word);
                        const pool = getAllData().filter(d => d.pinyin !== ST.currentPinyin && !correctWords.includes(d.word));
                        if (pool.length > 0) { const item = pool[Math.floor(Math.random() * pool.length)]; word = item.word; pinyin = item.pinyin; }
                        else { type = 'obstacle'; }
                    }
                } else {
                    type = 'correct';
                    if (ST.gamePhase === 'wordToSound') {
                        // 字找音：正确项是正确拼音
                        if (ST.currentPinyin) {
                            word = ST.currentPinyin; // 显示拼音
                            pinyin = ST.currentPinyin;
                        } else {
                            type = 'obstacle';
                        }
                    } else {
                        // 音找字：正确项是正确汉字
                        if (ST.currentCorrectWord) {
                            word = ST.currentCorrectWord;
                            pinyin = ST.currentPinyin;
                        } else {
                            type = 'obstacle';
                        }
                    }
                }

                // 选择跑道（不在同一跑道放相同干扰项）
                let track = Math.floor(Math.random() * 3);
                const existingOnTrack = ST.objects.filter(o => o.track === track && o.y < VP.y + 100);
                if (existingOnTrack.length > 0) track = (track + 1) % 3;

                ST.objects.push({
                    type, track, y: VP.y, word, pinyin,
                    alive: true, scale: 0.08
                });
            }

            function updateObjects(dt) {
                const diff = getDifficulty();
                const py = H * CFG.physics.playerY;
                const frameScale = dt * 60;

                for (let i = ST.objects.length - 1; i >= 0; i--) {
                    const o = ST.objects[i];
                    // v2.8: 跑动时速度加倍
                    const speed = diff.speed * ST.runSpeedMultiplier;
                    o.y += speed * frameScale;
                    o.scale = perspScale(o.y);

                    // 碰撞检测
                    if (o.alive && o.y > py - 40 && o.y < py + 20) {
                        const ox = trackX(o.track, o.y);
                        const px = trackX(ST.trackIndex, py);
                        const dist = Math.abs(ox - px);

                        if (dist < 30 * o.scale) {
                            // 玩家在跳跃中 → 跳过
                            if (!ST.isGrounded && ST.playerJump > 30) {
                                // 跳过不触发碰撞，不加分
                            } else {
                                handleCollision(o);
                            }
                            o.alive = false;
                        }
                    }

                    // 移出屏幕
                    if (o.y > H + 50) {
                        ST.objects.splice(i, 1);
                    }
                }
            }

            function drawObjects() {
                ST.objects.forEach(o => {
                    if (!o.alive) return;
                    const x = trackX(o.track, o.y);
                    let s = o.scale;

                    if (o.type === 'obstacle') s = s * CFG.physics.obstacleScale;

                    ctx.save();
                    ctx.translate(x, o.y);

                    if (IS_SAFARI) {
                        // Safari 轻量渲染分支：减少复杂路径和渐变导致的掉帧。
                        if (o.type === 'obstacle') {
                            const w = 44 * s;
                            const h = 34 * s;
                            ctx.fillStyle = '#d35400';
                            ctx.fillRect(-w / 2, -h / 2, w, h);
                            ctx.strokeStyle = '#8d6e63';
                            ctx.lineWidth = Math.max(1, s * 1.5);
                            ctx.strokeRect(-w / 2, -h / 2, w, h);
                            ctx.fillStyle = '#f8f9fa';
                            ctx.font = `bold ${Math.max(10, 10 * s)}px 'PingFang SC', 'Microsoft YaHei'`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText('!', 0, 0);
                        } else {
                            const sz = 42 * s;
                            ctx.fillStyle = '#f1c40f';
                            ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
                            ctx.strokeStyle = '#d4ac0d';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
                            ctx.fillStyle = '#2d3436';
                            ctx.font = `bold ${Math.max(12, 20 * s)}px 'PingFang SC', 'Microsoft YaHei'`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(o.word, 0, 0);
                        }
                        ctx.restore();
                        return;
                    }

                    if (o.type === 'obstacle') {
                        // v3.3: 厚牛皮纸箱板立牌 (Thick Corrugated Cardboard)
                        const w = 50 * s;
                        const h = 40 * s;

                        // 阴影
                        ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0;

                        // 1. 立牌底座 (深色硬纸板)
                        ctx.fillStyle = '#5d4037';
                        ctx.fillRect(-w / 2, h / 2 - 4 * s, w, 6 * s);

                        // 2. 剪纸主体 (波浪形/火焰形)
                        ctx.beginPath();
                        const points = [];
                        const steps = 8;
                        const stepW = w / steps;

                        // 左下角
                        points.push({ x: -w / 2, y: h / 2 - 4 * s });

                        // 上边缘波浪 (更圆润)
                        for (let i = 0; i <= steps; i++) {
                            const px = -w / 2 + i * stepW;
                            const py = -h / 2 + Math.sin(i * 0.8 + o.y * 0.1) * 8 * s + (i % 2 == 0 ? 2 * s : -2 * s);
                            points.push({ x: px, y: py });
                        }

                        // 右下角
                        points.push({ x: w / 2, y: h / 2 - 4 * s });

                        // 闭合并填充
                        ctx.moveTo(points[0].x, points[0].y);
                        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
                        ctx.closePath();

                        // 填充: 牛皮纸渐变
                        const grad = ctx.createLinearGradient(0, -h, 0, h);
                        grad.addColorStop(0, '#e67e22'); // 亮橙
                        grad.addColorStop(1, '#d35400'); // 深橙
                        ctx.fillStyle = grad;
                        ctx.fill();

                        // 3. 增加厚度 (侧面 3D)
                        ctx.shadowColor = 'transparent';
                        ctx.fillStyle = '#8d6e63'; // 侧面深褐色
                        ctx.beginPath();
                        const thickness = 6 * s;
                        for (let i = 1; i < points.length; i++) {
                            ctx.moveTo(points[i - 1].x, points[i - 1].y);
                            ctx.lineTo(points[i].x, points[i].y);
                            ctx.lineTo(points[i].x + thickness, points[i].y + thickness * 0.5);
                            ctx.lineTo(points[i - 1].x + thickness, points[i - 1].y + thickness * 0.5);
                        }
                        ctx.fill();

                        // 4. 瓦楞纸纹理 (内部纹理)
                        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; // 深色压痕
                        ctx.lineWidth = 2 * s;
                        ctx.beginPath();
                        // 竖向条纹
                        const stripeCount = 6;
                        const stripeGap = w / stripeCount;
                        for (let i = 1; i < stripeCount; i++) {
                            const sx = -w / 2 + i * stripeGap;
                            if (sx < w / 2 - 5 * s) { // 简单裁剪
                                ctx.moveTo(sx, -h / 2 + 10 * s);
                                ctx.lineTo(sx, h / 2 - 6 * s);
                            }
                        }
                        ctx.stroke();



                        // 警告标识 (喷漆/印章效果)
                        const triSz = 12 * s;
                        const triY = 2 * s;
                        ctx.fillStyle = 'rgba(50, 50, 50, 0.8)'; // 黑墨水
                        ctx.beginPath();
                        ctx.moveTo(0, triY - triSz);
                        ctx.lineTo(-triSz * 0.8, triY + triSz * 0.6);
                        ctx.lineTo(triSz * 0.8, triY + triSz * 0.6);
                        ctx.fill();

                        // 感叹号
                        ctx.save();
                        ctx.translate(0, triY + triSz * 0.4);
                        ctx.scale(s, s);
                        ctx.fillStyle = '#e67e22'; // 镂空
                        ctx.font = "bold 14px sans-serif";
                        ctx.textAlign = 'center';
                        ctx.fillText('!', 0, 0);
                        ctx.restore();

                    } else {
                        // v3.2: 统一不规则深黄色方形便签 (Irregular Dark Yellow Square)
                        const sz = 36 * s;

                        ctx.shadowColor = 'transparent';
                        ctx.shadowOffsetY = 0;
                        ctx.shadowBlur = 0;

                        // 深黄色
                        ctx.fillStyle = '#f1c40f'; // Vivid Yellow/Orange-Yellow

                        // 稍微旋转
                        const rot = ((o.y * 100) % 10 - 5) * 0.02;
                        ctx.rotate(rot);

                        const w = sz * 1.3;
                        const h = sz * 1.3;

                        const points = [
                            { x: -w / 2, y: -h / 2 },
                            { x: w / 2, y: -h / 2 },
                            { x: w / 2, y: h / 2 },
                            { x: -w / 2, y: h / 2 },
                            { x: -w / 2, y: -h / 2 }
                        ];
                        drawRoughPath(ctx, points, true);
                        ctx.fill();

                        ctx.shadowColor = 'transparent';
                        ctx.strokeStyle = '#d4ac0d'; // Darker border
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        // 汉字 (墨水风)
                        ctx.save();
                        ctx.scale(s, s);
                        ctx.fillStyle = '#2d3436';
                        ctx.font = "bold 24px 'PingFang SC', 'Microsoft YaHei'";
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(o.word, 0, 0);
                        ctx.restore();

                        // 拼音 (已移除)
                    }
                    ctx.restore();
                });
            }

            // ===== 碰撞处理 =====
            function handleCollision(o) {
                // v2.8.6: 通关动画期间无敌
                if (ST.isCompletingLevel && o.type !== 'correct') return;
                if (CFG.ui.isInvincible && o.type !== 'correct') return;

                if (o.type === 'obstacle') {
                    ST.lives -= CFG.rules.obstacleDamage;
                    ST.score += (CFG.scoring.hitObstacle || 0); // 扣分
                    SFX.hit();
                    ST.combo = 0; ST.wrongStreak = 0;
                    spawnParticles(trackX(o.track, o.y), o.y, '#ff3c3c', 15);
                } else if (o.type === 'wrong') {
                    ST.lives -= CFG.rules.wrongDamage;
                    ST.score += (CFG.scoring.hitDistractor || 0); // 扣分
                    SFX.wrong();
                    ST.combo = 0;
                    ST.wrongStreak++;
                    ST.correctStreak = 0;
                    spawnParticles(trackX(o.track, o.y), o.y, '#ff6b6b', 10);
                } else if (o.type === 'correct') {
                    ST.combo++;
                    if (ST.combo > ST.maxCombo) ST.maxCombo = ST.combo;
                    // v4.1: 基础得分 + 连击奖励查表
                    ST.score += CFG.scoring.correctBase;
                    if (ST.combo >= 2 && CFG.scoring.comboRewards) {
                        const comboKey = Math.min(ST.combo, CFG.scoring.comboMax || 5);
                        const reward = CFG.scoring.comboRewards[comboKey] || 0;
                        ST.score += reward;
                    }
                    ST.correctTotal++;
                    ST.correctStreak++;
                    ST.wrongStreak = 0;
                    // v4.1: 播放音频
                    if (ST.gamePhase === 'wordToSound') {
                        // 字找音：正确撞击播拼音拼写
                        SFX.correct({ type: 'spell', pinyin: o.pinyin });
                    } else {
                        // 音找字：正确撞击播汉字读音
                        SFX.correct({ word: o.word });
                    }
                    spawnParticles(trackX(o.track, o.y), o.y, '#00ffcc', 25);
                    spawnParticles(trackX(o.track, o.y), o.y, '#ffd700', 15);
                    spawnParticles(trackX(o.track, o.y), o.y, '#ff69b4', 10);
                }

                // v4.1: 连击粒子效果
                if (ST.combo >= 2) {
                    ST.comboDisplayTimer = 0.8;
                    // 生成金色粒子在连击文字位置
                    const comboX = W / 2;
                    const comboY = H * 0.42;
                    for (let i = 0; i < 8; i++) {
                        ST.particles.push({
                            x: comboX + (Math.random() - 0.5) * 60,
                            y: comboY + (Math.random() - 0.5) * 30,
                            vx: (Math.random() - 0.5) * 6,
                            vy: (Math.random() - 0.5) * 6 - 2,
                            life: 1, decay: 0.02 + Math.random() * 0.02,
                            size: 3 + Math.random() * 4,
                            color: Math.random() > 0.5 ? '#ffd700' : '#ff9500',
                            type: 'star'
                        });
                    }
                }

                updateHUD();
                checkLevelState();
            }

