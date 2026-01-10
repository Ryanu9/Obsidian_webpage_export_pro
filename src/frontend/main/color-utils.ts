
export function getRGB(color: string, element: HTMLElement = document.body): { r: number, g: number, b: number } | null {
    const div = document.createElement('div');
    div.style.color = color;
    element.appendChild(div);
    const computedColor = window.getComputedStyle(div).color;
    element.removeChild(div);

    const match = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        return {
            r: parseInt(match[1]),
            g: parseInt(match[2]),
            b: parseInt(match[3])
        };
    }
    return null;
}

export function getRelativeLuminance(r: number, g: number, b: number): number {
    const transform = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function getContrastRatio(l1: number, l2: number): number {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 确保前景色与背景色对比度达到目标值
 * @param fgColor 前景色 (例如 'grey')
 * @param bgColor 背景色 (例如 var(--code-background))
 * @param targetContrast 目标对比度 (例如 3)
 */
export function ensureContrast(fgColor: string, bgColor: string, targetContrast: number = 3, element: HTMLElement = document.body): string {
    const rgbBg = getRGB(bgColor, element);
    const rgbFg = getRGB(fgColor, element);
    if (!rgbBg || !rgbFg) return fgColor;

    const lBg = getRelativeLuminance(rgbBg.r, rgbBg.g, rgbBg.b);
    let lFg = getRelativeLuminance(rgbFg.r, rgbFg.g, rgbFg.b);

    let ratio = getContrastRatio(lFg, lBg);
    if (ratio >= targetContrast) return fgColor;

    // 如果对比度不够，尝试调整亮度
    // 如果背景是暗的，调亮前景；如果背景是亮的，调暗前景
    if (lBg < 0.5) {
        // 背景暗，调亮前景
        // 简单的线性插值或寻找目标亮度
        // 目标 L: (L1 + 0.05) / (Lbg + 0.05) = targetContrast => L1 = targetContrast * (Lbg + 0.05) - 0.05
        let targetLFg = targetContrast * (lBg + 0.05) - 0.05;
        targetLFg = Math.min(1, Math.max(0, targetLFg));

        // 粗略转换为颜色：由于我们只需要“灰色”感，直接用相同 RGB 值
        // 这里的转换很不精确，因为我们要的是看起来像原先的颜色但对比度够
        // 既然默认是灰色，我们直接返回一个灰色的 rgb 字符串
        const greyVal = l2grey(targetLFg);
        return `rgb(${greyVal}, ${greyVal}, ${greyVal})`;
    } else {
        // 背景亮，调暗前景
        let targetLFg = (lBg + 0.05) / targetContrast - 0.05;
        targetLFg = Math.min(1, Math.max(0, targetLFg));
        const greyVal = l2grey(targetLFg);
        return `rgb(${greyVal}, ${greyVal}, ${greyVal})`;
    }
}

function l2grey(l: number): number {
    // 反转 getRelativeLuminance 对于 R=G=B 的情况
    // L = 0.2126 * f(v) + 0.7152 * f(v) + 0.0722 * f(v) = f(v)
    // f(v) = L
    let v;
    if (l <= 0.00303949) { // 0.03928 / 12.92
        v = l * 12.92;
    } else {
        v = Math.pow(l, 1 / 2.4) * 1.055 - 0.055;
    }
    return Math.round(v * 255);
}
