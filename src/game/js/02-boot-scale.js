
        ; (function () {
            "use strict";
            const CFG = window.WRM_CONFIG;
            if (window.OFFLINE_CONFIG) {
                console.log('🚀 强制启动离线配置模式 (OFFLINE_CONFIG)');
            }
            const W = 450, H = 800;
            const canvas = document.getElementById('gc');
            const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d');
            canvas.width = W; canvas.height = H;
            const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            const IS_CHROMIUM = /(?:chrome|chromium|crios|edg)/i.test(navigator.userAgent) && !IS_SAFARI;

            // ===== 自适应缩放 =====
            function resize() {
                const ww = window.innerWidth, wh = window.innerHeight;
                const scale = Math.min(ww / W, wh / H);
                const cw = W * scale, ch = H * scale;
                canvas.style.width = cw + 'px';
                canvas.style.height = ch + 'px';
                const hud = document.getElementById('hud');
                hud.style.width = cw + 'px';
                hud.style.height = ch + 'px';
                // 居中 HUD 在 canvas 上方
                hud.style.left = ((ww - cw) / 2) + 'px';
                hud.style.top = ((wh - ch) / 2) + 'px';
            }
            window.addEventListener('resize', resize); resize();

