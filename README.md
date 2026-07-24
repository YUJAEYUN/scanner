# Scan → PDF

카메라 앱처럼 사진을 찍기만 하면, 그 자리에서 스캔된 PDF로 만들어주는 모바일 웹 앱입니다.

## 로컬에서 테스트하기

카메라 권한은 HTTPS(또는 localhost)에서만 동작합니다.

```bash
npx serve .
# 또는
python3 -m http.server 5173
```

`http://localhost:포트`로 접속해서 테스트하세요. 실제 휴대폰으로 테스트하려면 HTTPS로 배포 후 URL로 접속하는 게 가장 확실합니다.

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
