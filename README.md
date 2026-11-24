# MY LITTLE CAFE

빵과 커피를 **직접 만들고**, 사람·동물 손님에게 **직접 서빙**하며, 카페를 꾸미고 넓혀 가는 아이소메트릭 3D 힐링 카페 경영 게임입니다.
웹 브라우저에서 바로 실행되고, Capacitor로 Android APK를 만들 수 있습니다.

- 엔진: [three.js](https://threejs.org) (WebGL) + TypeScript + Vite
- 앱 패키징: [Capacitor 8](https://capacitorjs.com) (Android)
- 캐릭터·가구·음식·사운드는 모두 **코드로 생성**합니다(외부 이미지/모델/음원 에셋 없음 → 라이선스 이슈 없음).

---

## 빠른 시작

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 타입체크 + 프로덕션 빌드 (dist/)
npm run preview    # 빌드 결과 미리보기
```

Node.js 20 이상을 권장합니다(개발·검증은 Node 22에서 진행).

## 조작법

| 동작 | 모바일 | PC |
|---|---|---|
| 이동 | 화면을 끌면 가상 조이스틱 / 바닥 탭 시 자동 이동 | WASD·방향키 / 클릭 |
| 제조 | 오븐·에스프레소 머신 탭 → 메뉴 선택 → 미니게임 | 동일 (Space/E: 상황 버튼) |
| 서빙 | 주문 말풍선 또는 손님 탭 (자동으로 걸어가서 전달) | 동일 |
| 확대/축소 | 두 손가락 핀치 | 마우스 휠 |
| 뒤로 | Android 뒤로가기 (패널 닫기 → 꾸미기 종료 → 일시정지 → 종료 확인) | Esc |

## 구현된 기능

| 영역 | 내용 |
|---|---|
| 하루 운영 | 영업 준비 → 오픈 → 손님 입장·착석·주문 → 제조 → 서빙 → 식사 → 계산·퇴장 → 마감 → 정산. 하루 5/6/8/10분 선택, 일시정지, 조기 종료 |
| 직접 제조 (8종 미니게임) | 반죽 치대기(리듬 탭), 모양 만들기(스와이프), 굽기(타이밍), 토핑/크림(문지르기), 원두 분쇄(원 그리기), 에스프레소 추출·우유 스티밍(길게 누르기), 라떼아트(따라 그리기). 메뉴 7종이 2~4단계 조합 |
| 품질 | 단계 점수 평균 = 품질(0~100) → PERFECT/GREAT/GOOD 등급, 손님 만족도·팁에 반영 |
| 숙련도 | 메뉴별 제조 횟수로 Lv.1~5. Lv.3부터 첫 단계 "숙련자 자동 처리"(82점) 선택 가능 |
| 손님 AI | 입장 → 빈자리 탐색(A* 경로) → 착석 → 주문 → 기다림(인내심) → 식사 중 활동(마시기·먹기·독서·폰·사진·대화·구경) → 감정 표현 → 계산 → 퇴장. 친구 동반(2인), 장식 구경 |
| 손님 관계 | 이름·종족·성격·선호 메뉴·방문 기록·친밀도, 단골 시스템, 스토리 특별 손님 3명(고유 부탁·보상) |
| 캐릭터 | 사람 + 동물 16종(웜뱃·쿼카·카피바라·토끼·고양이·강아지·수달·고슴도치·레서판다·곰·여우·펭귄 기본, 코알라·햄스터·알파카·판다 보석 구매). 종족과 직업은 무관 |
| 커스터마이징 | 앞치마·모자·안경·액세서리, 사람은 피부·머리색 |
| 경제 | 골드(운영)·보석(특별)·EXP. 플레이어 레벨(레시피·의상)과 카페 레벨(확장·가구·장비·직원 슬롯) 분리, 평판 ★0~5 |
| 직원 | 바리스타·베이커(대기 주문 제조 → 픽업대), 홀 직원(픽업대 → 서빙), 매니저(인내심+20%, 팁+10%). 신입/숙련/전문가, 성격 특성, 일당 정산 |
| 인테리어 | 격자 배치·드래그 이동·회전·보관, 겹침/통로 막힘/좌석 고립 자동 검사, 테마 6종, 가구 효과(만족도·체류·팁·디저트 추가 판매·독서) |
| 확장 | 기본 카페 → 넓은 홀 → 창가 좌석 → 야외 테라스 → 정원 |
| 상점 | 상시 판매(가챠 없음), 영구 소유, 찜하기, 도감 수집률, 레벨 해금 표시 |
| 퀘스트 | 일일 5종, 업적 6종(단계형), 스토리 10단계, 기간 한정 이벤트(겨울/봄/여름, 매년 반복) |
| 출석 | 7일 주기 보상(놓쳐도 단계 유지), 연속·누적 출석, 월간 마일스톤 |
| 추억 앨범 | 첫 손님·첫 단골·첫 PERFECT·시그니처 메뉴·확장·특별 손님 등을 **게임 화면 스냅샷**과 함께 자동 기록, 손님별 추억 보기 |
| 저장 | localStorage 자동 저장(12초 주기·주요 이벤트·앱 백그라운드 전환 시), 백업 파일 내보내기/가져오기, 초기화 |
| 계정·클라우드 저장 | 게스트 우선 + Google 계정 연동(Firebase Auth), Firestore 클라우드 세이브, 기기 간 충돌 선택, 계정 삭제. Firebase 설정이 없으면 기능 자체가 숨겨짐 → [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) |
| 사운드 | WebAudio로 합성한 효과음·배경음(에셋 없음), 진동 피드백 |

## 프로젝트 구조

```
src/
  main.ts              부트스트랩, UI 연결, 뒤로가기 처리
  core/                상태 스키마(state), 저장(save), 이벤트, 사운드, 유틸
  data/                게임 데이터 (종족, 메뉴, 가구·테마, 의상·장비, 손님, 레이아웃, 진행·퀘스트)
  world/               3D: 렌더러/카메라(scene), 카페 환경(cafe), 캐릭터 리그(character),
                       가구·음식 메시(props), 그리드·A*·배치 검증(grid), 썸네일(thumbs)
  game/                게임 로직: Game(오케스트레이터), 손님 AI, 직원, 플레이어, 꾸미기, 진행/경제
  minigames/           제조 미니게임 8종(steps) + 오버레이(host)
  ui/                  HUD·입력(hud), 패널(panels), 시트/토스트(dom), SVG 아이콘
  platform/native.ts   Capacitor(Android) 연동
scripts/
  e2e.mjs              핵심 루프 E2E 테스트
  e2e-systems.mjs      전 시스템 E2E 테스트
  gen-android-assets.mjs  Android 아이콘/스플래시 생성
android/               Capacitor Android 프로젝트
```

### 확장 방법

- **새 동물 추가**: `src/data/species.ts`에 항목 1개 추가 (귀/주둥이/꼬리/특징 조합). 리그를 공유하므로 모든 직업·손님·플레이어로 바로 사용됩니다.
- **새 메뉴**: `src/data/menu.ts`에 단계 조합으로 추가, 아이콘은 `src/ui/icons.ts`, 3D 모델은 `src/world/props.ts`의 `createFood`.
- **새 가구**: `src/data/furniture.ts`(크기·좌석·효과) + `createFurniture`에 메시.
- **클라우드 저장**: `src/core/save.ts`의 `StorageAdapter` 인터페이스를 구현해 `SaveManager`에 주입하면 됩니다(현재는 로컬 어댑터만 존재하며 가짜 서버 연동은 없음).

## 테스트

```bash
npm run build
npm run test:e2e                     # 빌드 결과를 vite preview로 띄워 핵심 루프 25개 항목 검사
node scripts/e2e-systems.mjs         # 미니게임 8종 실제 입력, 직원 자동화, 확장, 특별 손님, 반응형 등 22개 항목
# 개발 서버 대상: BASE_URL=http://localhost:5173 npm run test:e2e
```

계정·클라우드 저장 테스트(20개 항목, Firebase 에뮬레이터 사용):

```bash
npx firebase emulators:start --only auth,firestore --project demo-mlc
VITE_FIREBASE_API_KEY=demo-key VITE_FIREBASE_AUTH_DOMAIN=demo-mlc.firebaseapp.com VITE_FIREBASE_PROJECT_ID=demo-mlc VITE_FIREBASE_APP_ID=1:1:web:1 VITE_FIREBASE_EMULATOR=true npx vite --port 5174
BASE_URL=http://localhost:5174 npm run test:cloud
```

Playwright + Chromium이 필요합니다. 테스트는 `?debug=1`일 때만 노출되는 `window.__game` 훅을 사용하며, 일반 플레이어 화면에는 디버그 UI가 없습니다.

## Android APK

사전 준비: JDK 21, Android SDK(`platforms;android-36`, `build-tools;36.0.0`, `platform-tools`).

```bash
# android/local.properties 에 SDK 경로 지정 (git에 올리지 않음)
echo "sdk.dir=/path/to/android-sdk" > android/local.properties

npm run android:apk
# 결과: android/app/build/outputs/apk/debug/app-debug.apk
```

- Android Studio에서 열기: `npx cap open android`
- 웹 코드 수정 후 반영: `npm run cap:sync`
- 아이콘/스플래시 재생성: `node scripts/gen-android-assets.mjs`
- 디버그 빌드는 저장소의 고정 개발 키(`android/app/debug.keystore`, 비밀번호 `android`)로 서명됩니다. 어디서 빌드해도 서명이 같아 **덮어쓰기 업데이트**가 되고, Firebase에 등록할 SHA-1도 고정입니다(`63:C0:84:CC:DE:C8:90:2E:32:07:54:2A:77:43:CB:42:8C:C7:BF:BE`). 이 키는 공개돼 있으므로 개발용으로만 쓰세요.
- Google 로그인을 폰에서 쓰려면 `android/app/google-services.json`이 필요합니다 ([docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) 5단계).
- **출시용(release) APK/AAB**는 서명 키가 필요합니다. 키스토어(`*.jks`)는 저장소에 올리지 말고(.gitignore 처리됨) Android Studio의 *Build > Generate Signed Bundle/APK* 또는 CI 시크릿으로 관리하세요.

## 배포 (Vercel)

`vercel.json`이 포함되어 있어 Vercel이 Vite 프로젝트로 인식합니다.

1. Vercel 대시보드 → *Add New Project* → GitHub 저장소 `my_little_cafe` 선택
2. Framework: Vite (자동), Build Command `npm run build`, Output `dist` (vercel.json에 지정됨)
3. *Settings → Environment Variables*에 아래 변수를 필요 시 등록
4. Deploy

### 환경 변수

| 변수 | 용도 | 기본값 |
|---|---|---|
| `VITE_APP_VERSION` | 설정 화면 버전 표기 | `0.1.0` |
| `VITE_ENABLE_DEBUG` | `true`면 디버그 훅 상시 노출 (운영에서는 `false`) | `false` |
| `VITE_FIREBASE_API_KEY` | Firebase 웹 앱 설정값 (공개 식별자) | (비움 = 계정 기능 숨김) |
| `VITE_FIREBASE_AUTH_DOMAIN` | 〃 | (비움) |
| `VITE_FIREBASE_PROJECT_ID` | 〃 | (비움) |
| `VITE_FIREBASE_APP_ID` | 〃 | (비움) |
| `VITE_FIREBASE_EMULATOR` | `true`면 로컬 Firebase 에뮬레이터 사용 (테스트 전용) | `false` |

- 로컬: `.env.example`을 `.env`로 복사해 사용. `.env`는 `.gitignore`로 커밋되지 않습니다.
- `VITE_` 접두사 변수는 **브라우저 번들에 그대로 포함**되므로 비밀 키를 넣으면 안 됩니다. 서버 비밀 값이 필요해지면 별도 백엔드(서버리스 함수 등)에서 처리해야 합니다.

## 알려진 제한 및 로드맵

| 항목 | 상태 |
|---|---|
| 2층·루프탑 확장 | 미구현(다층 맵·계단 이동 필요). UI에 노출하지 않음 |
| 친구 교류 | 미구현. 싱글 플레이 전용, 저장 구조만 분리 |
| 클라우드 저장·계정 | 구현됨(Firebase). 실제 Firebase 프로젝트 연결과 Android 네이티브 Google 로그인은 실기기 확인 필요 |
| 영업 중 새로고침 | 진행 중이던 하루(손님·제조 중 메뉴)는 저장되지 않고 영업 전 상태로 돌아감. 재화·성장·꾸미기는 유지 |
| 실기기 검증 | APK 빌드는 성공했으나 실제 Android 기기/에뮬레이터 실행 검증은 아직 하지 않음 |

## 라이선스

- three.js — MIT
- Capacitor — MIT
- Firebase JS SDK — Apache-2.0 · @capacitor-firebase/authentication — Apache-2.0
- BM JUA 폰트(@fontsource/jua) — SIL Open Font License 1.1
- 게임 코드·그래픽·사운드: 이 저장소에서 직접 작성/생성
