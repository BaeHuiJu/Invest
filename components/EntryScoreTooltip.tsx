import { useState } from 'react';

interface EntryScoreBreakdown {
  priceVsBase: number;
  targetGap: number;
  reportCount: number;
  consensusStrength: number;
}

interface EntryScoreTooltipProps {
  score: number;
  breakdown: EntryScoreBreakdown;
  size?: 'sm' | 'md';
}

const scoreComponents = [
  {
    key: 'priceVsBase' as const,
    label: '기준가 대비 할인',
    maxScore: 30,
    description: '현재가가 리포트 발행일 기준가보다 낮을수록 높은 점수',
    color: 'bg-blue-500',
  },
  {
    key: 'targetGap' as const,
    label: '목표가까지 여력',
    maxScore: 35,
    description: '목표가가 높을수록 상승 여력이 크므로 높은 점수',
    color: 'bg-green-500',
  },
  {
    key: 'reportCount' as const,
    label: '리포트 수',
    maxScore: 15,
    description: '많을수록 분석이 충분하므로 신뢰도 높음',
    color: 'bg-yellow-500',
  },
  {
    key: 'consensusStrength' as const,
    label: '공통추천 강도',
    maxScore: 20,
    description: '여러 증권사가 동의할수록 높은 점수',
    color: 'bg-purple-500',
  },
];

export function EntryScoreTooltip({ score, breakdown, size = 'md' }: EntryScoreTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const tooltipWidth = size === 'sm' ? 'w-72' : 'w-80';

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-all"
        style={{ width: size === 'sm' ? '20px' : '24px', height: size === 'sm' ? '20px' : '24px' }}
        aria-label="Entry Score 설명"
      >
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ${tooltipWidth} z-50`}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="rounded-lg border bg-white p-4 shadow-xl">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between border-b pb-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Entry Score</div>
                <div className="text-xs text-gray-500">매수 타이밍 점수 (0-100점)</div>
              </div>
              <div className="text-2xl font-bold text-blue-600">{score}점</div>
            </div>

            {/* Score Components */}
            <div className="space-y-3">
              {scoreComponents.map((component) => {
                const value = breakdown[component.key];
                const percentage = (value / component.maxScore) * 100;

                return (
                  <div key={component.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700">{component.label}</span>
                      <span className="text-gray-500">
                        {value}/{component.maxScore}점
                      </span>
                    </div>
                    <div className="mb-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full transition-all ${component.color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500">{component.description}</div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-3 border-t pt-2 text-xs text-gray-500">
              <div className="mb-1 font-medium text-gray-700">점수 기준</div>
              <ul className="space-y-0.5">
                <li>• 80점 이상: 강력한 매수 신호</li>
                <li>• 70-79점: 양호한 매수 타이밍</li>
                <li>• 70점 미만: 관망 권장</li>
              </ul>
            </div>
          </div>
          {/* Arrow */}
          <div className="absolute left-1/2 top-full -translate-x-1/2">
            <div className="border-8 border-transparent border-t-white" style={{ filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.1))' }} />
          </div>
        </div>
      )}
    </div>
  );
}
