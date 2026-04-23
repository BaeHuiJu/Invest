import { useState } from 'react';

interface GlossaryTerm {
  term: string;
  definition: string;
  example?: string;
  category: 'price' | 'score' | 'recommendation' | 'risk';
}

const glossaryTerms: GlossaryTerm[] = [
  {
    term: '목표가 (Target Price)',
    definition: '애널리스트가 예상하는 미래의 주가입니다. 일반적으로 6~12개월 후의 예상 가격을 의미합니다.',
    example: '현재가 10,000원, 목표가 15,000원 → 50% 상승 여력',
    category: 'price',
  },
  {
    term: '기준가 (Base Price)',
    definition: '애널리스트가 리포트를 발행한 날의 종가입니다. 목표가와 기준가의 차이로 애널리스트의 기대 수익률을 계산합니다.',
    example: '리포트 발행일 2024-01-15 종가 10,000원 → 기준가',
    category: 'price',
  },
  {
    term: '현재가 (Current Price)',
    definition: '지금 시점의 최신 주가입니다. 실시간으로 변동하며, 목표가와 비교하여 상승여력을 계산합니다.',
    example: '실시간 주가 9,500원 → 현재가',
    category: 'price',
  },
  {
    term: '상승여력 (Upside Potential)',
    definition: '현재가 대비 목표가까지 올라갈 수 있는 여력(%)입니다. 높을수록 더 많은 수익을 기대할 수 있습니다.',
    example: '현재가 10,000원, 목표가 15,000원 → 상승여력 50%',
    category: 'price',
  },
  {
    term: 'Entry Score (진입 점수)',
    definition: '현재 매수하기 좋은 타이밍인지를 0-100점으로 나타낸 점수입니다. 기준가 대비 할인율, 목표가까지 여력, 리포트 수, 컨센서스 강도를 종합하여 계산합니다.',
    example: '80점 이상: 강력한 매수 신호 / 70-79점: 양호 / 70점 미만: 관망',
    category: 'score',
  },
  {
    term: '공통추천 / 컨센서스 (Consensus)',
    definition: '2개 이상의 증권사가 동시에 매수 추천하는 종목입니다. 여러 전문가의 의견이 일치할수록 신뢰도가 높습니다.',
    example: '삼성증권, 한화투자증권, 신한투자증권 모두 매수 추천 → 컨센서스 3',
    category: 'recommendation',
  },
  {
    term: '증권사 (Brokerage Firm)',
    definition: '주식 리서치 리포트를 발행하는 금융 기관입니다. 삼성증권, 미래에셋증권, KB증권 등이 있습니다.',
    example: '삼성증권이 삼성전자 목표가 90,000원으로 상향 조정',
    category: 'recommendation',
  },
  {
    term: '리포트 (Research Report)',
    definition: '증권사 애널리스트가 특정 종목을 분석하여 작성한 보고서입니다. 투자 의견, 목표가, 매수/매도 추천 등이 포함됩니다.',
    example: '"카카오 목표가 70,000원, 투자의견 매수(BUY)" - 삼성증권',
    category: 'recommendation',
  },
  {
    term: '리스크 레벨 (Risk Level)',
    definition: '투자 위험도를 낮음/보통/높음으로 분류합니다. Entry Score와 상승여력을 기반으로 자동 계산됩니다.',
    example: 'Entry Score 80+, 상승여력 30% 이하 → 낮은 리스크',
    category: 'risk',
  },
  {
    term: '포지션 사이징 (Position Sizing)',
    definition: '전체 포트폴리오에서 해당 종목에 투자할 비중(%)입니다. 리스크 레벨에 따라 5-15% 범위로 자동 권장됩니다.',
    example: '높은 리스크 종목 → 포트폴리오의 5% / 낮은 리스크 종목 → 10-15%',
    category: 'risk',
  },
  {
    term: '투자 기간 (Time Horizon)',
    definition: '목표가 도달까지 예상되는 기간입니다. 상승여력이 클수록 더 긴 기간이 필요합니다.',
    example: '상승여력 30% 이하 → 1-3개월 / 30% 초과 → 3-12개월',
    category: 'risk',
  },
  {
    term: '괴리율 (Gap Ratio)',
    definition: '현재가와 목표가 사이의 거리를 백분율로 나타낸 것입니다. 상승여력과 유사한 개념입니다.',
    example: '목표가 15,000원, 현재가 10,000원 → 괴리율 50%',
    category: 'price',
  },
];

const categories = [
  { key: 'all', label: '전체' },
  { key: 'price', label: '가격/수익률' },
  { key: 'score', label: '점수/평가' },
  { key: 'recommendation', label: '추천/리포트' },
  { key: 'risk', label: '리스크/포지션' },
] as const;

export function GlossaryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'price' | 'score' | 'recommendation' | 'risk'>('all');

  if (!isOpen) return null;

  const filteredTerms = glossaryTerms.filter((term) => {
    const matchesSearch =
      searchQuery === '' ||
      term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      term.definition.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || term.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-c-surface shadow-2xl">
        {/* Header */}
        <div className="border-b border-c-border bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">금융 용어 사전</h2>
              <p className="mt-1 text-sm text-blue-100">
                주식 투자에 필요한 기본 용어를 쉽게 설명합니다
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white transition hover:bg-white/20"
              aria-label="닫기"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mt-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="용어 검색..."
              className="w-full rounded-lg border-0 bg-white/90 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <svg
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Category Filters */}
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  selectedCategory === cat.key
                    ? 'bg-white text-blue-700'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-280px)] overflow-y-auto p-6">
          {filteredTerms.length === 0 ? (
            <div className="py-12 text-center text-c-text-3">
              <svg className="mx-auto mb-4 h-16 w-16 text-c-text-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-lg font-medium text-c-text-2">검색 결과가 없습니다</p>
              <p className="mt-1 text-sm text-c-text-3">다른 검색어를 입력해보세요</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTerms.map((term, index) => (
                <article
                  key={index}
                  className="rounded-lg border border-c-border bg-c-surface-2 p-4 transition hover:border-c-accent hover:bg-c-accent-bg"
                >
                  <h3 className="text-lg font-bold text-c-text">{term.term}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-c-text-2">{term.definition}</p>
                  {term.example && (
                    <div className="mt-3 rounded bg-c-surface p-3 text-sm text-c-text-2">
                      <div className="mb-1 font-medium text-c-text">💡 예시</div>
                      {term.example}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-c-border bg-c-surface-2 p-4 text-center text-xs text-c-text-2">
          총 {glossaryTerms.length}개 용어 | 검색 결과 {filteredTerms.length}개
        </div>
      </div>
    </div>
  );
}
