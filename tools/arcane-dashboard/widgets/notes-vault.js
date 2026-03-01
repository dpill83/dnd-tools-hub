/**
 * Notes Vault widget – tabbed sections, rich text, optional encryption + warning + hint.
 */
(function () {
    'use strict';

    var STATE = window.ArcaneDashboardState;
    if (!STATE) return;

    function getData(campaignId) {
        return STATE.getNotes(campaignId);
    }

    function saveData(campaignId, data) {
        STATE.setNotes(campaignId, data);
    }

    function renderBody(body, widget, campaignId) {
        var data = getData(campaignId);
        var sections = data.sections || [];
        if (sections.length === 0) {
            sections = [{ id: 's1', title: 'General', content: '', encrypted: false }];
            data.sections = sections;
            saveData(campaignId, data);
        }

        body.innerHTML = '';

        var hasEncrypted = sections.some(function (s) { return s.encrypted; });
        if (hasEncrypted) {
            var warn = document.createElement('p');
            warn.className = 'ad-notes-warning';
            warn.style.cssText = 'font-size:0.75rem;color:var(--ad-warning, #ffc107);margin:0 0 0.5rem;';
            warn.textContent = 'Encrypted sections cannot be recovered without the passphrase. Use the optional hint to avoid lockout.';
            warn.setAttribute('role', 'status');
            body.appendChild(warn);
        }

        var tabs = document.createElement('div');
        tabs.className = 'ad-notes-tabs';
        var panels = document.createElement('div');
        panels.className = 'ad-notes-panels';

        function showPanel(index) {
            panels.querySelectorAll('.ad-notes-panel').forEach(function (p, i) {
                p.classList.toggle('hidden', i !== index);
            });
            tabs.querySelectorAll('.ad-notes-tab').forEach(function (t, i) {
                t.classList.toggle('active', i === index);
            });
        }

        sections.forEach(function (sec, i) {
            var tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'ad-notes-tab' + (i === 0 ? ' active' : '');
            tab.textContent = sec.title || 'Section ' + (i + 1);
            tab.addEventListener('click', function () { showPanel(i); });
            tabs.appendChild(tab);

            var panel = document.createElement('div');
            panel.className = 'ad-notes-panel' + (i === 0 ? '' : ' hidden');
            if (sec.encrypted) {
                var lockMsg = document.createElement('p');
                lockMsg.className = 'ad-notes-locked';
                lockMsg.textContent = 'Encrypted. Enter passphrase to unlock.';
                var passInput = document.createElement('input');
                passInput.type = 'password';
                passInput.placeholder = 'Passphrase';
                passInput.className = 'ad-notes-pass';
                var hintBtn = document.createElement('button');
                hintBtn.type = 'button';
                hintBtn.className = 'ad-widget-btn';
                hintBtn.textContent = 'Show hint';
                hintBtn.addEventListener('click', function () {
                    alert(data.hint || 'No hint set.');
                });
                var unlockBtn = document.createElement('button');
                unlockBtn.type = 'button';
                unlockBtn.className = 'ad-widget-btn';
                unlockBtn.textContent = 'Unlock';
                unlockBtn.addEventListener('click', function () {
                    var pass = passInput.value;
                    if (!pass) return;
                    decryptSection(sec, pass, data, campaignId, function (content) {
                        if (content != null) {
                            sec._decryptedContent = content;
                            var ta = document.createElement('textarea');
                            ta.className = 'ad-notes-textarea';
                            ta.value = content;
                            ta.rows = 8;
                            panel.innerHTML = '';
                            panel.appendChild(ta);
                            ta.addEventListener('input', function () {
                                sec._decryptedContent = ta.value;
                            });
                        }
                    });
                });
                panel.appendChild(lockMsg);
                panel.appendChild(passInput);
                panel.appendChild(unlockBtn);
                panel.appendChild(hintBtn);
            } else {
                var ta = document.createElement('textarea');
                ta.className = 'ad-notes-textarea';
                ta.value = sec.content || '';
                ta.rows = 8;
                ta.addEventListener('input', function () {
                    sec.content = ta.value;
                    saveData(campaignId, data);
                });
                panel.appendChild(ta);
                var encBtn = document.createElement('button');
                encBtn.type = 'button';
                encBtn.className = 'ad-widget-btn';
                encBtn.textContent = 'Encrypt section';
                encBtn.style.marginTop = '0.35rem';
                encBtn.addEventListener('click', function () {
                    var pass = prompt('Passphrase (cannot be recovered):');
                    if (!pass) return;
                    var hint = prompt('Optional hint (shown on unlock only):');
                    encryptSection(sec, ta.value, pass, hint, data, campaignId);
                    if (window.ArcaneDashboard && window.ArcaneDashboard.refreshWidgetLayer) {
                        window.ArcaneDashboard.refreshWidgetLayer();
                    }
                });
                panel.appendChild(encBtn);
            }
            panels.appendChild(panel);
        });

        body.appendChild(tabs);
        body.appendChild(panels);

        var addSec = document.createElement('button');
        addSec.type = 'button';
        addSec.className = 'ad-widget-btn';
        addSec.textContent = '+ Section';
        addSec.style.marginTop = '0.5rem';
        addSec.addEventListener('click', function () {
            var title = prompt('Section title:', 'New section');
            if (!title || !title.trim()) return;
            sections.push({ id: 's' + Date.now(), title: title.trim(), content: '', encrypted: false });
            saveData(campaignId, data);
            if (window.ArcaneDashboard && window.ArcaneDashboard.refreshWidgetLayer) {
                window.ArcaneDashboard.refreshWidgetLayer();
            }
        });
        body.appendChild(addSec);
    }

    function deriveKey(passphrase, salt) {
        return new Promise(function (resolve, reject) {
            if (!window.crypto || !window.crypto.subtle) return reject(new Error('Web Crypto not available'));
            var enc = new TextEncoder();
            crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits']).then(function (key) {
                return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
            }).then(function (bits) {
                return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
            }).then(resolve).catch(reject);
        });
    }

    function encryptSection(sec, plaintext, passphrase, hint, data, campaignId) {
        if (!window.crypto || !window.crypto.subtle) { alert('Web Crypto not available.'); return; }
        var salt = window.crypto.getRandomValues(new Uint8Array(16));
        var iv = window.crypto.getRandomValues(new Uint8Array(12));
        deriveKey(passphrase, salt).then(function (key) {
            var enc = new TextEncoder();
            return crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                enc.encode(plaintext)
            );
        }).then(function (ciphertext) {
            sec.content = '';
            sec.encrypted = true;
            sec.ciphertext = btoa(String.fromCharCode.apply(null, new Uint8Array(ciphertext)));
            sec.iv = btoa(String.fromCharCode.apply(null, iv));
            sec.salt = btoa(String.fromCharCode.apply(null, salt));
            if (hint) data.hint = hint;
            saveData(campaignId, data);
        }).catch(function (e) {
            alert('Encryption failed: ' + e.message);
        });
    }

    function decryptSection(sec, passphrase, data, campaignId, callback) {
        if (!sec.ciphertext || !sec.iv || !sec.salt) return callback(null);
        var salt = Uint8Array.from(atob(sec.salt), function (c) { return c.charCodeAt(0); });
        var iv = Uint8Array.from(atob(sec.iv), function (c) { return c.charCodeAt(0); });
        var ct = Uint8Array.from(atob(sec.ciphertext), function (c) { return c.charCodeAt(0); });
        deriveKey(passphrase, salt).then(function (key) {
            return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
        }).then(function (buf) {
            callback(new TextDecoder().decode(buf));
        }).catch(function () { callback(null); });
    }

    window.ArcaneDashboardWidgets._renderers.notes = renderBody;
})();
