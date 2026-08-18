"use client";

import { useEffect, useState } from "react";

type ToastTone = "info" | "success" | "warning" | "error";

export function useToast() {
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(null);

  const show = (message: string, tone: ToastTone = "info") => {
    setToast({ id: Date.now(), message, tone });
  };

  useEffect(() => {
    if (!toast) return;
    // 2026-08-16 由 3000 延长至 10000：流程错误提示（如"请先设置模型配置"）不再一闪而过，便于用户看到
    const timer = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(timer);
  }, [toast]);

  const ToastHost = toast ? (
    <div className={`toast toast-${toast.tone}`} role="status" key={toast.id}>
      {toast.message}
    </div>
  ) : null;

  return { show, ToastHost };
}
