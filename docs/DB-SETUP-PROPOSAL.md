# T08 운영 저장소 설정 기록 — 승인 범위 적용·DB 검증 완료

과제 8의 공개키·일회용 질문·세션·가상 자료를 서버 재시작 뒤에도 유지하려면 지속 저장소가 필요합니다. 로컬 개발에는 Git에서 제외한 JSON 파일을 사용합니다. Vercel 운영 환경에서는 이 파일 방식을 사용하지 않으며 DB 연결이 없으면 비공개 API가 503으로 실패하도록 합니다.

## 승인 대상과 적용 범위

- 사용자가 이 문서의 SQL 범위를 명시적으로 승인했습니다. `verification/db-setup.json`의 userApproved는 true이며 승인 범위는 기존 `skt-aleph-t07-diary-auth` DB의 새 `t08` 스키마·`t08_runtime` 역할·상태 행·전용 서버 연결입니다.
- 승인된 기존 DB 안에 별도 `t08` 스키마와 전용 `t08_runtime` 역할을 만들었습니다. 기록된 스키마 변경 이름은 `t08_private_passkey_state`입니다. 별도 T08 Supabase 프로젝트를 새로 만들지 않았습니다.
- 아래 SQL은 `t08` 스키마의 새 테이블 하나와 새 역할에만 적용합니다. 기존 T07·방어전 테이블, 자료, 로그인 정책을 변경하거나 삭제하지 않습니다.
- `anon`, `authenticated`, `PUBLIC`에 새 자료 접근 권한을 주지 않습니다. `t08_runtime`은 새 상태 행을 읽고 갱신하는 권한만 갖습니다.
- 상태 문서는 사용자·공개키·질문·세션 해시·가상 자료를 담습니다. 서버의 모든 변경은 `SELECT ... FOR UPDATE` 트랜잭션으로 직렬화하여 질문 재사용과 동시 요청을 처리합니다.
- 하나의 상태 행에 자료를 모으는 방식은 과제 규모에 맞춘 선택입니다. 많은 계정이나 대규모 동시 요청을 위한 설계는 아닙니다.
- 승인된 전용 역할의 로그인 비밀값을 비공개로 생성하고 LOGIN을 활성화했습니다. 서버 전용으로 사용하며 공개 파일·제출물·도구 출력에 기록하지 않았습니다. 비공개 자격 파일은 Git 제외 대상입니다. 운영 환경 변수 구성·배포 승격·앱 기능 검증의 완료 여부는 DB 적용과 구분합니다.

## 승인 후 적용한 원래 SQL

아래 SQL과 변경 범위는 승인 문서의 원문을 유지합니다. 처음에는 NOLOGIN 역할을 만들고, 승인된 비공개 자격으로 뒤에서 LOGIN을 활성화했습니다. 원문을 다시 실행하라는 뜻은 아닙니다.

```sql
BEGIN;
CREATE ROLE t08_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE SCHEMA t08;
REVOKE ALL ON SCHEMA t08 FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA t08 TO t08_runtime;

CREATE TABLE t08.app_state (
  slot text PRIMARY KEY CHECK (slot = 'main'),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO t08.app_state(slot, state) VALUES
  ('main', '{"users":{},"credentials":{},"challenges":{},"sessions":{},"rates":{}}'::jsonb);

ALTER TABLE t08.app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE t08.app_state FORCE ROW LEVEL SECURITY;
REVOKE ALL ON t08.app_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON t08.app_state TO t08_runtime;
CREATE POLICY t08_runtime_state ON t08.app_state
  FOR ALL TO t08_runtime
  USING (slot = 'main') WITH CHECK (slot = 'main');
COMMIT;
```

로그인 활성화는 위 범위 승인 후 생성한 비밀값을 사용한 `ALTER ROLE t08_runtime LOGIN PASSWORD ...`로 수행했습니다. 실제 값은 문서와 로그에 적지 않습니다. 전용 역할은 T08 서버에서만 사용합니다. `rolcanlogin=true`이며 SUPERUSER·CREATEDB·CREATEROLE·BYPASSRLS·INHERIT는 모두 false로 확인했습니다. 관리 권한을 넓히지 않았습니다.

## 실제 DB 검증 결과

확인일은 2026-10-15입니다. 근거는 `verification/db-setup.json`과 `verification/db-runtime.json`입니다. 문서 담당자는 두 실제 결과 파일을 읽어 아래 상태를 대조했습니다.

| 검증 항목 | 실제 결과 | 근거 |
|---|---|---|
| SQL·역할 적용 | 새 t08 스키마·상태 행·t08_runtime 역할을 적용하고 전용 LOGIN을 활성화했습니다. | db-setup.json의 schemaMigration·runtimeCredentialActivated·rolePrivileges |
| 권한과 RLS | 테이블 소유자는 postgres이며 RLS와 FORCE RLS가 true입니다. runtime은 SELECT·UPDATE만 true이고 INSERT·DELETE는 false입니다. | db-setup.json의 rolePrivileges.table·runtimeStatePrivileges |
| 공개 역할 접근 | PUBLIC·anon·authenticated에 새 자료 접근 권한을 주지 않았고 publicDenied=true입니다. | db-setup.json의 rolePrivileges.publicDenied |
| 기존 T07 접근 | 기존 7개 테이블에 runtime의 SELECT·UPDATE·DELETE 권한이 모두 false입니다. 실제 기존 T07 읽기도 SQLSTATE 42501로 거절되었습니다. | db-setup.json의 existingTablePrivileges·db-runtime.json의 denied |
| TLS 인증서·호스트 | 공식 Supabase CA를 사용해 인증서와 연결 호스트를 검증했습니다. 검증을 끄거나 관리 권한을 늘려 연결하지 않았습니다. | db-setup.json의 connection.sslCertificateVerified·sslHostnameVerified·caSource |
| 실제 PgStore 지속 저장 | 별도 연결 풀에서 같은 상태가 유지되는 것을 확인했습니다. separatePoolPersistence=true입니다. | db-runtime.json |
| 롤백과 시험 자료 정리 | 롤백 후 상태가 보존되었고 시험 표식은 제거했습니다. rollbackPreservedState=true·probeRemoved=true입니다. | db-runtime.json |
| 허용하지 않은 쓰기 | runtime의 t08 INSERT·DELETE가 각각 SQLSTATE 42501로 거절되었습니다. | db-runtime.json의 denied |
| 기존 자료 보존 | 기존 T07 7개 테이블 건수가 전후 같고 existingT07OrDefenseTablesModified=false입니다. | db-setup.json |

실제 연결 호스트는 `aws-0-ap-northeast-2.pooler.supabase.com:6543`이며 transaction 모드를 사용했습니다. 공식 CA 출처는 [Supabase 저장소의 인증서 안내 자료](https://raw.githubusercontent.com/supabase/supabase/master/apps/studio/hooks/custom-content/custom-content.json)로 기록되어 있습니다. DB 접속 문자열·사용자 비밀값·서버 자격은 이 문서에 넣지 않습니다.

초기 연결 실패의 원인은 확정하지 않았습니다. 이후 위 호스트에 인증서·호스트 검증을 유지한 실제 연결과 PgStore 시험이 성공했습니다. 첫 실패를 특정 네트워크·인증서·비밀값 문제로 단정하지 않습니다.

### 기존 T07 테이블 건수 비교

| 테이블 | 적용 전 | 적용 후 |
|---|---:|---:|
| plans | 3 | 3 |
| tasks | 8 | 8 |
| reviews | 1 | 1 |
| executions | 4 | 4 |
| plan_history | 7 | 7 |
| request_receipts | 8 | 8 |
| completion_events | 8 | 8 |

상위 작업에서 Supabase security advisors의 `lints=[]`도 확인했습니다. 이는 해당 점검에서 경고가 없었다는 결과이며 전체 앱·운영·실제 기기의 완주 판정이 아닙니다.

## 현재 상태와 남은 검증

완료: 사용자 승인 범위의 SQL 적용·전용 역할 LOGIN·최소 권한·공식 CA와 호스트 검증·실제 DB 연결·별도 PgStore 풀 지속 저장·롤백·권한 거절·기존 테이블 건수 보존을 확인했습니다.

대기: T08 운영 배포 승격과 실제 앱 기능 검증은 상위 작업에서 진행 중입니다. 운영 환경 변수 적용 상태·운영의 질문 한 번 소비·로그아웃 후 세션 거절·운영 공개 접근은 해당 실제 결과가 확인될 때 별도로 기록합니다. DB 연결 시험 성공을 운영 배포나 과제 제출·승인 완료로 표시하지 않습니다.
