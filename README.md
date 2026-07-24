# Scan → PDF

카메라 앱처럼 사진을 찍기만 하면, 그 자리에서 스캔된 PDF로 만들어주는 모바일 웹 앱입니다.
빌드 과정이 필요 없는 순수 정적 사이트(HTML/CSS/JS)라 Vercel에 그대로 올리면 됩니다.

## 동작 방식

- `navigator.mediaDevices.getUserMedia`로 후면 카메라 실시간 미리보기를 띄웁니다.
- 촬영 버튼을 누를 때마다 현재 프레임을 캔버스에 그린 뒤, 밝기/대비를 스캔 문서처럼 보정합니다
  (흑백 모드는 대비를 크게 올려 텍스트가 선명하게, 컬러 모드는 화이트밸런스 느낌으로 보정).
- 촬영한 사진은 순서대로 필름스트립에 쌓이고, "완료"를 누르면 리뷰 화면에서 순서 변경(길게 눌러 드래그)·삭제가 가능합니다.
- "PDF로 저장"을 누르면 [jsPDF](https://github.com/parys/jsPDF)로 각 사진을 한 페이지씩 원본 비율 그대로 추가해 PDF를 만들고, 기기에 바로 다운로드합니다.
- 모든 처리가 브라우저 안에서 끝나기 때문에 서버나 별도 백엔드가 필요 없습니다.

## 로컬에서 테스트하기

카메라 권한은 HTTPS(또는 localhost)에서만 동작합니다.

```bash
npx serve .
# 또는
python3 -m http.server 5173
```

`http://localhost:포트`로 접속해서 테스트하세요. 실제 휴대폰으로 테스트하려면 배포 후 URL로 접속하는 게 가장 확실합니다.

## Vercel로 배포하기

### 방법 A — Vercel CLI (가장 빠름)

```bash
npm i -g vercel   # 처음 한 번만
cd scan-pdf-app
vercel            # 질문에 기본값으로 답하면 됩니다 (Framework: Other)
vercel --prod     # 프로덕션 배포
```

### 방법 B — GitHub 연동

1. 이 폴더를 GitHub 저장소로 push합니다.
2. [vercel.com](https://vercel.com) → **Add New → Project** → 저장소 선택.
3. Framework Preset은 **Other**로 두고 Build Command/Output Directory는 비워둡니다 (정적 파일이라 빌드가 필요 없음).
4. Deploy를 누르면 끝입니다. 이후 GitHub에 push할 때마다 자동 배포됩니다.

배포되면 `https://프로젝트명.vercel.app` 같은 HTTPS 주소가 생기고, 휴대폰 브라우저(Chrome/Safari)로 접속해 카메라 권한을 허용하면 바로 사용할 수 있습니다.

## 파일 구조

```
scan-pdf-app/
├── index.html   # 화면 구조 (촬영 / 리뷰 / 완료 3단계)
├── style.css    # 다크 뷰파인더 UI, 스캔빔 연출
├── app.js       # 카메라 제어, 스캔 보정 필터, 순서변경, PDF 생성
└── README.md
```

## 커스터마이징 포인트

- **보정 강도**: `app.js`의 `applyScanFilter()` 함수에서 대비 계수(`1.25`), 밝기 오프셋(`+12`) 값을 조절하면 됩니다.
- **JPEG 화질/용량**: `canvas.toDataURL('image/jpeg', 0.86)`의 `0.86`이 화질입니다. 20장 기준 파일 용량을 줄이려면 `0.7~0.8` 정도로 낮추세요.
- **자동 테두리 인식(퍼스펙티브 보정)**: 지금 버전은 밝기/대비 보정만 하고, 종이 가장자리를 자동으로 찾아 반듯하게 펴주는 기능(CamScanner류)은 포함하지 않았습니다. 이 기능을 넣으려면 OpenCV.js로 윤곽선(contour) 검출 + `warpPerspective`를 추가해야 하는데, 원하시면 이어서 작업해드릴 수 있어요.
- **카메라 접근 실패 시 대체 수단**: `getUserMedia`가 실패하거나 지원하지 않는 브라우저에서는 자동으로 `<input type="file" capture="environment">` 방식의 사진 선택 버튼이 노출됩니다.
