# 트러블슈팅 이력

## 2026-03-26

### 이슈 1: matplotlib 미설치로 인한 ImportError

**증상:**
```
ImportError: background_gradient requires matplotlib.
```

애널리스트 추천매수 화면에서 pandas DataFrame의 `style.background_gradient()` 메서드 사용 시 발생

**원인:**
- pandas의 스타일링 기능 중 `background_gradient()`는 matplotlib을 필요로 함
- matplotlib이 requirements.txt에 포함되지 않아 미설치 상태였음

**해결:**
```bash
pip install matplotlib
```

**조치 사항:**
- requirements.txt에 matplotlib 추가 필요

---

### 이슈 2: Python 3.13 환경에서 numpy 버전 충돌

**증상:**
```
error: metadata-generation-failed
numpy_12e03db06f784194947858c9eb7a92ff\.mesonpy-yw5p385s\meson-logs\meson-log.txt
ERROR: Unknown compiler(s): [['icl'], ['cl'], ['cc'], ['gcc'], ['clang'], ['clang-cl'], ['pgcc']]
```

**원인:**
- Python 3.13에서 numpy 1.26.4 빌드 시 C 컴파일러 필요
- yfinance, pykrx가 numpy<2.0을 요구하지만 Python 3.13에서는 numpy 2.x만 바이너리 휠 제공

**해결:**
```bash
# numpy 2.x 먼저 설치 (바이너리 휠 사용)
pip install numpy pandas streamlit plotly

# yfinance는 --no-deps로 설치 후 의존성 별도 설치
pip install yfinance --no-deps
pip install multitasking platformdirs frozendict peewee curl_cffi websockets

# pykrx도 --no-deps로 설치
pip install pykrx --no-deps
pip install deprecated multipledispatch xlrd openpyxl
```

**주의:**
- pykrx가 numpy<2.0을 요구하지만 numpy 2.x에서도 기본 기능은 동작함
- 일부 고급 기능에서 호환성 문제 발생 가능

---

### 이슈 3: curl_cffi 버전 충돌

**증상:**
```
yfinance 1.2.0 requires curl_cffi<0.14,>=0.7, but you have curl-cffi 0.14.0 which is incompatible.
```

**원인:**
- pip이 자동으로 curl_cffi 최신 버전(0.14.0) 설치
- yfinance는 0.14 미만 버전 필요

**해결:**
```bash
pip install curl_cffi==0.13.0
```

---

## 권장 설치 순서

Python 3.13 환경에서 안정적인 설치를 위한 순서:

```bash
# 1. 핵심 패키지 (바이너리 휠)
pip install numpy pandas streamlit plotly matplotlib

# 2. yfinance (의존성 분리 설치)
pip install yfinance --no-deps
pip install multitasking platformdirs frozendict peewee websockets
pip install curl_cffi==0.13.0

# 3. pykrx (의존성 분리 설치)
pip install pykrx --no-deps
pip install deprecated multipledispatch xlrd openpyxl

# 4. 기타
pip install beautifulsoup4 lxml requests
```

---

## 환경 정보

- **OS:** Windows
- **Python:** 3.13.3
- **발생일:** 2026-03-26
