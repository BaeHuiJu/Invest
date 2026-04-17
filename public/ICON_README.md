# PWA 아이콘 생성 가이드

현재 `icon.svg` 파일이 생성되어 있습니다. 실제 앱에서 사용하려면 PNG 파일로 변환해야 합니다.

## 자동 변환 방법

### 옵션 1: 온라인 도구 사용
1. https://www.pwabuilder.com/imageGenerator 방문
2. `icon.svg` 업로드
3. 모든 사이즈 자동 생성 (192x192, 512x512 등)
4. 다운로드하여 `public/` 폴더에 배치

### 옵션 2: npm 패키지 사용
```bash
npm install -g pwa-asset-generator
pwa-asset-generator public/icon.svg public --icon-only --padding "10%"
```

### 옵션 3: ImageMagick 사용
```bash
# 설치 (Windows)
choco install imagemagick

# 변환
magick convert public/icon.svg -resize 192x192 public/icon-192x192.png
magick convert public/icon.svg -resize 512x512 public/icon-512x512.png
```

## 필요한 파일 목록

- `icon-192x192.png` - Android 홈 스크린
- `icon-512x512.png` - Android 스플래시 스크린
- `apple-touch-icon.png` - iOS 홈 스크린 (180x180)
- `favicon.ico` - 브라우저 탭 아이콘

## 디자인 가이드

### 현재 디자인
- 배경: 파란색 (#3b82f6)
- 아이콘: 차트 + 지구본 조합
- 텍스트: "글로벌픽"

### 커스터마이징
필요하다면 Figma, Canva, Adobe Illustrator 등에서 새로운 디자인을 만들 수 있습니다.

**권장 사항:**
- 단순하고 인식하기 쉬운 디자인
- 작은 크기(48x48)에서도 명확하게 보여야 함
- 브랜드 컬러 사용 (#3b82f6)
- Safe area: 가장자리에서 10% 여백 확보

## 빠른 테스트용

현재 SVG 파일만으로도 일부 기능은 작동합니다. 하지만 프로덕션 배포 전에는 반드시 PNG 파일을 생성해야 합니다.

임시로 아무 PNG 이미지를 다음 이름으로 저장해도 됩니다:
- `public/icon-192x192.png`
- `public/icon-512x512.png`
- `public/apple-touch-icon.png`
