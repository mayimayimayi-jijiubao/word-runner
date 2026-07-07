            // ===== 透视计算 =====
            const VP = { x: W / 2, y: 0 }; // y 将在 drawTrack 中动态计算
            function perspScale(y) {
                const t = (y - VP.y) / (H - VP.y);
                const sStart = CFG.physics.objScaleStart;
                const sEnd = CFG.physics.objScaleEnd;
                return sStart + (sEnd - sStart) * t;
            }
            // v2.9.3: 跑道透视缩放与物体缩放分离
            function trackScale(y) {
                const t = (y - VP.y) / (H - VP.y);
                const sStart = 0.08; // 跑道远端固定缩放
                const sEnd = 1.0;    // 跑道近端固定缩放
                return sStart + (sEnd - sStart) * t;
            }
            function trackX(trackIdx, y) {
                const s = trackScale(y); // 使用独立的跑道缩放
                const baseX = CFG.physics.tracksX[trackIdx] * W;

                const t = (y - VP.y) / (H - VP.y);
                // 将 0.25 改小（例如 0.1），跑道底部会扩张得更开，符合图片比例
                const shrinkFactor = 1.0 - t * 0.1;
                return VP.x + (baseX - VP.x) * s * shrinkFactor;
            }

            // ===== 粒子系统 =====
            function spawnParticles(x, y, color, count) {
                const actualCount = IS_SAFARI ? Math.max(2, Math.floor(count * 0.5)) : count;
                for (let i = 0; i < actualCount; i++) {
                    ST.particles.push({
                        x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8 - 3,
                        life: 1, decay: 0.01 + Math.random() * 0.02,
                        size: 2 + Math.random() * 4, color,
                        type: Math.random() > 0.5 ? 'circle' : 'star'
                    });
                }
            }
            function updateParticles(dt) {
                const frameScale = dt * 60;
                for (let i = ST.particles.length - 1; i >= 0; i--) {
                    const p = ST.particles[i];
                    p.x += p.vx * frameScale;
                    p.y += p.vy * frameScale;
                    p.vy += 0.15 * frameScale;
                    p.life -= p.decay * frameScale;
                    if (p.life <= 0) ST.particles.splice(i, 1);
                }
            }
            function drawParticles() {
                ST.particles.forEach(p => {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    // v3.0: 纸屑风格粒子，无发光，旋转正方形或圆形
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.life * 5); // 旋转效果
                    if (p.type === 'circle') {
                        ctx.beginPath(); ctx.arc(0, 0, p.size * p.life, 0, Math.PI * 2); ctx.fill();
                    } else {
                        // 碎纸片 (方形)
                        ctx.fillRect(-p.size * p.life, -p.size * p.life, p.size * p.life * 2, p.size * p.life * 2);
                    }
                    ctx.restore();
                });
                ctx.globalAlpha = 1;
            }
            function drawStar(cx, cy, r) {
                // 保留五角星逻辑，用于特效，但也可以简化
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const a = Math.PI * 2 * i / 5 - Math.PI / 2;
                    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    const a2 = a + Math.PI / 5;
                    ctx.lineTo(cx + Math.cos(a2) * r * 0.4, cy + Math.sin(a2) * r * 0.4);
                }
                ctx.closePath(); ctx.fill();
            }

            // ===== 性能优化：离屏Canvas缓存背景 =====
            // Safari 掉帧的元凶是每帧重新生成Pattern并填充全屏
            let bgCanvas = document.createElement('canvas');
            bgCanvas.width = W; bgCanvas.height = H;
            let bgCtx = bgCanvas.getContext('2d');
            let bgCached = false;

            function initBackgroundCache() {
                if (bgCached) return;
                // 生成纹理
                const pCanvas = document.createElement('canvas');
                pCanvas.width = 256; pCanvas.height = 256;
                const pCtx = pCanvas.getContext('2d');
                pCtx.fillStyle = '#2D3436'; pCtx.fillRect(0, 0, 256, 256);
                for (let i = 0; i < 4000; i++) { // 减少粒子数优化性能
                    pCtx.fillStyle = 'rgba(255,255,255,0.03)';
                    pCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
                }
                const pattern = bgCtx.createPattern(pCanvas, 'repeat');
                bgCtx.fillStyle = pattern;
                bgCtx.fillRect(0, 0, W, H);
                bgCached = true;
            }

            // 极速模式：禁用极其耗费 Safari CPU 的高频率动态计算边缘抖动特效
            function drawRoughPath(ctx, points, closePath = false) {
                if (points.length < 2) return;
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                if (closePath) {
                    ctx.closePath();
                }
                // 不在这里 stroke/fill，留给调用者
            }

            // ===== 跑道绘制 (Paper Cutout Style) =====
            function drawTrack() {
                const titleBottom = 20 + 36 + 10;
                const taskUIY = titleBottom + 80;
                VP.y = taskUIY;

                // 1. 全屏背景 (纸张纹理)
                if (!bgCached) initBackgroundCache();
                ctx.drawImage(bgCanvas, 0, 0);

                // 2. 绘制跑道主体 (大剪纸带)
                // 计算左右边缘的关键点
                const trackCheckPointsY = [VP.y, VP.y + (H - VP.y) * 0.25, VP.y + (H - VP.y) * 0.5, VP.y + (H - VP.y) * 0.75, H];
                const leftPoints = [];
                const rightPoints = [];

                trackCheckPointsY.forEach(y => {
                    const lBase = trackX(0, y);
                    const rBase = trackX(2, y);
                    const lw = rBase - lBase; // 两个车道宽 (因为 trackX是中心点)
                    // trackX(0)是左车道中心，trackX(2)是右车道中心。
                    // 跑道总左边缘 = trackX(0) - 0.5 * 单车道宽
                    // 跑道总右边缘 = trackX(2) + 0.5 * 单车道宽
                    // 但是 trackX 是基于 tracksX 配置 [1/6, 1/2, 5/6]
                    // 所以 trackX(1) - trackX(0) = 1/3 W * s
                    // 单车道宽 = trackX(1) - trackX(0)
                    const laneW = trackX(1, y) - trackX(0, y);

                    // 稍微加宽一点边缘作为跑道纸带边界
                    leftPoints.push({ x: trackX(0, y) - laneW * 0.6, y: y });
                    rightPoints.push({ x: trackX(2, y) + laneW * 0.6, y: y });
                });

                // 构建完整的多边形路径
                const polyPoints = [...leftPoints, ...rightPoints.reverse()];

                ctx.save();
                // 白色毛边阴影 (Hard Shadow)
                ctx.translate(2, 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                drawRoughPath(ctx, polyPoints, true);
                ctx.fill();
                ctx.translate(-2, -2);

                // 跑道本体 (深一点的米色或浅灰，模拟重叠纸张)
                ctx.fillStyle = '#EBE7DD'; // 略深于背景
                drawRoughPath(ctx, polyPoints, true);
                ctx.fill();

                // 边缘描边 (铅笔痕迹)
                ctx.strokeStyle = '#888';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();

                // 3. 绘制车道分隔线 (虚线剪裁效果)
                ctx.save();
                ctx.strokeStyle = 'rgba(0,0,0,0.15)'; // 淡淡的压痕色
                ctx.lineWidth = 2;
                if (!IS_SAFARI) ctx.setLineDash([15, 15]); // Safari 下禁用虚线，减少主线程开销

                // 线1 (跑道 0|1 之间)
                // 线2 (跑道 1|2 之间)
                // trackX(0) 是第一车道中心。分隔线应在 trackX(0) + laneW/2
                // 其实 trackX(0)和trackX(1)的中点就是分隔线
                const divLines = [0, 1];
                divLines.forEach(idx => {
                    const points = [];
                    trackCheckPointsY.forEach(y => {
                        const x = (trackX(idx, y) + trackX(idx + 1, y)) / 2;
                        points.push({ x, y });
                    });

                    // 用 rough path 绘制虚线有点奇怪，直接画带抖动的虚线
                    // 这里简化，直接画直虚线，配合手绘风背景即可
                    ctx.beginPath();
                    ctx.moveTo(points[0].x, points[0].y);
                    points.forEach((p, i) => { if (i > 0) ctx.lineTo(p.x, p.y); });
                    ctx.stroke();
                });
                ctx.restore();

                // 4. 起跑线/装饰横线 (贴纸条)
                // Safari 下减少装饰线数量，缓解绘制抖动。
                ST.roadLines.forEach((rl, idx) => {
                    if (IS_SAFARI && (idx % 2 !== 0)) return;
                    const s = trackScale(rl.y);
                    const h = s * 20;

                    // 绘制在两个分隔线位置的小横贴纸
                    for (let i = 0; i < 2; i++) {
                        const xLeft = trackX(i, rl.y);
                        const xRight = trackX(i + 1, rl.y);
                        const cx = (xLeft + xRight) / 2;
                        const w = 30 * s;

                        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                        ctx.fillRect(cx - w / 2, rl.y, w, h);
                    }
                });

                // 5. 单元信息显示（跑道最下方）
                ctx.save();
                ctx.font = "12px 'PingFang SC', 'Microsoft YaHei'";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = 'rgba(180, 170, 155, 0.7)';
                ctx.fillText(CFG.metadata.unitTitle || '', W / 2, H - 8);
                ctx.restore();
            }
            let roadLineSpawnAcc = 0;
            function updateRoadLines(dt) {
                const diff = getDifficulty();
                const frameScale = dt * 60;
                // 添加新线（固定时间间隔，避免低帧率时线条变稀）
                roadLineSpawnAcc += dt;
                while (roadLineSpawnAcc >= 0.25) {
                    ST.roadLines.push({ y: VP.y });
                    roadLineSpawnAcc -= 0.25;
                }
                // v2.8: 移动（受跑动速度影响）
                for (let i = ST.roadLines.length - 1; i >= 0; i--) {
                    ST.roadLines[i].y += diff.speed * 1.5 * ST.runSpeedMultiplier * frameScale;
                    if (ST.roadLines[i].y > H) ST.roadLines.splice(i, 1);
                }
            }

            // ===== 跳跃轨迹绘制 =====
            // ===== 跳跃轨迹绘制 (缝纫线风格) =====
            function drawJumpTrajectory() {
                if (ST.isGrounded || IS_SAFARI) return;

                ctx.save();
                ctx.strokeStyle = '#555'; // 深色缝衣线
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]); // 明显的虚线

                ctx.beginPath();
                const px = trackX(ST.trackIndex, H * CFG.physics.playerY);
                const py = H * CFG.physics.playerY - ST.playerJump;

                // 模拟抛物线轨迹
                let simY = ST.playerJump;
                let simVy = ST.jumpVy;
                const dt = 1 / 60;

                ctx.moveTo(px, py);
                let landingY = py;
                for (let i = 0; i < 60 && simY >= 0; i++) {
                    simY += simVy * dt;
                    simVy -= CFG.physics.gravity * dt;
                    const nextY = H * CFG.physics.playerY - simY;
                    ctx.lineTo(px, nextY);
                    landingY = nextY;
                }

                ctx.stroke();
                ctx.setLineDash([]);

                // 落点标记 (已移除)

                ctx.restore();
            }

            // ===== v3.0: 纸偶角色绘制 (Paper Puppet - Back View & Scaled) =====
            let cachedPlayerNameW = 0;
            let cachedPlayerName = '';
            let animFrameScale = 1;
            let smoothAnimScale = 1;
            function drawPlayer() {
                const ti = ST.trackIndex;
                const py = H * CFG.physics.playerY;
                const px = trackX(ti, py);
                const baseScale = CFG.physics.playerScale * 1.5; // v3.2: 放大 50%
                const sX = baseScale * (2 - ST.landingScale);
                const sY = baseScale * ST.landingScale;

                const jy = ST.playerJump;
                const t = ST.playerAnim;
                const tc = '#F7B731'; // 身体主色 (暖黄)
                const pantsColor = '#2D3436'; // 裤子深灰
                const skinColor = '#FFDAB9'; // 皮肤粉色

                const animPhase = ST.isRunning ? ST.runAnimPhase : t;
                const runCycle = Math.sin(animPhase);
                const runCycle2 = Math.cos(animPhase);

                // 身体颠簸
                let bobbing = 0;
                if (ST.isRunning && ST.isGrounded) {
                    bobbing = Math.abs(Math.sin(animPhase * 2)) * 6 * sY;
                }
                const by = py - jy - bobbing;

                // 影子 (硬边深色椭圆)
                ctx.save();
                ctx.fillStyle = 'rgba(0,0,0,0.5)'; // 深色硬投影
                const shadowScale = Math.max(0.2, 1 - jy / 200);

                ctx.beginPath();
                ctx.ellipse(px + 4, py + 8 * sY + 2, 18 * sX * shadowScale, 5 * sY * shadowScale, 0, 0, Math.PI * 2);
                ctx.fill();

                // 恢复落地形变
                if (ST.landingScale < 1.0) {
                    ST.landingScale += 0.05 * animFrameScale;
                    if (ST.landingScale > 1.0) ST.landingScale = 1.0;
                }

                const headR = 10 * sY;
                const bodyW = 16 * sX, bodyH = 22 * sY;
                const limbW = 5 * sX;

                // 绘制纸偶部件函数
                function drawLimb(x1, y1, x2, y2, color, w) {
                    ctx.beginPath();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = w;
                    ctx.lineCap = 'round';
                    // 模拟剪纸边缘
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    // 铆钉
                    ctx.fillStyle = '#b2bec3';
                    ctx.beginPath(); ctx.arc(x1, y1, w * 0.3, 0, Math.PI * 2); ctx.fill();
                }

                // 增强跑动幅度
                const swingMultiplier = ST.isRunning ? 2.5 : 1.0;
                let legSwingY = runCycle * 12 * sY * swingMultiplier;
                let legSwingX = Math.abs(runCycle) * 3 * sX;

                if (!ST.isGrounded) {
                    legSwingY = 8 * sY;
                    legSwingX = 2 * sX;
                }

                // 下半身 (腿) - Leg drawing logic
                // 左腿
                drawLimb(px - 4 * sX, by - 4 * sY, px - 4 * sX - legSwingX * 0.3, by + 10 * sY - legSwingY, pantsColor, limbW); // 大腿
                drawLimb(px - 4 * sX - legSwingX * 0.3, by + 10 * sY - legSwingY, px - 4 * sX, by + 18 * sY - legSwingY * 0.5, pantsColor, limbW); // 小腿

                // 右腿
                drawLimb(px + 4 * sX, by - 4 * sY, px + 4 * sX + legSwingX * 0.3, by + 10 * sY + legSwingY, pantsColor, limbW);
                drawLimb(px + 4 * sX + legSwingX * 0.3, by + 10 * sY + legSwingY, px + 4 * sX, by + 18 * sY + legSwingY * 0.5, pantsColor, limbW);

                // 身体 (圆角矩形纸片) - 背面视角，无需领口装饰
                ctx.fillStyle = '#0984e3'; // 蓝色衣服
                const bodyRot = runCycle * 0.1;
                ctx.save();
                ctx.translate(px, by - bodyH / 2);
                ctx.rotate(bodyRot);
                roundRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 4 * sX);
                // 背部装饰 (简单的线条或 Logo) - 可选
                // ctx.fillStyle = 'rgba(255,255,255,0.3)';
                // ctx.fillRect(-bodyW*0.3, -bodyH*0.2, bodyW*0.6, 2*sY);
                ctx.restore();

                // 头部 (背面 - 主要是头发)
                const headY = by - bodyH - headR * 0.8;

                // 1. 皮肤 (脖子/耳根部分)
                ctx.fillStyle = skinColor;
                ctx.beginPath(); ctx.arc(px, headY, headR, 0, Math.PI * 2); ctx.fill();

                // 2. 头发 (背面完全覆盖后脑勺)
                ctx.fillStyle = '#2d3436';
                ctx.beginPath();
                ctx.arc(px, headY, headR * 1.1, Math.PI, Math.PI * 2); // 上半球
                // 下部自然的短发发际线
                ctx.lineTo(px + headR * 1.1, headY + headR * 0.5);
                ctx.quadraticCurveTo(px, headY + headR * 1.2, px - headR * 1.1, headY + headR * 0.5);
                ctx.fill();

                // 手臂
                let armSwingY = -runCycle * 10 * sY * swingMultiplier;
                if (!ST.isGrounded) armSwingY = -12 * sY;

                // 左臂 (Swing opposite to legs usually, but here runCycle is same? runCycle2 is cos.
                // Standard: Left Leg forward -> Right Arm forward.
                // legSwing is based on sin(t).
                // Let's use cos(t) for arms or inverted sin.
                const armCycle = -runCycle;

                // Arms attached at shoulders
                const shoulderY = by - bodyH + 2 * sY;
                const armW = limbW * 0.9;

                // 左臂
                drawLimb(px - bodyW / 2, shoulderY, px - bodyW / 2 - 6 * sX, shoulderY + 8 * sY + armSwingY, skinColor, armW);
                drawLimb(px - bodyW / 2 - 6 * sX, shoulderY + 8 * sY + armSwingY, px - bodyW / 2 - 8 * sX, shoulderY + 16 * sY + armSwingY * 1.5, skinColor, armW);

                // 右臂
                drawLimb(px + bodyW / 2, shoulderY, px + bodyW / 2 + 6 * sX, shoulderY + 8 * sY - armSwingY, skinColor, armW);
                drawLimb(px + bodyW / 2 + 6 * sX, shoulderY + 8 * sY - armSwingY, px + bodyW / 2 + 8 * sX, shoulderY + 16 * sY - armSwingY * 1.5, skinColor, armW);

                // 昵称标签 (纸条风格)
                const nameY = headY - headR - 10 * sY; // 头顶上方

                if (cachedPlayerName !== CFG.metadata.playerName) {
                    ctx.save();
                    ctx.font = "bold 14px 'PingFang SC', 'Microsoft YaHei'";
                    cachedPlayerNameW = ctx.measureText(CFG.metadata.playerName).width;
                    cachedPlayerName = CFG.metadata.playerName;
                    ctx.restore();
                }

                ctx.save();
                ctx.translate(px, nameY);
                ctx.scale(sY, sY); // ✨ 利用矩阵缩放，避免重设 ctx.font

                // 白色底标签
                ctx.fillStyle = '#fff';
                ctx.fillRect(-cachedPlayerNameW / 2 - 4, -14, cachedPlayerNameW + 8, 18);
                ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.strokeRect(-cachedPlayerNameW / 2 - 4, -14, cachedPlayerNameW + 8, 18);

                ctx.fillStyle = '#333';
                ctx.font = "bold 14px 'PingFang SC', 'Microsoft YaHei'"; // ✨ 静态字号
                ctx.textAlign = 'center';
                ctx.fillText(CFG.metadata.playerName, 0, 0);

                ctx.restore();
            }

            // 圆角矩形辅助
            function roundRect(x, y, w, h, r) {
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.closePath(); ctx.fill();
            }

            // HEX转RGB
            function hexToRGB(hex) {
                const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
                return { r, g, b };
            }

            // ===== 圆形任务UI (中心点与消失点重合) =====
            // 绘制游戏标题
            // 构建游戏标题 (墨水风格 -> 跑道色)
            function drawGameTitle() {
                ctx.save();
                ctx.font = "bold 36px 'PingFang SC', 'Microsoft YaHei'";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                // 黑色水墨阴影
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillText('字跑大师', W / 2, 22);
                // 主色 (跑道颜色)
                ctx.fillStyle = '#EBE7DD';
                ctx.fillText('字跑大师', W / 2, 20);

                ctx.restore();
            }

            function drawTaskRing() {
                // Position slightly lower to accommodate larger size
                const titleBottom = 20 + 36 + 10;
                const cx = W / 2;
                const ringR = W / 4.5;
                const cy = titleBottom + ringR + 20;

                ctx.save();
                ctx.translate(cx, cy);

                // 1. 牛皮纸吊牌底座 (Kraft Paper Tag Base)
                // 阴影
                ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

                // 外圈 (深棕色/牛皮纸色)
                ctx.fillStyle = '#8d6e63';
                ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.fill();



                // 2. 内圈 (米白纸)
                const innerR = ringR * 0.82;
                ctx.fillStyle = '#faf3e0'; // Warmer
                ctx.beginPath(); ctx.arc(0, 0, innerR, 0, Math.PI * 2); ctx.fill();



                // 纸张边缘内阴影效果
                ctx.shadowColor = 'transparent';
                ctx.strokeStyle = '#d7ccc8';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(0, 0, innerR, 0, Math.PI * 2); ctx.stroke();

                // 3. 外环呼吸灯（小关状态）— 数量 = 累计正确数
                ctx.shadowColor = 'transparent';
                const dotR = ringR * 0.96;
                const maxDots = CFG.rules.winCorrectTotal;
                const breathAlpha = 0.5 + 0.5 * Math.sin(ST.frameCount * 0.06); // 呼吸节奏
                for (let i = 0; i < maxDots; i++) {
                    const a = (Math.PI * 2 * i) / maxDots;
                    const dx = Math.cos(a) * dotR;
                    const dy = Math.sin(a) * dotR;
                    ctx.beginPath();
                    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
                    if (i < ST.correctTotal) {
                        // 已点亮的呼吸灯 — 金色光晕
                        ctx.fillStyle = `rgba(255, 200, 50, ${breathAlpha})`;
                        ctx.fill();
                        // 光晕
                        ctx.save();
                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                        ctx.beginPath();
                        ctx.arc(dx, dy, 4, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255, 215, 0, ${breathAlpha})`;
                        ctx.fill();
                        ctx.restore();
                    } else {
                        // 未点亮的暗色圆点
                        ctx.fillStyle = '#d7ccc8';
                        ctx.fill();
                    }
                }

                // 4. (已移除顶部穿孔)

                // 5. 内容展示
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // 倒计时 (上方红色)
                const remaining = Math.max(0, Math.ceil(CFG.rules.levelTime - ST.levelTime));
                const timerFontSize = Math.floor(innerR * 0.35);
                ctx.fillStyle = remaining <= 10 ? '#ff3c3c' : '#d63031';
                ctx.font = `bold ${timerFontSize}px 'PingFang SC', 'Microsoft YaHei'`;
                ctx.fillText(remaining + 's', 0, -innerR * 0.45);

                // 任务内容（根据阶段切换）
                if (ST.gamePhase === 'wordToSound') {
                    // 字找音：显示汉字
                    ctx.fillStyle = '#2d3436';
                    const fontSize = Math.floor(innerR * 0.8);
                    ctx.font = `bold ${fontSize}px 'PingFang SC', 'Microsoft YaHei'`;
                    ctx.fillText(ST.currentTaskDisplay || '--', 0, innerR * 0.05);
                } else {
                    // 音找字：显示拼音
                    ctx.fillStyle = '#2980b9';
                    const fontSize = Math.floor(innerR * 0.7);
                    ctx.font = `bold ${fontSize}px 'PingFang SC', 'Microsoft YaHei'`;
                    ctx.fillText(ST.currentTaskDisplay || '--', 0, innerR * 0.05);
                }

                // 进度 (下方小字)
                const currentList = ST.gamePhase === 'wordToSound' ? wordList : pinyinList;
                const progressText = `${ST.completedWordCount + 1}/${currentList.length}`;
                ctx.fillStyle = '#2d3436';
                ctx.font = `bold ${Math.floor(innerR * 0.25)}px 'PingFang SC', 'Microsoft YaHei'`;
                ctx.fillText(progressText, 0, innerR * 0.55);

                // 阶段标签
                ctx.fillStyle = '#888';
                ctx.font = `${Math.floor(innerR * 0.18)}px 'PingFang SC', 'Microsoft YaHei'`;
                ctx.fillText(ST.gamePhase === 'wordToSound' ? '字找音' : '音找字', 0, -innerR * 0.72);

                ctx.restore();
            }

