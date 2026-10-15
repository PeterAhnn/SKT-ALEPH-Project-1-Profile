const status = document.querySelector('#private-status');
const form = document.querySelector('#passkey-form');
const registerButton = document.querySelector('#register-passkey');
const accountInput = document.querySelector('#account-name');
const loginButton = document.querySelector('#login-passkey');
const logoutButton = document.querySelector('#logout');
let authenticated = false;
const evidence = [];

async function request(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  evidence.push({ checkedAt: new Date().toISOString(), request: { method, path, cookie: '[가림]', body: body ?? null }, response: { status: response.status, body: data, setCookie: '[가림]' } });
  if (evidence.length > 200) evidence.shift();
  if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다. 다시 시도해 주세요.');
  return data;
}

async function refresh() {
  const content = document.querySelector('#private-content');
  const management = document.querySelector('#passkey-management');
  content.replaceChildren();
  content.hidden = true;
  management.hidden = true;
  document.querySelector('#passkey-list').replaceChildren();
  try {
    const session = await request('/api/session');
    authenticated = session.authenticated;
    accountInput.readOnly = authenticated;
    loginButton.hidden = authenticated;
    logoutButton.hidden = !authenticated;
    registerButton.textContent = authenticated ? '패스키 하나 더 등록' : '처음 패스키 등록';
    if (authenticated) accountInput.value = session.user.name;
    status.textContent = authenticated ? `${session.user.name} 계정의 비공개 공간입니다.` : '잠겨 있습니다. 패스키로 로그인한 뒤에만 내용을 볼 수 있습니다.';
    if (!authenticated) return true;
    const data = await request('/api/private/items');
    for (const item of data.items) {
      const article = document.createElement('article');
      const title = document.createElement('h3');
      const body = document.createElement('p');
      title.textContent = item.title;
      body.textContent = item.body;
      article.append(title, body);
      content.append(article);
    }
    content.hidden = false;
    const passkeys = await request('/api/passkeys');
    const list = document.querySelector('#passkey-list');
    list.replaceChildren();
    for (const key of passkeys.credentials) {
      const row = document.createElement('li');
      row.textContent = `${key.name} · ${new Date(key.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      const publicKey = document.createElement('pre');
      summary.textContent = '서버에 저장된 공개키 확인';
      publicKey.textContent = JSON.stringify({ publicKey: key.publicKey, type: '공개키이며 비밀번호가 아닙니다. 개인키는 서비스 서버로 보내지 않습니다.' }, null, 2);
      details.append(summary, publicKey);
      row.append(details);
      const remove = document.createElement('button');
      remove.className = 'button secondary';
      remove.type = 'button';
      remove.textContent = `${key.name} 삭제`;
      remove.addEventListener('click', async () => {
        const message = passkeys.credentials.length === 1 ? '마지막 패스키입니다. 삭제하면 이 계정에 다시 로그인할 수 없고 복구 기능도 없습니다. 그래도 삭제하시겠습니까?' : `${key.name} 패스키를 삭제하시겠습니까? 삭제한 패스키로는 다시 로그인할 수 없습니다.`;
        if (!window.confirm(message)) return;
        remove.disabled = true;
        try {
          const result = await request(`/api/passkeys/${encodeURIComponent(key.id)}`, {}, 'DELETE');
          if (!await refresh()) return;
          status.textContent = result.remaining === 0 ? '패스키를 모두 삭제했습니다. 이 계정에 다시 로그인할 수 없습니다. 비밀번호나 이메일 복구는 제공하지 않습니다.' : `패스키를 삭제했습니다. 남은 패스키는 ${result.remaining}개입니다.${result.loggedOut ? ' 남은 패스키로 다시 로그인해 주세요.' : ''}`;
        } catch (error) { status.textContent = error.message; remove.disabled = false; }
      });
      row.append(remove);
      list.append(row);
    }
    management.hidden = false;
    return true;
  } catch (error) { status.textContent = error.message; return false; }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  let challengeId;
  registerButton.disabled = true;
  try {
    if (!window.PublicKeyCredential || !window.isSecureContext || !window.SimpleWebAuthnBrowser) throw new Error('패스키를 지원하는 브라우저와 HTTPS 주소에서 열어 주세요. 개발 중에는 localhost를 사용할 수 있습니다.');
    const options = await request('/api/passkeys/register/options', { name: accountInput.value.trim(), credentialName: document.querySelector('#credential-name').value.trim() });
    challengeId = options.challengeId;
    const response = await window.SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options.publicKey });
    await request('/api/passkeys/register/verify', { challengeId, response });
    if (!await refresh()) return;
    status.textContent = '패스키 등록을 마쳤습니다. 이 계정의 비공개 공간을 열었습니다.';
  } catch (error) {
    if (challengeId) { try { await request('/api/passkeys/register/cancel', { challengeId }); } catch {} }
    status.textContent = error.name === 'NotAllowedError' || error.code === 'ERROR_CEREMONY_ABORTED' ? '패스키 등록을 취소했습니다. 새 패스키와 계정 자료는 저장하지 않았습니다. 다시 등록할 수 있습니다.' : error.message;
  } finally { registerButton.disabled = false; }
});

loginButton.addEventListener('click', async () => {
  loginButton.disabled = true;
  try {
    if (!window.PublicKeyCredential || !window.isSecureContext || !window.SimpleWebAuthnBrowser) throw new Error('패스키를 지원하는 브라우저와 HTTPS 주소에서 열어 주세요. 개발 중에는 localhost를 사용할 수 있습니다.');
    const options = await request('/api/passkeys/login/options', { name: accountInput.value.trim() });
    const response = await window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options.publicKey });
    await request('/api/passkeys/login/verify', { challengeId: options.challengeId, response });
    if (!await refresh()) return;
    status.textContent = '패스키로 로그인했습니다. 비공개 공간을 열었습니다.';
  } catch (error) {
    status.textContent = error.name === 'NotAllowedError' ? '패스키 로그인을 취소했거나 사용할 패스키가 없습니다. 등록한 기기로 다시 시도해 주세요.' : error.message;
  } finally { loginButton.disabled = false; }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await request('/api/logout', {});
    if (!await refresh()) return;
    status.textContent = '로그아웃했습니다. 비공개 공간을 잠갔습니다.';
  } catch (error) { status.textContent = error.message; }
  finally { logoutButton.disabled = false; }
});

document.querySelector('#download-evidence').addEventListener('click', () => {
  const data = { recordedAt: new Date().toISOString(), source: location.origin, kind: '이 탭의 실제 요청·응답을 브라우저에서 수집한 기록입니다. 저장 위치는 사용자의 직접 선택이며 자동 판정이 아닙니다.', storageLocation: document.querySelector('#storage-location').value, records: evidence };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 't08-browser-evidence.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

refresh();
