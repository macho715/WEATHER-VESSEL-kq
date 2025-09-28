"use client"

import { useEffect } from "react"

export default function LogisticsControlTower() {
  useEffect(() => {
    // Redirect to the static HTML file
    window.location.href = "/logistics-app.html"
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-400 mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold text-white mb-2">물류 관제탑 v2.5</h1>
        <p className="text-slate-400">해상 운영 대시보드를 로딩 중...</p>
        <p className="text-xs text-slate-500 mt-4">잠시만 기다려주세요. 곧 관제탑으로 이동합니다.</p>
      </div>
    </div>
  )
}
