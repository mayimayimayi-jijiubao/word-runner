        // ========== 配置块（由 workbench.html 注入）==========
        window.WRM_CONFIG = {
            metadata: { version: "3.5.0", unitTitle: "字跑大师", playerName: "贝贝" },
            rules: {
                levelTime: 40,
                winCorrectTotal: 9,
                winCorrectStreak: 4,
                failWrongStreak: 4,
                initLives: 3,
                obstacleDamage: 1,
                wrongDamage: 0.5
            },
            difficulty: {
                speedStart: 2, speedEnd: 6,
                intervalStart: 2000, intervalEnd: 800,
                obstacleStart: 0.10, obstacleEnd: 0.40,
                wrongStart: 0.20, wrongEnd: 0.45,
                correctStart: 0.70, correctEnd: 0.15
            },
            scoring: {
                correctBase: 10, comboMax: 5,
                hitDistractor: -3, hitObstacle: -5,
                comboRewards: { 2: 20, 3: 30, 4: 40, 5: 50 }
            },
            character: {
                nickname: "贝贝",
                grades: [
                    { name: "童生", score: 0 },
                    { name: "秀才", score: 100 },
                    { name: "贡生", score: 200 },
                    { name: "举人", score: 300 },
                    { name: "解元", score: 400 },
                    { name: "贡士", score: 500 },
                    { name: "会元", score: 600 },
                    { name: "进士", score: 700 },
                    { name: "探花", score: 800 },
                    { name: "榜眼", score: 900 },
                    { name: "状元", score: 1000 }
                ]
            },
            // levels 数组已移除，现在通过 CFG.character.grades 动态获取
            physics: {
                tracksX: [0.166666, 0.5, 0.833333], // v2.9.2: 真正三等分跑道（1/6, 1/2, 5/6）
                playerY: 0.90, // 下移至 90%
                gravity: 2000,
                jumpForce: 750,
                objScaleStart: 0.08, // 物体远端缩放
                objScaleEnd: 1.0,     // 物体近端缩放
                playerScale: 1.5,     // 角色固定缩放
                obstacleScale: 1.0    // 障碍物额外缩放
            },
            levelDesign: {
                levelName: "音找字",                    // 关卡名称
                taskSource: "pinyin",                    // 任务区数据来源: pinyin | word
                correctSource: "word",                   // 正确项数据来源: word
                wrongSource: "word_exclude_homophone",   // 干扰项数据来源: word | word_exclude_homophone
                polyphoneRule: "use_data_pinyin",        // 多音字规则: use_data_pinyin | auto
                homophoneRule: "exclusive"               // 同音字规则: exclusive | allow_both
            },
            ui: { themeColor: "#00ffcc", isInvincible: false },
            dataSource: {
                offlineData: [
                    { "word": "潮", "pinyin": "cháo", "radical": "氵", "words_std": "观潮、潮水" },
                    { "word": "盐", "pinyin": "yán", "radical": "皿", "words_std": "盐官、食盐" },
                    { "word": "薄", "pinyin": "bó", "radical": "艹", "words_std": "薄雾" },
                    { "word": "屹", "pinyin": "yì", "radical": "山", "words_std": "屹立" },
                    { "word": "昂", "pinyin": "áng", "radical": "日", "words_std": "昂首" },
                    { "word": "鼎", "pinyin": "dǐng", "radical": "鼎", "words_std": "鼎沸" },
                    { "word": "沸", "pinyin": "fèi", "radical": "氵", "words_std": "沸腾" },
                    { "word": "据", "pinyin": "jù", "radical": "扌", "words_std": "据说、证据" },
                    { "word": "堤", "pinyin": "dī", "radical": "土", "words_std": "大堤、河堤" },
                    { "word": "阔", "pinyin": "kuò", "radical": "门", "words_std": "宽阔、广阔" },
                    { "word": "盼", "pinyin": "pàn", "radical": "目", "words_std": "盼望" },
                    { "word": "滚", "pinyin": "gǔn", "radical": "氵", "words_std": "滚动、翻滚" },
                    { "word": "顿", "pinyin": "dùn", "radical": "页", "words_std": "顿时" },
                    { "word": "逐", "pinyin": "zhú", "radical": "辶", "words_std": "逐渐" },
                    { "word": "渐", "pinyin": "jiàn", "radical": "氵", "words_std": "逐渐" },
                    { "word": "堵", "pinyin": "dǔ", "radical": "土", "words_std": "一堵、堵塞" },
                    { "word": "犹", "pinyin": "yóu", "radical": "犭", "words_std": "犹如" },
                    { "word": "贯", "pinyin": "guàn", "radical": "贝", "words_std": "横贯" },
                    { "word": "浩", "pinyin": "hào", "radical": "氵", "words_std": "浩荡" },
                    { "word": "崩", "pinyin": "bēng", "radical": "山", "words_std": "崩裂、山崩地裂" },
                    { "word": "震", "pinyin": "zhèn", "radical": "雨", "words_std": "震动、地震" },
                    { "word": "霎", "pinyin": "shà", "radical": "雨", "words_std": "霎时" },
                    { "word": "余", "pinyin": "yú", "radical": "人", "words_std": "余波、剩余" },
                    { "word": "淘", "pinyin": "táo", "radical": "氵", "words_std": "淘洗、浪淘沙" },
                    { "word": "牵", "pinyin": "qiān", "radical": "牛", "words_std": "牵手、牵着" },
                    { "word": "鹅", "pinyin": "é", "radical": "鸟", "words_std": "鹅卵石" },
                    { "word": "卵", "pinyin": "luǎn", "radical": "卩", "words_std": "鹅卵石" },
                    { "word": "坑", "pinyin": "kēng", "radical": "土", "words_std": "坑洼、坑坑洼洼" },
                    { "word": "洼", "pinyin": "wā", "radical": "氵", "words_std": "坑洼、坑坑洼洼" },
                    { "word": "填", "pinyin": "tián", "radical": "土", "words_std": "填充、填上" },
                    { "word": "庄", "pinyin": "zhuāng", "radical": "广", "words_std": "庄稼" },
                    { "word": "稼", "pinyin": "jià", "radical": "禾", "words_std": "庄稼" },
                    { "word": "俗", "pinyin": "sú", "radical": "亻", "words_std": "风俗" },
                    { "word": "跃", "pinyin": "yuè", "radical": "足", "words_std": "跃出、跳跃" },
                    { "word": "葡", "pinyin": "pú", "radical": "艹", "words_std": "葡萄" },
                    { "word": "萄", "pinyin": "táo", "radical": "艹", "words_std": "葡萄" },
                    { "word": "稻", "pinyin": "dào", "radical": "禾", "words_std": "水稻" },
                    { "word": "熟", "pinyin": "shú", "radical": "灬", "words_std": "成熟、熟悉" },
                    { "word": "穗", "pinyin": "suì", "radical": "禾", "words_std": "稻穗" },
                    { "word": "镀", "pinyin": "dù", "radical": "钅", "words_std": "镀亮" },
                    { "word": "埂", "pinyin": "gěng", "radical": "土", "words_std": "田埂" },
                    { "word": "烁", "pinyin": "shuò", "radical": "火", "words_std": "闪烁" },
                    { "word": "巢", "pinyin": "cháo", "radical": "巛", "words_std": "归巢" },
                    { "word": "苇", "pinyin": "wěi", "radical": "艹", "words_std": "芦苇" },
                    { "word": "罗", "pinyin": "luó", "radical": "罒", "words_std": "剪秋罗" },
                    { "word": "眠", "pinyin": "mián", "radical": "目", "words_std": "睡眠、冬眠" },
                    { "word": "霸", "pinyin": "bà", "radical": "雨", "words_std": "霸占" },
                    { "word": "占", "pinyin": "zhàn", "radical": "卜", "words_std": "霸占、占据" },
                    { "word": "昧", "pinyin": "mèi", "radical": "日", "words_std": "半明半昧" },
                    { "word": "坠", "pinyin": "zhuì", "radical": "土", "words_std": "摇摇欲坠" },
                    { "word": "怀", "pinyin": "huái", "radical": "忄", "words_std": "怀抱" }
                ]
            }
        };
        // ========== 配置块结束 ==========
