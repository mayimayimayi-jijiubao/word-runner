            // ===== 主循环 =====
            function gameLoop(timestamp) {
                requestAnimationFrame(gameLoop);
                if (!ST.running) return;
                if (ST.lastTime === 0) ST.lastTime = timestamp;
                const dt = Math.min((timestamp - ST.lastTime) / 1000, 0.05);
                const frameScale = dt * 60;
                smoothAnimScale = smoothAnimScale * 0.82 + frameScale * 0.18;
                ST.lastTime = timestamp; ST.frameCount++;
                if (ST.paused) return;

                // 关卡计时
                // 关卡计时
                // v2.8.6: 通关动画期间停止计时
                if (!ST.isCompletingLevel) {
                    ST.levelTime += dt;
                    if (ST.levelTime >= CFG.rules.levelTime) {
                        endGame(); return;
                    }
                }

                // v2.8.6: 更新连击计时器
                if (ST.comboDisplayTimer > 0) {
                    ST.comboDisplayTimer -= dt;
                    if (ST.comboDisplayTimer <= 0) updateHUD(); // 触发消失动画
                }

                // v2.8.3: 检测长按并更新跑动状态
                updateRunningState(dt);

                // v2.8: 角色动画（跑动比走动快）
                const animSpeed = ST.isRunning ? 0.2 : 0.12;
                ST.playerAnim += animSpeed * smoothAnimScale;

                // 跳跃物理 update (基于力学步动，不使用 dt)
                if (!ST.isGrounded) {
                    ST.playerJump -= ST.vy * frameScale; // 速度应用到高度偏移
                    ST.vy += CFG.physics.gravity * frameScale; // 重力加速度应用到速度

                    // 落地检测
                    if (ST.playerJump <= 0) {
                        ST.playerJump = 0;
                        ST.vy = 0;
                        ST.isGrounded = true;
                        // 落地特效
                        SFX.hit();
                        spawnParticles(trackX(ST.trackIndex, H * CFG.physics.playerY), H * CFG.physics.playerY, '#fff', 5);
                        ST.landingScale = 0.6; // 触发挤压动画
                    }
                }

                // 更新
                updateRoadLines(dt);
                updateSpawner(dt);
                updateObjects(dt);
                updateParticles(dt);
                updateHUDThrottled(dt);
                animFrameScale = smoothAnimScale;

                // 绘制
                ctx.clearRect(0, 0, W, H);
                drawTrack();
                drawGameTitle();
                drawTaskRing();
                drawJumpTrajectory();
                drawObjects();
                drawPlayer();
                drawParticles();
            }

            // v2.8.3: 跳跃 (物理驱动，支持原地跳和跑动跳)
            function jumpPlayer(isRunJump = false) {
                if (!ST.isGrounded || !ST.running || ST.paused) return;
                ST.isGrounded = false;
                // 跑动中跳跃力度更大
                ST.vy = -(isRunJump ? CFG.physics.jumpForce * 1.3 : CFG.physics.jumpForce);
                SFX.jump();
            }

            // ===== 车道切换 =====
            function movePlayer(dir) {
                if (!ST.running || ST.paused) return;
                ST.trackIndex = Math.max(0, Math.min(2, ST.trackIndex + dir));
            }

            // ===== 暂停 =====
            function togglePause() {
                if (!ST.running || ST.gameOver) return;
                ST.paused = !ST.paused;
                document.getElementById('hud-task').textContent = ST.paused ? '⏸ 已暂停' : `寻找拼音：${ST.currentPinyin}`;
            }

            // v2.8.3: 按键状态跟踪（用于单击/长按/双击检测）
            let lastUpKeyTime = 0;
            let upKeyPressed = false;
            let upKeyPressTime = 0;
            const LONG_PRESS_THRESHOLD = 200; // 长按阈值（毫秒）
            const DOUBLE_CLICK_THRESHOLD = 300; // 双击阈值（毫秒）

            // ===== 键盘输入 =====
            document.addEventListener('keydown', e => {
                if (e.code === 'ArrowUp' && !upKeyPressed) {
                    upKeyPressed = true;
                    upKeyPressTime = Date.now();
                    e.preventDefault();
                } else if (e.code === 'ArrowLeft') {
                    movePlayer(-1); e.preventDefault();
                } else if (e.code === 'ArrowRight') {
                    movePlayer(1); e.preventDefault();
                } else if (e.code === 'Space') {
                    togglePause(); e.preventDefault();
                }
            });

            document.addEventListener('keyup', e => {
                if (e.code === 'ArrowUp' && upKeyPressed) {
                    const now = Date.now();
                    const pressDuration = now - upKeyPressTime;
                    upKeyPressed = false;

                    // 判断是否为长按（跑动）
                    if (pressDuration >= LONG_PRESS_THRESHOLD) {
                        // 长按结束，停止跑动
                        ST.isRunning = false;
                        ST.runSpeedMultiplier = 1.0;
                    } else {
                        // 快速单击
                        // 检查是否为双击（在跑动状态下的双击跳跃）
                        if (ST.isRunning && now - lastUpKeyTime < DOUBLE_CLICK_THRESHOLD) {
                            // 跑动中双击 = 跑动跳跃
                            jumpPlayer(true);
                            lastUpKeyTime = 0;
                        } else {
                            // 单击 = 原地跳跃
                            jumpPlayer(false);
                            lastUpKeyTime = now;
                        }
                    }
                }
            });

            // v2.8.3: 检测长按并触发跑动
            function updateRunningState(dt) {
                if (upKeyPressed && !ST.isRunning) {
                    const pressDuration = Date.now() - upKeyPressTime;
                    if (pressDuration >= LONG_PRESS_THRESHOLD) {
                        ST.isRunning = true;
                        ST.runSpeedMultiplier = 2.0;
                    }
                }
                // 更新跑动动画
                if (ST.isRunning && !ST.paused) {
                    ST.runAnimPhase = (ST.runAnimPhase + 0.2 * smoothAnimScale) % (Math.PI * 2);
                }
            }

            // ===== 触摸手势 =====
            let touchStartX = 0, touchStartY = 0, touchStartTime = 0, lastTapTime = 0, lastUpTapTime = 0;
            document.addEventListener('touchstart', e => {
                const t = e.touches[0]; touchStartX = t.clientX; touchStartY = t.clientY; touchStartTime = Date.now();
                e.preventDefault();
            }, { passive: false });
            document.addEventListener('touchend', e => {
                const t = e.changedTouches[0];
                const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const elapsed = Date.now() - touchStartTime;

                if (dist < 20 && elapsed < 300) {
                    // 点击 → 检查双击
                    const now = Date.now();
                    if (now - lastTapTime < 350) { togglePause(); lastTapTime = 0; }
                    else lastTapTime = now;
                } else if (dist > 30) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        dx < 0 ? movePlayer(-1) : movePlayer(1);
                    } else if (dy < -30) {
                        // v2.8: 向上滑动 - 检测双击跳跃 vs 单击跑动
                        const now = Date.now();
                        if (now - lastUpTapTime < 300) {
                            jumpPlayer();
                            lastUpTapTime = 0;
                        } else {
                            ST.isRunning = true;
                            ST.runSpeedMultiplier = 2.0;
                            lastUpTapTime = now;
                            // 0.5秒后自动恢复走动
                            setTimeout(() => {
                                ST.isRunning = false;
                                ST.runSpeedMultiplier = 1.0;
                            }, 500);
                        }
                    }
                }
                e.preventDefault();
            }, { passive: false });


