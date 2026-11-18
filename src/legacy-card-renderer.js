// Card drawing routines from mining_diggers_dream_2/js/core/renderer.js.
import { CARD_DATA, RAINBOW_CARDS } from './legacy-cards.js';

export class Renderer {
    // カテゴリごとのアクセント色とアイコン（カードモデル統一用）
    static getCategoryStyle(category) {
        const styles = {
            mining: { color: '#e8a33d', icon: '⛏' },
            draw: { color: '#4aa3df', icon: '📜' },
            buff: { color: '#9b59b6', icon: '✨' },
            debuff: { color: '#e74c3c', icon: '💀' },
            trap: { color: '#e67e22', icon: '🔥' },
            special: { color: '#f1c40f', icon: '🌟' },
            worker: { color: '#27ae60', icon: '👷' },
            health: { color: '#ff6b81', icon: '❤' },
            resource: { color: '#8d6e63', icon: '🌲' },
            random: { color: '#1abc9c', icon: '🎲' },
            time: { color: '#5dade2', icon: '⏳' },
            reset: { color: '#bdc3c7', icon: '🕊' },
            token: { color: '#95a5a6', icon: '🎫' },
            auto: { color: '#7f8c8d', icon: '📦' }
        };
        return styles[category] || { color: '#888888', icon: '◆' };
    }

    // 効果テキストの折り返し（カードIDごとにキャッシュ）
    static getWrappedDescription(ctx, cardId, description, maxWidth, font) {
        if (!Renderer._descCache) Renderer._descCache = {};
        const cacheKey = cardId;
        if (Renderer._descCache[cacheKey]) return Renderer._descCache[cacheKey];

        ctx.save();
        ctx.font = font;
        const lines = [];
        const sourceLines = (description || '').split('\n');
        for (const src of sourceLines) {
            let current = '';
            for (const ch of src) {
                if (ctx.measureText(current + ch).width > maxWidth && current.length > 0) {
                    lines.push(current);
                    current = ch;
                } else {
                    current += ch;
                }
            }
            if (current.length > 0) lines.push(current);
        }
        ctx.restore();

        // 最大7行（はみ出しは省略記号）
        const MAX_LINES = 7;
        const clipped = lines.slice(0, MAX_LINES);
        if (lines.length > MAX_LINES) {
            clipped[MAX_LINES - 1] = clipped[MAX_LINES - 1].slice(0, -1) + '…';
        }
        Renderer._descCache[cacheKey] = clipped;
        return clipped;
    }

    // 静的メソッド：カード描画ロジック（手札・ドロー演出・使用演出・履歴演出 共通モデル）
    static drawCard(ctx, cardId, x, y, rotation, isHovered, isGlowing, healthCost, workerCost, scale = 1.0, flashAlpha = 0) {
        const card = CARD_DATA[cardId] || RAINBOW_CARDS[cardId];
        if (!card) return;

        const baseWidth = 120;
        const baseHeight = 180;
        const w = baseWidth * scale;
        const h = baseHeight * scale;
        const isToken = card.isToken === true;
        const isDragonEgg = cardId === 'dragon_egg';   // 深淵にて眠る者：常に暗い専用色
        const isDiamondPick = cardId === 'diamond_pickaxe'; // 掘り進めIV：常時シアンの外オーラ
        const catStyle = Renderer.getCategoryStyle(isToken ? 'token' : card.category);

        // アクセント色（ヘッダー帯・区切り線などカード上の細部に使う）
        let accentColor = catStyle.color;
        if (isToken) accentColor = '#888';
        else if (isDragonEgg) accentColor = '#b026ff';
        else if (isDiamondPick) accentColor = '#5be6d2';

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // 発光（オーラ）はカードの「外側」に広がる影として出す。表面の塗りには使わない
        if (isDiamondPick) {
            // ダイヤのつるはしは常にシアンのオーラをまとう（発動可能時の深淵オーラと同じ仕組み）
            ctx.shadowBlur = 18 * scale;
            ctx.shadowColor = '#74f0e4';
        } else if (isGlowing) {
            ctx.shadowBlur = 12 * scale;
            ctx.shadowColor = isDragonEgg ? '#b026ff' : '#FFD700';
        }

        // カード背景（縦グラデーション）。深淵のみ専用の暗色、それ以外（ダイヤ含む）は通常色
        const bgGradient = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        if (isDragonEgg) {
            // 深淵：黄色ではなく暗黒〜紫の専用色（条件未達でも常に暗い）
            bgGradient.addColorStop(0, isHovered ? '#2a1133' : '#1d0c26');
            bgGradient.addColorStop(1, '#08030f');
        } else if (isToken) {
            bgGradient.addColorStop(0, isHovered ? '#3c3c3c' : '#333333');
            bgGradient.addColorStop(1, '#252525');
        } else {
            bgGradient.addColorStop(0, isHovered ? '#3b3b46' : '#32323c');
            bgGradient.addColorStop(1, '#1e1e26');
        }
        ctx.fillStyle = bgGradient;

        // 枠線の色（カテゴリ色をベースに、状態で上書き）
        let borderColor = catStyle.color;
        if (isToken) {
            borderColor = '#888';
        } else if (isDragonEgg) {
            borderColor = '#b026ff';
        } else if (isDiamondPick) {
            borderColor = '#5be6d2';
        } else if (isGlowing) {
            borderColor = '#FFD700';
        } else if (isHovered) {
            borderColor = '#f4c430';
        }

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = isHovered ? 4 : 2;

        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 10 * scale);
        ctx.fill();
        ctx.stroke();

        // 以降の描画ではカード自体の影を引き継がない
        ctx.shadowBlur = 0;

        // ヘッダー帯（カテゴリ色）
        const headerH = 30 * scale;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 10 * scale);
        ctx.clip();
        ctx.fillStyle = accentColor + '33'; // 半透明アクセント
        ctx.fillRect(-w / 2, -h / 2, w, headerH);
        ctx.strokeStyle = accentColor + '88';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2 + headerH);
        ctx.lineTo(w / 2, -h / 2 + headerH);
        ctx.stroke();
        ctx.restore();

        // カード名（長い名前は縮小して収める）
        if (isDragonEgg) {
            ctx.fillStyle = '#e0b0ff';
        } else if (isDiamondPick) {
            ctx.fillStyle = '#8ef3e8';
        } else {
            ctx.fillStyle = '#f4c430';
        }
        let nameFontSize = 12 * scale;
        const nameMaxWidth = w - 16 * scale;
        ctx.font = `bold ${nameFontSize}px Arial`;
        while (ctx.measureText(card.name).width > nameMaxWidth && nameFontSize > 7 * scale) {
            nameFontSize -= 0.5 * scale;
            ctx.font = `bold ${nameFontSize}px Arial`;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(card.name, 0, -h / 2 + 20 * scale);

        // カテゴリアイコン
        ctx.font = `${22 * scale}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.9;
        ctx.fillText(catStyle.icon, 0, -h / 2 + 48 * scale);
        ctx.globalAlpha = 1.0;

        // 区切り線
        ctx.strokeStyle = accentColor + '55';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 10 * scale, -h / 2 + 64 * scale);
        ctx.lineTo(w / 2 - 10 * scale, -h / 2 + 64 * scale);
        ctx.stroke();

        // 効果テキスト（折り返し・キャッシュ済み）
        const descFontSize = 9;
        const descLines = Renderer.getWrappedDescription(
            ctx, cardId, card.description, baseWidth - 18, `${descFontSize}px Arial`);
        ctx.fillStyle = '#d8d8d8';
        ctx.font = `${descFontSize * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const descStartY = -h / 2 + 80 * scale;
        const lineHeight = 13 * scale;
        descLines.forEach((line, i) => {
            ctx.fillText(line, 0, descStartY + i * lineHeight);
        });

        // コスト表示（hideCostフラグがtrueなら非表示）
        if (!card.hideCost && !isToken) {
            // 五角形描画ヘルパー（staticメソッド内なのでRenderer.darkenColorを使用）
            const drawPentagon = (cX, cY, size, color) => {
                ctx.save();
                ctx.translate(cX, cY);
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
                    const px = size * Math.cos(angle);
                    const py = size * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();

                const gradient = ctx.createLinearGradient(0, -size, 0, size);
                gradient.addColorStop(0, color);
                gradient.addColorStop(1, Renderer.darkenColor(color, 0.4));
                ctx.fillStyle = gradient;
                ctx.fill();

                ctx.strokeStyle = Renderer.darkenColor(color, 0.6);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            };

            // 体力コスト
            const healthX = -w / 2 + 20 * scale;
            const healthY = -h / 2 + 30 * scale;
            const pentagonSize = 15 * scale;
            drawPentagon(healthX, healthY, pentagonSize, '#ff4444');

            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${14 * scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(healthCost, healthX, healthY);

            // 作業員コスト
            if (workerCost > 0) {
                // 体力コストの下に表示
                const workerX = healthX;
                const workerY = healthY + 35 * scale;
                drawPentagon(workerX, workerY, pentagonSize, '#4488ff');
                ctx.fillText(workerCost, workerX, workerY);
            }

            // フラッシュエフェクト（引数で渡されたalpha値を使用）
            if (flashAlpha > 0) {
                ctx.save();
                ctx.translate(healthX, healthY);
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
                    const px = pentagonSize * Math.cos(angle);
                    const py = pentagonSize * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();

                ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                ctx.fill();

                ctx.shadowBlur = 15;
                ctx.shadowColor = 'white';
                ctx.strokeStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.restore();
    }

    // 静的メソッド：色を暗くする
    static darkenColor(color, factor) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const newR = Math.floor(r * (1 - factor));
        const newG = Math.floor(g * (1 - factor));
        const newB = Math.floor(b * (1 - factor));
        return '#' + [newR, newG, newB].map(value => value.toString(16).padStart(2, '0')).join('');
    }
}
