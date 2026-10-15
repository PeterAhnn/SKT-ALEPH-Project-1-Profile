import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fixture, kind } from './browser-fixture.mjs';

const f = await fixture();
try {
  await f.register();
  const keyA = await f.store.transact(state => Object.values(state.credentials)[0]);
  // Device credentials, including the emulator's private key, stay in RAM only.
  const deviceA = (await f.cdp.send('WebAuthn.getCredentials', { authenticatorId: f.authenticatorId })).credentials[0];
  await f.cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: f.authenticatorId });
  let activeAuthenticator = await f.addAuthenticator();
  await f.page.locator('#credential-name').fill('가상 인증기 B');
  const added = f.page.waitForResponse(response => response.url().endsWith('/register/verify'));
  await f.page.locator('#register-passkey').click();
  assert.equal((await added).status(), 200);
  await f.page.locator('#passkey-list li').nth(1).waitFor();
  const keys = await f.store.transact(state => Object.values(state.credentials));
  assert.equal(keys.length, 2);
  const keyB = keys.find(key => key.id !== keyA.id);
  const deviceB = (await f.cdp.send('WebAuthn.getCredentials', { authenticatorId: activeAuthenticator })).credentials[0];
  await mkdir('verification/card4', { recursive: true });
  await f.page.locator('#private-space').screenshot({ path: 'verification/card4/two-passkeys.png' });
  f.page.on('dialog', dialog => dialog.accept());
  const removed = f.page.waitForResponse(response => response.request().method() === 'DELETE');
  await f.page.getByRole('button', { name: '가상 인증기 A 삭제', exact: true }).click();
  const removedResponse = await removed;
  const removedBody = await removedResponse.json();
  assert.equal(removedResponse.status(), 200);
  assert.equal(removedBody.remaining, 1);
  await f.page.getByRole('status').getByText('남은 패스키는 1개입니다.', { exact: false }).waitFor();
  await f.logout();

  await f.cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: activeAuthenticator });
  activeAuthenticator = await f.addAuthenticator();
  await f.cdp.send('WebAuthn.addCredential', { authenticatorId: activeAuthenticator, credential: deviceA });
  const deletedOptions = (await f.post('/api/passkeys/login/options', { name: 'virtual-a' })).body;
  const deletedProof = await f.page.evaluate(async ({ options, id }) => {
    options.allowCredentials = [{ type: 'public-key', id }];
    return window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options });
  }, { options: deletedOptions.publicKey, id: keyA.id });
  const deletedLogin = await f.post('/api/passkeys/login/verify', { challengeId: deletedOptions.challengeId, response: deletedProof });
  assert.equal(deletedLogin.status, 401);

  await f.cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: activeAuthenticator });
  activeAuthenticator = await f.addAuthenticator();
  await f.cdp.send('WebAuthn.addCredential', { authenticatorId: activeAuthenticator, credential: deviceB });
  const remainingOptions = (await f.post('/api/passkeys/login/options', { name: 'virtual-a' })).body;
  const remainingProof = await f.page.evaluate(async optionsJSON => window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON }), remainingOptions.publicKey);
  const remainingLogin = await f.post('/api/passkeys/login/verify', { challengeId: remainingOptions.challengeId, response: remainingProof });
  assert.equal(remainingLogin.status, 200);
  await f.page.reload();
  await f.page.locator('#private-content article').nth(2).waitFor();
  await f.page.locator('#private-space').screenshot({ path: 'verification/card4/remaining-passkey-login.png' });
  const last = f.page.waitForResponse(response => response.request().method() === 'DELETE');
  await f.page.getByRole('button', { name: '가상 인증기 B 삭제', exact: true }).click();
  const lastResponse = await last;
  const lastBody = await lastResponse.json();
  assert.equal(lastBody.remaining, 0);
  assert.equal(lastBody.loggedOut, true);
  await f.page.getByRole('status').getByText('패스키를 모두 삭제했습니다.', { exact: false }).waitFor();
  assert.equal(await f.page.locator('#private-content').isVisible(), false);
  const noKeyLogin = await f.post('/api/passkeys/login/options', { name: 'virtual-a' });
  assert.equal(noKeyLogin.status, 401);
  await f.page.locator('#private-space').screenshot({ path: 'verification/card4/no-passkeys.png' });
  await writeFile('verification/card4/deletion-evidence.json', JSON.stringify({ checkedAt: new Date().toISOString(), kind, devices: '서로 독립한 Chromium 가상 인증기 2개', registered: keys.map(({ id, name, createdAt, publicKey }) => ({ id, name, createdAt, publicKey })), deleteFirst: { request: { method: 'DELETE', path: `/api/passkeys/${keyA.id}`, cookie: '[가림]' }, response: { status: removedResponse.status(), body: removedBody } }, records: f.records, deletedKeyNegativeTest: '삭제된 키로 서명하기 위해 클라이언트 allowCredentials만 삭제된 키 ID로 바꾸었습니다. 서버 검증과 저장 상태는 바꾸지 않았습니다.', deleteLast: { request: { method: 'DELETE', path: `/api/passkeys/${keyB.id}`, cookie: '[가림]' }, response: { status: lastResponse.status(), body: lastBody } }, lastKeyPolicy: '패스키 0개면 기존 계정 로그인과 비밀번호·이메일 복구를 제공하지 않습니다. 기존 가상 자료는 삭제하지 않습니다.' }, null, 2));
  console.log('카드 4: 독립 가상 인증기 2개·삭제키401·남은키200·마지막키삭제 후 로그인401 확인 완료');
} finally { await f.close(); }
