# 마이리틀마운틴

산을 등산로로 걸어 다니고, 중턱 펜션에서 쉬고, 옆 텃밭에서 농사를 짓는 2D 탑뷰 웹 게임 (싱글 플레이 프로토타입).

- 접속: https://wsjeon92.github.io/my-little-mountain/
- 조작: 가고 싶은 곳을 누르면 등산로를 따라 걸어감 · 휠/두 손가락으로 확대·축소 · 오른쪽 아래 `지도`
- 장작: 길가 나무를 누르면 베어서 장작을 얻음(10분 뒤 다시 자람) · 펜션 벽난로에 넣으면 불이 켜짐
- 돌: 길가 바위를 캐서 돌을 얻고, 정상 돌탑에 올림
- 낚시: 계곡물을 누르고, 찌가 흔들릴 때 화면을 누름
- 요리: 펜션 주방 조리대에서 작물·물고기와 장작으로 요리 · 가방에서 먹으면 걸음이 빨라짐
- 카페: 펜션 위쪽 산마루 카페에서 공짜로 주문하고 앉아 쉼
- 가방: 오른쪽 위 `가방` 버튼
- 저장: 브라우저 localStorage (위치, 텃밭, 수확물)

업데이트 기록은 [CHANGELOG.md](CHANGELOG.md)에 날짜별로 정리한다.

## 개발

```bash
npm install
npm run dev      # 로컬 실행
npm run build    # dist/ 생성
```

`main` 브랜치에 push 하면 GitHub Actions 가 빌드해서 GitHub Pages 에 배포한다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `src/items.ts` | 가방에 들어가는 물건 정의 |
| `src/state.ts` | 게임 상태와 상태를 바꾸는 유일한 통로(`actions`). 멀티 유저 전환 시 이 부분만 서버로 옮긴다 |
| `src/mapgen.ts` | 산 지도 생성(고도, 등산로 그래프, 계곡, 마당, 텃밭). 화면과 무관한 순수 계산 |
| `src/pathfind.ts` | 격자 최단 경로(A*) |
| `src/art.ts` | 모든 그림을 코드로 그려 텍스처로 등록 |
| `src/cairn.ts` | 정상 돌탑의 모양 계산과 그리기 |
| `src/BaseScene.ts` | 클릭 이동, 확대·축소 등 공통 동작 |
| `src/MountainScene.ts` | 산, 건물 외관, 텃밭, 채집, 낚시, 돌탑 |
| `src/RoomScene.ts` | 실내 지도 공통 동작 |
| `src/PensionScene.ts` | 펜션 실내(거실·주방) |
| `src/CafeScene.ts` | 카페 실내 |
| `src/hud.ts` | 화면 위 글자·버튼·가방·미니맵(HTML) |
