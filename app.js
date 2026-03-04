    /* ════════════════════════════════════════
       ALGORITMOS (portados do Python)
    ════════════════════════════════════════ */

    /**
     * Gera senha de 6 dígitos a partir de uma string serial.
     * Usa BigInt para replicar exatamente a aritmética 32/64-bit do Python.
     */
    function gerarSenhaDeSerial(serial) {
        const bytes = new TextEncoder().encode(serial);
        const mask32 = 0xFFFFFFFFn;
        const mask64 = 0xFFFFFFFFFFFFFFFFn;

        let cpu_id0 = 0n, cpu_id1 = 0n, cpu_id2 = 0n;

        for (let i = 0; i < bytes.length; i++) {
            const b = BigInt(bytes[i]);
            if (i % 3 === 0) {
                cpu_id0 = ((cpu_id0 << 8n) | b) & mask32;
            } else if (i % 3 === 1) {
                cpu_id1 = ((cpu_id1 << 8n) | b) & mask32;
            } else {
                cpu_id2 = ((cpu_id2 << 8n) | b) & mask32;
            }
        }

        let temp = cpu_id0;
        temp ^= (cpu_id1 << 11n) & mask64;
        temp ^= (cpu_id2 << 22n) & mask64;
        temp = ((temp >> 32n) ^ (temp & mask32)) & mask32;
        temp = (temp * 2654435761n) & mask32;

        return Number(temp % 1000000n);
    }

    /** Nível 2 (Técnico) — base para ativação */
    function geraSenha4Digitos(senha6) {
        const p1 = Math.floor(senha6 / 1000);
        const p2 = senha6 % 1000;
        let t = (p1 * 17) ^ (p2 * 23);
        t = t * 40503;
        return t % 10000;
    }

    /** Nível 2 (Técnico) */
    function geraSenhaNivel2(senha6) {
        return geraSenha4Digitos(senha6);
    }

    /* ════════════════════════════════════════
       CRIPTOGRAFIA — AES-GCM (Web Crypto API)
    ════════════════════════════════════════ */

    /* Chave de 256 bits fixa — ofusca o conteúdo gravado em localStorage */
    const _KEY_BYTES = new Uint8Array([
        0xB3, 0x7E, 0x4A, 0xD1, 0x09, 0xF8, 0x2C, 0x55,
        0xE6, 0x3B, 0x91, 0x0D, 0x74, 0xCA, 0x58, 0xA2,
        0x1F, 0x86, 0xDD, 0x47, 0x30, 0x6E, 0xBC, 0x93,
        0x5A, 0x28, 0xF0, 0x61, 0x9C, 0xE3, 0x42, 0x17
    ]);

    async function _importKey() {
        return crypto.subtle.importKey(
            'raw', _KEY_BYTES,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function _encrypt(obj) {
        const key = await _importKey();
        const iv  = crypto.getRandomValues(new Uint8Array(12));
        const raw = new TextEncoder().encode(JSON.stringify(obj));
        const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, raw);
        const buf = new Uint8Array(12 + enc.byteLength);
        buf.set(iv);
        buf.set(new Uint8Array(enc), 12);
        /* converte para base64 sem caracteres legíveis evidentes */
        return btoa(String.fromCharCode(...buf));
    }

    async function _decrypt(b64) {
        const key = await _importKey();
        const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const iv  = buf.slice(0, 12);
        const enc = buf.slice(12);
        const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, enc);
        return JSON.parse(new TextDecoder().decode(dec));
    }

    /* ════════════════════════════════════════
       DISPOSITIVO & LICENÇA (localStorage)
    ════════════════════════════════════════ */

    const LICENSE_STORAGE_KEY = 'alfatronic_license';
    const DEVICE_STORAGE_KEY = 'alfatronic_device_id';
    const LICENSE_FILE_NAME = 'alfatronic_license.enc';

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    function getDeviceId() {
        let id = localStorage.getItem(DEVICE_STORAGE_KEY);
        if (!id) {
            id = generateUUID();
            localStorage.setItem(DEVICE_STORAGE_KEY, id);
        }
        return id;
    }

    async function getLicenseFileHandle(createIfMissing = false) {
        if (!navigator.storage || !navigator.storage.getDirectory) return null;
        const root = await navigator.storage.getDirectory();
        return root.getFileHandle(LICENSE_FILE_NAME, { create: createIfMissing });
    }

    async function readLicenseBlob() {
        try {
            const handle = await getLicenseFileHandle(false);
            if (!handle) return null;
            const file = await handle.getFile();
            return await file.text();
        } catch {
            return null;
        }
    }

    async function writeLicenseBlob(blob) {
        localStorage.setItem(LICENSE_STORAGE_KEY, blob);
        try {
            const handle = await getLicenseFileHandle(true);
            if (!handle) return;
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
        } catch {
            /* fallback já salvo em localStorage */
        }
    }

    async function deleteLicenseBlob() {
        localStorage.removeItem(LICENSE_STORAGE_KEY);
        try {
            if (!navigator.storage || !navigator.storage.getDirectory) return;
            const root = await navigator.storage.getDirectory();
            await root.removeEntry(LICENSE_FILE_NAME);
        } catch {
            /* arquivo pode não existir */
        }
    }

    async function isLicensed() {
        try {
            const raw = await readLicenseBlob();
            if (!raw) return false;
            const data = await _decrypt(raw);
            return !!data.ativado;
        } catch { return false; }
    }

    async function saveLicense(contra, codigoAtivacao) {
        const blob = await _encrypt({
            ativado: true,
            senha_validacao: contra,
            codigo_ativacao: codigoAtivacao,
            device_id: getDeviceId()
        });
        await writeLicenseBlob(blob);
    }

    async function resetLicense() {
        await deleteLicenseBlob();
        localStorage.removeItem(DEVICE_STORAGE_KEY);
    }

    /* ════════════════════════════════════════
       UTILITÁRIOS DE UI
    ════════════════════════════════════════ */

    let _toastTimer = null;

    function showToast(msg, ms = 2600) {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.classList.add('show');
        if (_toastTimer) clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => el.classList.remove('show'), ms);
    }

    function setStatus(id, msg, type = '') {
        const el = document.getElementById(id);
        el.textContent = msg;
        el.className = 'status-msg' + (type ? ' ' + type : '');
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('✓ Copiado para a área de transferência');
        } catch {
            /* fallback para WebViews mais antigos */
            const ta = document.createElement('textarea');
            ta.value = text;
            Object.assign(ta.style, { position: 'fixed', opacity: '0', top: '0', left: '0' });
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            try {
                document.execCommand('copy');
                showToast('✓ Copiado!');
            } catch {
                showToast('Código: ' + text, 4000);
            }
            document.body.removeChild(ta);
        }
    }

    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    }

    /* ════════════════════════════════════════
       TELA DE ATIVAÇÃO
    ════════════════════════════════════════ */

    let _codigoAtivacao = null;

    function initActivationScreen() {
        showScreen('screen-activation');

        const deviceId = getDeviceId();
        _codigoAtivacao = gerarSenhaDeSerial(deviceId);
        const codigoStr = String(_codigoAtivacao).padStart(6, '0');

        document.getElementById('display-codigo').textContent = codigoStr;

        document.getElementById('btn-copiar-codigo').addEventListener('click', () => {
            copyText(codigoStr);
        });

        const inputContra = document.getElementById('input-contra');

        inputContra.addEventListener('input', () => {
            inputContra.value = inputContra.value.replace(/\D/g, '').slice(0, 6);
            const n = inputContra.value.length;
            if (n === 6) {
                setStatus('status-ativacao', '✓ Pronto para ativar', 'success');
            } else {
                setStatus('status-ativacao', `Digite mais ${6 - n} dígito(s)`);
            }
        });

        inputContra.addEventListener('keyup', e => { if (e.key === 'Enter') ativarLicenca(); });
        document.getElementById('btn-ativar').addEventListener('click', ativarLicenca);
    }

    async function ativarLicenca() {
        const contra = document.getElementById('input-contra').value;

        if (contra.length !== 6 || !/^\d{6}$/.test(contra)) {
            setStatus('status-ativacao', '⚠ Digite exatamente 6 dígitos!', 'error');
            showToast('⚠ Contra-senha deve ter 6 dígitos');
            return;
        }

        const senha4 = geraSenha4Digitos(_codigoAtivacao);
        const senhaCorreta = String(senha4).padStart(6, '0');

        if (contra === senhaCorreta) {
            await saveLicense(contra, String(_codigoAtivacao).padStart(6, '0'));
            showToast('✓ Licença ativada com sucesso!');
            setTimeout(initGeneratorScreen, 700);
        } else {
            setStatus('status-ativacao', '✗ Contra-senha incorreta! Verifique com o suporte.', 'error');
            showToast('✗ Contra-senha incorreta');
            document.getElementById('input-contra').value = '';
            document.getElementById('input-contra').focus();
        }
    }

    /* ════════════════════════════════════════
       TELA DO GERADOR
    ════════════════════════════════════════ */

    function initGeneratorScreen() {
        showScreen('screen-generator');

        /* Input senha 6 */
        const input6 = document.getElementById('input-senha6');
        input6.addEventListener('input', () => {
            input6.value = input6.value.replace(/\D/g, '').slice(0, 6);
            const n = input6.value.length;
            if (n === 6) {
                setStatus('status-gerador', '✓ Pronto para gerar', 'success');
            } else {
                setStatus('status-gerador', `Digite mais ${6 - n} dígito(s)`);
            }
        });
        input6.addEventListener('keyup', e => { if (e.key === 'Enter') gerarSenha(); });

        /* Botões */
        document.getElementById('btn-gerar').addEventListener('click', gerarSenha);
    }

    function gerarSenha() {
        const val = document.getElementById('input-senha6').value;

        if (val.length !== 6 || !/^\d{6}$/.test(val)) {
            setStatus('status-gerador', '⚠ Digite exatamente 6 dígitos!', 'error');
            showToast('⚠ Digite 6 dígitos');
            return;
        }

        const senha6 = parseInt(val, 10);
        const senha4 = geraSenhaNivel2(senha6);

        const result = String(senha4).padStart(4, '0');
        const display = document.getElementById('display-senha4');
        display.textContent = result;
        display.classList.remove('pop');
        /* força re-flow para reiniciar animação */
        void display.offsetWidth;
        display.classList.add('pop');

        setStatus('status-gerador', '✓ Senha gerada com Sucesso', 'success');
    }

    /* ════════════════════════════════════════
       INICIALIZAÇÃO
    ════════════════════════════════════════ */

    async function init() {
        if (await isLicensed()) {
            initGeneratorScreen();
        } else {
            initActivationScreen();
        }
    }

    init();

    /* ── Service Worker (PWA offline) ── */
    if ('serviceWorker' in navigator) {
        const host = location.hostname;
        const isLocalDev = host === 'localhost' || host === '127.0.0.1';

        if (isLocalDev) {
            navigator.serviceWorker.getRegistrations()
                .then(regs => Promise.all(regs.map(r => r.unregister())))
                .catch(() => {});
        } else {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch(() => {});
            });
        }
    }

