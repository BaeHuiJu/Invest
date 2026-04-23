import Head from 'next/head'

export default function Offline() {
  return (
    <>
      <Head>
        <title>오프라인 - 글로벌픽</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center p-8 max-w-md">
          <div className="mb-6">
            <svg
              className="mx-auto h-24 w-24 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-c-text mb-4">
            인터넷 연결이 필요합니다
          </h1>

          <p className="text-c-text-2 mb-8">
            현재 오프라인 상태입니다. 글로벌픽의 최신 데이터를 보려면 인터넷에 연결해주세요.
          </p>

          <div className="space-y-4">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              다시 시도
            </button>

            <div className="text-sm text-c-text-2">
              <p>💡 팁: 연결되면 자동으로 업데이트됩니다</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
