import { i18n } from "../translations/language";
import { EncryptedData } from "../utils/encryption-utils";

export const DOM_IDS = {
    PASSWORD_INPUT: 'page-password-input',
    UNLOCK_BUTTON: 'unlock-button',
    ERROR_MSG: 'password-error',
    CONTENT_CONTAINER: 'center-content',
    REMEMBER_CHECKBOX: 'remember-password'
};

export class LockScreen {
    public static generateLockScreenHtml(title?: string, description?: string): string {
        const t = i18n.settings.lockScreen;
        const displayTitle = title || t.title;
        const displayDescription = description || t.description;

        return `
<div class="password-lock" id="password-lock-container">
    <section class="password-lock__panel">
        <svg class="password-lock__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <h2 class="password-lock__title">${displayTitle}</h2>
        <p class="password-lock__description">${displayDescription}</p>
        
        <div class="password-lock__form">
            <input type="password" id="${DOM_IDS.PASSWORD_INPUT}" class="password-lock__input" placeholder="${t.inputPlaceholder}" autocomplete="new-password">
            
            <div class="password-lock__remember-wrapper" style="display:flex; align-items:center; gap:0.5em; width:100%">
                <input type="checkbox" id="${DOM_IDS.REMEMBER_CHECKBOX}">
                <label for="${DOM_IDS.REMEMBER_CHECKBOX}" style="cursor:pointer">${t.rememberPassword}</label>
            </div>
            
            <button type="button" id="${DOM_IDS.UNLOCK_BUTTON}" class="password-lock__submit">${t.unlock}</button>
            <div id="${DOM_IDS.ERROR_MSG}" class="password-lock__error" style="color:var(--text-error); display:none"></div>
        </div>
    </section>
</div>
`;
    }

    public static generateDecryptionScript(encryptedData: EncryptedData): string {
        const t = i18n.settings.lockScreen;
        return `
// 注意：这段代码是在用户的浏览器中运行的
(function() {
    const encryptedData = ${JSON.stringify(encryptedData)}; 
    const DOM_IDS = ${JSON.stringify(DOM_IDS)};
    const translations = ${JSON.stringify(t)};
    
    function base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    async function decrypt(password, data) {
        const salt = base64ToArrayBuffer(data.salt);
        const iv = base64ToArrayBuffer(data.iv);
        const authTag = base64ToArrayBuffer(data.authTag);
        const encryptedContent = base64ToArrayBuffer(data.encrypted);
        
        const encryptedWithTag = new Uint8Array(encryptedContent.byteLength + authTag.byteLength);
        encryptedWithTag.set(new Uint8Array(encryptedContent), 0);
        encryptedWithTag.set(new Uint8Array(authTag), encryptedContent.byteLength);
        
        const passwordMaterial = await crypto.subtle.importKey(
            'raw', 
            new TextEncoder().encode(password), 
            { name: 'PBKDF2' }, 
            false, 
            ['deriveKey']
        );
        
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv, tagLength: 128 },
            key,
            encryptedWithTag
        );
        
        return new TextDecoder().decode(decryptedBuffer);
    }
    
    function hideTOC() {
        const outline = document.querySelector('#outline');
        if (outline) {
            outline.style.setProperty('display', 'none', 'important');
            outline.setAttribute('data-toc-hidden', 'true');
        }
    }

    async function attemptUnlock() {
        const inputEl = document.getElementById(DOM_IDS.PASSWORD_INPUT);
        const errorEl = document.getElementById(DOM_IDS.ERROR_MSG);
        const password = inputEl.value.trim();
        if (!password) { errorEl.textContent = translations.inputPlaceholder; errorEl.style.display = 'block'; return; }
        
        try {
            const htmlContent = await decrypt(password, encryptedData);
            
            // 停止强力隐藏观察者
            if (window.__tocHideObserver) {
                window.__tocHideObserver.disconnect();
                delete window.__tocHideObserver;
            }

            const container = document.getElementById(DOM_IDS.CONTENT_CONTAINER);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            container.innerHTML = tempDiv.innerHTML;
            
            Array.from(container.querySelectorAll('script')).forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                if (oldScript.src) newScript.src = oldScript.src;
                else newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
            
            const rememberEl = document.getElementById(DOM_IDS.REMEMBER_CHECKBOX);
            const storageKey = 'doc-password-' + window.location.pathname;
            if (rememberEl && rememberEl.checked) {
                localStorage.setItem(storageKey, password);
            }
            
            const outline = document.querySelector('#outline');
            if (outline) {
                outline.style.removeProperty('display');
                outline.removeAttribute('data-toc-hidden');
            }
            
            if (window.ObsidianSite && window.ObsidianSite.document) {
                window.ObsidianSite.document.documentEl = container.querySelector('.obsidian-document') || container;
                
                // 触发全局加载回调，确保所有 feature (如 tags) 被正确初始化并显示
                window.ObsidianSite.triggerOnDocumentLoad(window.ObsidianSite.document);
                
                // 执行文档类自身的初始化
                await window.ObsidianSite.document.postLoadInit();
            }

            // 发送解密成功事件
            document.dispatchEvent(new CustomEvent('contentDecrypted'));
            
        } catch (e) {
            console.error(e);
            errorEl.textContent = translations.invalidPassword;
            errorEl.style.display = 'block';
            inputEl.value = '';
            inputEl.focus();
        }
    }
    
    if (!document.getElementById('password-lock-style')) {
        const style = document.createElement('style');
        style.id = 'password-lock-style';
        style.textContent = \`
            #password-lock-container { width: 100%; height: 100%; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 2rem; padding-top: min(10vh, 5rem); text-align: center; overflow-y: auto; box-sizing: border-box; }
            .password-lock { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; width: 100%; padding: 0; text-align: center; box-sizing: border-box; flex-shrink: 0; }
            .password-lock__panel { background: var(--background-secondary); padding: 2.5rem; border-radius: 12px; border: 1px solid var(--divider-color); box-shadow: var(--shadow-l); max-width: 400px; width: 100%; box-sizing: border-box; margin: 0 auto; flex-shrink: 0; }
            .password-lock__icon { width: 48px; height: 48px; margin-bottom: 1rem; color: var(--text-accent); }
            .password-lock__title { margin: 0 0 0.5rem 0; font-size: 1.5rem; }
            .password-lock__description { color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.9rem; }
            .password-lock__form { display: flex; flex-direction: column; gap: 1rem; }
            .password-lock__input { padding: 0.8rem; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--background-primary); color: var(--text-normal); width: 100%; }
            .password-lock__submit { padding: 0.8rem; border-radius: 6px; border: none; background: var(--interactive-accent); color: var(--text-on-accent); cursor: pointer; font-weight: bold; transition: opacity 0.2s; }
            .password-lock__submit:hover { opacity: 0.9; }
            .password-lock__error { font-size: 0.85rem; margin-top: 0.5rem; }
        \`;
        document.head.appendChild(style);
    }

    function init() {
        const unlockBtn = document.getElementById(DOM_IDS.UNLOCK_BUTTON);
        if(unlockBtn) unlockBtn.addEventListener('click', attemptUnlock);
        const passInput = document.getElementById(DOM_IDS.PASSWORD_INPUT);
        if(passInput) passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptUnlock(); });
        
        const storageKey = 'doc-password-' + window.location.pathname;
        const savedPass = localStorage.getItem(storageKey);
        if (savedPass && passInput) { passInput.value = savedPass; setTimeout(attemptUnlock, 100); }
        
        hideTOC();

        if (window.__tocHideObserver) window.__tocHideObserver.disconnect();
        const observer = new MutationObserver(hideTOC);
        observer.observe(document.body, { childList: true, subtree: true });
        window.__tocHideObserver = observer;
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
`;
    }
}
