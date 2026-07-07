        // ══════════════════════════════════════════════
        //  角色等级默认数据
        // ══════════════════════════════════════════════
        const GRADE_DEFAULTS = [
            { level: 'V1', name: '童生', score: 100 },
            { level: 'V2', name: '秀才', score: 200 },
            { level: 'V3', name: '贡生', score: 300 },
            { level: 'V4', name: '举人', score: 400 },
            { level: 'V5', name: '解元', score: 500 },
            { level: 'V6', name: '贡士', score: 600 },
            { level: 'V7', name: '会元', score: 700 },
            { level: 'V8', name: '进士', score: 800 },
            { level: 'V9', name: '探花', score: 900 },
            { level: 'V10', name: '榜眼', score: 1000 },
            { level: 'V11', name: '状元', score: 1100 }
        ];

        // ══════════════════════════════════════════════
        //  CFG 默认值
        // ══════════════════════════════════════════════
        const DEFAULTS = {
            physical_engine: {
                trackWidth: 1.0,
                obstacleScale: { near: 1.0, far: 0.15 },
                itemScale: { near: 0.9, far: 0.15 },
                physics: { jumpForce: 15, gravity: 0.8 }
            },
            unit_settings: {
                unitName: '',
                csvData: null,
                mode: 'soundToWord'
            },
            level_settings: {
                goals: { timeLimit: 40, targetCount: 8, comboTarget: 3 },
                fail: { totalWrong: 5, comboWrong: 3 }
            },
            difficulty: {
                spawn: { targetDensity: 0.6, distractorDensity: 0.3, obstacleDensity: 0.3 }
            },
            scoring: {
                base: { hitTarget: 10, hitDistractor: -3, hitObstacle: -5 },
                combo: { combo2: 20, combo3: 30, combo4: 40, combo5: 50 },
                lives: { initLives: 3, distractorDamage: 0.5, obstacleDamage: 1.0 }
            },
            character: {
                nickname: '贝贝',
                grades: JSON.parse(JSON.stringify(GRADE_DEFAULTS))
            },
            dataSource: {
                offlineData: []
            }
        };

        const CFG = JSON.parse(JSON.stringify(DEFAULTS));

