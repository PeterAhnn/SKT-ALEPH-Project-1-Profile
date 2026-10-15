# T08 운영 저장소 설정 제안 — 아직 실행하지 않음

과제 8의 공개키·일회용 질문·세션·가상 자료를 서버 재시작 뒤에도 유지하려면 지속 저장소가 필요합니다. 로컬 개발에는 Git에서 제외한 JSON 파일을 사용합니다. Vercel 운영 환경에서는 이 파일 방식을 사용하지 않으며 DB 연결이 없으면 비공개 API가 503으로 실패하도록 합니다.

## 검토 대상과 변경 범위

- 현재 연결 목록에는 T08 전용 Supabase 프로젝트가 없습니다.
- 선택 가능한 제안: 기존 `skt-aleph-t07-diary-auth` DB 안에 별도 `t08` 스키마와 전용 `t08_runtime` 역할을 만듭니다. 실제 프로젝트 ID와 기존 이름 충돌 여부는 승인 후 읽기 전용으로 재확인합니다.
- 아래 SQL은 `t08` 스키마의 새 테이블 하나와 새 역할에만 적용합니다. 기존 T07·방어전 테이블, 자료, 로그인 정책을 변경하거나 삭제하지 않습니다.
- `anon`, `authenticated`, `PUBLIC`에 새 자료 접근 권한을 주지 않습니다. `t08_runtime`은 새 상태 행을 읽고 갱신하는 권한만 갖습니다.
- 상태 문서는 사용자·공개키·질문·세션 해시·가상 자료를 담습니다. 서버의 모든 변경은 `SELECT ... FOR UPDATE` 트랜잭션으로 직렬화하여 질문 재사용과 동시 요청을 처리합니다.
- 하나의 상태 행에 자료를 모으는 방식은 과제 규모에 맞춘 선택입니다. 많은 계정이나 대규모 동시 요청을 위한 설계는 아닙니다.
- DB 로그인 비밀값은 승인 후 전용 역할에 별도로 생성하고 서버 환경변수로만 설정합니다. 공개 파일·제출물에는 기록하지 않습니다.

## 적용 예정 SQL

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

로그인 활성화는 위 범위 승인 후 생성한 비밀값을 사용한 `ALTER ROLE t08_runtime LOGIN PASSWORD ...`로 수행합니다. 실제 값은 문서와 로그에 적지 않습니다. 전용 역할은 T08 서버에서만 사용합니다.

## 검증할 사항

1. 승인 대상 프로젝트와 스키마 이름 충돌 여부를 확인합니다.
2. 위 SQL을 적용하고 t08_runtime의 새 스키마·테이블 권한과 RLS를 확인합니다.
3. 다른 테이블에 명시적으로 새 권한이 부여되지 않았는지 확인합니다.
4. 운영 서버에서 트랜잭션·질문 한 번 소비·로그아웃 후 세션 거절을 확인합니다.

현재 상태: SQL 적용, 역할 생성, 로그인 활성화, 운영 연결을 모두 수행하지 않았습니다.
