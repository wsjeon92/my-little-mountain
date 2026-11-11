# 마이리틀마운틴

산을 등산로로 걸어 다니고, 중턱 펜션에서 쉬고, 옆 텃밭에서 농사를 짓는 2D 탑뷰 웹 게임 (싱글 플레이 프로토타입).

- 접속: https://wsjeon92.github.io/my-little-mountain/
- 조작: 가고 싶은 곳을 누르면 등산로를 따라 걸어감 · 휠/두 손가락으로 확대·축소 · 오른쪽 아래 `지도`
- 장작: 길가 나무를 누르면 베어서 장작을 얻음(10분 뒤 다시 자람) · 펜션 벽난로에 넣으면 불이 켜짐
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
| `src/state.ts` | 게임 상태와 상태를 바꾸는 유일한 통로(`actions`). 멀티 유저 전환 시 이 부분만 서버로 옮긴다 |
| `src/mapgen.ts` | 산 지도 생성(고도, 등산로 그래프, 계곡, 마당, 텃밭). 화면과 무관한 순수 계산 |
| `src/pathfind.ts` | 격자 최단 경로(A*) |
| `src/art.ts` | 모든 그림을 코드로 그려 텍스처로 등록 |
| `src/BaseScene.ts` | 클릭 이동, 확대·축소 등 공통 동작 |
| `src/MountainScene.ts` | 산, 펜션 외관, 텃밭 |
| `src/InteriorScene.ts` | 펜션 실내 |
| `src/hud.ts` | 화면 위 글자·버튼·미니맵(HTML) |
