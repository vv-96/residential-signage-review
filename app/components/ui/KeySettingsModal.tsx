"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "./Modal";
import { FormField } from "./FormField";
import { Button } from "./Button";
import {
  PRESET_PROVIDERS,
  providerIdForBaseURL,
  getModelConfig,
  setModelConfig,
  clearModelConfig,
  maskApiKey,
  isValidKey,
  isValidBaseURL,
} from "../../lib/model-config";

type ToastTone = "success" | "error" | "warning" | "info";

/**
 * 模型配置设置弹窗（支持任意 OpenAI 兼容视觉模型）。
 * Toast 由父级统一持有（useToast 是每组件独立 hook，弹窗内再 useToast 会产生
 * 两条 Toast），通过 showToast 回调。父级用 key 控制每次打开重建组件（见
 * page.tsx），因此 useState 惰性初始化在每次打开时重新执行（回填已保存配置）。
 */
export function KeySettingsModal({ open, onClose, onSaved, showToast }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  showToast: (message: string, tone?: ToastTone) => void;
}) {
  // 渲染时读取当前配置（打开时为最新值；SSR/关闭时 open=false 短路不读）
  const current = open ? getModelConfig() : null;

  // 惰性初始化：父级 key 重建 → 每次打开都回填已保存的配置
  const [providerId, setProviderId] = useState<string>(() => (current ? providerIdForBaseURL(current.baseURL) : "custom"));
  const [baseURL, setBaseURL] = useState<string>(() => current?.baseURL ?? "");
  const [modelName, setModelName] = useState<string>(() => current?.modelName ?? "");
  const [keyInput, setKeyInput] = useState<string>(() => current?.apiKey ?? "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState("");

  function handleProviderChange(id: string) {
    setProviderId(id);
    if (id === "custom") {
      setBaseURL("");
      setModelName("");
    } else {
      const preset = PRESET_PROVIDERS.find((item) => item.id === id);
      if (preset) {
        setBaseURL(preset.baseURL);
        setModelName(preset.model);
      }
    }
    setError("");
  }

  function handleSave() {
    const trimmedBase = baseURL.trim();
    if (!isValidBaseURL(trimmedBase)) { setError("Base URL 格式不正确：应以 http(s):// 开头。"); return; }
    if (!modelName.trim()) { setError("模型名称不能为空。"); return; }
    if (!isValidKey(keyInput)) { setError("密钥格式不正确：长度应不少于 16 位。"); return; }
    setSaving(true);
    try {
      setModelConfig({ baseURL: trimmedBase, apiKey: keyInput.trim(), modelName: modelName.trim() });
      showToast("模型配置已保存", "success");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    clearModelConfig();
    setKeyInput("");
    setError("");
    setTestResult(null);
    showToast("模型配置已清除", "success");
    onSaved();
  }

  /** 2026-08-16 新增：一键测试模型连通性（调用 /api/test-model，验证 Base URL/密钥/模型可达） */
  async function handleTest() {
    const trimmedBase = baseURL.trim();
    if (!isValidBaseURL(trimmedBase)) { setTestResult({ ok: false, message: "Base URL 格式不正确。" }); return; }
    if (!modelName.trim()) { setTestResult({ ok: false, message: "模型名称不能为空。" }); return; }
    if (!isValidKey(keyInput)) { setTestResult({ ok: false, message: "密钥格式不正确（长度≥16）。" }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/test-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": keyInput.trim(),
          "x-api-base": trimmedBase,
          "x-api-model": modelName.trim(),
        },
      });
      const data = (await res.json()) as { ok: boolean; latencyMs?: number; status?: number; error?: string; response?: string };
      if (data.ok) {
        setTestResult({ ok: true, message: `连通正常（${data.latencyMs ?? "?"}ms，HTTP ${data.status ?? "?"}）` });
      } else {
        setTestResult({ ok: false, message: `失败：${data.error || "未知错误"}（HTTP ${data.status ?? "?"}）` });
      }
    } catch (e) {
      setTestResult({ ok: false, message: `网络请求失败：${e instanceof Error ? e.message : "未知"}` });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Modal
      title="模型配置设置"
      eyebrow="AI 模型"
      width="md"
      open={open}
      onClose={onClose}
      footer={
        <ModalFooter>
          {current ? <Button variant="danger" size="sm" onClick={handleClear}>清除配置</Button> : null}
          <span style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={onClose}>取消</Button>
          <Button variant="secondary" size="sm" loading={testing} onClick={handleTest}>测试连接</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>保存</Button>
        </ModalFooter>
      }
    >
      <div className="key-settings-body">
        <p className="key-settings-status">
          {current ? <>当前已设置：<strong className="key-status-set">{current.modelName} · {maskApiKey(current.apiKey)}</strong></> : "当前未设置模型"}
        </p>
        {testResult && (
          <p className={`key-test-result ${testResult.ok ? "key-test-ok" : "key-test-fail"}`} role="status">
            {testResult.ok ? "✓ " : "✗ "}{testResult.message}
          </p>
        )}
        <FormField label="服务商" htmlFor="provider-select" hint="选择预置服务商会自动填入 Base URL 和默认模型名，可再修改。">
          <select id="provider-select" value={providerId} onChange={(event) => handleProviderChange(event.target.value)}>
            {PRESET_PROVIDERS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            <option value="custom">自定义（手动填写）</option>
          </select>
        </FormField>
        <FormField label="Base URL" required htmlFor="base-url-input" hint="模型服务的 API 根地址，如 https://api.moonshot.cn/v1。">
          <input id="base-url-input" type="text" value={baseURL} placeholder="https://..." autoComplete="off"
            onChange={(event) => { setBaseURL(event.target.value); if (error) setError(""); }} />
        </FormField>
        <FormField label="模型名称" required htmlFor="model-name-input" hint="如 kimi-k2.6 / qwen-vl-max / gpt-4o，需支持图片输入。">
          <input id="model-name-input" type="text" value={modelName} placeholder="kimi-k2.6" autoComplete="off"
            onChange={(event) => { setModelName(event.target.value); if (error) setError(""); }} />
        </FormField>
        <FormField label="API 密钥" required htmlFor="api-key-input" hint="密钥仅保存在当前浏览器，解析时通过请求头发送，不会上传服务器。">
          <input id="api-key-input" type="password" value={keyInput} placeholder="sk-... / id.secret... / UUID" autoComplete="off"
            onChange={(event) => { setKeyInput(event.target.value); if (error) setError(""); }} />
        </FormField>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
      </div>
    </Modal>
  );
}
