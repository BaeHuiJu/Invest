import { useState, useEffect } from 'react';

const STORAGE_KEY = 'beginner_onboarding_dismissed_v1';

const STEPS = [
  {
    num: '1',
    color: 'bg-blue-500',
    icon: '🤖',
    title: 'AI추천 탭 열기',
    desc: 'Entry Score 70점 이상, 2개 이상 증권사가 추천한 종목이 자동으로 정리됩니다.',
    tab: 'AI추천',
  },
  {
    num: '2',
    color: 'bg-emerald-500',
    icon: '📌',
    title: '종목 선택 & 매수',
    desc: '리스크 낮음(Low) 종목 위주로 권장 비중(5~15%)만큼 매수합니다.',
    tab: '',
  },
  {
    num: '3',
    color: 'bg-violet-500',
    icon: '📊',
    title: '포트폴리오에서 추적',
    desc: '"매수 기록" 버튼을 누르면 P&L, 목표가 진행률, 매도 신호를 자동으로 알려줍니다.',
    tab: '포트폴리오',
  },
];

export function BeginnerOnboarding({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* noop */ }
    setVisible(false);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 p-5 text-white shadow-xl">
      {/* 닫기 */}
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        aria-label="닫기"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-blue-300">처음이신가요?</div>
        <h3 className="mt-1 text-lg font-bold">3단계로 주식 투자 시작하기</h3>
        <p className="mt-0.5 text-sm text-slate-400">
          애널리스트 추천 데이터를 AI가 분석해 최적 종목을 골라드립니다.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={i} className="flex gap-3 rounded-xl bg-white/5 p-3 backdrop-blur">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${step.color} text-sm font-bold`}>
              {step.num}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{step.icon}</span>
                <span className="text-sm font-semibold">{step.title}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{step.desc}</p>
              {step.tab && onNavigate && (
                <button
                  onClick={() => { onNavigate(step.tab); dismiss(); }}
                  className="mt-2 text-[11px] font-medium text-blue-300 hover:text-blue-200 hover:underline"
                >
                  → {step.tab} 탭 바로가기
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-slate-500">
          ⚠️ 투자 결과는 보장되지 않습니다. 반드시 본인 판단하에 투자하세요.
        </p>
        <button onClick={dismiss} className="text-xs text-slate-500 hover:text-slate-300">
          다시 보지 않기
        </button>
      </div>
    </div>
  );
}
